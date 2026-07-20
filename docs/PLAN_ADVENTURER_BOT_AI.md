# Plan — Persistent Adventurer Bot AI System (a living world of adventurers)

Source spec: `Blackroot_Adventurer_Bot_AI_System.txt`. This is a design/implementation
plan, not a shipped change — nothing here is built yet. It maps the spec against
what already exists, names the one big architectural decision, and breaks the work
into shippable phases.

---

## 1. The core idea (and the one architectural decision that matters)

The spec asks for a **persistent population of adventurers** who live their own
lives — pick a daily activity, travel, quest, level, hire mercs, spend gold, die and
respawn — *whether or not the player is nearby*, with a performance model of
**Active (full sim) / Neighboring (light sim) / Distant (abstract sim)**.

Blackroot already has genuinely capable **companion/squad bots** (`entities/bot-player.js`,
`systems/bot-player-system.js`, ~5.3k lines): roles, personalities, named recurring
characters (Bram, Talia, Riven, Luma…), a `reputation` field, quest accept/track/turn-in
(`advanceBotQuestProgress`, `enemyMatchesBotQuest`), squad goals (`questing`,
`camp-supply-run`, `road-patrol`, `dungeon-prep`), party-vs-world split
(`isBotInParty`), and they're saved (`serializeBotPlayerState`). The game also already
has: `hireMerc()` + `MERC_ROLES` (Tank/Healer/DPS + upkeep), vendors + buy/sell + gold
(`npc-system`, `inventory-system`), a world clock with day/morning
(`getWorldTimeInfo`), distance-based mob leveling across the map, and — most
importantly — **wall-clock-budgeted AI banding** (near/mid/far/sleep) that already
throttles AI by distance.

So this is **not** a from-scratch build. The gap is *scale, persistence, autonomy,
and abstraction*. The decision that shapes everything:

> **Two-tier representation.** Split "an adventurer" into a lightweight persistent
> **record** (the whole population lives as data) and a **materialized bot entity**
> (a full-AI `BotPlayer`, only for adventurers near the player). Distant adventurers
> are advanced by cheap **abstract simulation** on the record; when the player comes
> near, a record is **promoted** to a real entity; when the player leaves, it's
> **demoted** back to a record (syncing level/gold/gear/quest/hp). The existing
> AI banding already draws exactly this near/far line — we extend it one step
> further out (the "sleep" band becomes "abstract-simulated record").

This directly realizes the spec's Active/Neighboring/Distant model and keeps frame
cost flat regardless of population size (only ~the current handful of bots are ever
full entities at once; the other N are ticked as data, cheaply, on the world clock).

---

## 2. Spec → what exists → gap

| Spec feature | Already exists | Gap to build |
|---|---|---|
| Persistent adventurers (name/race/class/level/gear/gold/rep/home/personality) | bot profiles + `reputation` + save via `serializeBotPlayerState` | a **population registry** of records that persists independent of materialization; home-town + guild fields |
| Daily activity selection (rest/craft/gather/solo/small/large %) | world clock + morning event | a **daily scheduler** that rolls each record's activity each in-game dawn |
| Mercenary hiring by bots | `hireMerc()`, `MERC_ROLES`, upkeep (player) | let **records/bots hire+pay+lose** mercs; party-composition logic |
| Party sizes (solo/duo/small/full) | squads/parties/routes exist | group **formation among records** by activity roll |
| Zone selection (level/zone/quests/resources/travel) | one overworld + caves/dungeons; distance-leveling | **region/instance selection** by level band + quest availability + travel time |
| Quest AI (accept→track→complete→turn in→next) | full bot quest loop | run it **abstractly** for distant records too |
| Grinding when no quests | bots hunt mobs | abstract XP grind tick for records |
| Supplies (food/water/potions/repair; poor→gather) | vendors, gold, repair | **economy transactions** on records; buy-before-leave-town |
| Death (spirit healer, corpse/res penalty, resume) | player death+spirit healer; `respawnBotPlayer` | apply the **full death loop to bots/records** |
| Gear progression (compare/equip/sell) | loot + equip compare exists | record-level **gear score progression** + vendor sell |
| Social behaviors (wave/sit/eat/chat/vendor/repair/train/bank) | emotes, campfires, vendors exist | schedule **idle social actions** for materialized bots in town |
| Reputation → recognizable recurring NPCs | `reputation` field | **rep growth + surfacing** (titles, "known adventurer" tags, /who) |
| Dynamic events (elites/town attack/world boss/escort/caravan) | some world events exist | records **react/join** nearby events |
| Economy (earn/spend/buy/repair/sell/hire) | gold, vendors, mercs | a bounded **economic loop** on records (net gold in/out) |
| Performance (active/neighbor/distant) | AI banding + wall-clock budget | the **abstract-sim tier** + promote/demote |

---

## 3. Architecture

**New module: `systems/adventurer-population-system.js`** (the registry + abstract sim).

- `AdventurerRecord` — the persistent unit: `id, name, race, class, level, xp,
  gold, reputation, personalityId, homeTownId, gearScore, equipmentSummary,
  activity, party(groupId), mercs[], location{region/instance, x, y, traveling},
  questRef, hp%, state, lastTickDay`.
- `population: Map<id, AdventurerRecord>` — seeded at world start, persisted in the
  save (extends the existing bot serialization), grows/cycles over time.
- **Daily scheduler** (`onWorldDawn`) — each record rolls a primary activity from the
  spec distribution (rest 15 / craft 10 / gather 15 / solo 20 / small 25 / large 15),
  forms/joins parties, picks a region + quest, buys supplies (gold permitting), and
  sets a travel plan.
- **Abstract sim tick** (on the world clock, batched + wall-clock budgeted like the AI
  loop) — advances distant records: travel progress, quest/grind XP → levels, gold
  earned/spent, merc upkeep, gear-score creep, death rolls (→ spirit-healer delay),
  reputation. Cheap arithmetic, no pathfinding/entities.
- **Promote/demote bridge** — when a record enters the player's active radius (extend
  the existing band check), spawn a real `BotPlayer` via `spawnBotPlayer()` seeded
  from the record; when it leaves, write the entity's state back to the record and
  despawn. The materialized bot keeps using **all the existing bot AI** unchanged.

**Reuse (do not rebuild):** `spawnBotPlayer`/`respawnBotPlayer`, the bot quest loop,
`hireMerc`/`MERC_ROLES`, vendor/inventory buy-sell, world clock/morning, AI banding +
wall-clock budget, save-system bot serialization, the spirit-healer/death flow, emotes
& campfires for social actions.

**World mapping note:** Blackroot is one Dark Woods overworld (360×360) + cave/dungeon
instances, not a multi-continent world. So "zone/travel" = **regions of the overworld
by distance/level band** (near-camp = low level, deep = high) plus cave/dungeon
instances; "home town" = the camp/spawn town. This keeps the spec faithful without
inventing a new world map.

---

## 4. Phased roadmap (each phase is independently shippable & testable)

- **Phase 0 — Audit & scaffold.** Confirm exact reuse seams (bot spawn/serialize, merc
  hire, vendor API, world-dawn hook, band radius). Create the population system module,
  the `AdventurerRecord` shape, save/load round-trip, and a dev overlay listing records.
  *No behavior change yet.*
- **Phase 1 — Population registry + persistence.** Seed N records (name/race/class/level/
  personality/home), persist them, and show them in a `/who`-style panel. Static for now.
- **Phase 2 — Promote/demote bridge.** Materialize nearby records into real bots and back,
  syncing state. This is the perf-critical piece — validate frame cost is flat as N grows.
- **Phase 3 — Daily activity scheduler.** Dawn roll → activity + party formation + region/
  quest choice + travel plan. Materialized ones act it out with existing AI; distant ones
  set intent only.
- **Phase 4 — Abstract simulation tier.** Distant records advance (travel, quest/grind XP →
  levels, gold, gear score) on the budgeted world-clock tick.
- **Phase 5 — Economy & mercenaries.** Records earn/spend gold, buy supplies/repair, hire &
  pay mercs (lose them on unpaid upkeep), sell inferior gear. Bounded net-flow so the
  economy stays stable.
- **Phase 6 — Death & progression loops.** Full death→spirit-healer→recover/penalty→resume
  for records and materialized bots; gear-score progression; leveling milestones.
- **Phase 7 — Reputation & recurring characters.** Rep growth from deeds; titles/"known
  adventurer" surfacing; a few guaranteed marquee names that recur.
- **Phase 8 — Social & dynamic-event reactions.** Town idle behaviors (wave/sit/eat/vendor/
  repair/train/bank) for materialized bots; records react to nearby elites/world bosses/
  caravans/town attacks.
- **Phase 9 — Tuning & scale.** Dial population size, activity mix, economy rates, spawn
  density; perf pass; playtest "does the world feel alive?"

---

## 5. Performance model (ties into what's proven)

- Only records within the active band are full entities — the same handful the game
  already runs. Everything else is arithmetic on a `Map`, ticked in **wall-clock-budgeted
  batches** (the exact pattern that fixed the AI loop in V0.17.98). Target: population of
  hundreds at **zero added per-frame entity cost**; abstract tick amortized across seconds.
- Promote/demote is throttled (hysteresis on the band edge) to avoid spawn/despawn thrash.
- Save size grows ~linearly with population — records are small; cap + recycle the roster.

## 6. Key risks / watch-items

- **Economy runaway/collapse** — bots infinitely farming gold or going broke. Mitigate with
  bounded per-day net flow and soft caps.
- **Promote/demote state drift** — entity vs record divergence. Single source of truth per
  side of the boundary; sync on transition only.
- **Save bloat / migration** — version the population schema (mirror the meditation/save
  migration pattern).
- **Perf regression** — the abstract tick must stay budgeted; never pathfind for distant
  records.
- **"Feels fake"** — without visible payoff (seeing named adventurers in town, on roads),
  the sim is invisible. Phases 1/7/8 are what make it *felt*.

## 7. Decisions — ANSWERED (2026-07-12)

- **Scope:** Full arc, phase by phase (build all phases in sequence, each shipped as its own version).
- **Population scale:** A dozen recognizable, recurring named adventurers (curated cast; the abstract-sim tier stays light at this size — emphasis on making each distinct and memorable).
- **Existing squad bots:** fold into the new population registry (one system). *(default — say if not)*
- **World framing:** regions of the Dark Woods overworld + cave/dungeon instances = "the world". *(default)*

Build order starts at Phase 1 (Phase 0 audit folds into it). Original decision list kept below for reference.

## 7b. Original decision list (for reference)

1. **Scope of first delivery** — full arc (Phases 0–9, a genuinely massive multi-release
   effort), or a vertical slice first (Phases 0–3: a real persistent, daily-scheduled,
   promote/demote population you can see) to prove the feel before investing in economy/
   death/rep?
2. **Population size / density target** — a dozen recognizable adventurers, or hundreds for
   a "busy world"? (Drives the abstract-sim design.)
3. **Relationship to current squad bots** — fold the existing named squad bots into the new
   population registry (recommended, one system), or keep them separate?
4. **World framing** — accept "regions of the Dark Woods overworld + instances = the world"
   (recommended, faithful to the current map), or is a larger multi-zone world intended?
