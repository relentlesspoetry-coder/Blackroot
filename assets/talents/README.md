# Talent spec background art (drop-in)

Put a **PNG named after the spec id** in this folder and it becomes that specialization's
talent-tree column background automatically — no code changes. Reopen the talent panel (or reload)
to see it.

- Filename = `<specId>.png` (e.g. `assassin_boltweaver.png`, `wizard_pyromancer.png`,
  `paladin_oathkeeper.png`). Spec ids are the `id` fields in `data/talents.js`.
- Recommended size: tall portrait, roughly **300×540** (a column is ~300px wide). The panel scales it
  with `background-size: cover`, so exact size isn't critical.
- The image is shown under a dark tinted veil for text readability, with the spec's colour glow on top.
- If no PNG is present for a spec, the panel uses the built-in procedural colour+emblem theme — so you
  can add art one spec at a time.

To force a specific path/extension for a spec instead of this convention, set a `bg:` field on that spec
in `data/talents.js` (e.g. `bg: 'assets/talents/custom.jpg'`); an explicit `bg` always wins.

## Full list of spec ids (42)

Paladin: `paladin_oathkeeper`, `paladin_lightbearer`, `paladin_judicator`
Warden: `warden_stoneguard`, `warden_thornwarden`, `warden_wildheart`
Fighter: `fighter_berserker`, `fighter_weaponmaster`, `fighter_breaker`
Rogue: `rogue_shadowblade`, `rogue_venomfang`, `rogue_duelist`
Ranger: `ranger_beaststalker`, `ranger_trapper`, `ranger_deadeye`
Assassin: `assassin_boltweaver`, `assassin_trapmaster`, `assassin_nightblade`
Wizard: `wizard_pyromancer`, `wizard_frostbinder`, `wizard_arcanist`
Shaman: `shaman_stormcaller`, `shaman_earthspeaker`, `shaman_spiritflame`
Summoner: `summoner_beastcaller`, `summoner_planebinder`, `summoner_swarmweaver`
Necromancer: `necromancer_bonecaller`, `necromancer_plaguebinder`, `necromancer_soulreaper`
Cleric: `cleric_radiant`, `cleric_sanctifier`, `cleric_exorcist`
Druid: `druid_lifebloom`, `druid_mooncaller`, `druid_wildmender`
Bard: `bard_minstrel`, `bard_warchanter`, `bard_dirgesinger`
Enchanter: `enchanter_mesmerist`, `enchanter_illusionist`, `enchanter_runebinder`
