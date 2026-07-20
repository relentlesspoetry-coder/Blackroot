# Blackroot — Central Failure Policy

**Roadmap Item 24** asks for *"a central failure-policy document [defining] which states are temporary,
recoverable, permanent, or branch-specific."* This is that document.

**Every rule below was measured against the running game, not read out of the code.** Where the game
has no answer yet, this says so rather than inventing one — a policy that describes something the code
doesn't do is exactly the dead data this project has spent fifteen versions removing.

*Established V0.20.17. Measured on V0.20.16.*

---

## The policy in one line

**Death in Blackroot costs you time and nothing else.**

Nothing is lost, damaged, consumed, or reduced. You stop, you go back to the Dream Spirit, you walk out
again with everything you had. That is a *coherent* choice for an early-game hub built around a
starting camp — and it is applied **consistently**, which matters more than which side of the line it
falls on.

---

## Measured behaviour

### On death

| what | happens | class |
|---|---|---|
| **HP** | → 0, `alive: false`, `dead: true`, death animation | temporary |
| **Communication** | *"You were slain. Waiting for resurrection or respawn at camp."* — logged immediately | ✅ Item 24's "visible immediately after failure" |
| **Food buffs** | **survive** | temporary (they keep ticking) |
| **Potion buffs** | **survive** | temporary |
| **Class buffs** | **survive** | temporary |
| **Set bonuses** | survive (derived from equipment, which is untouched) | — |
| **Inventory** | **untouched** | — |
| **Money** | **untouched** | — |
| **Equipment** | **untouched**. No item in the game carries a `durability` field, so equipment cannot be damaged by anything, including swimming deaths | — |
| **Player XP / level** | **not lost** | — |
| **Profession XP** | **not lost** | — |
| **Death location** | recorded — `deathZone`, `deathDungeonId`, `deathDungeonFloor` | recoverable |
| **DPS meter** | reset (`dpsMeterResetOnPlayerDeath`, configurable) | temporary |
| **Event** | `playerDeath` fires for other systems | — |

### On respawn

Measured via `respawnPlayerAtCamp()`:

| what | happens |
|---|---|
| **HP** | restored to **full** |
| **Buffs** | **all survive respawn too** — food, potion and class |
| **Location** | the Dream Spirit near camp (measured: `100.5, 91.5`; camp centre `100,100`) |
| **Communication** | *"You return to the Dream Spirit."* |

**The key consistency result:** buffs persist through **both** death and respawn. **One policy, applied
the same way at both ends.** There is no seam where a buff survives dying and then vanishes on
returning — which is the kind of inconsistency Item 24 exists to prevent.

### Recovery routes that exist

`beginPlayerRespawn` · `updatePlayerRespawn` · `ensureDeathRespawnOverlay` ·
`findDreamSpiritRespawnPoint` · `respawnPlayerAtCamp` · bot resurrection
(`hasAvailableBotResurrectionForPlayer`, `findBotReviveTarget`, `botCanSafelyRevive`) ·
`reviveFriendlyActor` · `reviveMercenary` · `respawnBotPlayer`

---

## Classification (Item 24's actual ask)

| state | verdict |
|---|---|
| **Temporary** | death itself · HP loss · the DPS meter |
| **Recoverable** | position (respawn at camp, or a bot resurrects you where you fell); death location is recorded so a corpse run is possible |
| **Permanent** | **nothing.** No permanent consequence exists in the game today |
| **Branch-specific** | the Rurik fork (V0.19.4) — a **quest** branch, not a death consequence. Choosing a side permanently closes the other, and that is the only irreversible thing a player can do |

---

## Rules Item 24 lists that the game cannot answer yet

**These are not gaps in the policy. They are questions about systems that do not exist**, and writing a
rule for them would be authoring fiction:

| rule | why unanswerable |
|---|---|
| mount state on death · mount summon cooldown | **no mount system** (Item 7) |
| taming materials lost on failure · retry cooldown | **no taming system** (Item 7) |
| swimming deaths damage equipment | **no durability field on any item** — nothing can be damaged |
| crafting interrupted by damage · materials consumed on interruption | not measured; crafting exists |
| skill experience loss | **measured: none is lost.** The rule is "can it be lost?" — today, no |
| failed escorts affecting future quests | only **1 of 26** quests can fail at all (V0.19.5) |
| abandoned quest items recoverable | not measured |
| death during defence events | defence encounters exist (V0.17.87); interaction not measured |
| pets/mercenaries after player death | **`reviveMercenary` and pet revive exist**; not measured under player death (no pet or merc active in the test) |

---

## Consistency requirements — audit

| requirement | status |
|---|---|
| *failure consequences visible before or immediately after* | ✅ death logs immediately |
| *permanent consequences clearly communicated* | ✅ **vacuously** — there are none |
| *recovery must not duplicate or conflict with respawn* | ✅ one respawn path, plus bot resurrection as an alternative to it |
| *save/load must preserve legitimate failure state* | ⚠️ **not measured.** `deathZone`/`deathDungeonId`/`deathDungeonFloor` are set on the player; whether they round-trip through `serializeCharacterState` is unverified |
| *death must not duplicate items, rewards, buffs, or mounts* | ✅ nothing is granted on death or respawn — measured: inventory 5→5, money unchanged |
| *quest recovery consistent across zones* | ⚠️ not measured |

---

## If this policy is ever changed

The obvious candidate is **clearing buffs on death** — most RPGs do. If that changes, it must change in
**both** places at once (death *and* respawn), or the seam returns. And note what a buff wipe would
actually cost here: `item_bramblehide_elixir` and friends run 180s, so a death would burn a potion the
player paid for. That is a real decision, not a default.

**This document describes what the game does today.** If the code changes and this doesn't, it becomes
the very thing this project keeps deleting.
