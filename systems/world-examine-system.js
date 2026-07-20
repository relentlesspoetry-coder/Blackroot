(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  // V0.20.9 (Roadmap Item 17 - World Interaction and Environmental Feedback).
  //
  // Item 17 asks to "increase the sense that the world is tangible": inspect supply crates, use water
  // sources, sit on benches, use training dummies, inspect tents. V0.20.8 placed those objects in Dead
  // Lantern Camp; every one of them was scenery you walked past.
  //
  // WHY ITS OWN KEY ('i'), and not E. There is no central interact dispatcher here: each system binds
  // its own keydown for E and calls stopImmediatePropagation() when it claims the press (see
  // systems/chest-system.js bindInput), so listener ORDER is priority - and listener order is script
  // load order, which is a terrible thing to hang "does E talk to the NPC or read the crate behind her"
  // on.
  //
  // The first version of this deferred explicitly instead, asking every other system's finder whether
  // it had a target before examining. It was measured, and it was a dead feature: E is claimed by NPCs
  // at ~3.25 tiles and Dead Lantern Camp holds 27 of them, so standing at a lone path torch with the
  // nearest NPC 2.83 tiles away STILL had E claimed. Examine would have been silent in the exact place
  // its objects live - something that looks finished and never fires, which is the whole pattern this
  // session has spent its time deleting. Measuring it beat reasoning about it.
  //
  // A dedicated key fixes it outright: examining is always available, and it can never take a press
  // from talking, looting, gathering or crafting - Item 17's "world interactions must not interfere
  // with combat targeting or movement", met by construction rather than by arbitration.
  //
  // "Not every interaction needs a reward" - none of these give one. They are text, a sound and a ring.

  const EXAMINE_RANGE = 1.75;
  const REPEAT_COOLDOWN_MS = 900;

  // Object names come from world data and are written into the prompt as HTML, so they get escaped -
  // the same guard every other panel in this codebase uses.
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[ch]);
  }

  // Flavour, keyed by the object type the renderer already draws. Multiple lines per type: Item 17
  // requires "repeated interactions should avoid excessive message spam", so a second look says
  // something new rather than repeating the first line back.
  const EXAMINE_TEXT = {
    crate:         ['Salvage and split wood. Someone has prised the lid and nailed it back badly.',
                    'Nails, twine, a broken buckle. Nothing anybody would miss.'],
    barrel:        ['Water, and a tin cup chained to the hoop. The chain is newer than the barrel.',
                    'Brackish, but cold. Somebody refills this.'],
    sackPile:      ['Grain sacks, stacked off the wet ground on planks. Mice have found two of them.',
                    'The bottom sack has been re-sewn. Twice.'],
    supplyStack:   ['The quartermaster\'s stack. Counted, chalked, and counted again.',
                    'A tally in chalk on the top crate. The last three marks are fresher.'],
    weaponRack:    ['Practice blades, blunted and notched. The good steel is not kept here.',
                    'One slot is empty. Whoever took it did not sign for it.'],
    sparringDummy: ['Straw and sacking on a post. The left side is beaten flat.',
                    'Everyone here favours the same shoulder. You can read it in the dents.'],
    bedroll:       ['Rolled tight, ready to move. Whoever sleeps here does not unpack.',
                    'Still shaped to somebody. It has not been aired in a while.'],
    tent:          ['Canvas, patched at the seams. The pegs have been re-driven where the ground gives.',
                    'Someone has scratched a tally into the pole. You do not know what it counts.'],
    campLeanTo:    ['A lean-to of branches and canvas. Rough, but it keeps the rain off.',
                    'The ground beneath is worn smooth. This is not new.'],
    well:          ['The camp well. The rope is damp, the bucket is dented, the water is clean.',
                    'You can hear it hit, a long way down.'],
    studyTable:    ['Charts and a guttered candle. Someone has been reading the woods.',
                    'A map with the trail marked and re-marked. The last route is drawn in a hurry.'],
    herbalistTable:['Cut herbs, a mortar, a stained cloth. Sister Liora\'s work.',
                    'Gloomleaf and wispbloom, sorted. Someone knows what they are doing.'],
    logSeat:       ['A split log, worn smooth. People have been sitting here for a long time.',
                    'Warm on the fire side. You could sit a while.'],
    fire:          ['The Dark Woods campfire. It is never let out.',
                    'Somebody has banked it carefully. The wood is stacked to burn slow.'],
    cookingSpit:   ['A spit over the coals, scrubbed and ready. The cook keeps a clean fire.',
                    'Drippings in the pan below. Recent.'],
    torch:         ['A path torch, pitch-soaked. It marks the way in for anyone coming back after dark.',
                    'Burned low. Someone will replace it before nightfall.'],
    lanternPost:   ['A camp lantern on a post. The glass is smoked but the flame is steady.',
                    'This is what the Dead Lantern Trail is named for - the ones that went out.'],
    banner:        ['The Dead Lantern banner, weathered pale. It still flies.',
                    'The cloth is mended in three places. Nobody has replaced it.'],
    ropeBundle:    ['Coiled rope, damp from the ground. Good rope, kept badly.',
                    'Long enough for a cave descent. Someone has been down something.'],
    brokenWeapon:  ['A practice blade, snapped at the tang. Left where it broke.',
                    'The break is clean. Somebody hit something much harder than straw.'],
    candleCluster: ['Candle stubs pooled on a board. The trainers read late.',
                    'Wax over wax over wax. Months of it.'],
    campStall:     ['A trade stall, shutters open. Nothing valuable is left out overnight.',
                    'The counter is worn where hands have rested on it.'],
    // NOTE: `flower` is deliberately absent. It was written as "planted deliberately in rows / someone
    // weeds these" for the camp's Medicinal Flowers - but this table is keyed by object TYPE, and the
    // Dark Woods is full of wild flowers that nobody planted and nobody weeds. Every one of them would
    // have claimed a gardener. A line that is true of one object and false of hundreds is the same
    // failure as a cone that draws a circle, so it is gone rather than nearly-right. Camp-specific
    // flavour for that one object needs keying by NAME, not type.
    fallenLog:     ['A fallen trunk, soft with moss. Something has been at the bark.'],
    standingStone: ['An old stone, older than the camp. The marks on it are not letters you know.']
  };

  // V0.20.10 (Roadmap Item 17): "interaction prompts must remain readable across input methods".
  // Two gaps this closes. (1) Examining is discoverable only if you already know the key. (2) The
  // WAYPOINT authors `interactLabel: 'Attune Waypoint'` and systems/waypoint-system.js has no HUD
  // panel at ALL - so nothing ever told you a waypoint could be attuned. `interactLabel` is written on
  // 4 objects in world-system.js and, before this, read by NOTHING: the stash prompt hardcoded the
  // same words it authored, and the waypoint had no prompt to hardcode. The field is live now.
  function ensureExaminePanel() {
    const host = document.getElementById('externalSystemsHud');
    if (!host) return null;
    let panel = document.getElementById('worldExaminePanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'worldExaminePanel';
    panel.className = 'systemPanel';
    panel.style.display = 'none';
    panel.innerHTML = `
      <h3>Nearby</h3>
      <div class="small" data-examine-prompt></div>
    `;
    host.appendChild(panel);
    return panel;
  }

  DR.WorldExamineSystem = {
    install(Game) {
      Game.prototype.installWorldExamineSystem = function() {
        if (this._worldExamineBound) return;
        this._worldExamineBound = true;
        this._examineLast = new Map();
        this.examinePanel = ensureExaminePanel();

        // Any object beside the player that AUTHORS an interactLabel - the stash, the waypoint. Read
        // from the object rather than hardcoded, which is the whole point.
        this.findLabelledInteractable = function() {
          const p = this.player;
          if (!p || !Array.isArray(this.objects)) return null;
          const px = Math.round(p.x), py = Math.round(p.y);
          let best = null, bestD = 2.4;
          for (let y = py - 3; y <= py + 3; y++) {
            for (let x = px - 3; x <= px + 3; x++) {
              const obj = this.objects?.[y]?.[x];
              if (!obj?.interactLabel) continue;
              const d = Math.hypot((x + 0.5) - p.x, (y + 0.5) - p.y);
              if (d <= bestD) { bestD = d; best = { obj, x, y }; }
            }
          }
          return best;
        };

        this.refreshExaminePanel = function() {
          const panel = this.examinePanel || (this.examinePanel = ensureExaminePanel());
          if (!panel) return;
          if (!this.started || !this.player?.alive) { panel.style.display = 'none'; return; }
          const node = this.examinePanel.querySelector('[data-examine-prompt]');
          const labelled = this.findLabelledInteractable();
          const examinable = this.findExaminableObject();
          const lines = [];
          // The authored label, in the object's own words.
          if (labelled) lines.push(`<strong>E</strong>: ${escapeHtml(labelled.obj.interactLabel)}`);
          if (examinable) lines.push(`<strong>I</strong>: Look at ${escapeHtml(examinable.obj.name || examinable.obj.type)}`);
          if (!lines.length) { panel.style.display = 'none'; return; }
          panel.style.display = '';
          if (node) node.innerHTML = lines.join('<br>');
        };

        // Nearest examinable object the player is actually standing beside.
        this.findExaminableObject = function() {
          const p = this.player;
          if (!p || !Array.isArray(this.objects)) return null;
          let best = null, bestD = EXAMINE_RANGE;
          const px = Math.round(p.x), py = Math.round(p.y);
          for (let y = py - 2; y <= py + 2; y++) {
            for (let x = px - 2; x <= px + 2; x++) {
              const obj = this.objects?.[y]?.[x];
              if (!obj) continue;
              const lines = EXAMINE_TEXT[String(obj.type || '')];
              if (!lines) continue;
              const d = Math.hypot((x + 0.5) - p.x, (y + 0.5) - p.y);
              if (d <= bestD) { bestD = d; best = { obj, x, y }; }
            }
          }
          return best;
        };

        this.examineWorldObject = function(found) {
          if (!found?.obj) return false;
          const key = `${found.x},${found.y}`;
          const now = Date.now();
          const seen = this._examineLast.get(key);
          // Anti-spam (Item 17): ignore a mashed key, and on a genuine second look say the NEXT line
          // rather than repeating the first.
          if (seen && now - seen.at < REPEAT_COOLDOWN_MS) return true;
          const lines = EXAMINE_TEXT[String(found.obj.type || '')] || [];
          if (!lines.length) return false;
          const idx = seen ? (seen.idx + 1) % lines.length : 0;
          this._examineLast.set(key, { at: now, idx });
          const name = found.obj.name || found.obj.type;
          this.log?.(`${name}: ${lines[idx]}`);
          // Feedback beyond text, per Item 17: a soft ring at the object and a quiet cue.
          this.spawnRing?.(found.x + 0.5, found.y + 0.5, found.obj.color || '#d8c9a8', 10);
          this.playSfx?.('ui_select', { volume: 0.18, rate: 0.9, cooldown: 0.2 });
          return true;
        };

        window.addEventListener('keydown', event => {
          const typing = (() => {
            const el = event.target, tag = String(el?.tagName || '').toLowerCase();
            return tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable;
          })();
          if (typing || event.repeat) return;
          const isExamine = this.isActionKey ? this.isActionKey(event, 'examine') : String(event.key || '').toLowerCase() === 'i';
          if (!isExamine) return;
          if (!this.started || this.paused || !this.player || !this.player.alive) return;
          const found = this.findExaminableObject();
          if (!found) return;
          this.examineWorldObject(found);
        });
      };
    }
  };
})();
