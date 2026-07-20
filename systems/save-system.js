// Dream Realms save system foundation
// Owns world save/load/reset/export/import plumbing for future in-game editors.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  const WORLD_STORAGE_KEY = 'dream-realms.world.v1';
  const WORLD_BACKUP_STORAGE_KEY = 'dream-realms.world.backup.v1';
  const WORLD_CORRUPT_STORAGE_KEY = 'dream-realms.world.corrupt.v1';
  const CHARACTER_STORAGE_KEY = 'dream-realms.character.v1'; // legacy import/export mirror only; not a primary save owner.
  const CHARACTER_BACKUP_STORAGE_KEY = 'dream-realms.character.backup.v1';
  const ACCOUNT_STORAGE_KEY = 'dream-realms.accounts.v1';
  const ACCOUNT_BACKUP_STORAGE_KEY = 'dream-realms.accounts.backup.v1';
  const ACCOUNT_CORRUPT_STORAGE_KEY = 'dream-realms.accounts.corrupt.v1';
  const ACCOUNT_SESSION_KEY = 'dream-realms.account.session.v1';
  const ACCOUNT_SAVE_SCHEMA = 'dream-realms-account-character-save-v2';
  const ACCOUNT_SAVE_FORMAT_VERSION = 2;
  // Phase 2 (Save/Migration Hardening): documents which account-document
  // schemas normalizeAccountsState() will accept without complaint. Mirrors
  // systems/world-serializer.js's SUPPORTED_SCHEMAS pattern. Unlike the
  // world save, an unrecognized schema is not rejected outright here - the
  // local account system stays lenient/best-effort (see normalizeAccountsState)
  // and only logs the drift, since silently losing local login access is a
  // worse outcome than a stale schema label.
  const ACCOUNT_SUPPORTED_SCHEMAS = new Set([ACCOUNT_SAVE_SCHEMA]);
  // Same idea for the individual character-save payload schema checked by
  // normalizeCharacterPayload(). Currently a single supported value; adding
  // a new schema here (plus a migration step in normalizeCharacterPayload)
  // is the seam a future character-save format change should use instead of
  // widening the equality check ad hoc.
  const CHARACTER_SUPPORTED_SCHEMAS = new Set(['dream-realms-character-save-v1']);
  const ACCOUNT_PASSWORD_HASH_METHOD = 'fnv1a-local-v1';
  const GAME_SAVE_FOLDER_NAME = 'Save';
  const SAVE_FOLDER_ACCOUNT_AUTOSAVE = 'Dream-Realms-Accounts.json';
  const SAVE_FOLDER_CHARACTER_AUTOSAVE = 'Dream-Realms-Character-Autosave.json'; // legacy folder import fallback only.
  const SAVE_FOLDER_WORLD_AUTOSAVE = 'Dream-Realms-World-Autosave.json';
  const SAVE_FOLDER_MANIFEST_URL = 'Save/save-folder-manifest.json';
  const SAVE_FOLDER_HANDLE_DB = 'dream-realms-save-folder-handle-v1';
  const SAVE_FOLDER_HANDLE_STORE = 'handles';
  const SAVE_FOLDER_HANDLE_KEY = 'save-folder-directory';
  const CHARACTER_AUTOSAVE_SECONDS = 15 * 60;
  const CHARACTER_SAVE_BUILD_VERSION = '0.15.77';
  const CHARACTER_SAVE_BUILD_NAME = 'Dream Realms V0.15.77 Bogling Amphibian Locomotion';

  function readLocal(key) {
    try { return window.localStorage ? window.localStorage.getItem(key) : null; }
    catch (_err) { return null; }
  }

  function writeLocal(key, value) {
    try {
      if (!window.localStorage) return false;
      window.localStorage.setItem(key, value);
      return true;
    } catch (_err) {
      return false;
    }
  }

  function removeLocal(key) {
    try {
      if (!window.localStorage) return false;
      window.localStorage.removeItem(key);
      return true;
    } catch (_err) {
      return false;
    }
  }


  function parseWorldJson(raw) {
    try { return { ok: true, payload: JSON.parse(raw) }; }
    catch (err) { return { ok: false, error: err?.message || 'invalid JSON' }; }
  }

  function backupCurrentWorldSave(reason = 'backup') {
    const raw = readLocal(WORLD_STORAGE_KEY);
    if (!raw) return false;
    const backup = {
      reason,
      backedUpAt: new Date().toISOString(),
      storageKey: WORLD_STORAGE_KEY,
      raw
    };
    return writeLocal(WORLD_BACKUP_STORAGE_KEY, JSON.stringify(backup));
  }

  function quarantineBadWorldSave(raw, reason = 'corrupt or unsupported save') {
    if (!raw) return false;
    const quarantine = {
      reason,
      quarantinedAt: new Date().toISOString(),
      storageKey: WORLD_STORAGE_KEY,
      raw: String(raw).slice(0, 2000000)
    };
    writeLocal(WORLD_CORRUPT_STORAGE_KEY, JSON.stringify(quarantine));
    removeLocal(WORLD_STORAGE_KEY);
    return true;
  }

  function migrateWorldPayload(payload) {
    if (!DR.WorldSerializer || typeof DR.WorldSerializer.migrate !== 'function') {
      return { ok: false, error: 'World serializer migration layer is unavailable.' };
    }
    return DR.WorldSerializer.migrate(payload);
  }

  function downloadText(filename, content, mime = 'application/json') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function openSaveFolderHandleDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { resolve(null); return; }
      const request = window.indexedDB.open(SAVE_FOLDER_HANDLE_DB, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SAVE_FOLDER_HANDLE_STORE)) db.createObjectStore(SAVE_FOLDER_HANDLE_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB unavailable.'));
    });
  }

  async function storeSaveFolderHandle(handle) {
    if (!handle) return false;
    const db = await openSaveFolderHandleDb().catch(() => null);
    if (!db) return false;
    return new Promise(resolve => {
      const tx = db.transaction(SAVE_FOLDER_HANDLE_STORE, 'readwrite');
      tx.objectStore(SAVE_FOLDER_HANDLE_STORE).put(handle, SAVE_FOLDER_HANDLE_KEY);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); resolve(false); };
      tx.onabort = () => { db.close(); resolve(false); };
    });
  }

  async function loadStoredSaveFolderHandle() {
    const db = await openSaveFolderHandleDb().catch(() => null);
    if (!db) return null;
    return new Promise(resolve => {
      const tx = db.transaction(SAVE_FOLDER_HANDLE_STORE, 'readonly');
      const request = tx.objectStore(SAVE_FOLDER_HANDLE_STORE).get(SAVE_FOLDER_HANDLE_KEY);
      request.onsuccess = () => { const value = request.result || null; db.close(); resolve(value); };
      request.onerror = () => { db.close(); resolve(null); };
      tx.onerror = () => { db.close(); resolve(null); };
      tx.onabort = () => { db.close(); resolve(null); };
    });
  }

  async function ensureDirectoryPermission(handle, mode = 'readwrite', requestIfNeeded = false) {
    if (!handle) return false;
    try {
      if (typeof handle.queryPermission !== 'function') return true;
      let permission = await handle.queryPermission({ mode });
      if (permission === 'granted') return true;
      if (!requestIfNeeded || typeof handle.requestPermission !== 'function') return false;
      permission = await handle.requestPermission({ mode });
      return permission === 'granted';
    } catch (_err) {
      return false;
    }
  }

  function isAccountSavePayload(payload) {
    return Boolean(payload && typeof payload === 'object' && !Array.isArray(payload) && payload.accounts && typeof payload.accounts === 'object');
  }

  function isCharacterSaveFilename(name = '') {
    return /^Dream-Realms-Character-[^/\\]+\.json$/i.test(String(name || ''));
  }

  function isAccountSaveFilename(name = '') {
    return String(name || '').toLowerCase() === SAVE_FOLDER_ACCOUNT_AUTOSAVE.toLowerCase();
  }

  async function fileToSaveCandidate(file, explicitName = '') {
    if (!file) return null;
    const filename = explicitName || file.name || 'SelectedSave.json';
    if (!/\.json$/i.test(filename)) return null;
    const text = await file.text();
    const payload = JSON.parse(text);
    return { filename, payload, modified: Number(file.lastModified || 0) };
  }


  function safeFilename(value) {
    return String(value || 'Adventurer')
      .trim()
      .replace(/[^a-z0-9 _.-]+/gi, '')
      .replace(/\s+/g, '-')
      .slice(0, 40) || 'Adventurer';
  }

  function cloneJson(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function finiteNumber(value, fallback = null) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clampFinite(value, min, max, fallback = min) {
    const n = finiteNumber(value, fallback);
    return Math.max(min, Math.min(max, n));
  }

  function normalizeRuntimeZone(value) {
    const zone = String(value || 'overworld');
    return ['overworld', 'cave', 'dungeon'].includes(zone) ? zone : 'overworld';
  }

  function backupCurrentCharacterSave(reason = 'backup') {
    const raw = readLocal(CHARACTER_STORAGE_KEY);
    if (!raw) return false;
    const backup = {
      reason,
      backedUpAt: new Date().toISOString(),
      storageKey: CHARACTER_STORAGE_KEY,
      raw
    };
    return writeLocal(CHARACTER_BACKUP_STORAGE_KEY, JSON.stringify(backup));
  }


  function parseJsonSafe(raw, fallback = null) {
    if (!raw) return fallback;
    try { return JSON.parse(raw); }
    catch (_err) { return fallback; }
  }

  function backupCurrentAccountSave(reason = 'backup') {
    const raw = readLocal(ACCOUNT_STORAGE_KEY);
    if (!raw) return false;
    const backup = {
      reason,
      backedUpAt: new Date().toISOString(),
      storageKey: ACCOUNT_STORAGE_KEY,
      raw
    };
    return writeLocal(ACCOUNT_BACKUP_STORAGE_KEY, JSON.stringify(backup));
  }

  function quarantineBadAccountSave(raw, reason = 'corrupt or unsupported account save') {
    if (!raw) return false;
    const quarantine = {
      reason,
      quarantinedAt: new Date().toISOString(),
      storageKey: ACCOUNT_STORAGE_KEY,
      raw: String(raw).slice(0, 2000000)
    };
    writeLocal(ACCOUNT_CORRUPT_STORAGE_KEY, JSON.stringify(quarantine));
    removeLocal(ACCOUNT_STORAGE_KEY);
    return true;
  }

  function normalizeAccountName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 32);
  }

  function accountKey(value) {
    return normalizeAccountName(value).toLowerCase();
  }

  function stableToken(value, fallback = 'id') {
    const text = String(value || fallback);
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function generateAccountId(username) {
    const key = accountKey(username).replace(/[^a-z0-9_-]+/g, '-') || 'account';
    return `${key}-${Date.now().toString(36)}-${stableToken(`${key}:${Math.random()}:${Date.now()}`)}`;
  }

  function generateCharacterId(accountId, slotIndex, payload = null) {
    const name = payload?.character?.name || payload?.player?.name || 'character';
    const seed = `${accountId}:${slotIndex}:${name}:${payload?.savedAt || Date.now()}`;
    return `char-${slotIndex + 1}-${stableToken(seed)}`;
  }

  function simplePasswordHash(accountName, password) {
    // Local/offline save integrity only. This avoids plaintext credentials without pretending to be server-grade auth.
    const text = `${ACCOUNT_PASSWORD_HASH_METHOD}:${accountKey(accountName)}:${String(password || '')}`;
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `${ACCOUNT_PASSWORD_HASH_METHOD}:${(h >>> 0).toString(16).padStart(8, '0')}`;
  }

  function legacyPasswordHash(accountName, password) {
    const text = `${accountKey(accountName)}:${String(password || '')}`;
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `fnv1a:${(h >>> 0).toString(16).padStart(8, '0')}`;
  }

  function emptyAccountsState() {
    return {
      schema: ACCOUNT_SAVE_SCHEMA,
      saveFormatVersion: ACCOUNT_SAVE_FORMAT_VERSION,
      game: 'Dream Realms',
      version: window.DREAM_REALMS_VERSION || CHARACTER_SAVE_BUILD_VERSION,
      createdFrom: window.DREAM_REALMS_BUILD_NAME || CHARACTER_SAVE_BUILD_NAME,
      savedAt: nowIso(),
      activeAccountId: null,
      accounts: {},
      // Phase 2 (Save/Migration Hardening): capped history of normalization
      // events (schema drift noticed, character slots that failed to bind
      // and were dropped) - visibility only, mirrors WorldSerializer's
      // migrationHistory. Never blocks a login/load.
      migrationHistory: []
    };
  }

  function characterSummaryFromPayload(payload) {
    const c = payload?.character || payload?.player || {};
    const raceId = DR.normalizeRaceId?.(c.raceId) || 'human';
    return {
      name: String(c.name || 'Adventurer').slice(0, 18),
      className: DR.CLASSES?.[c.className] ? String(c.className) : 'Fighter',
      raceId,
      raceName: DR.getRaceDefinition?.(raceId)?.name || 'Human',
      level: Math.max(1, Math.floor(Number(c.level) || 1)),
      gender: String(c.gender || 'Male'),
      hairStyle: DR.Hairstyles?.normalize?.(raceId, c.hairStyle) || String(c.hairStyle || 'short'),
      hairColor: String(c.hairColor || '#4b3628'),
      eyeColor: String(c.eyeColor || '#8ec9ff'),
      faceStyle: String(c.faceStyle || 'balanced'),
      savedAt: payload?.savedAt || nowIso()
    };
  }

  function normalizeCharacterPayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { ok: false, error: 'Character save payload is missing.' };
    }
    if (payload.schema && !CHARACTER_SUPPORTED_SCHEMAS.has(payload.schema)) {
      return { ok: false, error: `Unsupported character save schema: ${payload.schema}.` };
    }
    const character = payload.character || payload.player || null;
    if (!character || typeof character !== 'object') return { ok: false, error: 'Character save is missing character data.' };
    const result = cloneJson(payload);
    result.schema = 'dream-realms-character-save-v1';
    result.saveFormatVersion = 1;
    result.character = result.character && typeof result.character === 'object' ? result.character : cloneJson(character);
    result.character.raceId = DR.normalizeRaceId?.(result.character.raceId) || 'human';
    result.character.racePaletteId = DR.normalizeRacePaletteId?.(result.character.raceId, result.character.racePaletteId) || DR.getRaceDefinition?.(result.character.raceId)?.defaultPaletteId || 'settled';
    if (!result.character.itemCooldowns || typeof result.character.itemCooldowns !== 'object' || Array.isArray(result.character.itemCooldowns)) result.character.itemCooldowns = {};
    result.inventory = Array.isArray(result.inventory) ? result.inventory : [];
    result.equipment = result.equipment && typeof result.equipment === 'object' && !Array.isArray(result.equipment) ? result.equipment : {};
    result.bags = Array.isArray(result.bags) ? result.bags : [];
    // Phase 9 (Intersect parity): personal bank storage, same top-level
    // container pattern as inventory/equipment/bags. Empty for every save
    // that predates this phase.
    result.bank = Array.isArray(result.bank) ? result.bank : [];
    result.runtime = result.runtime && typeof result.runtime === 'object' && !Array.isArray(result.runtime) ? result.runtime : {};
    // Phase 1 (Simulation Core): additive, optional character-model fields.
    // Default to empty containers so older saves without them still load
    // normally; no owning gameplay system populates these yet.
    result.skillTrees = result.skillTrees && typeof result.skillTrees === 'object' && !Array.isArray(result.skillTrees) ? result.skillTrees : {};
    result.factions = result.factions && typeof result.factions === 'object' && !Array.isArray(result.factions) ? result.factions : {};
    result.unlockedWaypoints = Array.isArray(result.unlockedWaypoints) ? result.unlockedWaypoints : [];
    return { ok: true, payload: result };
  }

  function bindCharacterPayloadToAccount(payload, account, slotIndex, characterId = null) {
    const normalized = normalizeCharacterPayload(payload);
    if (!normalized.ok || !account) return null;
    const result = normalized.payload;
    const index = Math.max(0, Math.min(3, Math.floor(Number(slotIndex) || 0)));
    const existingId = characterId || result.characterId || result.character?.characterId || null;
    const boundCharacterId = existingId || generateCharacterId(account.id, index, result);
    result.accountId = account.id;
    result.accountUsername = account.username;
    result.characterId = boundCharacterId;
    result.characterSlotIndex = index;
    result.character.accountId = account.id;
    result.character.accountUsername = account.username;
    result.character.characterId = boundCharacterId;
    result.character.characterSlotIndex = index;
    result.savedAt = result.savedAt || nowIso();
    return result;
  }

  function normalizeAccountRecord(rawId, account, migrations = null) {
    if (!account || typeof account !== 'object') return null;
    const username = normalizeAccountName(account.username || account.name || rawId);
    if (!username) return null;
    const id = String(account.id || rawId || generateAccountId(username));
    const key = account.key || accountKey(username);
    const existingCredential = account.credentials && typeof account.credentials === 'object' ? account.credentials : {};
    const passwordHash = account.passwordHash || existingCredential.passwordHash || '';
    const normalized = {
      id,
      username,
      key,
      credentials: {
        username,
        passwordHash,
        passwordHashMethod: account.passwordHashMethod || existingCredential.passwordHashMethod || ACCOUNT_PASSWORD_HASH_METHOD
      },
      passwordHash,
      passwordHashMethod: account.passwordHashMethod || existingCredential.passwordHashMethod || ACCOUNT_PASSWORD_HASH_METHOD,
      createdAt: account.createdAt || nowIso(),
      updatedAt: account.updatedAt || account.lastLoginAt || nowIso(),
      lastLoginAt: account.lastLoginAt || null,
      slots: [null, null, null, null],
      characters: []
    };
    const slotSources = Array.isArray(account.slots) ? account.slots : [];
    const characterSources = Array.isArray(account.characters) ? account.characters : [];
    for (let i = 0; i < 4; i++) {
      const source = slotSources[i] || characterSources.find(ch => Number(ch?.slotIndex) === i) || null;
      if (!source || typeof source !== 'object') continue;
      const payload = source.payload || source.save || source.characterSave || null;
      if (!payload) continue;
      const boundPayload = bindCharacterPayloadToAccount(payload, normalized, i, source.characterId || payload.characterId || payload.character?.characterId || null);
      if (!boundPayload) {
        // Phase 2 (Save/Migration Hardening): this used to drop the slot
        // with zero visibility. The fallback behavior (skip the slot rather
        // than corrupt the account) is unchanged - this only makes the drop
        // visible instead of silent.
        const note = `account "${username}" slot ${i + 1}: character payload failed to normalize and was dropped.`;
        console.warn(`[Dream Realms Save] ${note}`);
        migrations?.push(note);
        continue;
      }
      const createdAt = source.createdAt || boundPayload.createdAt || boundPayload.savedAt || nowIso();
      const updatedAt = source.updatedAt || boundPayload.savedAt || nowIso();
      const summary = source.summary && typeof source.summary === 'object' ? cloneJson(source.summary) : characterSummaryFromPayload(boundPayload);
      summary.savedAt = summary.savedAt || updatedAt;
      normalized.slots[i] = {
        slotIndex: i,
        accountId: normalized.id,
        characterId: boundPayload.characterId,
        createdAt,
        updatedAt,
        summary,
        payload: boundPayload
      };
    }
    normalized.characters = normalized.slots.filter(Boolean).map(slot => ({
      slotIndex: slot.slotIndex,
      accountId: slot.accountId,
      characterId: slot.characterId,
      createdAt: slot.createdAt,
      updatedAt: slot.updatedAt,
      summary: cloneJson(slot.summary)
    }));
    return normalized;
  }

  function normalizeAccountsState(payload) {
    const state = emptyAccountsState();
    const previousHistory = Array.isArray(payload?.migrationHistory) ? payload.migrationHistory : [];
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      state.migrationHistory = previousHistory;
      return state;
    }
    const migrations = [];
    // Phase 2 (Save/Migration Hardening): visibility-only schema check,
    // mirrors WorldSerializer's schema drift note. The local account system
    // stays lenient on purpose (see ACCOUNT_SUPPORTED_SCHEMAS comment) - an
    // unrecognized schema is still normalized best-effort below, not
    // rejected, so a stale or foreign save document never locks a user out
    // of their local account.
    if (payload.schema && !ACCOUNT_SUPPORTED_SCHEMAS.has(payload.schema)) {
      const note = `account save schema "${payload.schema}" is not in the current supported set; normalized on a best-effort basis.`;
      console.warn(`[Dream Realms Save] ${note}`);
      migrations.push(note);
    }
    const rawAccounts = payload.accounts && typeof payload.accounts === 'object' && !Array.isArray(payload.accounts) ? payload.accounts : {};
    for (const [rawId, account] of Object.entries(rawAccounts)) {
      const normalized = normalizeAccountRecord(rawId, account, migrations);
      if (!normalized) continue;
      state.accounts[normalized.id] = normalized;
    }
    if (payload.activeAccountId && state.accounts[payload.activeAccountId]) state.activeAccountId = payload.activeAccountId;
    state.savedAt = payload.savedAt || nowIso();
    state.migrationHistory = migrations.length
      ? previousHistory.concat([{ at: nowIso(), changes: migrations.slice() }]).slice(-12)
      : previousHistory;
    return state;
  }

  function serializeAccountsDocument(state) {
    const normalized = normalizeAccountsState(state || emptyAccountsState());
    normalized.schema = ACCOUNT_SAVE_SCHEMA;
    normalized.saveFormatVersion = ACCOUNT_SAVE_FORMAT_VERSION;
    normalized.game = 'Dream Realms';
    normalized.version = window.DREAM_REALMS_VERSION || CHARACTER_SAVE_BUILD_VERSION;
    normalized.createdFrom = window.DREAM_REALMS_BUILD_NAME || CHARACTER_SAVE_BUILD_NAME;
    normalized.savedAt = nowIso();
    return normalized;
  }

  function mergeAccountSlots(targetAccount, sourceAccount) {
    targetAccount.slots = Array.from({ length: 4 }, (_, i) => targetAccount.slots?.[i] || null);
    sourceAccount.slots = Array.from({ length: 4 }, (_, i) => sourceAccount.slots?.[i] || null);
    for (let i = 0; i < 4; i++) {
      const incoming = sourceAccount.slots[i];
      if (!incoming) continue;
      const current = targetAccount.slots[i];
      if (!current || String(incoming.updatedAt || '') >= String(current.updatedAt || '')) {
        const bound = bindCharacterPayloadToAccount(incoming.payload, targetAccount, i, incoming.characterId);
        if (!bound) continue;
        targetAccount.slots[i] = {
          ...cloneJson(incoming),
          accountId: targetAccount.id,
          characterId: bound.characterId,
          payload: bound,
          summary: characterSummaryFromPayload(bound)
        };
      }
    }
    targetAccount.updatedAt = nowIso();
    targetAccount.characters = targetAccount.slots.filter(Boolean).map(slot => ({
      slotIndex: slot.slotIndex,
      accountId: slot.accountId,
      characterId: slot.characterId,
      createdAt: slot.createdAt,
      updatedAt: slot.updatedAt,
      summary: cloneJson(slot.summary)
    }));
    return targetAccount;
  }

  function mergeAccountsStates(localState, incomingState) {
    const local = normalizeAccountsState(localState || emptyAccountsState());
    const incoming = normalizeAccountsState(incomingState || emptyAccountsState());
    for (const incomingAccount of Object.values(incoming.accounts)) {
      const existing = local.accounts[incomingAccount.id] || Object.values(local.accounts).find(acc => acc.key === incomingAccount.key) || null;
      if (!existing) {
        local.accounts[incomingAccount.id] = incomingAccount;
      } else {
        mergeAccountSlots(existing, incomingAccount);
        existing.lastLoginAt = existing.lastLoginAt || incomingAccount.lastLoginAt || null;
        existing.createdAt = existing.createdAt || incomingAccount.createdAt || nowIso();
        existing.credentials = existing.credentials || incomingAccount.credentials;
        existing.passwordHash = existing.passwordHash || incomingAccount.passwordHash;
        local.accounts[existing.id] = existing;
      }
    }
    if (!local.activeAccountId && incoming.activeAccountId && local.accounts[incoming.activeAccountId]) local.activeAccountId = incoming.activeAccountId;
    local.savedAt = nowIso();
    return local;
  }

  DR.SaveSystem = {
    WORLD_STORAGE_KEY,
    WORLD_BACKUP_STORAGE_KEY,
    WORLD_CORRUPT_STORAGE_KEY,
    CHARACTER_STORAGE_KEY,
    CHARACTER_BACKUP_STORAGE_KEY,
    ACCOUNT_STORAGE_KEY,
    ACCOUNT_BACKUP_STORAGE_KEY,
    ACCOUNT_CORRUPT_STORAGE_KEY,
    ACCOUNT_SAVE_SCHEMA,
    ACCOUNT_SAVE_FORMAT_VERSION,

    install(Game) {
      Game.prototype.generateDefaultWorld = function() {
        return this.generateMap();
      };


      Game.prototype.serializePetState = function(pet = this.pet) {
        if (!pet || pet.kind !== 'pet') return null;
        return {
          version: 1,
          active: true,
          name: String(pet.name || '').slice(0, 48),
          petType: pet.petType || (pet.className === 'Necromancer' ? 'undead' : 'shard'),
          className: pet.className || (pet.petType === 'undead' ? 'Necromancer' : 'Summoner'),
          visualModel: pet.visualModel || null,
          color: pet.color || pet.petColor || null,
          x: Number.isFinite(Number(pet.x)) ? Number(pet.x) : null,
          y: Number.isFinite(Number(pet.y)) ? Number(pet.y) : null,
          zone: pet.zone || this.currentZone || 'dark_woods',
          level: Math.max(1, Math.floor(Number(pet.level || this.player?.level || 1))),
          hp: Math.max(0, Math.floor(Number(pet.hp) || 0)),
          maxHp: Math.max(1, Math.floor(Number(pet.maxHp || pet.hp || 1))),
          mana: Math.max(0, Math.floor(Number(pet.mana) || 0)),
          maxMana: Math.max(0, Math.floor(Number(pet.maxMana || 0))),
          attack: Math.max(1, Math.floor(Number(pet.attack || pet.baseAttack || 1))),
          attackDamageMin: Math.max(0, Math.floor(Number(pet.attackDamageMin || 0))),
          attackDamageMax: Math.max(0, Math.floor(Number(pet.attackDamageMax || 0))),
          attackIntervalSeconds: Math.max(0, Number(pet.attackIntervalSeconds || 0)),
          shieldBashDamage: Math.max(0, Math.floor(Number(pet.shieldBashDamage || 0))),
          shieldBashCooldown: Math.max(0, Number(pet.shieldBashCooldown || 0)),
          defense: Math.max(0, Math.floor(Number(pet.defense || pet.baseDefense || 0))),
          speed: Math.max(0.1, Number(pet.speed || 1)),
          range: Math.max(0.25, Number(pet.range || 1.4)),
          alive: pet.alive !== false,
          command: String(pet.command || 'assist'),
          commandState: String(pet.commandState || pet.command || 'assist'),
          hoveringPet: Boolean(pet.hoveringPet),
          combatCooldown: Math.max(0, Number(pet.combatCooldown || 0)),
          statusEffects: cloneJson(this.serializeEntityStatuses?.(pet) || [])
        };
      };

      Game.prototype.restorePetState = function(state) {
        if (!state || !state.active || !this.player) return false;
        const PetClass = DR.entities?.Pet || window.Pet;
        if (!PetClass) return false;
        if (this.pet) this.entities = (this.entities || []).filter(entity => entity !== this.pet);
        const x = Number.isFinite(Number(state.x)) ? Number(state.x) : this.player.x - 0.75;
        const y = Number.isFinite(Number(state.y)) ? Number(state.y) : this.player.y + 0.75;
        const petType = state.petType || (state.className === 'Necromancer' ? 'undead' : 'shard');
        const pet = new PetClass(x, y, this.player, {
          name: state.name || (petType === 'undead' ? 'Bone Servant' : 'Azure Shard Familiar'),
          petName: state.name,
          petType,
          color: state.color || state.petColor || (petType === 'undead' ? '#d8e5b4' : '#78ddff'),
          petHp: Math.max(1, Math.floor(Number(state.maxHp || state.hp || 1))),
          hp: Math.max(1, Math.floor(Number(state.maxHp || state.hp || 1))),
          attack: Math.max(1, Math.floor(Number(state.attack || 1))),
          attackDamageMin: Math.max(0, Math.floor(Number(state.attackDamageMin || 0))),
          attackDamageMax: Math.max(0, Math.floor(Number(state.attackDamageMax || 0))),
          attackIntervalSeconds: Math.max(0, Number(state.attackIntervalSeconds || 0)),
          shieldBashDamage: Math.max(0, Math.floor(Number(state.shieldBashDamage || 0))),
          shieldBashCooldown: Math.max(0, Number(state.shieldBashCooldown || 0)),
          defense: Math.max(0, Math.floor(Number(state.defense || 0))),
          speed: Math.max(0.1, Number(state.speed || 1)),
          range: Math.max(0.25, Number(state.range || 1.4)),
          command: state.command || 'assist'
        });
        pet.level = Math.max(1, Math.floor(Number(state.level || this.player.level || 1)));
        pet.zone = state.zone || this.currentZone || this.player.zone || 'dark_woods';
        pet.visualModel = state.visualModel || pet.visualModel;
        pet.maxHp = Math.max(1, Math.floor(Number(state.maxHp || pet.maxHp || pet.hp || 1)));
        pet.hp = Math.max(0, Math.min(pet.maxHp, Math.floor(Number(state.hp ?? pet.maxHp))));
        pet.maxMana = Math.max(0, Math.floor(Number(state.maxMana || pet.maxMana || 0)));
        pet.mana = Math.max(0, Math.min(pet.maxMana, Math.floor(Number(state.mana || 0))));
        pet.attack = Math.max(1, Math.floor(Number(state.attack || pet.attack || 1)));
        pet.attackDamageMin = Math.max(0, Math.floor(Number(state.attackDamageMin || pet.attackDamageMin || 0)));
        pet.attackDamageMax = Math.max(0, Math.floor(Number(state.attackDamageMax || pet.attackDamageMax || 0)));
        pet.attackIntervalSeconds = Math.max(0, Number(state.attackIntervalSeconds || pet.attackIntervalSeconds || 0));
        pet.shieldBashDamage = Math.max(0, Math.floor(Number(state.shieldBashDamage || pet.shieldBashDamage || 0)));
        pet.shieldBashCooldown = Math.max(0, Number(state.shieldBashCooldown || pet.shieldBashCooldown || 0));
        pet.defense = Math.max(0, Math.floor(Number(state.defense || pet.defense || 0)));
        pet.speed = Math.max(0.1, Number(state.speed || pet.speed || 1));
        pet.range = pet.petType === 'shard'
          ? Math.max(5.4, Number(state.range || pet.range || 5.4))
          : Math.max(0.25, Number(state.range || pet.range || 1.45));
        pet.autoAttackRangeTiles = pet.petType === 'shard' ? 5.6 : Math.max(1.45, Number(pet.range || 1.45));
        pet.combatStyle = pet.petType === 'shard' ? 'rangedCaster' : 'melee';
        pet.autoAttackProjectile = pet.petType === 'shard';
        pet.autoAttackDamageType = pet.petType === 'shard' ? 'magic' : 'physical';
        pet.alive = state.alive !== false;
        pet.command = String(state.command || 'assist');
        pet.commandState = pet.alive ? String(state.commandState || pet.command || 'assist') : 'downed';
        pet.combatCooldown = Math.max(0, Number(state.combatCooldown || 0));
        if (Array.isArray(state.statusEffects)) this.importEntityStatuses?.(pet, state.statusEffects);
        this.pet = pet;
        if (!this.entities.includes(pet)) this.entities.push(pet);
        this.partyPanelDirty = true;
        this.petCommandDirty = true;
        this.characterSaveDirty = true;
        return true;
      };

      Game.prototype.installWorldSaveControls = function() {
        if (this.worldSaveControlsInstalled) return;
        this.worldSaveControlsInstalled = true;

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/json,.json';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', () => {
          const file = fileInput.files && fileInput.files[0];
          if (file) this.importWorldSaveFromFile(file);
          fileInput.value = '';
        });
        document.body.appendChild(fileInput);
        this.worldImportInput = fileInput;

        const characterInput = document.createElement('input');
        characterInput.type = 'file';
        characterInput.accept = 'application/json,.json';
        characterInput.style.display = 'none';
        characterInput.addEventListener('change', () => {
          const file = characterInput.files && characterInput.files[0];
          if (file) this.importCharacterSaveFromFile(file);
          characterInput.value = '';
        });
        document.body.appendChild(characterInput);
        this.characterImportInput = characterInput;

        const saveLoadInput = document.createElement('input');
        saveLoadInput.type = 'file';
        saveLoadInput.accept = 'application/json,.json';
        saveLoadInput.multiple = true;
        saveLoadInput.style.display = 'none';
        saveLoadInput.addEventListener('change', () => {
          const files = Array.from(saveLoadInput.files || []);
          if (files.length) this.loadSaveFilesFromFileList?.(files, { source: 'fallback-file-input' });
          saveLoadInput.value = '';
        });
        document.body.appendChild(saveLoadInput);
        this.saveLoadInput = saveLoadInput;

        const bindButton = (id, handler) => {
          const btn = document.getElementById(id);
          btn?.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            handler();
          });
        };
        bindButton('accountLoadGameBtn', () => this.loadGameFromSavePicker?.());
        bindButton('slotLoadGameBtn', () => this.loadGameFromSavePicker?.());
        bindButton('menuLoadGameBtn', () => this.loadGameFromSavePicker?.());
        bindButton('menuSaveGameBtn', () => this.saveGameToSaveFolder?.({ manual: true }));
        bindButton('slotSaveFolderBtn', () => this.chooseCharacterSaveFolder?.());
        bindButton('menuSaveFolderBtn', () => this.chooseCharacterSaveFolder?.());

        this.characterAutosaveTimer = 0;
        this.characterAutosaveInterval = CHARACTER_AUTOSAVE_SECONDS;
        this.restorePersistedSaveFolderHandle?.({ silent: true, load: true });

        window.addEventListener('keydown', e => {
          if (!this.started) return;
          if (e.repeat) return;
          if (e.key === 'F9' || e.key === 'F10') return;
          if (this.isActionKey ? this.isActionKey(e, 'saveWorld') : e.key === 'F9') {
            e.preventDefault();
            this.saveWorldState();
            this.saveCharacterState?.({ manual: true });
          } else if (this.isActionKey ? this.isActionKey(e, 'exportCharacter') : e.key === 'F10') {
            e.preventDefault();
            this.exportCharacterSave?.();
          } else if (this.isActionKey ? this.isActionKey(e, 'saveFolder') : e.key === 'F5') {
            e.preventDefault();
            this.chooseCharacterSaveFolder?.();
          } else if (this.isActionKey ? this.isActionKey(e, 'reloadWorld') : e.key === 'F8') {
            e.preventDefault();
            this.loadSavedWorldState({ silent: false, resetEntities: true });
          } else if (e.key === 'F7') {
            e.preventDefault();
            this.resetWorldSave();
          } else if (e.key === 'F6') {
            e.preventDefault();
            this.exportWorldSave();
          } else if (e.key === 'F4') {
            e.preventDefault();
            this.worldImportInput?.click();
          }
        });
      };

      Game.prototype.serializeWorldState = function() {
        return DR.WorldSerializer.serialize(this);
      };

      Game.prototype.saveWorldState = function(options = {}) {
        const payload = this.serializeWorldState();
        const validation = migrateWorldPayload(payload);
        if (!validation.ok) {
          this.log(`World save blocked: ${validation.error}`);
          return false;
        }
        backupCurrentWorldSave('before save overwrite');
        const json = JSON.stringify(validation.payload);
        const ok = writeLocal(WORLD_STORAGE_KEY, json);
        if (ok) {
          this.worldSaveDirty = false;
          if (this.characterSaveDirectoryHandle) this.writeWorldSaveToFolder?.(validation.payload, options);
          const pass = validation.payload.buildPass || DR.WorldSerializer?.buildPass || 65;
          if (!options.silent) this.log(`Saved world state: ${validation.payload.zones.dark_woods.name} · format ${validation.payload.saveFormatVersion} · Pass ${pass}.`);
          return true;
        }
        if (!options.silent) this.log('World save failed: browser storage is unavailable or full. Previous save backup was preserved when possible.');
        return false;
      };



      Game.prototype.serializeCharacterState = function() {
        const p = this.player;
        if (!p) return null;
        const now = new Date().toISOString();
        return {
          schema: 'dream-realms-character-save-v1',
          saveFormatVersion: 1,
          descriptorSchemaVersion: DR.Registry?.DESCRIPTOR_VERSION || 1,
          game: 'Dream Realms',
          version: window.DREAM_REALMS_VERSION || CHARACTER_SAVE_BUILD_VERSION,
          createdFrom: window.DREAM_REALMS_BUILD_NAME || CHARACTER_SAVE_BUILD_NAME,
          savedAt: now,
          accountId: this.activeAccountId || this.player?.accountId || null,
          accountUsername: this.getActiveAccount?.()?.username || this.player?.accountUsername || null,
          characterId: this.player?.characterId || null,
          characterSlotIndex: Number.isInteger(this.activeCharacterSlotIndex) ? this.activeCharacterSlotIndex : null,
          activeRuntimeZone: normalizeRuntimeZone(this.currentZone || 'overworld'),
          // V0.20.80 (Roadmap Item 26): WHICH overworld the character is standing in. Distinct from
          // activeRuntimeZone above, which is only the coarse overworld/cave/dungeon mode. Without
          // this a character who logged out in Ashen Valley would reload in Dark Woods holding
          // Ashen Valley coordinates. Its mirror lives in resetCharacterOwnedState.
          activeOverworldZoneId: String(this.activeOverworldZoneId || 'dark_woods'),
          activeCaveId: normalizeRuntimeZone(this.currentZone || 'overworld') === 'cave' ? (this.currentCave?.id || this.activeCaveId || null) : null,
          activeCaveFloor: normalizeRuntimeZone(this.currentZone || 'overworld') === 'cave' ? Math.max(1, Math.floor(Number(this.currentCaveFloor) || 1)) : 1,
          activeDungeonId: normalizeRuntimeZone(this.currentZone || 'overworld') === 'dungeon' ? (this.activeDungeon?.id || this.dungeonRuntimeState?.active?.dungeonId || null) : null,
          activeDungeonFloor: normalizeRuntimeZone(this.currentZone || 'overworld') === 'dungeon' ? Math.max(1, Math.floor(Number(this.activeDungeon?.floor || this.dungeonRuntimeState?.active?.floor || 1))) : 1,
          character: {
            name: p.name,
            accountId: this.activeAccountId || p.accountId || null,
            accountUsername: this.getActiveAccount?.()?.username || p.accountUsername || null,
            characterId: p.characterId || null,
            characterSlotIndex: Number.isInteger(this.activeCharacterSlotIndex) ? this.activeCharacterSlotIndex : null,
            className: p.className,
            raceId: DR.normalizeRaceId?.(p.raceId) || 'human',
            racePaletteId: DR.normalizeRacePaletteId?.(p.raceId, p.racePaletteId),
            itemCooldowns: cloneJson(p.itemCooldowns || {}),
            gender: p.gender,
            hairStyle: p.hairStyle,
            hairColor: p.hairColor,
            eyeColor: p.eyeColor,
            faceStyle: p.faceStyle,
            skinTone: p.skinTone,
            clothesPrimary: p.clothesPrimary,
            clothesSecondary: p.clothesSecondary,
            level: Math.max(1, Math.floor(Number(p.level) || 1)),
            xp: Math.max(0, Math.floor(Number(p.xp) || 0)),
            nextXp: Math.max(1, Math.floor(Number(p.nextXp) || 100)),
            hp: Math.max(0, Math.floor(Number(p.hp) || 0)),
            maxHp: Math.max(1, Math.floor(Number(p.maxHp) || 1)),
            baseMaxHp: Math.max(1, Math.floor(Number(p.baseMaxHp) || Number(p.maxHp) || 1)),
            baseAttack: Math.max(1, Math.floor(Number(p.baseAttack) || Number(p.attack) || 1)),
            baseDefense: Math.max(0, Math.floor(Number(p.baseDefense) || Number(p.defense) || 0)),
            baseMaxMana: Math.max(0, Math.floor(Number(p.baseMaxMana) || Number(p.maxMana) || 0)),
            attributes: cloneJson(p.attributes || null),
            derivedStats: cloneJson(p.derivedStats || null),
            mana: Math.max(0, Math.floor(Number(p.mana) || 0)),
            maxMana: Math.max(1, Math.floor(Number(p.maxMana) || 1)),
            coinCopper: Math.max(0, Math.floor(Number(p.coinCopper) || 0)),
            x: Number.isFinite(Number(p.x)) ? Number(p.x) : null,
            y: Number.isFinite(Number(p.y)) ? Number(p.y) : null,
            meditationSkill: cloneJson(p.meditationSkill || null),
            meditation: cloneJson(p.meditation || null),
            oxygen: Math.max(0, Math.floor(Number(p.oxygen) || 0)),
            oxygenMax: Math.max(1, Math.floor(Number(p.oxygenMax) || 45)),
            statusEffects: cloneJson(this.serializeEntityStatuses?.(p) || []),
            starterGearGranted: Boolean(this.classStartingGearGranted)
          },
          inventory: cloneJson(this.inventory || []),
          equipment: cloneJson(this.equipment || {}),
          armorProficiency: cloneJson(this.armorProficiency || null), // V0.20.41 (Roadmap Item 8)
          starterGearGranted: Boolean(this.classStartingGearGranted),
          bags: cloneJson(this.bags || []),
          // Phase 9 (Intersect parity): personal bank storage.
          bank: cloneJson(this.serializeBankState?.() || this.bank || []),
          // Phase 1 (Simulation Core): additive character-model fields;
          // no owning gameplay system populates these yet, so they persist
          // whatever is currently on the player instance (empty by default).
          skillTrees: cloneJson(p.skillTrees || {}),
          // V0.17.69 Talents: versioned, validated, migratable state owned by
          // systems/talent-system.js (deliberately NOT the generic skillTrees bag).
          talents: cloneJson(p.talents || null),
          // V0.17.71 BUG 1: per-character action-bar assignments (18 slots -> spell id).
          hotbar: cloneJson(p.hotbar || null),
          factions: cloneJson(p.factions || {}),
          unlockedWaypoints: cloneJson(p.unlockedWaypoints || []),
          runtime: {
            fishing: cloneJson(this.fishingSystem?.serializeState ? this.fishingSystem.serializeState() : null),
            professions: cloneJson(this.professionSystem?.serializeState ? this.professionSystem.serializeState() : null),
            resourceGathering: cloneJson(this.resourceGatheringSystem?.serializeState ? this.resourceGatheringSystem.serializeState() : null),
            crafting: cloneJson(this.craftingSystem?.serializeState ? this.craftingSystem.serializeState() : null),
            quests: cloneJson(this.questSystem?.serializeState ? this.questSystem.serializeState() : null),
            fog: cloneJson(this.serializeFogState?.() || null),
            worldTime: cloneJson(this.serializeWorldTime?.() || null),
            weather: cloneJson(this.serializeWeather?.() || null),
            dungeon: cloneJson(this.dungeonRuntimeState || null),
            mercenary: cloneJson(this.serializeMercenaryState?.() || null),
            pet: cloneJson(this.serializePetState?.() || null),
            party: cloneJson(this.serializePartyState?.() || null),
            botPlayers: cloneJson(this.serializeBotPlayerState?.() || null),
            adventurerPopulation: cloneJson(this.serializeAdventurerPopulation?.() || null),
            // V0.20.64 (Roadmap Item 7.F): the mount collection is character-owned and must survive
            // save/load. Its mirror lives in resetCharacterOwnedState so a NEW character on the same
            // account cannot inherit this stable - the V0.20.2 belongings-leak class of bug.
            mounts: cloneJson(this.serializeMountState?.() || null)
          }
        };
      };

      Game.prototype.characterSaveFilename = function(payload = null, suffix = '') {
        const source = payload || this.serializeCharacterState?.() || {};
        const name = safeFilename(source.character?.name || this.player?.name || 'Adventurer');
        return `Dream-Realms-Character-${name}${suffix}.json`;
      };

      Game.prototype.resolveGameSaveDirectoryHandle = async function(options = {}) {
        const root = this.characterSaveDirectoryHandle;
        if (!root) return null;
        const rootName = String(root.name || '').toLowerCase();
        if (rootName === GAME_SAVE_FOLDER_NAME.toLowerCase()) return root;
        if (typeof root.getDirectoryHandle !== 'function') return root;
        try {
          return await root.getDirectoryHandle(GAME_SAVE_FOLDER_NAME, { create: options.create !== false });
        } catch (_err) {
          return root;
        }
      };

      Game.prototype.writeCharacterSaveToFolder = async function(payload, options = {}) {
        // Legacy explicit character export path. Primary autosaves are account-bound and written by writeAccountsSaveToFolder().
        if (!this.characterSaveDirectoryHandle || !payload || options.primaryAccountSave !== false) return false;
        try {
          const permission = await this.characterSaveDirectoryHandle.queryPermission?.({ mode: 'readwrite' });
          if (permission && permission !== 'granted') {
            if (options.auto || options.silent) return false;
            const requested = await this.characterSaveDirectoryHandle.requestPermission?.({ mode: 'readwrite' });
            if (requested && requested !== 'granted') return false;
          }
          const saveDir = await this.resolveGameSaveDirectoryHandle?.({ create: true }) || this.characterSaveDirectoryHandle;
          const fileHandle = await saveDir.getFileHandle(this.characterSaveFilename(payload), { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify(payload, null, 2));
          await writable.close();
          this.lastCharacterFolderSaveAt = Date.now();
          this.characterSaveFolderMode = 'Save-folder-export';
          return true;
        } catch (err) {
          if (!options.auto && !options.silent) this.log?.(`Character Save folder export failed: ${err?.message || err}`);
          return false;
        }
      };

      Game.prototype.writeAccountsSaveToFolder = async function(options = {}) {
        if (!this.characterSaveDirectoryHandle) return false;
        try {
          const permission = await this.characterSaveDirectoryHandle.queryPermission?.({ mode: 'readwrite' });
          if (permission && permission !== 'granted') {
            if (options.auto || options.silent) return false;
            const requested = await this.characterSaveDirectoryHandle.requestPermission?.({ mode: 'readwrite' });
            if (requested && requested !== 'granted') return false;
          }
          const saveDir = await this.resolveGameSaveDirectoryHandle?.({ create: true }) || this.characterSaveDirectoryHandle;
          const document = serializeAccountsDocument(this.accountsState || this.loadAccountsState?.() || emptyAccountsState());
          const fileHandle = await saveDir.getFileHandle(SAVE_FOLDER_ACCOUNT_AUTOSAVE, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify(document, null, 2));
          await writable.close();
          this.lastAccountFolderSaveAt = Date.now();
          this.characterSaveFolderMode = 'Account-bound Save folder';
          return true;
        } catch (err) {
          if (!options.auto && !options.silent) this.log?.(`Account Save folder write failed: ${err?.message || err}`);
          return false;
        }
      };

      Game.prototype.writeWorldSaveToFolder = async function(payload, options = {}) {
        if (!this.characterSaveDirectoryHandle || !payload) return false;
        try {
          const permission = await this.characterSaveDirectoryHandle.queryPermission?.({ mode: 'readwrite' });
          if (permission && permission !== 'granted') {
            if (options.auto || options.silent) return false;
            const requested = await this.characterSaveDirectoryHandle.requestPermission?.({ mode: 'readwrite' });
            if (requested && requested !== 'granted') return false;
          }
          const saveDir = await this.resolveGameSaveDirectoryHandle?.({ create: true }) || this.characterSaveDirectoryHandle;
          const fileHandle = await saveDir.getFileHandle(SAVE_FOLDER_WORLD_AUTOSAVE, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify(payload, null, 2));
          await writable.close();
          this.lastWorldFolderSaveAt = Date.now();
          return true;
        } catch (err) {
          if (!options.auto && !options.silent) this.log?.(`World Save folder write failed: ${err?.message || err}`);
          return false;
        }
      };

      Game.prototype.readAccountsSaveFromFolder = async function() {
        if (!this.characterSaveDirectoryHandle) return null;
        try {
          const saveDir = await this.resolveGameSaveDirectoryHandle?.({ create: false }) || this.characterSaveDirectoryHandle;
          const fileHandle = await saveDir.getFileHandle(SAVE_FOLDER_ACCOUNT_AUTOSAVE, { create: false });
          const file = await fileHandle.getFile();
          const payload = JSON.parse(await file.text());
          return { filename: SAVE_FOLDER_ACCOUNT_AUTOSAVE, payload, modified: Number(file.lastModified || 0) };
        } catch (_err) {
          return null;
        }
      };

      Game.prototype.readLatestCharacterSaveFromFolder = async function() {
        if (!this.characterSaveDirectoryHandle) return null;
        try {
          const saveDir = await this.resolveGameSaveDirectoryHandle?.({ create: false }) || this.characterSaveDirectoryHandle;
          const candidates = [];
          if (typeof saveDir.entries === 'function') {
            for await (const [name, handle] of saveDir.entries()) {
              if (!/\.json$/i.test(name) || !/^Dream-Realms-Character-/i.test(name)) continue;
              if (name === SAVE_FOLDER_ACCOUNT_AUTOSAVE || handle.kind !== 'file') continue;
              const file = await handle.getFile();
              candidates.push({ name, file, modified: Number(file.lastModified || 0) });
            }
          }
          candidates.sort((a, b) => b.modified - a.modified);
          const candidate = candidates[0];
          if (!candidate) return null;
          const text = await candidate.file.text();
          const payload = JSON.parse(text);
          return { filename: candidate.name, payload };
        } catch (err) {
          this.log?.(`Legacy character Save folder read failed: ${err?.message || err}`);
          return null;
        }
      };

      Game.prototype.setSaveDirectoryHandle = async function(handle, options = {}) {
        if (!handle) return false;
        this.characterSaveDirectoryHandle = handle;
        this.characterSaveFolderReady = true;
        this.characterSaveFolderMode = 'Account-bound Save folder';
        if (options.persist !== false) await storeSaveFolderHandle(handle);
        return true;
      };

      Game.prototype.restorePersistedSaveFolderHandle = async function(options = {}) {
        if (!window.indexedDB) return false;
        const handle = await loadStoredSaveFolderHandle();
        if (!handle) return false;
        const ok = await ensureDirectoryPermission(handle, 'readwrite', false);
        if (!ok) {
          if (!options.silent) this.log?.('Stored Save folder permission is no longer available. Use Load Game or Link Save Folder again.');
          return false;
        }
        await this.setSaveDirectoryHandle?.(handle, { persist: false });
        if (options.load !== false) {
          const loaded = await this.loadSaveFilesFromDirectoryHandle?.(handle, { silent: true, source: 'stored-save-folder' });
          if (loaded && !options.silent) this.log?.('Automatically loaded account/character saves from the linked Save folder.');
        }
        return true;
      };

      Game.prototype.importAccountSavePayload = function(payload, sourceName = 'selected save file', options = {}) {
        if (!isAccountSavePayload(payload)) return { ok: false, imported: 0, error: 'Not an account save document.' };
        const incoming = normalizeAccountsState(payload);
        const incomingCount = Object.keys(incoming.accounts || {}).length;
        if (!incomingCount) return { ok: false, imported: 0, error: 'No accounts found in account save document.' };
        const local = this.accountsState || this.loadAccountsState?.() || emptyAccountsState();
        const merged = mergeAccountsStates(local, incoming);
        if (!merged.activeAccountId) {
          merged.activeAccountId = incoming.activeAccountId && merged.accounts[incoming.activeAccountId]
            ? incoming.activeAccountId
            : Object.keys(merged.accounts)[0] || null;
        }
        this.accountsState = merged;
        this.activeAccountId = merged.activeAccountId || this.activeAccountId || null;
        this.saveAccountsState?.({ reason: `import-account-save:${sourceName}`, skipFolderWrite: true, silent: true });
        this.renderCharacterSlots?.();
        if (!options.silent) this.log?.(`Loaded ${incomingCount} account record${incomingCount === 1 ? '' : 's'} from ${sourceName}.`);
        return { ok: true, imported: incomingCount };
      };

      Game.prototype.importStandaloneCharacterPayload = function(payload, sourceName = 'selected character save', options = {}) {
        const normalized = normalizeCharacterPayload(payload);
        if (!normalized.ok) return { ok: false, imported: 0, error: normalized.error };
        const character = normalized.payload.character || {};
        const explicitUsername = normalizeAccountName(normalized.payload.accountUsername || character.accountUsername || '');
        const activeAccount = this.getActiveAccount?.();
        const username = explicitUsername || activeAccount?.username || normalizeAccountName(`Imported ${character.name || 'Adventurer'}`);
        const state = this.accountsState || this.loadAccountsState?.() || emptyAccountsState();
        const explicitAccountId = normalized.payload.accountId || character.accountId || null;
        const key = accountKey(username);
        let account = (explicitAccountId && state.accounts[explicitAccountId]) || Object.values(state.accounts).find(candidate => candidate.key === key) || null;
        if (!account) {
          const accountId = explicitAccountId || generateAccountId(username);
          account = normalizeAccountRecord(accountId, {
            id: accountId,
            username,
            key,
            passwordHash: '',
            passwordHashMethod: ACCOUNT_PASSWORD_HASH_METHOD,
            createdAt: normalized.payload.savedAt || nowIso(),
            updatedAt: nowIso(),
            slots: [null, null, null, null]
          });
          state.accounts[account.id] = account;
        }
        account.slots = Array.from({ length: 4 }, (_, i) => account.slots?.[i] || null);
        const requestedIndex = Number.isInteger(normalized.payload.characterSlotIndex) ? normalized.payload.characterSlotIndex
          : Number.isInteger(character.characterSlotIndex) ? character.characterSlotIndex
            : -1;
        const requestedClamped = requestedIndex >= 0 ? Math.max(0, Math.min(3, requestedIndex)) : -1;
        const incomingCharacterId = normalized.payload.characterId || character.characterId || null;
        let targetIndex = -1;
        if (incomingCharacterId) {
          targetIndex = account.slots.findIndex(slot => slot?.characterId === incomingCharacterId);
        }
        if (targetIndex < 0 && requestedClamped >= 0 && !account.slots[requestedClamped]) targetIndex = requestedClamped;
        if (targetIndex < 0) targetIndex = account.slots.findIndex(slot => !slot);
        if (targetIndex < 0) {
          if (!options.silent) this.log?.(`Skipped ${sourceName}: ${account.username} already has four character slots filled.`);
          return { ok: false, imported: 0, error: 'No empty character slot available.' };
        }
        const previous = account.slots[targetIndex];
        const boundPayload = bindCharacterPayloadToAccount(normalized.payload, account, targetIndex, previous?.characterId || incomingCharacterId || null);
        if (!boundPayload) return { ok: false, imported: 0, error: 'Character payload could not be bound to an account.' };
        account.slots[targetIndex] = {
          slotIndex: targetIndex,
          accountId: account.id,
          characterId: boundPayload.characterId,
          createdAt: previous?.createdAt || boundPayload.savedAt || nowIso(),
          updatedAt: nowIso(),
          summary: characterSummaryFromPayload(boundPayload),
          payload: boundPayload
        };
        account.characters = account.slots.filter(Boolean).map(slot => ({
          slotIndex: slot.slotIndex,
          accountId: slot.accountId,
          characterId: slot.characterId,
          createdAt: slot.createdAt,
          updatedAt: slot.updatedAt,
          summary: cloneJson(slot.summary)
        }));
        account.updatedAt = nowIso();
        state.accounts[account.id] = account;
        if (!state.activeAccountId) state.activeAccountId = account.id;
        this.accountsState = state;
        this.activeAccountId = state.activeAccountId || account.id;
        this.saveAccountsState?.({ reason: `import-character-save:${sourceName}`, skipFolderWrite: true, silent: true });
        this.renderCharacterSlots?.();
        if (!options.silent) this.log?.(`Imported ${boundPayload.character.name || 'character'} from ${sourceName} into ${account.username} slot ${targetIndex + 1}.`);
        return { ok: true, imported: 1, accountId: account.id, slotIndex: targetIndex };
      };

      Game.prototype.loadSaveCandidates = async function(candidates = [], options = {}) {
        const valid = (Array.isArray(candidates) ? candidates : []).filter(candidate => candidate?.payload && candidate?.filename);
        if (!valid.length) {
          if (!options.silent) this.log?.('No readable Dream Realms JSON save files were selected.');
          return false;
        }
        let accountDocs = 0;
        let characterDocs = 0;
        let skipped = 0;
        const ordered = valid.slice().sort((a, b) => {
          const aa = isAccountSavePayload(a.payload) || isAccountSaveFilename(a.filename) ? 0 : 1;
          const bb = isAccountSavePayload(b.payload) || isAccountSaveFilename(b.filename) ? 0 : 1;
          if (aa !== bb) return aa - bb;
          return Number(b.modified || 0) - Number(a.modified || 0);
        });
        for (const candidate of ordered) {
          if (isAccountSavePayload(candidate.payload)) {
            const result = this.importAccountSavePayload?.(candidate.payload, candidate.filename, { silent: true });
            if (result?.ok) accountDocs += result.imported || 0;
            else skipped++;
            continue;
          }
          if (isCharacterSaveFilename(candidate.filename) || candidate.payload?.character || candidate.payload?.player) {
            const result = this.importStandaloneCharacterPayload?.(candidate.payload, candidate.filename, { silent: true });
            if (result?.ok) characterDocs += result.imported || 0;
            else skipped++;
            continue;
          }
          skipped++;
        }
        const loaded = accountDocs > 0 || characterDocs > 0;
        if (loaded) {
          this.renderCharacterSlots?.();
          if (!this.getActiveAccount?.()) {
            const state = this.accountsState || this.loadAccountsState?.() || emptyAccountsState();
            const first = Object.keys(state.accounts || {})[0] || null;
            if (first) {
              state.activeAccountId = first;
              this.accountsState = state;
              this.activeAccountId = first;
              this.saveAccountsState?.({ reason: 'import-select-first-account', skipFolderWrite: true, silent: true });
            }
          }
          this.closeLogoSplash?.();
          if (!options.silent) this.log?.(`Loaded Save folder data: ${accountDocs} account record${accountDocs === 1 ? '' : 's'}, ${characterDocs} character save${characterDocs === 1 ? '' : 's'}${skipped ? `, ${skipped} skipped` : ''}.`);
          return true;
        }
        if (!options.silent) this.log?.(`No compatible Dream Realms account or character saves were found${skipped ? ` (${skipped} JSON file${skipped === 1 ? '' : 's'} skipped)` : ''}.`);
        return false;
      };

      Game.prototype.loadSaveFilesFromFileList = async function(files = [], options = {}) {
        const candidates = [];
        for (const file of Array.from(files || [])) {
          try {
            const candidate = await fileToSaveCandidate(file, file?.name || 'SelectedSave.json');
            if (candidate) candidates.push(candidate);
          } catch (err) {
            this.log?.(`Skipped ${file?.name || 'selected file'}: ${err?.message || 'invalid JSON'}.`);
          }
        }
        return this.loadSaveCandidates?.(candidates, options);
      };

      Game.prototype.loadSaveFilesFromDirectoryHandle = async function(handle = null, options = {}) {
        const root = handle || this.characterSaveDirectoryHandle;
        if (!root) return false;
        const ok = await ensureDirectoryPermission(root, options.readonly ? 'read' : 'readwrite', options.requestPermission === true);
        if (!ok) {
          if (!options.silent) this.log?.('Save folder permission was not granted. Use Load Game to select JSON files manually.');
          return false;
        }
        const previous = this.characterSaveDirectoryHandle;
        this.characterSaveDirectoryHandle = root;
        const saveDir = await this.resolveGameSaveDirectoryHandle?.({ create: false }) || root;
        const candidates = [];
        try {
          if (typeof saveDir.entries !== 'function') return false;
          for await (const [name, entry] of saveDir.entries()) {
            if (entry.kind !== 'file' || !/\.json$/i.test(name)) continue;
            if (!isAccountSaveFilename(name) && !isCharacterSaveFilename(name)) continue;
            try {
              const file = await entry.getFile();
              candidates.push(await fileToSaveCandidate(file, name));
            } catch (err) {
              if (!options.silent) this.log?.(`Skipped ${name}: ${err?.message || 'invalid JSON'}.`);
            }
          }
        } catch (err) {
          this.characterSaveDirectoryHandle = previous;
          if (!options.silent) this.log?.(`Save folder read failed: ${err?.message || err}`);
          return false;
        }
        const loaded = await this.loadSaveCandidates?.(candidates, options);
        if (!loaded && previous !== root) this.characterSaveDirectoryHandle = previous;
        return loaded;
      };

      Game.prototype.loadGameFromSavePicker = async function(options = {}) {
        if (window.showOpenFilePicker) {
          try {
            const handles = await window.showOpenFilePicker({
              id: 'dream-realms-load-game-json',
              multiple: true,
              types: [{
                description: 'Dream Realms JSON saves',
                accept: { 'application/json': ['.json'] }
              }]
            });
            const files = [];
            for (const handle of handles || []) files.push(await handle.getFile());
            return await this.loadSaveFilesFromFileList?.(files, { source: 'file-picker' });
          } catch (err) {
            if (err?.name === 'AbortError') {
              this.log?.('Load Game cancelled.');
              return false;
            }
            this.log?.(`File picker load failed: ${err?.message || err}. Falling back to standard file input.`);
          }
        } else {
          this.log?.('File System Access API is not available in this browser. Using the standard file input fallback.');
        }
        this.saveLoadInput?.click?.();
        return false;
      };

      Game.prototype.saveGameToSaveFolder = async function(options = {}) {
        if (!this.started && !this.getActiveAccount?.()) {
          this.log?.('Save Game needs a logged-in account or active character.');
          return false;
        }
        if (this.started) {
          this.saveWorldState?.({ silent: true });
          this.saveCharacterState?.({ manual: true, silent: true });
        } else {
          this.saveAccountsState?.({ reason: 'manual-save-game', silent: true });
        }
        if (!this.characterSaveDirectoryHandle) {
          if (window.showDirectoryPicker) {
            this.log?.('Choose your Save folder so Save Game can write Dream-Realms-Accounts.json.');
            const linked = await this.chooseCharacterSaveFolder?.({ writeOnly: true });
            if (!linked) return false;
          } else {
            this.log?.('This browser cannot write directly to a Save folder. Account data is saved in browser storage; use character export/download as fallback.');
            return true;
          }
        }
        const accountsSaved = await this.writeAccountsSaveToFolder?.({ manual: true, silent: false });
        const world = this.serializeWorldState?.();
        if (world) await this.writeWorldSaveToFolder?.(world, { manual: true, silent: true });
        if (accountsSaved) this.log?.(`Saved game to linked Save folder: ${SAVE_FOLDER_ACCOUNT_AUTOSAVE}.`);
        return Boolean(accountsSaved);
      };

      Game.prototype.loadAccountsSaveFromLinkedFolder = async function(options = {}) {
        const found = await this.readAccountsSaveFromFolder?.();
        if (!found?.payload) return false;
        const incoming = normalizeAccountsState(found.payload);
        const merged = mergeAccountsStates(this.accountsState || this.loadAccountsState?.() || emptyAccountsState(), incoming);
        this.accountsState = merged;
        this.activeAccountId = merged.activeAccountId || this.activeAccountId || null;
        this.saveAccountsState?.({ skipFolderWrite: true });
        this.renderCharacterSlots?.();
        if (!options.silent) this.log?.(`Loaded account-bound save document from Save folder: ${found.filename}.`);
        return true;
      };

      Game.prototype.loadCharacterSaveFromLinkedFolder = async function() {
        const accountLoaded = await this.loadAccountsSaveFromLinkedFolder?.({ silent: true });
        if (accountLoaded) {
          this.log?.(`Loaded account-bound characters from ${SAVE_FOLDER_ACCOUNT_AUTOSAVE}.`);
          return true;
        }
        const found = await this.readLatestCharacterSaveFromFolder?.();
        if (!found?.payload) {
          this.log?.('No account or legacy character JSON save found in the linked Save folder.');
          return false;
        }
        const account = this.getActiveAccount?.();
        if (!account) {
          this.log?.('Legacy character import requires an active account so the character can be bound to that account.');
          return false;
        }
        const normalized = normalizeCharacterPayload(found.payload);
        if (!normalized.ok) {
          this.log?.(`Save folder load failed: ${normalized.error}`);
          return false;
        }
        const targetSlot = Number.isInteger(this.activeCharacterSlotIndex) ? this.activeCharacterSlotIndex : 0;
        this.setCharacterSlotPayload?.(targetSlot, normalized.payload);
        this.saveAccountsState?.();
        this.log?.(`Imported legacy character save into ${account.username} slot ${targetSlot + 1}: ${found.filename}.`);
        return true;
      };

      Game.prototype.readBundledSaveFolderManifest = async function() {
        try {
          const response = await fetch(SAVE_FOLDER_MANIFEST_URL, { cache: 'no-store' });
          if (!response.ok) return null;
          return await response.json();
        } catch (_err) {
          return null;
        }
      };

      Game.prototype.chooseCharacterSaveFolder = async function(options = {}) {
        if (!window.showDirectoryPicker) {
          this.log?.('Directory Picker is not available in this browser. Use Load Game to select one or more JSON save files with the standard fallback picker.');
          return false;
        }
        try {
          const dir = await window.showDirectoryPicker({ id: 'dream-realms-save-folder', mode: 'readwrite' });
          const permission = await ensureDirectoryPermission(dir, 'readwrite', true);
          if (!permission) {
            this.log?.('Save-folder permission was not granted. Browser-local account saves remain active.');
            return false;
          }
          await this.setSaveDirectoryHandle?.(dir, { persist: true });
          if (!options.writeOnly) await this.loadSaveFilesFromDirectoryHandle?.(dir, { silent: true, requestPermission: false, source: 'directory-picker' });
          await this.writeAccountsSaveToFolder?.({ manual: true, silent: true });
          const world = this.serializeWorldState?.();
          if (world) await this.writeWorldSaveToFolder?.(world, { manual: true, silent: true });
          this.log?.(`Save folder linked. Account saves load/write through ${SAVE_FOLDER_ACCOUNT_AUTOSAVE}; legacy Dream-Realms-Character-*.json files in the folder are imported into account slots.`);
          return true;
        } catch (err) {
          if (err?.name === 'AbortError') this.log?.('Save-folder selection cancelled. Browser-local account saves remain active.');
          else this.log?.(`Save-folder selection failed: ${err?.message || err}`);
          return false;
        }
      };


      Game.prototype.loadAccountsState = function() {
        if (this.accountsState) return this.accountsState;
        const raw = readLocal(ACCOUNT_STORAGE_KEY);
        let parsed = null;
        if (raw) {
          parsed = parseJsonSafe(raw, null);
          if (!parsed) quarantineBadAccountSave(raw, 'account save JSON parse failed');
        }
        const state = normalizeAccountsState(parsed || emptyAccountsState());
        const session = parseJsonSafe(readLocal(ACCOUNT_SESSION_KEY), null);
        if (session?.activeAccountId && state.accounts[session.activeAccountId]) state.activeAccountId = session.activeAccountId;
        this.accountsState = state;
        this.activeAccountId = state.activeAccountId || null;
        return state;
      };

      Game.prototype.saveAccountsState = function(options = {}) {
        const document = serializeAccountsDocument(this.accountsState || emptyAccountsState());
        this.accountsState = document;
        this.activeAccountId = document.activeAccountId || null;
        backupCurrentAccountSave(options.reason || 'before account save overwrite');
        const ok = writeLocal(ACCOUNT_STORAGE_KEY, JSON.stringify(document));
        writeLocal(ACCOUNT_SESSION_KEY, JSON.stringify({ activeAccountId: document.activeAccountId || null, savedAt: document.savedAt }));
        if (!ok) {
          if (!options.silent) this.log?.('Account save failed: browser storage is unavailable or full.');
          return false;
        }
        if (this.characterSaveDirectoryHandle && !options.skipFolderWrite) {
          this.writeAccountsSaveToFolder?.({ auto: options.auto === true, silent: options.silent !== false });
        }
        return true;
      };

      Game.prototype.getActiveAccount = function() {
        const state = this.loadAccountsState?.() || emptyAccountsState();
        const id = this.activeAccountId || state.activeAccountId;
        return id ? state.accounts[id] || null : null;
      };

      Game.prototype.createLocalAccount = function(username, password) {
        const name = normalizeAccountName(username);
        if (!name) return { ok: false, error: 'Enter an account name.' };
        if (String(password || '').length < 1) return { ok: false, error: 'Enter a local password/PIN.' };
        const state = this.loadAccountsState?.() || emptyAccountsState();
        const key = accountKey(name);
        if (Object.values(state.accounts).some(account => account.key === key)) return { ok: false, error: 'That account already exists.' };
        const id = generateAccountId(name);
        const createdAt = nowIso();
        state.accounts[id] = normalizeAccountRecord(id, {
          id,
          username: name,
          key,
          passwordHash: simplePasswordHash(name, password),
          passwordHashMethod: ACCOUNT_PASSWORD_HASH_METHOD,
          createdAt,
          updatedAt: createdAt,
          lastLoginAt: createdAt,
          slots: [null, null, null, null]
        });
        state.activeAccountId = id;
        this.accountsState = state;
        this.activeAccountId = id;
        this.migrateLegacyCharacterSaveToAccount?.(id);
        this.saveAccountsState?.({ reason: 'account-create' });
        return { ok: true, account: state.accounts[id] };
      };

      Game.prototype.loginLocalAccount = function(username, password) {
        const name = normalizeAccountName(username);
        const state = this.loadAccountsState?.() || emptyAccountsState();
        const key = accountKey(name);
        const account = Object.values(state.accounts).find(candidate => candidate.key === key);
        if (!account) return { ok: false, error: 'Account not found. Create it first.' };
        const expected = simplePasswordHash(name, password);
        const legacyExpected = legacyPasswordHash(name, password);
        if (account.passwordHash && account.passwordHash !== expected && account.passwordHash !== legacyExpected) return { ok: false, error: 'Invalid password/PIN.' };
        if (!account.passwordHash || account.passwordHash === legacyExpected) {
          account.passwordHash = expected;
          account.passwordHashMethod = ACCOUNT_PASSWORD_HASH_METHOD;
          account.credentials = { username: account.username, passwordHash: expected, passwordHashMethod: ACCOUNT_PASSWORD_HASH_METHOD };
        }
        account.lastLoginAt = nowIso();
        account.updatedAt = account.lastLoginAt;
        state.activeAccountId = account.id;
        this.accountsState = state;
        this.activeAccountId = account.id;
        this.saveAccountsState?.({ reason: 'account-login' });
        return { ok: true, account };
      };

      Game.prototype.logoutLocalAccount = function() {
        this.cleanupPartyForSessionEnd?.({ reason: 'account-logout' });
        if (this.started && this.player) this.saveCharacterState?.({ manual: true, silent: true, reason: 'account-logout' });
        const state = this.loadAccountsState?.() || emptyAccountsState();
        state.activeAccountId = null;
        this.activeAccountId = null;
        this.activeCharacterSlotIndex = null;
        this.pendingCharacterSlotIndex = null;
        this.accountsState = state;
        this.saveAccountsState?.({ reason: 'account-logout' });
        return true;
      };

      Game.prototype.migrateLegacyCharacterSaveToAccount = function(accountId) {
        const state = this.loadAccountsState?.() || emptyAccountsState();
        const account = state.accounts[accountId];
        if (!account || account.slots?.some(Boolean)) return false;
        const raw = readLocal(CHARACTER_STORAGE_KEY);
        if (!raw) return false;
        const parsed = parseJsonSafe(raw, null);
        const normalized = normalizeCharacterPayload(parsed);
        if (!normalized.ok) return false;
        const payload = bindCharacterPayloadToAccount(normalized.payload, account, 0);
        if (!payload) return false;
        account.slots[0] = {
          slotIndex: 0,
          accountId: account.id,
          characterId: payload.characterId,
          createdAt: payload.savedAt || nowIso(),
          updatedAt: nowIso(),
          summary: characterSummaryFromPayload(payload),
          payload
        };
        account.characters = account.slots.filter(Boolean).map(slot => ({
          slotIndex: slot.slotIndex,
          accountId: slot.accountId,
          characterId: slot.characterId,
          createdAt: slot.createdAt,
          updatedAt: slot.updatedAt,
          summary: cloneJson(slot.summary)
        }));
        this.accountsState = state;
        backupCurrentCharacterSave('migrated legacy standalone character into account-bound save');
        removeLocal(CHARACTER_STORAGE_KEY);
        return true;
      };

      Game.prototype.getCharacterSlots = function() {
        const account = this.getActiveAccount?.();
        if (!account) return [];
        account.slots = Array.from({ length: 4 }, (_, i) => account.slots?.[i] || null);
        return account.slots;
      };

      Game.prototype.setCharacterSlotPayload = function(slotIndex, payload) {
        const account = this.getActiveAccount?.();
        if (!account) return false;
        const index = Math.max(0, Math.min(3, Math.floor(Number(slotIndex) || 0)));
        account.slots = Array.from({ length: 4 }, (_, i) => account.slots?.[i] || null);
        const previous = account.slots[index];
        const boundPayload = bindCharacterPayloadToAccount(payload, account, index, previous?.characterId || payload?.characterId || null);
        if (!boundPayload) return false;
        account.slots[index] = {
          slotIndex: index,
          accountId: account.id,
          characterId: boundPayload.characterId,
          createdAt: previous?.createdAt || boundPayload.savedAt || nowIso(),
          updatedAt: nowIso(),
          summary: characterSummaryFromPayload(boundPayload),
          payload: boundPayload
        };
        account.characters = account.slots.filter(Boolean).map(slot => ({
          slotIndex: slot.slotIndex,
          accountId: slot.accountId,
          characterId: slot.characterId,
          createdAt: slot.createdAt,
          updatedAt: slot.updatedAt,
          summary: cloneJson(slot.summary)
        }));
        account.updatedAt = nowIso();
        this.accountsState.accounts[account.id] = account;
        this.accountsState.activeAccountId = account.id;
        this.activeAccountId = account.id;
        this.activeCharacterSlotIndex = index;
        this.pendingCharacterSlotIndex = index;
        if (this.player) {
          this.player.accountId = account.id;
          this.player.accountUsername = account.username;
          this.player.characterId = boundPayload.characterId;
          this.player.characterSlotIndex = index;
        }
        this.saveAccountsState?.({ reason: 'character-slot-save' });
        return true;
      };

      Game.prototype.deleteCharacterSlot = function(slotIndex) {
        const account = this.getActiveAccount?.();
        if (!account) return false;
        const index = Math.max(0, Math.min(3, Math.floor(Number(slotIndex) || 0)));
        account.slots = Array.from({ length: 4 }, (_, i) => account.slots?.[i] || null);
        account.slots[index] = null;
        account.characters = account.slots.filter(Boolean).map(slot => ({
          slotIndex: slot.slotIndex,
          accountId: slot.accountId,
          characterId: slot.characterId,
          createdAt: slot.createdAt,
          updatedAt: slot.updatedAt,
          summary: cloneJson(slot.summary)
        }));
        if (this.activeCharacterSlotIndex === index) this.activeCharacterSlotIndex = null;
        if (this.pendingCharacterSlotIndex === index) this.pendingCharacterSlotIndex = null;
        account.updatedAt = nowIso();
        this.accountsState.accounts[account.id] = account;
        this.saveAccountsState?.({ reason: 'character-slot-delete' });
        return true;
      };


      Game.prototype.resetRuntimeSessionForCharacterSwap = function(options = {}) {
        const oldActors = [this.player, this.merc, this.pet, ...(this.botPlayers || [])].filter(Boolean);
        if (Array.isArray(this.entities)) this.entities = this.entities.filter(entity => entity && !oldActors.includes(entity));
        this.player = null;
        this.merc = null;
        this.pet = null;
        this.botPlayers = [];
        this.botPartyMembers = new Set();
        this.partyMembers = new Set(this.localPeerId ? [this.localPeerId] : []);
        this.partyMercIncluded = false;
        this.partyId = null;
        this.partyLeaderId = this.localPeerId || null;
        this.target = null;
        this.combatTarget = null;
        this.hoverTarget = null;
        this.interactionTarget = null;
        this.currentCave = null;
        this.activeCaveId = null;
        this.currentCaveFloor = 1;
        this.currentCaveFloors = 1;
        this.activeDungeon = null;
        this.dungeonMap = null;
        this.dungeonObjects = null;
        this.dungeonRooms = [];
        this.dungeonEnemies = [];
        if (this.dungeonRuntimeState && typeof this.dungeonRuntimeState === 'object') this.dungeonRuntimeState.active = null;
        if (this.dungeonSystem?.state && typeof this.dungeonSystem.state === 'object') this.dungeonSystem.state.active = null;
        this.currentZone = 'overworld';
        if (Array.isArray(this.overworldMap)) this.map = this.overworldMap;
        if (Array.isArray(this.overworldObjects)) this.objects = this.overworldObjects;
        if (Array.isArray(this.overworldEnemies) && typeof this.setActiveEnemySet === 'function') this.setActiveEnemySet(this.overworldEnemies);
        else if (Array.isArray(this.overworldEnemies)) this.enemies = this.overworldEnemies;
        this.started = options.started === true ? true : false;
        this.mapDirty = true;
        this.partyPanelDirty = true;
        this.botHudDirty = true;
        this.clearClickMoveTarget?.();
        return true;
      };

      Game.prototype.applySavedCharacterRuntimeZone = function(payload) {
        const targetZone = normalizeRuntimeZone(payload?.activeRuntimeZone || payload?.character?.zone || this.currentZone || 'overworld');
        // V0.20.80: restore WHICH overworld first, so the saved coordinates below are interpreted
        // against the right map. Older saves have no such field and correctly default to Dark Woods,
        // which is where every pre-V0.20.80 character was. Generation is on demand, so loading a
        // Dark Woods save still never builds Ashen Valley.
        const savedOverworld = String(payload?.activeOverworldZoneId || payload?.character?.overworldZoneId || 'dark_woods');
        if (savedOverworld !== 'dark_woods' && DR.DEFAULT_WORLD?.zones?.[savedOverworld]) {
          if (this.ensureOverworldZoneGenerated?.(savedOverworld)) {
            this.setActiveOverworldZone?.(savedOverworld);
          }
        } else {
          this.activeOverworldZoneId = 'dark_woods';
        }
        const dungeonRuntime = payload?.runtime?.dungeon && typeof payload.runtime.dungeon === 'object' ? payload.runtime.dungeon : null;
        const activeDungeonRuntime = dungeonRuntime?.active && typeof dungeonRuntime.active === 'object' ? dungeonRuntime.active : null;
        let applySavedPosition = true;

        if (targetZone === 'cave') {
          const caveId = payload?.activeCaveId || payload?.runtime?.activeCaveId || this.activeCaveId || this.currentCave?.id || 'mossfang_cave';
          const floor = Math.max(1, Math.floor(Number(payload?.activeCaveFloor || payload?.runtime?.activeCaveFloor || this.currentCaveFloor || 1)));

          // V0.13.30 corrective: old saves may have the player inside the pre-revamp
          // generic Silk Web cave wrapper. Route those saves into the authored dungeon
          // floor instead of rebuilding the old generic cave layout and then applying
          // stale cave coordinates to it.
          if (caveId === 'silk_web_cavern' && this.dungeonSystem?.loadDungeonFloor) {
            const dungeon = this.editorDungeons?.silk_web_cavern || DR.DUNGEON_BY_ID?.silk_web_cavern || null;
            if (dungeon) {
              const entrance = (this.caveEntrances || []).find(c => (c.caveId || c.id) === 'silk_web_cavern') || { x: 52, y: 139 };
              this.dungeonSystem.loadDungeonFloor({
                dungeon,
                marker: { dungeonId: 'silk_web_cavern', x: entrance.x, y: entrance.y, zoneId: 'dark_woods', directDungeon: true },
                floor: Math.max(1, Math.min(3, floor)),
                fromZone: 'overworld',
                fromZoneKey: 'dark_woods',
                returnX: Number(entrance.x || DR.CONFIG?.START_X || 100) + 0.5,
                returnY: Number(entrance.y || DR.CONFIG?.START_Y || 100) + 1.65,
                freshRun: false
              });
              applySavedPosition = false;
              this.log?.('Older Silk Web Cavern cave save redirected into the authored dungeon layout.');
            }
          }

          if (caveId === 'silk_web_cavern' && this.currentZone === 'dungeon') {
            // Already redirected above.
          } else if (typeof this.loadCaveFloor === 'function') this.loadCaveFloor(caveId, floor, 'entrance');
          else {
            this.currentZone = 'cave';
            if (Array.isArray(this.caveMap)) this.map = this.caveMap;
            if (Array.isArray(this.caveObjects)) this.objects = this.caveObjects;
            if (typeof this.setActiveEnemySet === 'function') this.setActiveEnemySet(this.caveEnemies || []);
          }
          this.activeDungeon = null;
          this.dungeonMap = null;
          this.dungeonObjects = null;
          this.dungeonRooms = [];
          this.dungeonEnemies = [];
        } else if (targetZone === 'dungeon') {
          const dungeonId = payload?.activeDungeonId || activeDungeonRuntime?.dungeonId || this.activeDungeon?.id || this.dungeonRuntimeState?.active?.dungeonId || null;
          const dungeon = dungeonId ? (this.editorDungeons?.[dungeonId] || DR.DUNGEON_BY_ID?.[dungeonId] || null) : null;
          const floor = Math.max(1, Math.floor(Number(payload?.activeDungeonFloor || activeDungeonRuntime?.floor || this.activeDungeon?.floor || 1)));
          if (dungeon && this.dungeonSystem && typeof this.dungeonSystem.loadDungeonFloor === 'function') {
            if (dungeonRuntime && typeof dungeonRuntime === 'object') {
              this.dungeonRuntimeState = cloneJson(dungeonRuntime);
              if (this.dungeonSystem.state && typeof this.dungeonSystem.state === 'object') Object.assign(this.dungeonSystem.state, cloneJson(dungeonRuntime));
            }
            const fromZone = normalizeRuntimeZone(activeDungeonRuntime?.fromZone || 'overworld');
            const fromZoneKey = activeDungeonRuntime?.fromZoneKey || (fromZone === 'cave' ? (payload?.activeCaveId || this.activeCaveId || 'mossfang_cave') : 'dark_woods');
            const returnX = Number.isFinite(Number(activeDungeonRuntime?.returnX)) ? Number(activeDungeonRuntime.returnX) : (DR.CONFIG?.START_X || window.CONFIG?.START_X || 100);
            const returnY = Number.isFinite(Number(activeDungeonRuntime?.returnY)) ? Number(activeDungeonRuntime.returnY) : (DR.CONFIG?.START_Y || window.CONFIG?.START_Y || 100);
            this.dungeonSystem.loadDungeonFloor({ dungeon, marker: null, floor, fromZone, fromZoneKey, returnX, returnY, freshRun: false });
            if (activeDungeonRuntime && this.dungeonSystem.state?.active) Object.assign(this.dungeonSystem.state.active, cloneJson(activeDungeonRuntime), { floor, floors: this.dungeonSystem.state.active.floors || activeDungeonRuntime.floors || dungeon.floors || 1 });
            if (this.dungeonSystem.state) this.dungeonRuntimeState = this.dungeonSystem.state;
          } else {
            // Safe fallback: do not apply dungeon coordinates to the overworld. Return to the saved entrance/start position.
            this.currentZone = 'overworld';
            this.activeDungeon = null;
            this.dungeonMap = null;
            this.dungeonObjects = null;
            this.dungeonRooms = [];
            this.dungeonEnemies = [];
            if (this.dungeonRuntimeState && typeof this.dungeonRuntimeState === 'object') this.dungeonRuntimeState.active = null;
            if (this.dungeonSystem?.state && typeof this.dungeonSystem.state === 'object') this.dungeonSystem.state.active = null;
            if (Array.isArray(this.overworldMap)) this.map = this.overworldMap;
            if (Array.isArray(this.overworldObjects)) this.objects = this.overworldObjects;
            if (typeof this.setActiveEnemySet === 'function') this.setActiveEnemySet(this.overworldEnemies || []);
            if (this.player) {
              const fallbackX = Number.isFinite(Number(activeDungeonRuntime?.returnX)) ? Number(activeDungeonRuntime.returnX) : (DR.CONFIG?.START_X || window.CONFIG?.START_X || this.player.x || 100);
              const fallbackY = Number.isFinite(Number(activeDungeonRuntime?.returnY)) ? Number(activeDungeonRuntime.returnY) : (DR.CONFIG?.START_Y || window.CONFIG?.START_Y || this.player.y || 100);
              this.player.x = fallbackX;
              this.player.y = fallbackY;
            }
            applySavedPosition = false;
            this.log?.('Saved dungeon session could not be restored; returned character to the dungeon entrance for safety.');
          }
        } else {
          this.currentZone = 'overworld';
          this.currentCave = null;
          this.activeCaveId = null;
          this.currentCaveFloor = 1;
          this.currentCaveFloors = 1;
          this.activeDungeon = null;
          this.dungeonMap = null;
          this.dungeonObjects = null;
          this.dungeonRooms = [];
          this.dungeonEnemies = [];
          if (this.dungeonRuntimeState && typeof this.dungeonRuntimeState === 'object') this.dungeonRuntimeState.active = null;
          if (this.dungeonSystem?.state && typeof this.dungeonSystem.state === 'object') this.dungeonSystem.state.active = null;
          if (Array.isArray(this.overworldMap)) this.map = this.overworldMap;
          if (Array.isArray(this.overworldObjects)) this.objects = this.overworldObjects;
          if (typeof this.setActiveEnemySet === 'function') this.setActiveEnemySet(this.overworldEnemies || []);
        }
        if (this.player) this.player.zone = this.currentZone || targetZone;
        return { zone: this.currentZone || targetZone, applySavedPosition };
      };

      Game.prototype.applySavedPlayerPosition = function(x, y) {
        if (!this.player) return false;
        const size = this.activeMapSize?.() || DR.CONFIG?.MAP_SIZE || window.CONFIG?.MAP_SIZE || 200;
        let px = clampFinite(x, 1, size - 2, this.player.x || DR.CONFIG?.START_X || 20);
        let py = clampFinite(y, 1, size - 2, this.player.y || DR.CONFIG?.START_Y || 20);
        const map = Array.isArray(this.map) ? this.map : [];
        const blockedAt = (tx, ty) => Boolean(map[Math.floor(ty)]?.[Math.floor(tx)]?.blocked);
        if (blockedAt(px, py)) {
          let found = null;
          const cx = Math.floor(px);
          const cy = Math.floor(py);
          for (let r = 1; r <= 8 && !found; r++) {
            for (let yy = cy - r; yy <= cy + r && !found; yy++) {
              for (let xx = cx - r; xx <= cx + r; xx++) {
                if (xx < 1 || yy < 1 || xx >= size - 1 || yy >= size - 1) continue;
                if (!blockedAt(xx + 0.5, yy + 0.5)) { found = { x: xx + 0.5, y: yy + 0.5 }; break; }
              }
            }
          }
          if (found) { px = found.x; py = found.y; }
        }
        this.player.x = px;
        this.player.y = py;
        this.player.zone = this.currentZone || this.player.zone || 'overworld';
        this.player.vx = 0;
        this.player.vy = 0;
        this.clearClickMoveTarget?.();
        this.recenterCameraOnPlayer?.(false);
        return true;
      };

      Game.prototype.loadCharacterSlot = function(slotIndex) {
        const account = this.getActiveAccount?.();
        if (!account) {
          this.log?.('Character slot load failed: login to an account first.');
          return false;
        }
        const slots = this.getCharacterSlots?.() || [];
        const index = Math.max(0, Math.min(3, Math.floor(Number(slotIndex) || 0)));
        const slot = slots[index];
        if (slot && slot.accountId && slot.accountId !== account.id) {
          this.log?.('Character slot load blocked: this character belongs to another account.');
          return false;
        }
        const boundPayload = bindCharacterPayloadToAccount(slot?.payload, account, index, slot?.characterId || null);
        const normalized = normalizeCharacterPayload(boundPayload);
        if (!normalized.ok) {
          this.log?.(`Character slot load failed: ${normalized.error}`);
          return false;
        }
        const c = normalized.payload.character;
        this.pendingCharacterSlotIndex = index;
        this.activeCharacterSlotIndex = index;
        this.resetRuntimeSessionForCharacterSwap?.({ reason: 'load-character-slot' });
        this.start(DR.CLASSES?.[c.className] ? c.className : 'Fighter', c);
        this.applyCharacterState?.(normalized.payload);
        this.started = true;
        this.enterGameplayDisplayMode?.('load-character-slot');
        document.body.classList.add('gameStarted');
        document.body.classList.remove('blackrootMenuActive');
        this.resize?.();
        this.recenterCameraOnPlayer?.(true);
        this.setCharacterSlotPayload?.(index, normalized.payload);
        this.log?.(`Loaded ${c.name || 'character'} from ${account.username} slot ${index + 1}.`);
        return true;
      };

      Game.prototype.saveCharacterState = function(options = {}) {
        const account = this.getActiveAccount?.();
        if (!account) {
          if (!options.silent && !options.auto) this.log?.('Character save blocked: login or create an account first.');
          return false;
        }
        const payload = this.serializeCharacterState?.();
        if (!payload) return false;
        const normalized = normalizeCharacterPayload(payload);
        if (!normalized.ok) {
          if (!options.silent) this.log?.(`Character save blocked: ${normalized.error}`);
          return false;
        }
        let targetSlot = Number.isInteger(this.activeCharacterSlotIndex) ? this.activeCharacterSlotIndex : Number.isInteger(this.pendingCharacterSlotIndex) ? this.pendingCharacterSlotIndex : -1;
        if (targetSlot < 0) {
          const slots = this.getCharacterSlots?.() || [];
          const emptyIndex = slots.findIndex(slot => !slot);
          targetSlot = emptyIndex >= 0 ? emptyIndex : 0;
        }
        targetSlot = Math.max(0, Math.min(3, targetSlot));
        const saved = this.setCharacterSlotPayload?.(targetSlot, normalized.payload);
        if (!saved) {
          if (!options.silent && !options.auto) this.log?.('Character save failed: account slot binding failed.');
          return false;
        }
        if (readLocal(CHARACTER_STORAGE_KEY)) {
          backupCurrentCharacterSave('legacy standalone character replaced by account-bound save');
          removeLocal(CHARACTER_STORAGE_KEY);
        }
        this.characterSaveDirty = false;
        if (this.characterSaveDirectoryHandle) this.writeAccountsSaveToFolder?.({ auto: options.auto === true, silent: options.silent !== false });
        const slotText = ` · ${account.username} Slot ${targetSlot + 1}`;
        if (!options.silent && !options.auto) this.log?.(`Saved character: ${normalized.payload.character.name}${slotText}.`);
        if (options.auto) this.log?.(`Autosaved account-bound character${slotText}.`);
        this.renderCharacterSlots?.();
        return true;
      };


      Game.prototype.autoSaveCharacterState = function() {
        if (!this.started || !this.player) return false;
        this.saveWorldState?.({ silent: true });
        return this.saveCharacterState?.({ auto: true, silent: false }) || false;
      };

      Game.prototype.updateAutosave = function(dt) {
        if (!this.started || !this.player) return;
        const interval = Math.max(60, Number(this.characterAutosaveInterval || CHARACTER_AUTOSAVE_SECONDS));
        this.characterAutosaveTimer = Math.max(0, Number(this.characterAutosaveTimer || 0) + Math.max(0, Number(dt) || 0));
        if (this.characterAutosaveTimer < interval) return;
        this.characterAutosaveTimer = 0;
        this.autoSaveCharacterState?.();
      };

      Game.prototype.exportCharacterSave = function() {
        const payload = this.serializeCharacterState?.();
        if (!payload) return this.log?.('No active character to export.');
        const normalized = normalizeCharacterPayload(payload);
        if (!normalized.ok) return this.log?.(`Character export blocked: ${normalized.error}`);
        downloadText(this.characterSaveFilename(normalized.payload, `-${new Date().toISOString().replace(/[:.]/g, '-')}`), JSON.stringify(normalized.payload, null, 2));
        this.log?.(`Exported character save JSON: ${normalized.payload.character.name}.`);
        return true;
      };

      Game.prototype.importCharacterSaveFromFile = function(file) {
        const reader = new FileReader();
        reader.onload = () => {
          let payload;
          try { payload = JSON.parse(String(reader.result || '')); }
          catch (_err) { this.log?.('Character import failed: selected file is not valid JSON.'); return; }
          const normalized = normalizeCharacterPayload(payload);
          if (!normalized.ok) { this.log?.(`Character import failed: ${normalized.error}`); return; }
          const account = this.getActiveAccount?.();
          if (!account) { this.log?.('Character import failed: login to an account before importing.'); return; }
          const slotIndex = Number.isInteger(this.activeCharacterSlotIndex) ? this.activeCharacterSlotIndex : Number.isInteger(this.pendingCharacterSlotIndex) ? this.pendingCharacterSlotIndex : 0;
          this.setCharacterSlotPayload?.(slotIndex, normalized.payload);
          if (this.player) this.applyCharacterState?.(normalized.payload);
          this.renderCharacterSlots?.();
          this.log?.(`Imported character save into ${account.username} slot ${slotIndex + 1}: ${normalized.payload.character.name}.`);
        };
        reader.onerror = () => this.log?.('Character import failed: unable to read selected file.');
        reader.readAsText(file);
      };

      // V0.20.2 - BUG: creating a new character inherited the previous character's gear, bags, bank,
      // quests and profession levels (reported: a fresh level-1 wearing another character's rares).
      //
      // ROOT CAUSE: a character's belongings do NOT live on the Player object. `entities/player.js` has
      // no inventory at all - inventory/equipment/bags/bank and the quest/crafting/gathering system
      // states all hang off the GAME. start() replaces this.player with a fresh Player and leaves every
      // one of them exactly where it was. The LOAD path got away with it because applyCharacterState()
      // overwrites them immediately afterwards; the CREATE path has nothing to overwrite them with, so
      // character 2 simply kept character 1's things - and, because classStartingGearGranted survived
      // too, was denied its own starter kit on top of that.
      //
      // resetRuntimeSessionForCharacterSwap() is NOT this: it clears actors, party, targets and zone -
      // the session - and deliberately says nothing about what a character owns.
      //
      // This is the MIRROR of applyCharacterState below: whatever that restores per character, this
      // clears. Keep the two in step - a field added there and not here becomes the next leak.
      Game.prototype.resetCharacterOwnedState = function() {
        this.classStartingGearGranted = false;
        this.inventory = [];
        this.equipment = {};
        this.armorProficiency = {}; // V0.20.41 (Roadmap Item 8): a fresh character starts unskilled.
        this.ensureEquipmentSlots?.();
        this.bags = [];
        this.ensureBagSystem?.();          // rebuilds the locked starter satchel
        if (this.importBankState) this.importBankState([]);
        else this.bank = [];
        // Each system's importState(null) rebuilds its own defaultState() - the same entry point
        // applyCharacterState uses with saved data, so a reset cannot drift from a load.
        this.questSystem?.importState?.(null);
        this.craftingSystem?.importState?.(null);
        this.resourceGatheringSystem?.importState?.(null);
        // V0.20.64: mirror for the mount collection. Mounts are character-owned, so a fresh
        // character must start with an empty stable and nothing mounted.
        this.mountSystem?.importState?.(null);
        // Fog is exploration memory, persisted per character under dream-realms.fog.v1:<characterId>.
        // Clear it in memory and re-arm the loader so the new character reads its OWN key rather than
        // inheriting the previous character's revealed map.
        this.fog = { zones: {}, discovered: {} };
        this._fogLoaded = false;
        // V0.20.80: mirror for the overworld zone. Without this a new character created while the
        // previous one stood in Ashen Valley would BEGIN in the level 10-20 zone - found in testing,
        // and the same belongings-leak shape as the V0.20.2 mount bug.
        //
        // Must go through setActiveOverworldZone, NOT a bare id assignment: the id and the live
        // `this.map` are two separate things, and setting only the id left the new character standing
        // on Ashen Valley's 450x450 terrain while everything reported "dark_woods" (also caught in
        // testing, and far nastier than the original bug because it looks correct from the outside).
        this.setActiveOverworldZone?.('dark_woods');
        return true;
      };

      Game.prototype.applyCharacterState = function(payload) {
        const normalized = normalizeCharacterPayload(payload);
        if (!normalized.ok || !this.player) return false;
        const data = normalized.payload;
        const c = data.character;
        this.classStartingGearGranted = Boolean(data.starterGearGranted ?? c.starterGearGranted);
        this.player.accountId = data.accountId || c.accountId || this.activeAccountId || null;
        this.player.accountUsername = data.accountUsername || c.accountUsername || this.getActiveAccount?.()?.username || null;
        this.player.characterId = data.characterId || c.characterId || this.player.characterId || null;
        this.player.characterSlotIndex = Number.isInteger(data.characterSlotIndex) ? data.characterSlotIndex : (Number.isInteger(c.characterSlotIndex) ? c.characterSlotIndex : this.activeCharacterSlotIndex);
        this.player.name = String(c.name || this.player.name).slice(0, 18);
        this.player.className = DR.CLASSES?.[c.className] ? c.className : (this.player.className || 'Fighter');
        this.player.raceId = DR.normalizeRaceId?.(c.raceId) || 'human';
        this.player.racePaletteId = DR.normalizeRacePaletteId?.(this.player.raceId, c.racePaletteId);
        this.player.itemCooldowns = c.itemCooldowns && typeof c.itemCooldowns === 'object' ? cloneJson(c.itemCooldowns) : {};
        this.player.gender = c.gender || this.player.gender;
        this.player.hairStyle = DR.Hairstyles?.normalize?.(this.player.raceId, c.hairStyle || this.player.hairStyle) || c.hairStyle || this.player.hairStyle;
        this.player.hairColor = c.hairColor || this.player.hairColor || '#4b3628';
        this.player.eyeColor = c.eyeColor || this.player.eyeColor || '#8ec9ff';
        this.player.faceStyle = c.faceStyle || this.player.faceStyle || 'balanced';
        this.player.skinTone = c.skinTone || this.player.skinTone;
        this.player.clothesPrimary = c.clothesPrimary || this.player.clothesPrimary;
        this.player.clothesSecondary = c.clothesSecondary || this.player.clothesSecondary;
        this.player.level = Math.max(1, Math.floor(Number(c.level) || this.player.level || 1));
        this.player.xp = Math.max(0, Math.floor(Number(c.xp) || 0));
        this.player.nextXp = Math.max(1, Math.floor(Number(c.nextXp) || this.player.nextXp || 100));
        this.player.maxHp = Math.max(1, Math.floor(Number(c.maxHp) || this.player.maxHp || 1));
        this.player.hp = Math.max(1, Math.min(this.player.maxHp, Math.floor(Number(c.hp) || this.player.hp || this.player.maxHp)));
        this.player.maxMana = Math.max(1, Math.floor(Number(c.maxMana) || this.player.maxMana || 1));
        this.player.mana = Math.max(0, Math.min(this.player.maxMana, Math.floor(Number(c.mana) || this.player.mana || this.player.maxMana)));
        this.player.baseMaxHp = Math.max(1, Math.floor(Number(c.baseMaxHp) || Number(c.maxHp) || this.player.baseMaxHp || this.player.maxHp || 1));
        this.player.baseMaxMana = Math.max(0, Math.floor(Number(c.baseMaxMana) || Number(c.maxMana) || this.player.baseMaxMana || this.player.maxMana || 0));
        this.player.baseAttack = Math.max(1, Math.floor(Number(c.baseAttack) || this.player.baseAttack || this.player.attack || 1));
        this.player.baseDefense = Math.max(0, Math.floor(Number(c.baseDefense) || this.player.baseDefense || this.player.defense || 0));
        if (c.attributes && typeof c.attributes === 'object') this.player.attributes = cloneJson(c.attributes);
        this.player.coinCopper = Math.max(0, Math.floor(Number(c.coinCopper) || 0));
        if (c.meditationSkill) this.player.meditationSkill = cloneJson(c.meditationSkill);
        this.player.meditation = c.meditation ? cloneJson(c.meditation) : null;
        this.normalizeMeditationState?.(this.player);
        this.player.oxygenMax = Math.max(1, Math.floor(Number(c.oxygenMax) || this.player.oxygenMax || 45));
        this.player.oxygen = Math.max(0, Math.min(this.player.oxygenMax, Math.floor(Number(c.oxygen) || this.player.oxygenMax)));
        if (Array.isArray(c.statusEffects)) this.importEntityStatuses?.(this.player, c.statusEffects);
        else this.player.buffs = [];
        DR.restoreActorLiveState?.(this.player);
        this.inventory = Array.isArray(data.inventory) ? cloneJson(data.inventory) : [];
        this.equipment = data.equipment && typeof data.equipment === 'object' && !Array.isArray(data.equipment) ? cloneJson(data.equipment) : this.equipment;
        this.armorProficiency = data.armorProficiency && typeof data.armorProficiency === 'object' ? cloneJson(data.armorProficiency) : {}; // V0.20.41 (Roadmap Item 8)
        this.ensureEquipmentSlots?.();
        this.bags = Array.isArray(data.bags) ? cloneJson(data.bags) : this.bags;
        // Phase 9 (Intersect parity): personal bank storage.
        if (this.importBankState) this.importBankState(cloneJson(data.bank || []));
        else this.bank = Array.isArray(data.bank) ? cloneJson(data.bank) : (this.bank || []);
        // Phase 1 (Simulation Core): additive character-model fields; no
        // owning gameplay system consumes these yet, so they are restored
        // as plain data for round-tripping through save/load.
        this.player.skillTrees = data.skillTrees && typeof data.skillTrees === 'object' && !Array.isArray(data.skillTrees) ? cloneJson(data.skillTrees) : {};
        // V0.17.69 Talents: restore -> normalize (migrate/validate/clamp) -> rebuild
        // derived stat/spell/combat/proc effects.
        this.player.talents = data.talents && typeof data.talents === 'object' ? cloneJson(data.talents) : null;
        this.normalizeTalentState?.(this.player);
        this.rebuildTalentEffects?.();
        // V0.17.71 BUG 1: restore action-bar assignments, then drop any that no
        // longer resolve to a class spell (content churn) and refill defaults.
        this.player.hotbar = Array.isArray(data.hotbar) ? cloneJson(data.hotbar) : null;
        this.normalizeHotbar?.();
        this.updateSpellHotbar?.();
        this.player.factions = data.factions && typeof data.factions === 'object' && !Array.isArray(data.factions) ? cloneJson(data.factions) : {};
        this.player.unlockedWaypoints = Array.isArray(data.unlockedWaypoints) ? cloneJson(data.unlockedWaypoints) : [];
        if (!Number.isFinite(Number(c.baseMaxHp)) || !Number.isFinite(Number(c.baseMaxMana)) || !Number.isFinite(Number(c.baseAttack)) || !Number.isFinite(Number(c.baseDefense))) {
          const gear = { hp: 0, mana: 0, attack: 0, defense: 0 };
          for (const item of Object.values(this.equipment || {})) {
            if (!item?.stats) continue;
            gear.hp += Number(item.stats.hp || 0);
            gear.mana += Number(item.stats.mana || 0);
            gear.attack += Number(item.stats.attack || 0);
            gear.defense += Number(item.stats.defense || 0);
          }
          if (!Number.isFinite(Number(c.baseMaxHp))) this.player.baseMaxHp = Math.max(1, Math.floor(this.player.maxHp - gear.hp));
          if (!Number.isFinite(Number(c.baseMaxMana))) this.player.baseMaxMana = Math.max(0, Math.floor(this.player.maxMana - gear.mana));
          if (!Number.isFinite(Number(c.baseAttack))) this.player.baseAttack = Math.max(1, Math.floor((this.player.baseAttack || this.player.attack || 1) - gear.attack));
          if (!Number.isFinite(Number(c.baseDefense))) this.player.baseDefense = Math.max(0, Math.floor((this.player.baseDefense || this.player.defense || 0) - gear.defense));
        }
        const runtimeZoneRestore = this.applySavedCharacterRuntimeZone?.(data);
        if (runtimeZoneRestore?.applySavedPosition !== false) this.applySavedPlayerPosition?.(c.x, c.y);
        if (data.runtime?.worldTime && typeof this.applyWorldTimeState === 'function') this.applyWorldTimeState(data.runtime.worldTime);
        if (data.runtime?.weather && typeof this.applyWeatherState === 'function') this.applyWeatherState(data.runtime.weather);
        if (data.runtime?.mercenary && typeof this.restoreMercenaryState === 'function') this.restoreMercenaryState(data.runtime.mercenary);
        if (data.runtime?.pet && typeof this.restorePetState === 'function') this.restorePetState(data.runtime.pet);
        if (data.runtime?.botPlayers && typeof this.restoreBotPlayerState === 'function') this.restoreBotPlayerState(data.runtime.botPlayers);
        if (data.runtime?.adventurerPopulation && typeof this.restoreAdventurerPopulation === 'function') this.restoreAdventurerPopulation(data.runtime.adventurerPopulation);
        if (data.runtime?.party && typeof this.restorePartyState === 'function') this.restorePartyState(data.runtime.party);
        if (data.runtime?.resourceGathering && this.resourceGatheringSystem?.importState) this.resourceGatheringSystem.importState(data.runtime.resourceGathering);
        if (data.runtime?.crafting && this.craftingSystem?.importState) this.craftingSystem.importState(data.runtime.crafting);
        // V0.20.64 (Roadmap Item 7.F): always call importState, even when the save predates mounts -
        // passing null rebuilds the empty collection rather than leaving the previous character's.
        this.mountSystem?.importState?.(data.runtime?.mounts || null);
        if (data.runtime?.quests && this.questSystem?.importState) this.questSystem.importState(data.runtime.quests);
        if (data.runtime?.fog && this.restoreFogState) { this.restoreFogState(data.runtime.fog); this._fogLoaded = true; }
        // Phase 1 (Descriptor & Registry Normalization): descriptor-version
        // migration guard. This never blocks or mutates the load - it only
        // logs when a save was written against a different descriptor
        // catalog version, and surfaces any quest ids that no longer
        // resolve so a stale save doesn't fail silently.
        try {
          const currentDescriptorVersion = DR.Registry?.DESCRIPTOR_VERSION;
          if (currentDescriptorVersion != null && data.descriptorSchemaVersion != null && data.descriptorSchemaVersion !== currentDescriptorVersion) {
            console.info(`[Dream Realms Save] Character save was written with descriptor schema v${data.descriptorSchemaVersion}, current is v${currentDescriptorVersion}. Content ids are re-validated below.`);
          }
          const questRuntime = data.runtime?.quests;
          if (questRuntime && DR.Registry?.auditRuntimeReferences) {
            const questIds = [
              ...Object.keys(questRuntime.active || {}),
              ...Object.keys(questRuntime.completed || {}),
              ...Object.keys(questRuntime.discovered || {})
            ];
            DR.Registry.auditRuntimeReferences('quest', questIds, 'character save quest runtime');
          }
        } catch (_) { /* validation must never block character load */ }
        this.ensureBotPlayers?.({ silent: true });
        this.reconcileLoadedCompanionZones?.({ zone: this.currentZone || this.player?.zone || 'overworld' });
        this.ensureBagSystem?.();
        this.recalculatePlayerStats?.();
        this.renderBag?.();
        this.updateSpellHotbar?.();
        this.updateUI?.();
        return true;
      };


      Game.prototype.hasSavedWorldState = function() {
        return Boolean(readLocal(WORLD_STORAGE_KEY));
      };

      Game.prototype.loadSavedWorldState = function(options = {}) {
        const raw = readLocal(WORLD_STORAGE_KEY);
        if (!raw) {
          if (!options.silent) this.log('No saved world state found.');
          return false;
        }

        const parsed = parseWorldJson(raw);
        if (!parsed.ok) {
          if (options.duringBoot) {
            quarantineBadWorldSave(raw, `parse failed: ${parsed.error}`);
            this.worldSaveLoadErrorAtBoot = 'saved world JSON is corrupted';
          }
          if (!options.silent) this.log('Saved world state is corrupted and was not loaded.');
          return false;
        }

        const migration = migrateWorldPayload(parsed.payload);
        if (!migration.ok) {
          if (options.duringBoot) {
            quarantineBadWorldSave(raw, migration.error);
            this.worldSaveLoadErrorAtBoot = migration.error;
          }
          if (!options.silent) this.log(`World load failed: ${migration.error}`);
          return false;
        }

        const result = DR.WorldSerializer.apply(this, migration.payload);
        if (!result.ok) {
          if (options.duringBoot) {
            quarantineBadWorldSave(raw, result.error);
            this.worldSaveLoadErrorAtBoot = result.error;
          }
          if (!options.silent) this.log(`World load failed: ${result.error}`);
          return false;
        }

        if (migration.migrated) {
          backupCurrentWorldSave('before automatic migration');
          writeLocal(WORLD_STORAGE_KEY, JSON.stringify(result.payload || migration.payload));
          this.worldSaveMigratedAtBoot = options.duringBoot;
        }

        this.markItemCatalogDirty?.('world load');
        this.rebuildRuntimeItemCatalog?.();
        this.markSpellBookDirty?.('world load');
        this.rebuildRuntimeSpellBook?.();
        this.updateSpellHotbar?.();
        if (options.resetEntities && this.player) this.rebuildWorldRuntimeAfterWorldLoad();
        if (!options.silent) {
          const suffix = migration.migrated ? ` Migrated ${migration.migrations.length} save section(s).` : '';
          this.log(`Loaded saved world state.${suffix}`);
        }
        return true;
      };

      Game.prototype.resetWorldSave = function() {
        backupCurrentWorldSave('before reset');
        removeLocal(WORLD_STORAGE_KEY);
        this.generateDefaultWorld();
        this.editorAttributes = { dark_woods: {}, mossfang_cave: {} };
        this.editorResources = { dark_woods: {}, mossfang_cave: {} };
        this.editorEvents = { dark_woods: {}, mossfang_cave: {} };
        this.editorNpcs = { dark_woods: {}, mossfang_cave: {} };
        this.editorMobSpawns = { dark_woods: {}, mossfang_cave: {} };
        this.editorDungeonMarkers = { dark_woods: {}, mossfang_cave: {} };
        this.editorNpcDefinitions = JSON.parse(JSON.stringify(DR.NPC_DRAFT_BY_ID || {}));
        this.editorMobDefinitions = JSON.parse(JSON.stringify(DR.MOB_DRAFT_BY_ID || {}));
        this.editorBosses = JSON.parse(JSON.stringify(DR.BOSS_BY_ID || {}));
        this.editorMobSpawnDefinitions = JSON.parse(JSON.stringify(DR.MOB_SPAWN_BY_ID || {}));
        this.editorDungeons = JSON.parse(JSON.stringify(DR.DUNGEON_BY_ID || {}));
        this.editorPuzzles = JSON.parse(JSON.stringify(DR.PUZZLE_BY_ID || {}));
        this.editorQuests = JSON.parse(JSON.stringify(DR.QUEST_BY_ID || {}));
        this.editorResourceTypes = JSON.parse(JSON.stringify(DR.RESOURCE_BY_ID || {}));
        this.editorProfessions = JSON.parse(JSON.stringify(DR.PROFESSION_BY_ID || {}));
        this.editorCraftingStations = JSON.parse(JSON.stringify(DR.CRAFTING_STATION_BY_ID || {}));
        this.editorRecipes = JSON.parse(JSON.stringify(DR.CRAFTING_RECIPE_BY_ID || {}));
        this.editorItems = JSON.parse(JSON.stringify(DR.ITEM_BY_ID || {}));
        this.markItemCatalogDirty?.('world reset');
        this.rebuildRuntimeItemCatalog?.();
        this.editorLootTables = JSON.parse(JSON.stringify(DR.LOOT_TABLE_BY_ID || {}));
        this.editorSpells = JSON.parse(JSON.stringify(DR.SPELL_BY_ID || {}));
        this.classSpellSlots = JSON.parse(JSON.stringify(DR.DEFAULT_CLASS_SPELL_SLOTS || {}));
        this.markSpellBookDirty?.('world reset');
        this.rebuildRuntimeSpellBook?.();
        this.updateSpellHotbar?.();
        this.chestRuntimeState = null;
        this.pendingChestRuntimeState = null;
        if (this.chestSystem && typeof this.chestSystem.importState === 'function') { this.chestSystem.importState(null); this.chestSystem.saveState?.(); }
        this.resourceRuntimeState = null;
        this.pendingResourceRuntimeState = null;
        if (this.resourceGatheringSystem && typeof this.resourceGatheringSystem.importState === 'function') { this.resourceGatheringSystem.importState(null); this.resourceGatheringSystem.saveState?.(); }
        this.craftingRuntimeState = null;
        this.pendingCraftingRuntimeState = null;
        if (this.craftingSystem && typeof this.craftingSystem.importState === 'function') { this.craftingSystem.importState(null); this.craftingSystem.saveState?.(); }
        this.npcRuntimeState = null;
        this.pendingNpcRuntimeState = null;
        this.npcTrainingBonuses = { hp: 0, mana: 0, attack: 0, defense: 0, speed: 0 };
        if (this.npcSystem && typeof this.npcSystem.importState === 'function') { this.npcSystem.importState(null); this.npcSystem.ensureDefaultNpcPlacements?.(); this.npcSystem.saveState?.(); }
        this.mobSpawnRuntimeState = null;
        this.pendingMobSpawnRuntimeState = null;
        if (this.mobSpawnSystem && typeof this.mobSpawnSystem.importState === 'function') { this.mobSpawnSystem.importState(null); this.mobSpawnSystem.ensureDefaultMobSpawnPlacements?.(); }
        this.dungeonRuntimeState = null;
        this.pendingDungeonRuntimeState = null;
        this.activeDungeon = null;
        this.dungeonMap = null;
        this.dungeonObjects = null;
        this.dungeonEnemies = [];
        this.dungeonRooms = [];
        if (this.dungeonSystem && typeof this.dungeonSystem.importState === 'function') { this.dungeonSystem.importState(null); this.dungeonSystem.ensureDefaultDungeonEntrances?.(); }
        this.puzzleRuntimeState = null;
        this.pendingPuzzleRuntimeState = null;
        if (this.puzzleSystem && typeof this.puzzleSystem.importState === 'function') { this.puzzleSystem.importState(null); }
        this.editorSpawnPoints = { dark_woods: null, mossfang_cave: null };
        this.zoneProperties = {
          dark_woods: { levelMin: 1, levelMax: 10, weather: 'temperate_forest', biome: 'temperate_forest', elevation: 850, music: 'dark_woods' },
          mossfang_cave: { levelMin: 1, levelMax: 8, weather: 'none', biome: 'cave', elevation: 120, music: 'cave_ambience' }
        };
        this.caveEditorMeta = {
          mossfang_cave: { name: 'Mossfang Cave', theme: 'mossfang', size: 'big', floors: 1, mobFamily: 'cave_wolves', notes: 'Starter cave attached to Dark Woods.' }
        };
        this.applyWeatherState?.(null);
        this.rebuildWorldRuntimeAfterWorldLoad();
        this.log('Reset world save. Default Dark Woods restored.');
        return true;
      };

      Game.prototype.exportWorldSave = function() {
        const payload = this.serializeWorldState();
        const validation = migrateWorldPayload(payload);
        if (!validation.ok) {
          this.log(`World export blocked: ${validation.error}`);
          return false;
        }
        const json = JSON.stringify(validation.payload, null, 2);
        downloadText('Dream-Realms-World-Save.json', json);
        this.log(`Exported world save JSON · format ${validation.payload.saveFormatVersion || 2} · Pass ${validation.payload.buildPass || 65}.`);
        return true;
      };

      Game.prototype.importWorldSaveFromFile = function(file) {
        const reader = new FileReader();
        reader.onload = () => {
          let payload;
          try { payload = JSON.parse(String(reader.result || '')); }
          catch (_err) {
            this.log('Import failed: selected file is not valid JSON.');
            return;
          }

          const migration = migrateWorldPayload(payload);
          if (!migration.ok) {
            this.log(`Import failed: ${migration.error}`);
            return;
          }

          backupCurrentWorldSave('before world import');
          const result = DR.WorldSerializer.apply(this, migration.payload);
          if (!result.ok) {
            this.log(`Import failed: ${result.error}`);
            return;
          }

          this.markItemCatalogDirty?.('world import');
          this.rebuildRuntimeItemCatalog?.();
          this.markSpellBookDirty?.('world import');
          this.rebuildRuntimeSpellBook?.();
          this.updateSpellHotbar?.();
          this.saveWorldState();
          this.rebuildWorldRuntimeAfterWorldLoad();
          const suffix = migration.migrated ? ` Migrated ${migration.migrations.length} section(s).` : '';
          this.log(`Imported world save and set it as the active world.${suffix}`);
        };
        reader.onerror = () => this.log('Import failed: unable to read selected file.');
        reader.readAsText(file);
      };

      Game.prototype.rebuildWorldRuntimeAfterWorldLoad = function() {
        const keep = new Set([this.player, this.merc, this.pet]);
        for (const remote of this.remotePlayers?.values?.() || []) keep.add(remote.entity);
        this.entities = this.entities.filter(entity => keep.has(entity));

        this.overworldEnemies = [];
        this.caveEnemies = [];
        this.enemies = [];
        this.currentZone = 'overworld';
        this.map = this.overworldMap;
        this.objects = this.overworldObjects;
        // Phase 20: re-seed the Dark Woods overworld herbs after a saved
        // editorResources has been applied (world load replaces the grid), so
        // saves created before the herbs existed still get them. Idempotent -
        // skips any herb type already present in the loaded grid.
        this.ensureDarkWoodsOverworldHerbs?.();
        this.ensureCampStashChest?.();
        this.spawnEnemies();
        this.setActiveEnemySet(this.overworldEnemies);

        if (this.player) {
          const resetBoundsSize = this.activeMapSize?.() || DR.CONFIG?.MAP_SIZE || 200;
          this.player.x = Math.max(1, Math.min(resetBoundsSize - 2, this.player.x));
          this.player.y = Math.max(1, Math.min(resetBoundsSize - 2, this.player.y));
          if (this.map[Math.floor(this.player.y)]?.[Math.floor(this.player.x)]?.blocked) {
            this.player.x = DR.CONFIG.START_X + 0.5;
            this.player.y = DR.CONFIG.START_Y + 0.5;
          }
        }

        this.markItemCatalogDirty?.('runtime rebuild');
        this.rebuildRuntimeItemCatalog?.();
        this.markSpellBookDirty?.('runtime rebuild');
        this.rebuildRuntimeSpellBook?.();
        this.updateSpellHotbar?.();
        if (this.chestSystem?.importState) this.chestSystem.importState(this.pendingChestRuntimeState || this.chestRuntimeState || null);
        if (this.resourceGatheringSystem?.importState) this.resourceGatheringSystem.importState(this.pendingResourceRuntimeState || this.resourceRuntimeState || null);
        if (this.craftingSystem?.importState) this.craftingSystem.importState(this.pendingCraftingRuntimeState || this.craftingRuntimeState || null);
        if (this.npcSystem?.importState) this.npcSystem.importState(this.pendingNpcRuntimeState || this.npcRuntimeState || null);
        if (this.dungeonSystem?.importState) this.dungeonSystem.importState(this.pendingDungeonRuntimeState || this.dungeonRuntimeState || null);
        if (this.puzzleSystem?.importState) this.puzzleSystem.importState(this.pendingPuzzleRuntimeState || this.puzzleRuntimeState || null);
        if (this.mobSpawnSystem?.importState) this.mobSpawnSystem.importState(this.pendingMobSpawnRuntimeState || this.mobSpawnRuntimeState || null);
        if (this.questSystem?.importState) this.questSystem.importState(this.pendingQuestRuntimeState || this.questRuntimeState || null);
        if (this.eventSystem?.importState) this.eventSystem.importState(this.pendingEventRuntimeState || this.eventRuntimeState || null);

        if (typeof this.buildStaticMinimap === 'function') this.staticMinimap = this.buildStaticMinimap();
        this.mapDirty = true;
        if (this.mapOpen) this.drawWorldMap();
      };
    }
  };
})();
