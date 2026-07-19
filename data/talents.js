(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  // V0.17.69: Talent System v1 - declarative talent trees.
  //
  // ARCHITECTURE (see spec): talents do NOT grant new castable abilities.
  // They EMPOWER the class spells that already exist in data/spells.js, plus
  // apply flat stat ranks and runtime combat multipliers. All effects are
  // pure data interpreted by systems/talent-system.js - no functions here,
  // fully JSON-serializable and editor-readable.
  //
  // TREE SHAPE (identical across every spec):
  //   T1: 2 nodes x 3 ranks | T2: 2 nodes x 3 ranks | T3: 1 node x 3 ranks
  //   T4: 1 node x 2 ranks  | T5: 1 node x 1 rank (capstone proc)
  //   = 7 nodes, 18 ranks per tree.
  //
  // TIER GATES: points spent IN THAT TREE - T1:0 T2:3 T3:6 T4:9 T5:12.
  //
  // EFFECT VOCABULARY (the whole language - keep it small):
  //   { k:'stat',  stat:<STAT_KEY>, per:<n> }               flat rating * rank
  //   { k:'spell', match:<M>, field:<f>, op:'add'|'mul', per:<n> }
  //         match: { names:[...] } | { kind } | { kinds:[...] } | { tag } |
  //                { damageType } | { all:true }
  //         op:'mul' => field *= (1 + per*rank); op:'add' => field += per*rank
  //   { k:'mod',   mod:<M>, op:'mul'|'add', per:<n>, when:<W> }   runtime query
  //   { k:'proc',  proc:{ id, trigger, chance, icd, effects:[...] } }  capstones
  //   { k:'flag',  flag:<string> }
  //
  // DESCRIPTION TOKENS: %1..%3 -> vals[n-1]*rank (1 decimal, trailing .0 cut);
  //                     %%1..  -> same value formatted as a percentage.
  //
  // NUMBERS ARE NOT FINAL: values here are per-rank and mechanically correct,
  // sitting inside the engine's balance clamps. The dedicated balance pass
  // (spec PART 9) re-tunes them; this slice proves the vertical works.

  DR.TALENT_TREES = {
    Paladin: {
      className: 'Paladin',
      role: 'Tank',
      specs: [
        // ================================================================
        // OATHKEEPER - Pure defensive tank
        // ================================================================
        {
          id: 'paladin_oathkeeper',
          name: 'Oathkeeper',
          role: 'Pure defensive tank',
          summary: 'The safest Paladin. Shields, taunts, threat, party protection.',
          color: '#fff2a8',
          empowers: ['Shield of Faith', 'Divine Challenge', 'Radiant Bulwark',
                     'Oathbound Stand', 'Blessed Intercept', 'Sanctuary Vow', 'Unbroken Faith'],
          nodes: [
            {
              id: 'pal_oath_1a', tier: 1, name: 'Iron Devotion', maxRank: 3,
              desc: 'Increases Armor by %1 and Defense by %2.',
              vals: [3, 2],
              effects: [
                { k: 'stat', stat: 'armor', per: 3 },
                { k: 'stat', stat: 'defense', per: 2 }
              ]
            },
            {
              id: 'pal_oath_1b', tier: 1, name: 'Bulwark Training', maxRank: 3,
              desc: 'Absorb shields you cast are %%1 stronger.',
              vals: [0.08],
              effects: [
                { k: 'mod', mod: 'absorbPower', op: 'mul', per: 0.08 }
              ]
            },
            {
              id: 'pal_oath_2a', tier: 2, name: 'Unyielding Oath', maxRank: 3,
              desc: 'Shield of Faith gains +%1 charge and its damage reduction improves by %%2.',
              vals: [1, 0.03],
              effects: [
                { k: 'spell', match: { names: ['Shield of Faith'] }, field: 'charges', op: 'add', per: 1 },
                { k: 'spell', match: { names: ['Shield of Faith'] }, field: 'damageTakenMultiplier', op: 'mul', per: -0.03 }
              ]
            },
            {
              id: 'pal_oath_2b', tier: 2, name: 'Provoking Presence', maxRank: 3,
              desc: 'Increases threat you generate by %%1.',
              vals: [0.08],
              effects: [
                { k: 'mod', mod: 'threatDone', op: 'mul', per: 0.08 }
              ]
            },
            {
              id: 'pal_oath_3', tier: 3, name: 'Oathbound Aegis', maxRank: 3,
              desc: 'Divine Challenge cooldown -%1s. Oathbound Stand reduces your damage taken by an extra %%2.',
              vals: [0.4, 0.04],
              effects: [
                { k: 'spell', match: { names: ['Divine Challenge'] }, field: 'cooldown', op: 'add', per: -0.4 },
                { k: 'spell', match: { names: ['Oathbound Stand'] }, field: 'damageTakenMultiplier', op: 'mul', per: -0.04 }
              ]
            },
            {
              id: 'pal_oath_4', tier: 4, name: 'Bastion', maxRank: 2,
              desc: 'Increases Armor by %1. Blessed Intercept redirects an extra %%2 of damage.',
              vals: [3, 0.04],
              effects: [
                { k: 'stat', stat: 'armor', per: 3 },
                { k: 'spell', match: { names: ['Blessed Intercept'] }, field: 'damageRedirectPct', op: 'add', per: 0.04 }
              ]
            },
            {
              id: 'pal_oath_5', tier: 5, name: 'Unbreakable Oath', maxRank: 1,
              capstone: true,
              desc: 'At 25% HP: gain 60% damage reduction and 300% threat for 8s, and cannot be reduced below 1 HP. The oath does not break.',
              vals: [],
              effects: [
                { k: 'proc', proc: {
                  id: 'pal_unbreakable_oath', name: 'Unbreakable Oath',
                  trigger: 'lowHealth', threshold: 0.25, chance: 1, icd: 120,
                  color: '#fff2a8', log: 'The oath does not break.',
                  effects: [
                    { type: 'status', status: {
                      id: 'pal_unbreakable_oath', name: 'Unbreakable Oath', type: 'buff',
                      duration: 8, damageTakenMultiplier: 0.4, lethalSave: true,
                      color: '#fff2a8', hostile: false, tags: ['paladin', 'talent', 'capstone']
                    } },
                    { type: 'dynamicMod', mod: 'threatDone', op: 'mul', value: 4, duration: 8 }
                  ]
                } }
              ]
            }
          ]
        },

        // ================================================================
        // LIGHTBEARER - Self-healing holy tank
        // ================================================================
        {
          id: 'paladin_lightbearer',
          name: 'Lightbearer',
          role: 'Self-healing holy tank',
          summary: 'Sustain through light. Self-heals, shields, and turns the undead.',
          color: '#ffe6a8',
          empowers: ['Light Within', 'Radiant Bulwark', 'Sunlit Aegis', 'Turn the Fallen',
                     'Cleanse Corruption', 'Blessing of Resolve', 'Guardian Aura'],
          nodes: [
            {
              id: 'pal_light_1a', tier: 1, name: 'Inner Light', maxRank: 3,
              desc: 'Increases HP Regen by %1 and Healing Power by %2.',
              vals: [2, 6],
              effects: [
                { k: 'stat', stat: 'hpRegen', per: 2 },
                { k: 'stat', stat: 'healingPower', per: 6 }
              ]
            },
            {
              id: 'pal_light_1b', tier: 1, name: 'Warm Radiance', maxRank: 3,
              desc: 'Increases healing you do by %%1.',
              vals: [0.06],
              effects: [
                { k: 'mod', mod: 'healingDone', op: 'mul', per: 0.06 }
              ]
            },
            {
              id: 'pal_light_2a', tier: 2, name: 'Radiant Renewal', maxRank: 3,
              desc: 'Light Within heals %%1 more and costs %%2 less.',
              vals: [0.12, 0.08],
              effects: [
                { k: 'spell', match: { names: ['Light Within'] }, field: 'heal', op: 'mul', per: 0.12 },
                { k: 'spell', match: { names: ['Light Within'] }, field: 'cost', op: 'mul', per: -0.08 }
              ]
            },
            {
              id: 'pal_light_2b', tier: 2, name: 'Blessed Bulwark', maxRank: 3,
              desc: 'Radiant Bulwark absorbs %%1 more; Sunlit Aegis reduces magic damage taken by an extra %%2.',
              vals: [0.10, 0.03],
              effects: [
                { k: 'spell', match: { names: ['Radiant Bulwark'] }, field: 'absorbFlat', op: 'mul', per: 0.10 },
                { k: 'spell', match: { names: ['Radiant Bulwark'] }, field: 'absorbMaxHpPct', op: 'mul', per: 0.10 },
                { k: 'spell', match: { names: ['Sunlit Aegis'] }, field: 'magicDamageTakenMultiplier', op: 'mul', per: -0.03 }
              ]
            },
            {
              id: 'pal_light_3', tier: 3, name: 'Sunlit Stand', maxRank: 3,
              desc: 'While below 50% HP, healing you receive is increased by %%1.',
              vals: [0.07],
              effects: [
                { k: 'mod', mod: 'healingReceived', op: 'mul', per: 0.07, when: { selfHpBelow: 0.5 } }
              ]
            },
            {
              id: 'pal_light_4', tier: 4, name: 'Scourge of the Grave', maxRank: 2,
              desc: 'Increases damage you deal to undead by %%1.',
              vals: [0.045],
              effects: [
                { k: 'mod', mod: 'damageDone', op: 'mul', per: 0.045, when: { targetFamily: 'undead' } }
              ]
            },
            {
              id: 'pal_light_5', tier: 5, name: 'Holy Regeneration', maxRank: 1,
              capstone: true,
              desc: 'When you take damage, 15% chance to heal 6% of max HP and refund 4% mana. Doubled below 40% HP.',
              vals: [],
              effects: [
                { k: 'proc', proc: {
                  id: 'pal_holy_regen', name: 'Holy Regeneration',
                  trigger: 'onDamageTaken', chance: 0.15, icd: 8,
                  color: '#ffe6a8', log: 'Holy light mends your wounds.',
                  effects: [
                    { type: 'healPct', pct: 0.06, doubleBelowSelfHp: 0.4 },
                    { type: 'manaPct', pct: 0.04, doubleBelowSelfHp: 0.4 }
                  ]
                } }
              ]
            }
          ]
        },

        // ================================================================
        // JUDICATOR - Aggressive holy tank
        // ================================================================
        {
          id: 'paladin_judicator',
          name: 'Judicator',
          role: 'Aggressive holy tank',
          summary: 'Threat through holy damage. Judgment, Consecration, and Reckoning.',
          color: '#ffd76a',
          empowers: ['Judgment', 'Consecrated Ground', 'Hammer of Reckoning', 'Holy Rebuke',
                     'Radiant Strike', 'Divine Verdict', 'Avatar of the Oath'],
          nodes: [
            {
              id: 'pal_jud_1a', tier: 1, name: 'Zeal', maxRank: 3,
              desc: 'Increases Attack by %1 and Crit Chance by %2.',
              vals: [3, 1.5],
              effects: [
                { k: 'stat', stat: 'attack', per: 3 },
                { k: 'stat', stat: 'critChance', per: 1.5 }
              ]
            },
            {
              id: 'pal_jud_1b', tier: 1, name: 'Righteous Wrath', maxRank: 3,
              desc: 'Increases holy damage you deal by %%1.',
              vals: [0.05],
              effects: [
                { k: 'mod', mod: 'damageDone', op: 'mul', per: 0.05, when: { damageType: 'holy' } }
              ]
            },
            {
              id: 'pal_jud_2a', tier: 2, name: 'Judgment Strike', maxRank: 3,
              desc: 'Judgment and Radiant Strike deal %%1 more damage and generate %%2 more threat.',
              vals: [0.10, 0.12],
              effects: [
                { k: 'spell', match: { names: ['Judgment', 'Radiant Strike'] }, field: 'power', op: 'mul', per: 0.10 },
                { k: 'spell', match: { names: ['Judgment', 'Radiant Strike'] }, field: 'threatMultiplier', op: 'mul', per: 0.12 }
              ]
            },
            {
              id: 'pal_jud_2b', tier: 2, name: 'Hammer and Anvil', maxRank: 3,
              desc: 'Hammer of Reckoning cooldown -%1s.',
              vals: [0.5],
              effects: [
                { k: 'spell', match: { names: ['Hammer of Reckoning'] }, field: 'cooldown', op: 'add', per: -0.5 }
              ]
            },
            {
              id: 'pal_jud_3', tier: 3, name: 'Consecration', maxRank: 3,
              desc: 'Consecrated Ground radius +%1 and damage +%%2.',
              vals: [0.2, 0.05],
              effects: [
                { k: 'spell', match: { names: ['Consecrated Ground'] }, field: 'radius', op: 'add', per: 0.2 },
                { k: 'spell', match: { names: ['Consecrated Ground'] }, field: 'tickDamage', op: 'mul', per: 0.05 }
              ]
            },
            {
              id: 'pal_jud_4', tier: 4, name: 'Divine Verdict', maxRank: 2,
              desc: 'Increases damage you deal to targets below 35% HP by %%1.',
              vals: [0.06],
              effects: [
                { k: 'mod', mod: 'damageDone', op: 'mul', per: 0.06, when: { targetHpBelow: 0.35 } }
              ]
            },
            {
              id: 'pal_jud_5', tier: 5, name: 'Reckoning', maxRank: 1,
              capstone: true,
              desc: 'When you land a critical hit, 25% chance to reset Judgment and Hammer of Reckoning and gain +80% holy damage for 8s.',
              vals: [],
              effects: [
                { k: 'proc', proc: {
                  id: 'pal_reckoning', name: 'Reckoning',
                  trigger: 'onCrit', chance: 0.25, icd: 6,
                  color: '#ffd76a', log: 'Reckoning!',
                  effects: [
                    { type: 'resetCooldowns', spells: ['Judgment', 'Hammer of Reckoning'] },
                    { type: 'status', status: {
                      id: 'pal_reckoning', name: 'Reckoning', type: 'buff',
                      duration: 8, holyDamageMultiplier: 1.8,
                      color: '#ffd76a', hostile: false, tags: ['paladin', 'talent', 'capstone']
                    } }
                  ]
                } }
              ]
            }
          ]
        }
      ]
    }
  };

  // ==================================================================
  // The remaining 13 classes (V0.17.72). Same shape as Paladin; effects
  // mapped to VERIFIED spell fields. Per-rank values sit inside engine
  // clamps - the balance pass re-tunes them.
  // ==================================================================
  const cap = (id, name, trigger, extra, effects) => ({ k: 'proc', proc: Object.assign({ id, name, trigger, color: '#ffe6a8', log: name + '!', effects }, extra) });

  DR.TALENT_TREES.Warden = {
    className: 'Warden', role: 'Tank',
    specs: [
      { id: 'warden_stoneguard', name: 'Stoneguard', role: 'Earth and stone mitigation tank', summary: 'Immovable. Armor, stances, and quaking threat.', color: '#8a9a6b',
        empowers: ['Stonehide', 'Ironroot Stance', 'Mountain\'s Patience', 'Earthen Roar', 'Quaking Challenge', 'Titanroot', 'Stonehand Strike'],
        nodes: [
          { id: 'wrd_stone_1a', tier: 1, name: 'Granite Skin', maxRank: 3, desc: 'Increases Armor by %1 and Defense by %2.', vals: [4, 2], effects: [{ k: 'stat', stat: 'armor', per: 4 }, { k: 'stat', stat: 'defense', per: 2 }] },
          { id: 'wrd_stone_1b', tier: 1, name: 'Rooted Stance', maxRank: 3, desc: 'Reduces physical damage taken by %%1.', vals: [0.02], effects: [{ k: 'mod', mod: 'damageTaken', op: 'mul', per: -0.02, when: { damageType: 'physical' } }] },
          { id: 'wrd_stone_2a', tier: 2, name: 'Stonehide Mastery', maxRank: 3, desc: 'Stonehide lasts %1s longer and its damage reduction improves by %%2.', vals: [1.5, 0.03], effects: [{ k: 'spell', match: { names: ['Stonehide'] }, field: 'duration', op: 'add', per: 1.5 }, { k: 'spell', match: { names: ['Stonehide'] }, field: 'damageTakenMultiplier', op: 'mul', per: -0.03 }] },
          { id: 'wrd_stone_2b', tier: 2, name: 'Earthen Roar', maxRank: 3, desc: 'Earthen Roar radius +%1 and threat +%%2.', vals: [0.2, 0.05], effects: [{ k: 'spell', match: { names: ['Earthen Roar'] }, field: 'radius', op: 'add', per: 0.2 }, { k: 'spell', match: { names: ['Earthen Roar'] }, field: 'flatThreat', op: 'mul', per: 0.05 }] },
          { id: 'wrd_stone_3', tier: 3, name: 'Mountain Stance', maxRank: 3, desc: 'Ironroot Stance cooldown -%1s. Below 60% HP you take %%2 less damage.', vals: [0.5, 0.015], effects: [{ k: 'spell', match: { names: ['Ironroot Stance'] }, field: 'cooldown', op: 'add', per: -0.5 }, { k: 'mod', mod: 'damageTaken', op: 'mul', per: -0.015, when: { selfHpBelow: 0.6 } }] },
          { id: 'wrd_stone_4', tier: 4, name: 'Granite Shell', maxRank: 2, desc: 'Your absorb shields are %%1 stronger.', vals: [0.06], effects: [{ k: 'mod', mod: 'absorbPower', op: 'mul', per: 0.06 }] },
          { id: 'wrd_stone_5', tier: 5, name: 'Immovable', maxRank: 1, capstone: true, desc: 'At 30% HP: 50% damage reduction and +100% threat for 10s.', vals: [], effects: [cap('wrd_immovable', 'Immovable', 'lowHealth', { threshold: 0.30, icd: 150, chance: 1, color: '#8a9a6b', log: 'Immovable.' }, [{ type: 'status', status: { id: 'wrd_immovable', name: 'Immovable', type: 'buff', duration: 10, damageTakenMultiplier: 0.5, color: '#8a9a6b', hostile: false, tags: ['warden', 'talent', 'capstone'] } }, { type: 'dynamicMod', mod: 'threatDone', op: 'mul', value: 2, duration: 10 }])] }
        ] },
      { id: 'warden_thornwarden', name: 'Thornwarden', role: 'Retaliation and root-control tank', summary: 'Thorns, roots, and briar traps.', color: '#6b8a4a',
        empowers: ['Thorn Guard', 'Root Grasp', 'Briar Lash', 'Thornsnare', 'Living Wall', 'Primal Guard'],
        nodes: [
          { id: 'wrd_thorn_1a', tier: 1, name: 'Barbed Hide', maxRank: 3, desc: 'Increases Armor by %1 and Attack by %2.', vals: [3, 2], effects: [{ k: 'stat', stat: 'armor', per: 3 }, { k: 'stat', stat: 'attack', per: 2 }] },
          { id: 'wrd_thorn_1b', tier: 1, name: 'Cruel Thorns', maxRank: 3, desc: 'Increases your damage by %%1.', vals: [0.04], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.04 }] },
          { id: 'wrd_thorn_2a', tier: 2, name: 'Root Grasp', maxRank: 3, desc: 'Root Grasp and Thornsnare last %1s longer and cost %%2 less.', vals: [0.5, 0.05], effects: [{ k: 'spell', match: { names: ['Root Grasp', 'Thornsnare'] }, field: 'duration', op: 'add', per: 0.5 }, { k: 'spell', match: { names: ['Root Grasp', 'Thornsnare'] }, field: 'cost', op: 'mul', per: -0.05 }] },
          { id: 'wrd_thorn_2b', tier: 2, name: 'Briar Taunt', maxRank: 3, desc: 'Threat +%%1. Briar Lash cooldown -%2s.', vals: [0.05, 0.3], effects: [{ k: 'mod', mod: 'threatDone', op: 'mul', per: 0.05 }, { k: 'spell', match: { names: ['Briar Lash'] }, field: 'cooldown', op: 'add', per: -0.3 }] },
          { id: 'wrd_thorn_3', tier: 3, name: 'Living Wall', maxRank: 3, desc: 'Living Wall radius +%1 and gains +%2 charge.', vals: [0.2, 1], effects: [{ k: 'spell', match: { names: ['Living Wall'] }, field: 'radius', op: 'add', per: 0.2 }, { k: 'spell', match: { names: ['Living Wall'] }, field: 'charges', op: 'add', per: 1 }] },
          { id: 'wrd_thorn_4', tier: 4, name: 'Bramble Field', maxRank: 2, desc: 'Damage to enemies below 50% HP +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.05, when: { targetHpBelow: 0.5 } }] },
          { id: 'wrd_thorn_5', tier: 5, name: 'Thornwall', maxRank: 1, capstone: true, desc: 'When you take damage, erupt: reflect 150% of your attack to nearby enemies and root them for 3s.', vals: [], effects: [cap('wrd_thornwall', 'Thornwall', 'onDamageTaken', { chance: 1, icd: 20, color: '#6b8a4a', log: 'Thornwall erupts!' }, [{ type: 'damageAoe', pctOfAttack: 1.5, radius: 4, damageType: 'nature' }, { type: 'applyStatusAoe', radius: 4, status: { id: 'wrd_thornwall_root', name: 'Rooted', type: 'debuff', duration: 3, rootDuration: 3, moveSpeedMultiplier: 0, hostile: true, tags: ['root', 'talent'] } }])] }
        ] },
      { id: 'warden_wildheart', name: 'Wildheart', role: 'Regeneration and primal endurance tank', summary: 'Endless regeneration and primal toughness.', color: '#4a8a6b',
        empowers: ['Barkskin', 'Wild Fortitude', 'Ancient Pulse', 'Grove Mend', 'Grove Shelter', 'Heart of the Grove', 'Ancient Warden Form'],
        nodes: [
          { id: 'wrd_wild_1a', tier: 1, name: 'Primal Vigor', maxRank: 3, desc: 'Increases HP by %1 and HP Regen by %2.', vals: [18, 2], effects: [{ k: 'stat', stat: 'hp', per: 18 }, { k: 'stat', stat: 'hpRegen', per: 2 }] },
          { id: 'wrd_wild_1b', tier: 1, name: 'Bark and Bone', maxRank: 3, desc: 'Healing you receive +%%1.', vals: [0.04], effects: [{ k: 'mod', mod: 'healingReceived', op: 'mul', per: 0.04 }] },
          { id: 'wrd_wild_2a', tier: 2, name: 'Barkskin Renewal', maxRank: 3, desc: 'Barkskin lasts %1s longer and reduces physical damage %%2 more.', vals: [1, 0.03], effects: [{ k: 'spell', match: { names: ['Barkskin'] }, field: 'duration', op: 'add', per: 1 }, { k: 'spell', match: { names: ['Barkskin'] }, field: 'physicalDamageTakenMultiplier', op: 'mul', per: -0.03 }] },
          { id: 'wrd_wild_2b', tier: 2, name: 'Ancient Pulse', maxRank: 3, desc: 'Ancient Pulse heals %%1 more and cooldown -%2s.', vals: [0.06, 0.4], effects: [{ k: 'spell', match: { names: ['Ancient Pulse'] }, field: 'heal', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Ancient Pulse'] }, field: 'cooldown', op: 'add', per: -0.4 }] },
          { id: 'wrd_wild_3', tier: 3, name: 'Wild Fortitude', maxRank: 3, desc: 'Increases HP by %1; your heal-over-time effects heal %%2 more.', vals: [12, 0.05], effects: [{ k: 'stat', stat: 'hp', per: 12 }, { k: 'mod', mod: 'healingDone', op: 'mul', per: 0.05, when: { periodic: true } }] },
          { id: 'wrd_wild_4', tier: 4, name: 'Heart of the Grove', maxRank: 2, desc: 'Below 50% HP you take %%1 less damage.', vals: [0.02], effects: [{ k: 'mod', mod: 'damageTaken', op: 'mul', per: -0.02, when: { selfHpBelow: 0.5 } }] },
          { id: 'wrd_wild_5', tier: 5, name: 'Evergrowth', maxRank: 1, capstone: true, desc: 'At 35% HP: instantly heal 12% of max HP and refund 6% mana.', vals: [], effects: [cap('wrd_evergrowth', 'Evergrowth', 'lowHealth', { threshold: 0.35, icd: 120, chance: 1, color: '#4a8a6b', log: 'Evergrowth surges.' }, [{ type: 'healPct', pct: 0.12 }, { type: 'manaPct', pct: 0.06 }])] }
        ] }
    ]
  };

  DR.TALENT_TREES.Fighter = {
    className: 'Fighter', role: 'Melee DPS',
    specs: [
      { id: 'fighter_berserker', name: 'Berserker', role: 'Reckless 2H damage', summary: 'The lower your health, the harder you hit.', color: '#c0503a',
        empowers: ['Reckless Strike', 'Bloodrush', 'Savage Momentum', 'Final Swing', 'Berserker\'s Roar', 'Momentum'],
        nodes: [
          { id: 'fig_bers_1a', tier: 1, name: 'Blood and Iron', maxRank: 3, desc: 'Increases Attack by %1 and Strength by %2.', vals: [4, 2], effects: [{ k: 'stat', stat: 'attack', per: 4 }, { k: 'stat', stat: 'strength', per: 2 }] },
          { id: 'fig_bers_1b', tier: 1, name: 'Rising Fury', maxRank: 3, desc: 'Below 50% HP your damage +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.05, when: { selfHpBelow: 0.5 } }] },
          { id: 'fig_bers_2a', tier: 2, name: 'Bloodrush', maxRank: 3, desc: 'Bloodrush lasts %1s longer and cooldown -%2s.', vals: [1, 0.5], effects: [{ k: 'spell', match: { names: ['Bloodrush'] }, field: 'duration', op: 'add', per: 1 }, { k: 'spell', match: { names: ['Bloodrush'] }, field: 'cooldown', op: 'add', per: -0.5 }] },
          { id: 'fig_bers_2b', tier: 2, name: 'Reckless Cleave', maxRank: 3, desc: 'Reckless Strike and Cleave deal %%1 more damage.', vals: [0.06], effects: [{ k: 'spell', match: { names: ['Reckless Strike', 'Cleave'] }, field: 'power', op: 'mul', per: 0.06 }] },
          { id: 'fig_bers_3', tier: 3, name: 'Savage Momentum', maxRank: 3, desc: 'Savage Momentum lasts %1s longer; your damage +%%2.', vals: [2, 0.03], effects: [{ k: 'spell', match: { names: ['Savage Momentum'] }, field: 'duration', op: 'add', per: 2 }, { k: 'mod', mod: 'damageDone', op: 'mul', per: 0.03 }] },
          { id: 'fig_bers_4', tier: 4, name: 'Final Swing', maxRank: 2, desc: 'Damage to targets below 25% HP +%%1.', vals: [0.09], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.09, when: { targetHpBelow: 0.25 } }] },
          { id: 'fig_bers_5', tier: 5, name: 'Deathwish', maxRank: 1, capstone: true, desc: 'At 30% HP: +40% damage but +25% damage taken for 10s.', vals: [], effects: [cap('fig_deathwish', 'Deathwish', 'lowHealth', { threshold: 0.30, icd: 90, chance: 1, color: '#c0503a', log: 'Deathwish!' }, [{ type: 'dynamicMod', mod: 'damageDone', op: 'mul', value: 1.4, duration: 10 }, { type: 'status', status: { id: 'fig_deathwish', name: 'Deathwish', type: 'buff', duration: 10, damageTakenMultiplier: 1.25, color: '#c0503a', hostile: false, tags: ['fighter', 'talent', 'capstone'] } }])] }
        ] },
      { id: 'fighter_weaponmaster', name: 'Weaponmaster', role: 'Technical heavy-weapon DPS', summary: 'Precision, flow, and perfect strikes.', color: '#b0803a',
        empowers: ['Heavy Swing', 'Heavy Riposte', 'Weapon Flow', 'Titan Chop', 'Perfect Masterstroke', 'Unstoppable Footwork'],
        nodes: [
          { id: 'fig_wm_1a', tier: 1, name: 'Precision', maxRank: 3, desc: 'Increases Crit Chance by %1 and Crit Damage by %2.', vals: [2, 4], effects: [{ k: 'stat', stat: 'critChance', per: 2 }, { k: 'stat', stat: 'critDamage', per: 4 }] },
          { id: 'fig_wm_1b', tier: 1, name: 'Perfect Swing', maxRank: 3, desc: 'Melee ability damage +%%1.', vals: [0.04], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.04, when: { spellKind: ['melee', 'aoeMelee', 'meleeDebuff', 'dashStrike'] } }] },
          { id: 'fig_wm_2a', tier: 2, name: 'Weapon Flow', maxRank: 3, desc: 'Weapon Flow lasts %1s longer and gains +%2 charge.', vals: [2, 1], effects: [{ k: 'spell', match: { names: ['Weapon Flow'] }, field: 'duration', op: 'add', per: 2 }, { k: 'spell', match: { names: ['Weapon Flow'] }, field: 'charges', op: 'add', per: 1 }] },
          { id: 'fig_wm_2b', tier: 2, name: 'Heavy Riposte', maxRank: 3, desc: 'Heavy Riposte cooldown -%1s and damage +%%2.', vals: [0.5, 0.06], effects: [{ k: 'spell', match: { names: ['Heavy Riposte'] }, field: 'cooldown', op: 'add', per: -0.5 }, { k: 'spell', match: { names: ['Heavy Riposte'] }, field: 'power', op: 'mul', per: 0.06 }] },
          { id: 'fig_wm_3', tier: 3, name: 'Masterstroke', maxRank: 3, desc: 'Increases Crit Chance by %1; melee damage +%%2.', vals: [2, 0.03], effects: [{ k: 'stat', stat: 'critChance', per: 2 }, { k: 'mod', mod: 'damageDone', op: 'mul', per: 0.03, when: { spellKind: ['melee', 'aoeMelee', 'meleeDebuff', 'dashStrike'] } }] },
          { id: 'fig_wm_4', tier: 4, name: 'Titan\'s Grip', maxRank: 2, desc: 'Two-handed damage +%%1.', vals: [0.04], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.04 }] },
          { id: 'fig_wm_5', tier: 5, name: 'Perfect Form', maxRank: 1, capstone: true, desc: 'On a crit, 30% chance to gain +30% damage for 8s.', vals: [], effects: [cap('fig_perfect_form', 'Perfect Form', 'onCrit', { chance: 0.3, icd: 5, color: '#b0803a', log: 'Perfect Form!' }, [{ type: 'dynamicMod', mod: 'damageDone', op: 'mul', value: 1.3, duration: 8 }])] }
        ] },
      { id: 'fighter_breaker', name: 'Breaker', role: 'Stagger and armor-break bruiser', summary: 'Shatter armor and stagger the biggest foes.', color: '#8a6a4a',
        empowers: ['Armor Splitter', 'Groundbreaker', 'Crushing Blow', 'Shatter Guard', 'Bonebreaker', 'Whirlwind Cleave'],
        nodes: [
          { id: 'fig_brk_1a', tier: 1, name: 'Bonecrusher', maxRank: 3, desc: 'Increases Attack by %1 and Stamina by %2.', vals: [3, 2], effects: [{ k: 'stat', stat: 'attack', per: 3 }, { k: 'stat', stat: 'stamina', per: 2 }] },
          { id: 'fig_brk_1b', tier: 1, name: 'Splitting Blows', maxRank: 3, desc: 'Increases your damage by %%1.', vals: [0.04], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.04 }] },
          { id: 'fig_brk_2a', tier: 2, name: 'Armor Splitter', maxRank: 3, desc: 'Armor Splitter lasts %1s longer and its weaken effect +%%2.', vals: [1, 0.02], effects: [{ k: 'spell', match: { names: ['Armor Splitter'] }, field: 'duration', op: 'add', per: 1 }, { k: 'spell', match: { names: ['Armor Splitter'] }, field: 'physicalDamageTakenMultiplier', op: 'mul', per: 0.02 }] },
          { id: 'fig_brk_2b', tier: 2, name: 'Groundbreaker', maxRank: 3, desc: 'Groundbreaker radius +%1 and damage +%%2.', vals: [0.2, 0.05], effects: [{ k: 'spell', match: { names: ['Groundbreaker'] }, field: 'radius', op: 'add', per: 0.2 }, { k: 'spell', match: { names: ['Groundbreaker'] }, field: 'power', op: 'mul', per: 0.05 }] },
          { id: 'fig_brk_3', tier: 3, name: 'Shatter Guard', maxRank: 3, desc: 'Damage to enemies below 50% HP +%%1.', vals: [0.04], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.04, when: { targetHpBelow: 0.5 } }] },
          { id: 'fig_brk_4', tier: 4, name: 'Concussive Force', maxRank: 2, desc: 'Crushing Blow and Bonebreaker cooldown -%1s.', vals: [0.5], effects: [{ k: 'spell', match: { names: ['Crushing Blow', 'Bonebreaker'] }, field: 'cooldown', op: 'add', per: -0.5 }] },
          { id: 'fig_brk_5', tier: 5, name: 'Sunder the World', maxRank: 1, capstone: true, desc: 'On cast, shatter the ground: 250% of your attack to all nearby enemies, staggered and armor-broken for 12s.', vals: [], effects: [cap('fig_sunder', 'Sunder the World', 'onCast', { chance: 1, icd: 25, color: '#8a6a4a', log: 'The ground shatters!' }, [{ type: 'damageAoe', pctOfAttack: 2.5, radius: 5, damageType: 'physical' }, { type: 'applyStatusAoe', radius: 5, status: { id: 'fig_sunder_stagger', name: 'Sundered', type: 'debuff', duration: 12, physicalDamageTakenMultiplier: 1.12, moveSpeedMultiplier: 0.5, hostile: true, tags: ['stagger', 'armorbreak', 'talent'] } }])] }
        ] }
    ]
  };

  DR.TALENT_TREES.Rogue = {
    className: 'Rogue', role: 'Melee DPS',
    specs: [
      { id: 'rogue_shadowblade', name: 'Shadowblade', role: 'Stealth burst', summary: 'Strike from the dark and vanish.', color: '#6a5a8a',
        empowers: ['Backstab', 'Shadowstep', 'Smoke Veil', 'Vanish', 'Killing Cut', 'Shadow Dance', 'Silent Execution'],
        nodes: [
          { id: 'rog_shadow_1a', tier: 1, name: 'Shadow Training', maxRank: 3, desc: 'Increases Dexterity by %1 and Crit Chance by %2.', vals: [3, 2], effects: [{ k: 'stat', stat: 'dexterity', per: 3 }, { k: 'stat', stat: 'critChance', per: 2 }] },
          { id: 'rog_shadow_1b', tier: 1, name: 'Opportunist', maxRank: 3, desc: 'Increases your damage by %%1.', vals: [0.04], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.04 }] },
          { id: 'rog_shadow_2a', tier: 2, name: 'Backstab Mastery', maxRank: 3, desc: 'Backstab deals %%1 more and costs %%2 less.', vals: [0.06, 0.05], effects: [{ k: 'spell', match: { names: ['Backstab'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Backstab'] }, field: 'cost', op: 'mul', per: -0.05 }] },
          { id: 'rog_shadow_2b', tier: 2, name: 'Shadowstep', maxRank: 3, desc: 'Shadowstep cooldown -%1s and +%%2 damage.', vals: [0.6, 0.05], effects: [{ k: 'spell', match: { names: ['Shadowstep'] }, field: 'cooldown', op: 'add', per: -0.6 }, { k: 'spell', match: { names: ['Shadowstep'] }, field: 'power', op: 'mul', per: 0.05 }] },
          { id: 'rog_shadow_3', tier: 3, name: 'Ambush', maxRank: 3, desc: 'Damage to targets above 80% HP (openers) +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.05, when: { targetHpAbove: 0.8 } }] },
          { id: 'rog_shadow_4', tier: 4, name: 'Killing Cut', maxRank: 2, desc: 'Increases Crit Damage by %1; Killing Cut +%%2 damage.', vals: [5, 0.06], effects: [{ k: 'stat', stat: 'critDamage', per: 5 }, { k: 'spell', match: { names: ['Killing Cut'] }, field: 'power', op: 'mul', per: 0.06 }] },
          { id: 'rog_shadow_5', tier: 5, name: 'Death from Shadow', maxRank: 1, capstone: true, desc: 'On kill, re-enter stealth, reset Backstab and Shadowstep, gain +25% damage for 8s and refund 10% mana.', vals: [], effects: [cap('rog_death_shadow', 'Death from Shadow', 'onKill', { chance: 1, icd: 30, color: '#6a5a8a', log: 'Death from the shadows.' }, [{ type: 'resetCooldowns', spells: ['Backstab', 'Shadowstep'] }, { type: 'status', status: { id: 'rog_stealth', name: 'Stealth', type: 'buff', duration: 6, color: '#6a5a8a', hostile: false, tags: ['rogue', 'stealth', 'talent'] } }, { type: 'dynamicMod', mod: 'damageDone', op: 'mul', value: 1.25, duration: 8 }, { type: 'manaPct', pct: 0.10 }])] }
        ] },
      { id: 'rogue_venomfang', name: 'Venomfang', role: 'Poison and bleed', summary: 'Death by a thousand ticks.', color: '#5a8a4a',
        empowers: ['Venom Edge', 'Bleeding Vein', 'Crippling Toxin', 'Garrote', 'Deathdose', 'Twin Fang'],
        nodes: [
          { id: 'rog_venom_1a', tier: 1, name: 'Toxicology', maxRank: 3, desc: 'Increases Attack by %1 and Damage Power by %2.', vals: [3, 5], effects: [{ k: 'stat', stat: 'attack', per: 3 }, { k: 'stat', stat: 'damagePower', per: 5 }] },
          { id: 'rog_venom_1b', tier: 1, name: 'Festering Wounds', maxRank: 3, desc: 'Damage-over-time effects +%%1.', vals: [0.06], effects: [{ k: 'mod', mod: 'dotDamage', op: 'mul', per: 0.06 }] },
          { id: 'rog_venom_2a', tier: 2, name: 'Venom Edge', maxRank: 3, desc: 'Venom Edge lasts %1s longer and gains +%2 charge.', vals: [1, 1], effects: [{ k: 'spell', match: { names: ['Venom Edge'] }, field: 'duration', op: 'add', per: 1 }, { k: 'spell', match: { names: ['Venom Edge'] }, field: 'charges', op: 'add', per: 1 }] },
          { id: 'rog_venom_2b', tier: 2, name: 'Bleeding Vein', maxRank: 3, desc: 'Bleeds tick %%1 harder and last %2s longer.', vals: [0.06, 1], effects: [{ k: 'spell', match: { names: ['Bleeding Vein', 'Garrote'] }, field: 'tickDamage', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Bleeding Vein', 'Garrote'] }, field: 'tickDuration', op: 'add', per: 1 }] },
          { id: 'rog_venom_3', tier: 3, name: 'Crippling Toxin', maxRank: 3, desc: 'Poison and bleed damage +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'dotDamage', op: 'mul', per: 0.05 }] },
          { id: 'rog_venom_4', tier: 4, name: 'Deathdose', maxRank: 2, desc: 'Periodic (DoT) damage +%%1.', vals: [0.06], effects: [{ k: 'mod', mod: 'dotDamage', op: 'mul', per: 0.06, when: { periodic: true } }] },
          { id: 'rog_venom_5', tier: 5, name: 'The Long Death', maxRank: 1, capstone: true, desc: 'On cast, detonate all your poison and bleed on the target for 150% of their remaining damage.', vals: [], effects: [cap('rog_long_death', 'The Long Death', 'onCast', { chance: 1, icd: 20, color: '#5a8a4a', log: 'The long death.' }, [{ type: 'detonateDots', pctOfRemaining: 1.5, damageType: 'poison' }, { type: 'damageTarget', pctOfAttack: 1.0, damageType: 'poison' }])] }
        ] },
      { id: 'rogue_duelist', name: 'Duelist', role: 'Evasion and precision', summary: 'Dance between blows and counter.', color: '#4a7a8a',
        empowers: ['Evasive Step', 'Flurry Cut', 'Perfect Counter', 'Quick Cut', 'Twin Fang', 'Phantom Blades'],
        nodes: [
          { id: 'rog_duel_1a', tier: 1, name: 'Bladework', maxRank: 3, desc: 'Increases Dexterity by %1 and Defense by %2.', vals: [3, 2], effects: [{ k: 'stat', stat: 'dexterity', per: 3 }, { k: 'stat', stat: 'defense', per: 2 }] },
          { id: 'rog_duel_1b', tier: 1, name: 'Fleet Footed', maxRank: 3, desc: 'Increases Armor by %1 and Speed by %2 (dodge).', vals: [3, 0.02], effects: [{ k: 'stat', stat: 'armor', per: 3 }, { k: 'stat', stat: 'speed', per: 0.02 }] },
          { id: 'rog_duel_2a', tier: 2, name: 'Riposte', maxRank: 3, desc: 'Perfect Counter cooldown -%1s and +%%2 damage.', vals: [0.5, 0.06], effects: [{ k: 'spell', match: { names: ['Perfect Counter'] }, field: 'cooldown', op: 'add', per: -0.5 }, { k: 'spell', match: { names: ['Perfect Counter'] }, field: 'power', op: 'mul', per: 0.06 }] },
          { id: 'rog_duel_2b', tier: 2, name: 'Flurry', maxRank: 3, desc: 'Flurry Cut +%%1 damage and costs %%2 less.', vals: [0.06, 0.04], effects: [{ k: 'spell', match: { names: ['Flurry Cut'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Flurry Cut'] }, field: 'cost', op: 'mul', per: -0.04 }] },
          { id: 'rog_duel_3', tier: 3, name: 'Quickstep', maxRank: 3, desc: 'Evasive Step cooldown -%1s; your damage +%%2.', vals: [0.5, 0.03], effects: [{ k: 'spell', match: { names: ['Evasive Step'] }, field: 'cooldown', op: 'add', per: -0.5 }, { k: 'mod', mod: 'damageDone', op: 'mul', per: 0.03 }] },
          { id: 'rog_duel_4', tier: 4, name: 'Perfect Counter', maxRank: 2, desc: 'Increases your damage by %%1.', vals: [0.04], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.04 }] },
          { id: 'rog_duel_5', tier: 5, name: 'Blade Storm', maxRank: 1, capstone: true, desc: 'When you take damage, riposte the attacker for 180% of your attack.', vals: [], effects: [cap('rog_bladestorm', 'Blade Storm', 'onDamageTaken', { chance: 0.2, icd: 12, color: '#4a7a8a', log: 'Blade Storm!' }, [{ type: 'damageTarget', pctOfAttack: 1.8, damageType: 'physical' }])] }
        ] }
    ]
  };

  DR.TALENT_TREES.Ranger = {
    className: 'Ranger', role: 'Physical Ranged DPS',
    specs: [
      { id: 'ranger_beaststalker', name: 'Beaststalker', role: 'Tracking and beast-hunting archer', summary: 'Mark, track, and run down your prey.', color: '#7a8a4a',
        empowers: ['Hunter\'s Mark', 'Predator Shot', 'Track Prey', 'Beastbane Arrow', 'Apex Predator', 'True Hunt'],
        nodes: [
          { id: 'rgr_beast_1a', tier: 1, name: 'Hunter\'s Instinct', maxRank: 3, desc: 'Increases Dexterity by %1 and Attack by %2.', vals: [3, 3], effects: [{ k: 'stat', stat: 'dexterity', per: 3 }, { k: 'stat', stat: 'attack', per: 3 }] },
          { id: 'rgr_beast_1b', tier: 1, name: 'Marked Prey', maxRank: 3, desc: 'Increases your damage by %%1.', vals: [0.03], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.03 }] },
          { id: 'rgr_beast_2a', tier: 2, name: 'Hunter\'s Mark', maxRank: 3, desc: 'Hunter\'s Mark lasts %1s longer and costs %%2 less.', vals: [2, 0.05], effects: [{ k: 'spell', match: { names: ['Hunter\'s Mark'] }, field: 'duration', op: 'add', per: 2 }, { k: 'spell', match: { names: ['Hunter\'s Mark'] }, field: 'cost', op: 'mul', per: -0.05 }] },
          { id: 'rgr_beast_2b', tier: 2, name: 'Predator Shot', maxRank: 3, desc: 'Predator Shot deals %%1 more and cooldown -%2s.', vals: [0.05, 0.3], effects: [{ k: 'spell', match: { names: ['Predator Shot'] }, field: 'power', op: 'mul', per: 0.05 }, { k: 'spell', match: { names: ['Predator Shot'] }, field: 'cooldown', op: 'add', per: -0.3 }] },
          { id: 'rgr_beast_3', tier: 3, name: 'Beastbane', maxRank: 3, desc: 'Beastbane Arrow cooldown -%1s; damage to wounded targets +%%2.', vals: [0.4, 0.04], effects: [{ k: 'spell', match: { names: ['Beastbane Arrow'] }, field: 'cooldown', op: 'add', per: -0.4 }, { k: 'mod', mod: 'damageDone', op: 'mul', per: 0.04, when: { targetHpBelow: 0.5 } }] },
          { id: 'rgr_beast_4', tier: 4, name: 'Apex Predator', maxRank: 2, desc: 'Increases Attack by %1.', vals: [2], effects: [{ k: 'stat', stat: 'attack', per: 2 }] },
          { id: 'rgr_beast_5', tier: 5, name: 'True Hunt', maxRank: 1, capstone: true, desc: 'On kill, gain +30% damage for 10s.', vals: [], effects: [cap('rgr_true_hunt', 'True Hunt', 'onKill', { chance: 1, icd: 20, color: '#7a8a4a', log: 'True Hunt!' }, [{ type: 'dynamicMod', mod: 'damageDone', op: 'mul', value: 1.3, duration: 10 }])] }
        ] },
      { id: 'ranger_trapper', name: 'Trapper', role: 'Control-based ranged DPS', summary: 'Snare, spike, and zone the battlefield.', color: '#8a7a3a',
        empowers: ['Snare Trap', 'Spike Trap', 'Binding Net', 'Kill Zone', 'Volley', 'Rain of Barbs'],
        nodes: [
          { id: 'rgr_trap_1a', tier: 1, name: 'Field Craft', maxRank: 3, desc: 'Increases Attack by %1 and Damage Power by %2.', vals: [2, 4], effects: [{ k: 'stat', stat: 'attack', per: 2 }, { k: 'stat', stat: 'damagePower', per: 4 }] },
          { id: 'rgr_trap_1b', tier: 1, name: 'Cruel Traps', maxRank: 3, desc: 'Trap and area damage +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.05 }] },
          { id: 'rgr_trap_2a', tier: 2, name: 'Snare Mastery', maxRank: 3, desc: 'Snare Trap and Binding Net last %1s longer; Snare Trap slows %%2 harder.', vals: [1, 0.1], effects: [{ k: 'spell', match: { names: ['Snare Trap', 'Binding Net'] }, field: 'duration', op: 'add', per: 1 }, { k: 'spell', match: { names: ['Snare Trap'] }, field: 'slowPct', op: 'mul', per: 0.1 }] },
          { id: 'rgr_trap_2b', tier: 2, name: 'Spike Trap', maxRank: 3, desc: 'Spike Trap ticks %%1 harder; cooldown -%2s.', vals: [0.06, 0.4], effects: [{ k: 'spell', match: { names: ['Spike Trap'] }, field: 'tickDamage', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Spike Trap'] }, field: 'cooldown', op: 'add', per: -0.4 }] },
          { id: 'rgr_trap_3', tier: 3, name: 'Kill Zone', maxRank: 3, desc: 'Kill Zone radius +%1 and damage +%%2.', vals: [0.2, 0.05], effects: [{ k: 'spell', match: { names: ['Kill Zone'] }, field: 'radius', op: 'add', per: 0.2 }, { k: 'spell', match: { names: ['Kill Zone'] }, field: 'power', op: 'mul', per: 0.05 }] },
          { id: 'rgr_trap_4', tier: 4, name: 'Area Denial', maxRank: 2, desc: 'Increases Damage Power by %1.', vals: [6], effects: [{ k: 'stat', stat: 'damagePower', per: 6 }] },
          { id: 'rgr_trap_5', tier: 5, name: 'The Snare Closes', maxRank: 1, capstone: true, desc: 'On cast, strike all enemies near your target for 250% of your attack and root them for 3s.', vals: [], effects: [cap('rgr_snare_closes', 'The Snare Closes', 'onCast', { chance: 1, icd: 18, color: '#8a7a3a', log: 'The snare closes!' }, [{ type: 'damageAoe', pctOfAttack: 2.5, radius: 4, damageType: 'physical' }, { type: 'applyStatusAoe', radius: 4, status: { id: 'rgr_snare_root', name: 'Snared', type: 'debuff', duration: 3, rootDuration: 3, moveSpeedMultiplier: 0, hostile: true, tags: ['root', 'talent'] } }])] }
        ] },
      { id: 'ranger_deadeye', name: 'Deadeye', role: 'Long-range precision', summary: 'One shot, one kill.', color: '#8a4a4a',
        empowers: ['Piercing Arrow', 'Eagle Eye', 'Heartseeker Arrow', 'Steady Shot', 'Volley', 'Rain of Barbs'],
        nodes: [
          { id: 'rgr_dead_1a', tier: 1, name: 'Steady Hands', maxRank: 3, desc: 'Increases Crit Chance by %1 and Crit Damage by %2.', vals: [2, 5], effects: [{ k: 'stat', stat: 'critChance', per: 2 }, { k: 'stat', stat: 'critDamage', per: 5 }] },
          { id: 'rgr_dead_1b', tier: 1, name: 'Longshot', maxRank: 3, desc: 'Your ranged damage +%%1.', vals: [0.04], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.04 }] },
          { id: 'rgr_dead_2a', tier: 2, name: 'Piercing Arrow', maxRank: 3, desc: 'Piercing Arrow deals %%1 more damage.', vals: [0.06], effects: [{ k: 'spell', match: { names: ['Piercing Arrow'] }, field: 'power', op: 'mul', per: 0.06 }] },
          { id: 'rgr_dead_2b', tier: 2, name: 'Focused Aim', maxRank: 3, desc: 'Eagle Eye lasts %1s longer; +%2 Crit Chance.', vals: [2, 1], effects: [{ k: 'spell', match: { names: ['Eagle Eye'] }, field: 'duration', op: 'add', per: 2 }, { k: 'stat', stat: 'critChance', per: 1 }] },
          { id: 'rgr_dead_3', tier: 3, name: 'Heartseeker', maxRank: 3, desc: 'Increases Crit Damage by %1; Heartseeker Arrow cooldown -%2s.', vals: [4, 0.5], effects: [{ k: 'stat', stat: 'critDamage', per: 4 }, { k: 'spell', match: { names: ['Heartseeker Arrow'] }, field: 'cooldown', op: 'add', per: -0.5 }] },
          { id: 'rgr_dead_4', tier: 4, name: 'Armor Piercing', maxRank: 2, desc: 'Increases Crit Damage by %1.', vals: [5], effects: [{ k: 'stat', stat: 'critDamage', per: 5 }] },
          { id: 'rgr_dead_5', tier: 5, name: 'One Shot', maxRank: 1, capstone: true, desc: 'On a crit, 20% chance for your next shot to hit for 300% of your attack.', vals: [], effects: [cap('rgr_one_shot', 'One Shot', 'onCrit', { chance: 0.2, icd: 30, color: '#8a4a4a', log: 'One Shot!' }, [{ type: 'damageTarget', pctOfAttack: 3.0, damageType: 'physical' }])] }
        ] }
    ]
  };

  DR.TALENT_TREES.Assassin = {
    className: 'Assassin', role: 'Physical Ranged DPS',
    specs: [
      { id: 'assassin_boltweaver', name: 'Boltweaver', role: 'Crossbow burst', summary: 'Reload, fire, execute.', color: '#8a5aa0',
        empowers: ['Light Crossbow Shot', 'Piercing Bolt', 'Quick Reload', 'Repeater Burst', 'Execution Bolt', 'Venom Bolt'],
        nodes: [
          { id: 'asn_bolt_1a', tier: 1, name: 'Marksmanship', maxRank: 3, desc: 'Increases Dexterity by %1 and Crit Chance by %2.', vals: [3, 2], effects: [{ k: 'stat', stat: 'dexterity', per: 3 }, { k: 'stat', stat: 'critChance', per: 2 }] },
          { id: 'asn_bolt_1b', tier: 1, name: 'Bolt Velocity', maxRank: 3, desc: 'Bolt ability damage +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.05, when: { spellKind: ['bolt', 'boltDot'] } }] },
          { id: 'asn_bolt_2a', tier: 2, name: 'Quick Reload', maxRank: 3, desc: 'Quick Reload cooldown -%1s and lasts %2s longer.', vals: [0.4, 1], effects: [{ k: 'spell', match: { names: ['Quick Reload'] }, field: 'cooldown', op: 'add', per: -0.4 }, { k: 'spell', match: { names: ['Quick Reload'] }, field: 'duration', op: 'add', per: 1 }] },
          { id: 'asn_bolt_2b', tier: 2, name: 'Piercing Bolt', maxRank: 3, desc: 'Piercing Bolt deals %%1 more damage.', vals: [0.06], effects: [{ k: 'spell', match: { names: ['Piercing Bolt'] }, field: 'power', op: 'mul', per: 0.06 }] },
          { id: 'asn_bolt_3', tier: 3, name: 'Repeater Burst', maxRank: 3, desc: 'Repeater Burst +%%1 damage and costs %%2 less.', vals: [0.06, 0.05], effects: [{ k: 'spell', match: { names: ['Repeater Burst'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Repeater Burst'] }, field: 'cost', op: 'mul', per: -0.05 }] },
          { id: 'asn_bolt_4', tier: 4, name: 'Execution Bolt', maxRank: 2, desc: 'Damage to targets below 30% HP +%%1.', vals: [0.10], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.10, when: { targetHpBelow: 0.30 } }] },
          { id: 'asn_bolt_5', tier: 5, name: 'Perfect Shot', maxRank: 1, capstone: true, desc: 'On cast, strike your target for 250% of your attack.', vals: [], effects: [cap('asn_perfect_shot', 'Perfect Shot', 'onCast', { chance: 1, icd: 25, color: '#8a5aa0', log: 'Perfect Shot!' }, [{ type: 'damageTarget', pctOfAttack: 2.5, damageType: 'physical' }])] }
        ] },
      { id: 'assassin_trapmaster', name: 'Trapmaster', role: 'Trap and ambush', summary: 'The battlefield is your killing floor.', color: '#6a8a3a',
        empowers: ['Tripwire', 'Poison Snare', 'Springblade Trap', 'Death Box', 'Shadow Fuse'],
        nodes: [
          { id: 'asn_trap_1a', tier: 1, name: 'Mechanist', maxRank: 3, desc: 'Increases Attack by %1 and Damage Power by %2.', vals: [2, 5], effects: [{ k: 'stat', stat: 'attack', per: 2 }, { k: 'stat', stat: 'damagePower', per: 5 }] },
          { id: 'asn_trap_1b', tier: 1, name: 'Lethal Devices', maxRank: 3, desc: 'Trap damage +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.05 }] },
          { id: 'asn_trap_2a', tier: 2, name: 'Tripwire', maxRank: 3, desc: 'Tripwire lasts %1s longer and cooldown -%2s.', vals: [1, 0.4], effects: [{ k: 'spell', match: { names: ['Tripwire'] }, field: 'duration', op: 'add', per: 1 }, { k: 'spell', match: { names: ['Tripwire'] }, field: 'cooldown', op: 'add', per: -0.4 }] },
          { id: 'asn_trap_2b', tier: 2, name: 'Poison Snare', maxRank: 3, desc: 'Poison Snare +%%1 damage and lasts %2s longer.', vals: [0.06, 1], effects: [{ k: 'spell', match: { names: ['Poison Snare'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Poison Snare'] }, field: 'duration', op: 'add', per: 1 }] },
          { id: 'asn_trap_3', tier: 3, name: 'Springblade', maxRank: 3, desc: 'Springblade Trap +%%1 damage and ticks %%2 harder.', vals: [0.06, 0.05], effects: [{ k: 'spell', match: { names: ['Springblade Trap'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Springblade Trap'] }, field: 'tickDamage', op: 'mul', per: 0.05 }] },
          { id: 'asn_trap_4', tier: 4, name: 'Death Box', maxRank: 2, desc: 'Death Box damage +%%1.', vals: [0.08], effects: [{ k: 'spell', match: { names: ['Death Box'] }, field: 'power', op: 'mul', per: 0.08 }] },
          { id: 'asn_trap_5', tier: 5, name: 'The Kill Box', maxRank: 1, capstone: true, desc: 'On cast, detonate the traps: 300% of your attack as poison to all nearby enemies and root them for 4s.', vals: [], effects: [cap('asn_kill_box', 'The Kill Box', 'onCast', { chance: 1, icd: 35, color: '#6a8a3a', log: 'The kill box.' }, [{ type: 'damageAoe', pctOfAttack: 3.0, radius: 4, damageType: 'poison' }, { type: 'applyStatusAoe', radius: 4, status: { id: 'asn_killbox_root', name: 'Trapped', type: 'debuff', duration: 4, rootDuration: 4, moveSpeedMultiplier: 0, hostile: true, tags: ['root', 'talent'] } }])] }
        ] },
      { id: 'assassin_nightblade', name: 'Nightblade', role: 'Throwing weapon execution', summary: 'Marked, then gone.', color: '#5a5a8a',
        empowers: ['Throwing Knife', 'Fan of Knives', 'Marked for Death', 'Silent Step', 'Ricochet Blade', 'Silent Finish', 'Perfect Ambush', 'Black Lotus Venom'],
        nodes: [
          { id: 'asn_night_1a', tier: 1, name: 'Knifework', maxRank: 3, desc: 'Increases Dexterity by %1 and Attack by %2.', vals: [3, 3], effects: [{ k: 'stat', stat: 'dexterity', per: 3 }, { k: 'stat', stat: 'attack', per: 3 }] },
          { id: 'asn_night_1b', tier: 1, name: 'Marked', maxRank: 3, desc: 'Increases your damage by %%1.', vals: [0.035], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.035 }] },
          { id: 'asn_night_2a', tier: 2, name: 'Fan of Knives', maxRank: 3, desc: 'Fan of Knives +%%1 damage and radius +%2.', vals: [0.06, 0.2], effects: [{ k: 'spell', match: { names: ['Fan of Knives'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Fan of Knives'] }, field: 'radius', op: 'add', per: 0.2 }] },
          { id: 'asn_night_2b', tier: 2, name: 'Black Lotus', maxRank: 3, desc: 'Black Lotus Venom lasts %1s longer and gains +%2 charge.', vals: [2, 1], effects: [{ k: 'spell', match: { names: ['Black Lotus Venom'] }, field: 'duration', op: 'add', per: 2 }, { k: 'spell', match: { names: ['Black Lotus Venom'] }, field: 'charges', op: 'add', per: 1 }] },
          { id: 'asn_night_3', tier: 3, name: 'Silent Finish', maxRank: 3, desc: 'Damage to targets below 35% HP +%%1; Silent Finish cooldown -%2s.', vals: [0.05, 0.5], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.05, when: { targetHpBelow: 0.35 } }, { k: 'spell', match: { names: ['Silent Finish'] }, field: 'cooldown', op: 'add', per: -0.5 }] },
          { id: 'asn_night_4', tier: 4, name: 'Ricochet', maxRank: 2, desc: 'Ricochet Blade damage +%%1.', vals: [0.06], effects: [{ k: 'spell', match: { names: ['Ricochet Blade'] }, field: 'power', op: 'mul', per: 0.06 }] },
          { id: 'asn_night_5', tier: 5, name: 'Marked for Death', maxRank: 1, capstone: true, desc: 'On kill, gain +25% damage for 8s and refund 5% mana.', vals: [], effects: [cap('asn_marked_death', 'Marked for Death', 'onKill', { chance: 1, icd: 20, color: '#5a5a8a', log: 'Marked for death.' }, [{ type: 'dynamicMod', mod: 'damageDone', op: 'mul', value: 1.25, duration: 8 }, { type: 'manaPct', pct: 0.05 }])] }
        ] }
    ]
  };

  DR.TALENT_TREES.Wizard = {
    className: 'Wizard', role: 'Magic Ranged DPS',
    specs: [
      { id: 'wizard_pyromancer', name: 'Pyromancer', role: 'Fire damage', summary: 'Everything burns.', color: '#e0603a',
        empowers: ['Fireball', 'Flame Wave', 'Ignite', 'Meteorfall', 'Spellstorm'],
        nodes: [
          { id: 'wiz_pyro_1a', tier: 1, name: 'Inner Flame', maxRank: 3, desc: 'Increases Intelligence by %1 and Spell Power by %2.', vals: [3, 6], effects: [{ k: 'stat', stat: 'intelligence', per: 3 }, { k: 'stat', stat: 'spellPower', per: 6 }] },
          { id: 'wiz_pyro_1b', tier: 1, name: 'Combustion', maxRank: 3, desc: 'Fire damage +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.05, when: { damageType: 'fire' } }] },
          { id: 'wiz_pyro_2a', tier: 2, name: 'Fireball', maxRank: 3, desc: 'Fireball deals %%1 more; cast time %%2 faster.', vals: [0.06, 0.03], effects: [{ k: 'spell', match: { names: ['Fireball'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Fireball'] }, field: 'castTime', op: 'mul', per: -0.03 }] },
          { id: 'wiz_pyro_2b', tier: 2, name: 'Ignite', maxRank: 3, desc: 'Ignite ticks %%1 harder and lasts %2s longer.', vals: [0.06, 1], effects: [{ k: 'spell', match: { names: ['Ignite'] }, field: 'tickDamage', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Ignite'] }, field: 'tickDuration', op: 'add', per: 1 }] },
          { id: 'wiz_pyro_3', tier: 3, name: 'Flame Wave', maxRank: 3, desc: 'Flame Wave radius +%1 and damage +%%2.', vals: [0.2, 0.05], effects: [{ k: 'spell', match: { names: ['Flame Wave'] }, field: 'radius', op: 'add', per: 0.2 }, { k: 'spell', match: { names: ['Flame Wave'] }, field: 'power', op: 'mul', per: 0.05 }] },
          { id: 'wiz_pyro_4', tier: 4, name: 'Meteorfall', maxRank: 2, desc: 'Meteorfall cooldown -%1s and +%%2 damage.', vals: [1, 0.06], effects: [{ k: 'spell', match: { names: ['Meteorfall'] }, field: 'cooldown', op: 'add', per: -1 }, { k: 'spell', match: { names: ['Meteorfall'] }, field: 'power', op: 'mul', per: 0.06 }] },
          { id: 'wiz_pyro_5', tier: 5, name: 'Conflagration', maxRank: 1, capstone: true, desc: 'On a fire crit, 25% chance to explode every nearby enemy for 250% of your attack.', vals: [], effects: [cap('wiz_conflag', 'Conflagration', 'onCrit', { chance: 0.25, icd: 10, color: '#e0603a', log: 'Conflagration!' }, [{ type: 'damageAoe', pctOfAttack: 2.5, radius: 6, damageType: 'fire' }])] }
        ] },
      { id: 'wizard_frostbinder', name: 'Frostbinder', role: 'Ice control damage', summary: 'Freeze them, then shatter.', color: '#4aa0e0',
        empowers: ['Frost Lance', 'Ice Prison', 'Shatter', 'Frost Nova', 'Blink', 'Time Slip'],
        nodes: [
          { id: 'wiz_frost_1a', tier: 1, name: 'Cold Focus', maxRank: 3, desc: 'Increases Intelligence by %1 and Defense by %2.', vals: [3, 2], effects: [{ k: 'stat', stat: 'intelligence', per: 3 }, { k: 'stat', stat: 'defense', per: 2 }] },
          { id: 'wiz_frost_1b', tier: 1, name: 'Deep Chill', maxRank: 3, desc: 'Frost damage +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.05, when: { damageType: 'frost' } }] },
          { id: 'wiz_frost_2a', tier: 2, name: 'Frost Lance', maxRank: 3, desc: 'Frost Lance +%%1 damage and slows %%2 harder.', vals: [0.06, 0.1], effects: [{ k: 'spell', match: { names: ['Frost Lance'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Frost Lance'] }, field: 'slowPct', op: 'mul', per: 0.1 }] },
          { id: 'wiz_frost_2b', tier: 2, name: 'Ice Prison', maxRank: 3, desc: 'Ice Prison lasts %1s longer and costs %%2 less.', vals: [0.5, 0.05], effects: [{ k: 'spell', match: { names: ['Ice Prison'] }, field: 'duration', op: 'add', per: 0.5 }, { k: 'spell', match: { names: ['Ice Prison'] }, field: 'cost', op: 'mul', per: -0.05 }] },
          { id: 'wiz_frost_3', tier: 3, name: 'Shatter', maxRank: 3, desc: 'Shatter deals %%1 more damage.', vals: [0.08], effects: [{ k: 'spell', match: { names: ['Shatter'] }, field: 'power', op: 'mul', per: 0.08 }] },
          { id: 'wiz_frost_4', tier: 4, name: 'Blizzard Veil', maxRank: 2, desc: 'You take %%1 less damage.', vals: [0.04], effects: [{ k: 'mod', mod: 'damageTaken', op: 'mul', per: -0.04 }] },
          { id: 'wiz_frost_5', tier: 5, name: 'Absolute Zero', maxRank: 1, capstone: true, desc: 'On cast, freeze all nearby enemies solid and blast them for 250% of your attack as frost.', vals: [], effects: [cap('wiz_abs_zero', 'Absolute Zero', 'onCast', { chance: 1, icd: 40, color: '#4aa0e0', log: 'Absolute Zero.' }, [{ type: 'damageAoe', pctOfAttack: 2.5, radius: 6, damageType: 'frost' }, { type: 'applyStatusAoe', radius: 6, status: { id: 'wiz_frozen', name: 'Frozen', type: 'debuff', duration: 4, rootDuration: 4, moveSpeedMultiplier: 0, hostile: true, tags: ['freeze', 'root', 'talent'] } }])] }
        ] },
      { id: 'wizard_arcanist', name: 'Arcanist', role: 'Pure arcane burst', summary: 'Raw arcane power, efficiently spent.', color: '#a05ae0',
        empowers: ['Arcane Bolt', 'Arcane Barrage', 'Mana Spear', 'Overchannel', 'Arcane Mirror', 'Mana Shield', 'Arcane Intellect', 'Prismatic Surge'],
        nodes: [
          { id: 'wiz_arc_1a', tier: 1, name: 'Arcane Study', maxRank: 3, desc: 'Increases Mana by %1 and Spell Power by %2.', vals: [18, 6], effects: [{ k: 'stat', stat: 'mana', per: 18 }, { k: 'stat', stat: 'spellPower', per: 6 }] },
          { id: 'wiz_arc_1b', tier: 1, name: 'Mana Efficiency', maxRank: 3, desc: 'Your spells cost %%1 less mana.', vals: [0.03], effects: [{ k: 'spell', match: { all: true }, field: 'cost', op: 'mul', per: -0.03 }] },
          { id: 'wiz_arc_2a', tier: 2, name: 'Arcane Barrage', maxRank: 3, desc: 'Arcane Barrage deals %%1 more damage.', vals: [0.06], effects: [{ k: 'spell', match: { names: ['Arcane Barrage'] }, field: 'power', op: 'mul', per: 0.06 }] },
          { id: 'wiz_arc_2b', tier: 2, name: 'Mana Spear', maxRank: 3, desc: 'Mana Spear +%%1 damage; cooldown -%2s.', vals: [0.06, 0.3], effects: [{ k: 'spell', match: { names: ['Mana Spear'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Mana Spear'] }, field: 'cooldown', op: 'add', per: -0.3 }] },
          { id: 'wiz_arc_3', tier: 3, name: 'Overchannel', maxRank: 3, desc: 'Overchannel lasts %1s longer; arcane damage +%%2.', vals: [1, 0.03], effects: [{ k: 'spell', match: { names: ['Overchannel'] }, field: 'duration', op: 'add', per: 1 }, { k: 'mod', mod: 'damageDone', op: 'mul', per: 0.03, when: { damageType: 'arcane' } }] },
          { id: 'wiz_arc_4', tier: 4, name: 'Arcane Mind', maxRank: 2, desc: 'Increases Magic Crit Chance by %1.', vals: [3], effects: [{ k: 'stat', stat: 'magicCritChance', per: 3 }] },
          { id: 'wiz_arc_5', tier: 5, name: 'Arcane Surge', maxRank: 1, capstone: true, desc: 'On a magic crit, 20% chance to gain +30% damage for 8s.', vals: [], effects: [cap('wiz_arc_surge', 'Arcane Surge', 'onCrit', { chance: 0.2, icd: 15, color: '#a05ae0', log: 'Arcane Surge!' }, [{ type: 'dynamicMod', mod: 'damageDone', op: 'mul', value: 1.3, duration: 8 }])] }
        ] }
    ]
  };

  DR.TALENT_TREES.Shaman = {
    className: 'Shaman', role: 'Magic Ranged DPS',
    specs: [
      { id: 'shaman_stormcaller', name: 'Stormcaller', role: 'Lightning and wind', summary: 'Call the storm down.', color: '#4ad0e0',
        empowers: ['Lightning Spark', 'Lightning Spear', 'Chain Storm', 'Thunderclap', 'Skybreak', 'Stormcall', 'Totem of Sparks', 'Tempest Avatar'],
        nodes: [
          { id: 'shm_storm_1a', tier: 1, name: 'Static Charge', maxRank: 3, desc: 'Increases Intelligence by %1 and Spell Power by %2.', vals: [3, 5], effects: [{ k: 'stat', stat: 'intelligence', per: 3 }, { k: 'stat', stat: 'spellPower', per: 5 }] },
          { id: 'shm_storm_1b', tier: 1, name: 'Conductivity', maxRank: 3, desc: 'Lightning damage +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.05, when: { damageType: 'lightning' } }] },
          { id: 'shm_storm_2a', tier: 2, name: 'Chain Storm', maxRank: 3, desc: 'Chain Storm +%%1 damage and radius +%2.', vals: [0.06, 0.2], effects: [{ k: 'spell', match: { names: ['Chain Storm'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Chain Storm'] }, field: 'radius', op: 'add', per: 0.2 }] },
          { id: 'shm_storm_2b', tier: 2, name: 'Lightning Spear', maxRank: 3, desc: 'Lightning Spear +%%1 damage; cast %%2 faster.', vals: [0.06, 0.04], effects: [{ k: 'spell', match: { names: ['Lightning Spear'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Lightning Spear'] }, field: 'castTime', op: 'mul', per: -0.04 }] },
          { id: 'shm_storm_3', tier: 3, name: 'Thunderclap', maxRank: 3, desc: 'Thunderclap radius +%1 and damage +%%2.', vals: [0.2, 0.05], effects: [{ k: 'spell', match: { names: ['Thunderclap'] }, field: 'radius', op: 'add', per: 0.2 }, { k: 'spell', match: { names: ['Thunderclap'] }, field: 'power', op: 'mul', per: 0.05 }] },
          { id: 'shm_storm_4', tier: 4, name: 'Skybreak', maxRank: 2, desc: 'Increases Magic Crit Chance by %1; Skybreak cooldown -%2s.', vals: [3, 0.5], effects: [{ k: 'stat', stat: 'magicCritChance', per: 3 }, { k: 'spell', match: { names: ['Skybreak'] }, field: 'cooldown', op: 'add', per: -0.5 }] },
          { id: 'shm_storm_5', tier: 5, name: 'The Storm Answers', maxRank: 1, capstone: true, desc: 'On a lightning crit, 30% chance to call 5 lightning strikes on nearby enemies.', vals: [], effects: [cap('shm_storm_answers', 'The Storm Answers', 'onCrit', { chance: 0.3, icd: 12, color: '#4ad0e0', log: 'The storm answers!' }, [{ type: 'chainStrike', count: 5, pctOfAttack: 1.5, radius: 8, damageType: 'lightning' }])] }
        ] },
      { id: 'shaman_earthspeaker', name: 'Earthspeaker', role: 'Earth damage and stagger', summary: 'The mountain fights beside you.', color: '#9a7a4a',
        empowers: ['Stone Shard', 'Earth Spike', 'Quaking Ground', 'Stone Fist', 'Mountain’s Wrath', 'Earthbind'],
        nodes: [
          { id: 'shm_earth_1a', tier: 1, name: 'Stone Sense', maxRank: 3, desc: 'Increases Intelligence by %1 and Defense by %2.', vals: [3, 3], effects: [{ k: 'stat', stat: 'intelligence', per: 3 }, { k: 'stat', stat: 'defense', per: 3 }] },
          { id: 'shm_earth_1b', tier: 1, name: 'Grinding Force', maxRank: 3, desc: 'Earth damage +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.05, when: { damageType: 'earth' } }] },
          { id: 'shm_earth_2a', tier: 2, name: 'Earth Spike', maxRank: 3, desc: 'Earth Spike +%%1 damage and lasts %2s longer.', vals: [0.06, 1], effects: [{ k: 'spell', match: { names: ['Earth Spike'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Earth Spike'] }, field: 'duration', op: 'add', per: 1 }] },
          { id: 'shm_earth_2b', tier: 2, name: 'Quaking Ground', maxRank: 3, desc: 'Quaking Ground radius +%1 and damage +%%2.', vals: [0.2, 0.05], effects: [{ k: 'spell', match: { names: ['Quaking Ground'] }, field: 'radius', op: 'add', per: 0.2 }, { k: 'spell', match: { names: ['Quaking Ground'] }, field: 'tickDamage', op: 'mul', per: 0.05 }] },
          { id: 'shm_earth_3', tier: 3, name: 'Stone Fist', maxRank: 3, desc: 'Stone Fist +%%1 damage; cooldown -%2s.', vals: [0.06, 0.3], effects: [{ k: 'spell', match: { names: ['Stone Fist'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Stone Fist'] }, field: 'cooldown', op: 'add', per: -0.3 }] },
          { id: 'shm_earth_4', tier: 4, name: 'Mountain\'s Wrath', maxRank: 2, desc: 'Earth damage +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.05, when: { damageType: 'earth' } }] },
          { id: 'shm_earth_5', tier: 5, name: 'The Mountain Moves', maxRank: 1, capstone: true, desc: 'On cast, rupture the earth: 200% of your attack and stagger all nearby enemies.', vals: [], effects: [cap('shm_mountain_moves', 'The Mountain Moves', 'onCast', { chance: 1, icd: 30, color: '#9a7a4a', log: 'The mountain moves.' }, [{ type: 'damageAoe', pctOfAttack: 2.0, radius: 5, damageType: 'earth' }, { type: 'applyStatusAoe', radius: 5, status: { id: 'shm_stagger', name: 'Staggered', type: 'debuff', duration: 4, moveSpeedMultiplier: 0.6, hostile: true, tags: ['stagger', 'talent'] } }])] }
        ] },
      { id: 'shaman_spiritflame', name: 'Spiritflame', role: 'Spirit fire and ancestral damage', summary: 'The ancestors burn your foes.', color: '#c05ad0',
        empowers: ['Spirit Flame', 'Ghostfire', 'Ancestor’s Brand', 'Ritual Inferno', 'Spirit Walk', 'Ancestral Cataclysm'],
        nodes: [
          { id: 'shm_spirit_1a', tier: 1, name: 'Ancestral Focus', maxRank: 3, desc: 'Increases Mana by %1 and Spell Power by %2.', vals: [18, 5], effects: [{ k: 'stat', stat: 'mana', per: 18 }, { k: 'stat', stat: 'spellPower', per: 5 }] },
          { id: 'shm_spirit_1b', tier: 1, name: 'Lingering Flame', maxRank: 3, desc: 'Damage-over-time effects +%%1.', vals: [0.06], effects: [{ k: 'mod', mod: 'dotDamage', op: 'mul', per: 0.06 }] },
          { id: 'shm_spirit_2a', tier: 2, name: 'Spirit Flame', maxRank: 3, desc: 'Spirit Flame ticks %%1 harder and lasts %2s longer.', vals: [0.06, 1], effects: [{ k: 'spell', match: { names: ['Spirit Flame'] }, field: 'tickDamage', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Spirit Flame'] }, field: 'tickDuration', op: 'add', per: 1 }] },
          { id: 'shm_spirit_2b', tier: 2, name: 'Ancestor\'s Brand', maxRank: 3, desc: 'Ancestor\'s Brand lasts %1s longer.', vals: [1], effects: [{ k: 'spell', match: { names: ['Ancestor’s Brand'] }, field: 'duration', op: 'add', per: 1 }] },
          { id: 'shm_spirit_3', tier: 3, name: 'Ghostfire', maxRank: 3, desc: 'Ghostfire ticks %%1 harder and deals %%2 more.', vals: [0.06, 0.05], effects: [{ k: 'spell', match: { names: ['Ghostfire'] }, field: 'tickDamage', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Ghostfire'] }, field: 'power', op: 'mul', per: 0.05 }] },
          { id: 'shm_spirit_4', tier: 4, name: 'Ritual Inferno', maxRank: 2, desc: 'Ritual Inferno cooldown -%1s and ticks %%2 harder.', vals: [1, 0.06], effects: [{ k: 'spell', match: { names: ['Ritual Inferno'] }, field: 'cooldown', op: 'add', per: -1 }, { k: 'spell', match: { names: ['Ritual Inferno'] }, field: 'tickDamage', op: 'mul', per: 0.06 }] },
          { id: 'shm_spirit_5', tier: 5, name: 'Ancestral Wrath', maxRank: 1, capstone: true, desc: 'On kill, refresh all your damage-over-time effects on nearby enemies and boost DoT damage +50% for 8s.', vals: [], effects: [cap('shm_ancestral_wrath', 'Ancestral Wrath', 'onKill', { chance: 1, icd: 25, color: '#c05ad0', log: 'The ancestors answer.' }, [{ type: 'refreshDots', radius: 8 }, { type: 'dynamicMod', mod: 'dotDamage', op: 'mul', value: 1.5, duration: 8 }])] }
        ] }
    ]
  };

  DR.TALENT_TREES.Summoner = {
    className: 'Summoner', role: 'Pet / DPS',
    specs: [
      { id: 'summoner_beastcaller', name: 'Beastcaller', role: 'One strong companion', summary: 'You and your bonded beast, unbreakable.', color: '#8a6a3a',
        empowers: ['Summon Familiar', 'Empower Beast', 'Mend Companion', 'Protective Bond', 'Soul Link', 'Familiar Rush'],
        nodes: [
          { id: 'sum_beast_1a', tier: 1, name: 'Bond of Blood', maxRank: 3, desc: 'Your companion\'s damage +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'petDamage', op: 'mul', per: 0.05 }] },
          { id: 'sum_beast_1b', tier: 1, name: 'Handler', maxRank: 3, desc: 'Increases Intelligence by %1 and Mana by %2.', vals: [3, 12], effects: [{ k: 'stat', stat: 'intelligence', per: 3 }, { k: 'stat', stat: 'mana', per: 12 }] },
          { id: 'sum_beast_2a', tier: 2, name: 'Empower Beast', maxRank: 3, desc: 'Empower Beast lasts %1s longer and gains +%2 charge.', vals: [2, 1], effects: [{ k: 'spell', match: { names: ['Empower Beast'] }, field: 'duration', op: 'add', per: 2 }, { k: 'spell', match: { names: ['Empower Beast'] }, field: 'charges', op: 'add', per: 1 }] },
          { id: 'sum_beast_2b', tier: 2, name: 'Mend Companion', maxRank: 3, desc: 'Mend Companion cooldown -%1s.', vals: [0.4], effects: [{ k: 'spell', match: { names: ['Mend Companion'] }, field: 'cooldown', op: 'add', per: -0.4 }] },
          { id: 'sum_beast_3', tier: 3, name: 'Loyal Guardian', maxRank: 3, desc: 'Your companion\'s damage +%%1.', vals: [0.04], effects: [{ k: 'mod', mod: 'petDamage', op: 'mul', per: 0.04 }] },
          { id: 'sum_beast_4', tier: 4, name: 'Soul Link', maxRank: 2, desc: 'Your companion\'s damage +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'petDamage', op: 'mul', per: 0.05 }] },
          { id: 'sum_beast_5', tier: 5, name: 'The Bond Unbroken', maxRank: 1, capstone: true, desc: 'When you take heavy damage, heal 8% max HP and your companion gains +50% damage for 12s.', vals: [], effects: [cap('sum_bond_unbroken', 'The Bond Unbroken', 'onDamageTaken', { chance: 0.15, icd: 180, color: '#8a6a3a', log: 'The bond holds.' }, [{ type: 'healPct', pct: 0.08 }, { type: 'dynamicMod', mod: 'petDamage', op: 'mul', value: 1.5, duration: 12 }])] }
        ] },
      { id: 'summoner_planebinder', name: 'Planebinder', role: 'Elemental / planar summons', summary: 'Bind the planes to your will.', color: '#8a5ad0',
        empowers: ['Summon Elemental Servitor', 'Planar Bolt', 'Planar Gate', 'Bind Essence', 'Elemental Rotation', 'Planar Surge', 'Legion Gate'],
        nodes: [
          { id: 'sum_plane_1a', tier: 1, name: 'Planar Study', maxRank: 3, desc: 'Increases Intelligence by %1 and Spell Power by %2.', vals: [3, 6], effects: [{ k: 'stat', stat: 'intelligence', per: 3 }, { k: 'stat', stat: 'spellPower', per: 6 }] },
          { id: 'sum_plane_1b', tier: 1, name: 'Elemental Attunement', maxRank: 3, desc: 'Planar damage +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.05, when: { damageType: 'planar' } }] },
          { id: 'sum_plane_2a', tier: 2, name: 'Elemental Servitor', maxRank: 3, desc: 'Summon Elemental Servitor cooldown -%1s; servitor damage +%%2.', vals: [0.5, 0.05], effects: [{ k: 'spell', match: { names: ['Summon Elemental Servitor'] }, field: 'cooldown', op: 'add', per: -0.5 }, { k: 'mod', mod: 'petDamage', op: 'mul', per: 0.05 }] },
          { id: 'sum_plane_2b', tier: 2, name: 'Planar Bolt', maxRank: 3, desc: 'Planar Bolt +%%1 damage; cast %%2 faster.', vals: [0.06, 0.03], effects: [{ k: 'spell', match: { names: ['Planar Bolt'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Planar Bolt'] }, field: 'castTime', op: 'mul', per: -0.03 }] },
          { id: 'sum_plane_3', tier: 3, name: 'Elemental Rotation', maxRank: 3, desc: 'Elemental Rotation cooldown -%1s; your damage +%%2.', vals: [0.4, 0.03], effects: [{ k: 'spell', match: { names: ['Elemental Rotation'] }, field: 'cooldown', op: 'add', per: -0.4 }, { k: 'mod', mod: 'damageDone', op: 'mul', per: 0.03 }] },
          { id: 'sum_plane_4', tier: 4, name: 'Planar Surge', maxRank: 2, desc: 'Planar Surge cooldown -%1s.', vals: [1], effects: [{ k: 'spell', match: { names: ['Planar Surge'] }, field: 'cooldown', op: 'add', per: -1 }] },
          { id: 'sum_plane_5', tier: 5, name: 'The Gate Opens', maxRank: 1, capstone: true, desc: 'On cast, summon 4 elemental servitors for 15s, boost your summons +50% damage, and blast your target for 200% of your attack.', vals: [], effects: [cap('sum_gate_opens', 'The Gate Opens', 'onCast', { chance: 1, icd: 60, color: '#8a5ad0', log: 'The gate opens.' }, [{ type: 'summonMinions', count: 4, petType: 'elemental_servitor', color: '#8a5ad0', duration: 15, attackMin: 12, attackMax: 20 }, { type: 'dynamicMod', mod: 'petDamage', op: 'mul', value: 1.5, duration: 15 }, { type: 'damageTarget', pctOfAttack: 2.0, damageType: 'planar' }])] }
        ] },
      { id: 'summoner_swarmweaver', name: 'Swarmweaver', role: 'Many weak summons', summary: 'Death by a thousand minions.', color: '#6a8a5a',
        empowers: ['Call Swarm', 'Familiar Rush', 'Overrun', 'Mass Dismissal', 'Twin Summon', 'Grand Binding'],
        nodes: [
          { id: 'sum_swarm_1a', tier: 1, name: 'Swarm Instinct', maxRank: 3, desc: 'Increases Intelligence by %1 and Spell Power by %2.', vals: [3, 4], effects: [{ k: 'stat', stat: 'intelligence', per: 3 }, { k: 'stat', stat: 'spellPower', per: 4 }] },
          { id: 'sum_swarm_1b', tier: 1, name: 'Numbers', maxRank: 3, desc: 'Your summons\' damage +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'petDamage', op: 'mul', per: 0.05 }] },
          { id: 'sum_swarm_2a', tier: 2, name: 'Call Swarm', maxRank: 3, desc: 'Call Swarm summons faster (cooldown -%1s).', vals: [0.5], effects: [{ k: 'spell', match: { names: ['Call Swarm'] }, field: 'cooldown', op: 'add', per: -0.5 }] },
          { id: 'sum_swarm_2b', tier: 2, name: 'Familiar Rush', maxRank: 3, desc: 'Familiar Rush +%%1 damage; cooldown -%2s.', vals: [0.06, 0.3], effects: [{ k: 'spell', match: { names: ['Familiar Rush'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Familiar Rush'] }, field: 'cooldown', op: 'add', per: -0.3 }] },
          { id: 'sum_swarm_3', tier: 3, name: 'Overrun', maxRank: 3, desc: 'Overrun +%%1 damage and gains +%2 charge.', vals: [0.06, 1], effects: [{ k: 'spell', match: { names: ['Overrun'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Overrun'] }, field: 'charges', op: 'add', per: 1 }] },
          { id: 'sum_swarm_4', tier: 4, name: 'Twin Summon', maxRank: 2, desc: 'Your summons\' damage +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'petDamage', op: 'mul', per: 0.05 }] },
          { id: 'sum_swarm_5', tier: 5, name: 'Mass Dismissal', maxRank: 1, capstone: true, desc: 'On cast, detonate the swarm for 250% of your attack to all nearby enemies.', vals: [], effects: [cap('sum_mass_dismissal', 'Mass Dismissal', 'onCast', { chance: 1, icd: 45, color: '#6a8a5a', log: 'Mass Dismissal!' }, [{ type: 'damageAoe', pctOfAttack: 2.5, radius: 3, damageType: 'planar' }])] }
        ] }
    ]
  };

  DR.TALENT_TREES.Necromancer = {
    className: 'Necromancer', role: 'Pet / DPS',
    specs: [
      { id: 'necromancer_bonecaller', name: 'Bonecaller', role: 'Undead minions', summary: 'An army that never tires.', color: '#8a8a6a',
        empowers: ['Raise Skeleton', 'Summon Bone Servant', 'Command Undead', 'Army of Bones', 'Bone Armor', 'Grave Sovereign'],
        nodes: [
          { id: 'nec_bone_1a', tier: 1, name: 'Grave Bond', maxRank: 3, desc: 'Undead minions\' damage +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'petDamage', op: 'mul', per: 0.05 }] },
          { id: 'nec_bone_1b', tier: 1, name: 'Bone Craft', maxRank: 3, desc: 'Increases Intelligence by %1 and Mana by %2.', vals: [3, 10], effects: [{ k: 'stat', stat: 'intelligence', per: 3 }, { k: 'stat', stat: 'mana', per: 10 }] },
          { id: 'nec_bone_2a', tier: 2, name: 'Raise Skeleton', maxRank: 3, desc: 'Raise Skeleton costs %%1 less and cooldown -%2s.', vals: [0.05, 0.4], effects: [{ k: 'spell', match: { names: ['Raise Skeleton'] }, field: 'cost', op: 'mul', per: -0.05 }, { k: 'spell', match: { names: ['Raise Skeleton'] }, field: 'cooldown', op: 'add', per: -0.4 }] },
          { id: 'nec_bone_2b', tier: 2, name: 'Command Undead', maxRank: 3, desc: 'Command Undead cooldown -%1s; minion damage +%%2.', vals: [0.4, 0.03], effects: [{ k: 'spell', match: { names: ['Command Undead'] }, field: 'cooldown', op: 'add', per: -0.4 }, { k: 'mod', mod: 'petDamage', op: 'mul', per: 0.03 }] },
          { id: 'nec_bone_3', tier: 3, name: 'Army of Bones', maxRank: 3, desc: 'Army of Bones cooldown -%1s; minion damage +%%2.', vals: [0.5, 0.04], effects: [{ k: 'spell', match: { names: ['Army of Bones'] }, field: 'cooldown', op: 'add', per: -0.5 }, { k: 'mod', mod: 'petDamage', op: 'mul', per: 0.04 }] },
          { id: 'nec_bone_4', tier: 4, name: 'Bone Armor', maxRank: 2, desc: 'Bone Armor reduces physical damage %%1 more and lasts %2s longer.', vals: [0.03, 2], effects: [{ k: 'spell', match: { names: ['Bone Armor'] }, field: 'physicalDamageTakenMultiplier', op: 'mul', per: -0.03 }, { k: 'spell', match: { names: ['Bone Armor'] }, field: 'duration', op: 'add', per: 2 }] },
          { id: 'nec_bone_5', tier: 5, name: 'Grave Sovereign', maxRank: 1, capstone: true, desc: 'On kill, 25% chance to raise a skeleton from the corpse for 20s and boost your minions +50% damage for 12s.', vals: [], effects: [cap('nec_grave_sovereign', 'Grave Sovereign', 'onKill', { chance: 0.25, icd: 15, color: '#8a8a6a', log: 'The corpse rises.' }, [{ type: 'summonMinions', count: 1, petType: 'skeleton', color: '#8a8a6a', duration: 20, attackMin: 14, attackMax: 22 }, { type: 'dynamicMod', mod: 'petDamage', op: 'mul', value: 1.5, duration: 12 }])] }
        ] },
      { id: 'necromancer_plaguebinder', name: 'Plaguebinder', role: 'Disease and DoT', summary: 'Rot spreads from corpse to corpse.', color: '#7a8a4a',
        empowers: ['Grave Rot', 'Plague Mark', 'Rot Cloud', 'Withering Curse', 'Bone Storm'],
        nodes: [
          { id: 'nec_plague_1a', tier: 1, name: 'Virulence', maxRank: 3, desc: 'Increases Intelligence by %1 and Spell Power by %2.', vals: [3, 6], effects: [{ k: 'stat', stat: 'intelligence', per: 3 }, { k: 'stat', stat: 'spellPower', per: 6 }] },
          { id: 'nec_plague_1b', tier: 1, name: 'Pestilence', maxRank: 3, desc: 'Damage-over-time effects +%%1.', vals: [0.06], effects: [{ k: 'mod', mod: 'dotDamage', op: 'mul', per: 0.06 }] },
          { id: 'nec_plague_2a', tier: 2, name: 'Grave Rot', maxRank: 3, desc: 'Grave Rot ticks %%1 harder and lasts %2s longer.', vals: [0.06, 1], effects: [{ k: 'spell', match: { names: ['Grave Rot'] }, field: 'tickDamage', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Grave Rot'] }, field: 'duration', op: 'add', per: 1 }] },
          { id: 'nec_plague_2b', tier: 2, name: 'Plague Mark', maxRank: 3, desc: 'Plague Mark lasts %1s longer.', vals: [1], effects: [{ k: 'spell', match: { names: ['Plague Mark'] }, field: 'duration', op: 'add', per: 1 }] },
          { id: 'nec_plague_3', tier: 3, name: 'Rot Cloud', maxRank: 3, desc: 'Rot Cloud radius +%1 and ticks %%2 harder.', vals: [0.2, 0.05], effects: [{ k: 'spell', match: { names: ['Rot Cloud'] }, field: 'radius', op: 'add', per: 0.2 }, { k: 'spell', match: { names: ['Rot Cloud'] }, field: 'tickDamage', op: 'mul', per: 0.05 }] },
          { id: 'nec_plague_4', tier: 4, name: 'Withering Curse', maxRank: 2, desc: 'Withering Curse ticks %%1 harder; your DoTs +%%2.', vals: [0.06, 0.05], effects: [{ k: 'spell', match: { names: ['Withering Curse'] }, field: 'tickDamage', op: 'mul', per: 0.06 }, { k: 'mod', mod: 'dotDamage', op: 'mul', per: 0.05 }] },
          { id: 'nec_plague_5', tier: 5, name: 'The Plague Spreads', maxRank: 1, capstone: true, desc: 'On kill, spread every DoT on the corpse to nearby enemies and boost your DoT damage +50% for 8s.', vals: [], effects: [cap('nec_plague_spreads', 'The Plague Spreads', 'onKill', { chance: 1, icd: 12, color: '#7a8a4a', log: 'The plague spreads.' }, [{ type: 'detonateDots', pctOfRemaining: 0.5, spread: true, radius: 6, damageType: 'disease' }, { type: 'dynamicMod', mod: 'dotDamage', op: 'mul', value: 1.5, duration: 8 }])] }
        ] },
      { id: 'necromancer_soulreaper', name: 'Soulreaper', role: 'Drain and execute', summary: 'Consume the living to fuel the dead.', color: '#8a4a6a',
        empowers: ['Life Tap', 'Soul Harvest', 'Soul Leech', 'Death Pact', 'Lich Veil', 'Bone Splinter', 'Fear the Living'],
        nodes: [
          { id: 'nec_soul_1a', tier: 1, name: 'Dark Sustain', maxRank: 3, desc: 'Increases Intelligence by %1 and HP Regen by %2.', vals: [3, 2], effects: [{ k: 'stat', stat: 'intelligence', per: 3 }, { k: 'stat', stat: 'hpRegen', per: 2 }] },
          { id: 'nec_soul_1b', tier: 1, name: 'Blood Price', maxRank: 3, desc: 'Your drain healing +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'healingDone', op: 'mul', per: 0.05 }] },
          { id: 'nec_soul_2a', tier: 2, name: 'Life Tap', maxRank: 3, desc: 'Life Tap +%%1 damage and cooldown -%2s.', vals: [0.06, 0.3], effects: [{ k: 'spell', match: { names: ['Life Tap'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Life Tap'] }, field: 'cooldown', op: 'add', per: -0.3 }] },
          { id: 'nec_soul_2b', tier: 2, name: 'Soul Harvest', maxRank: 3, desc: 'Soul Harvest +%%1 damage and lasts %2s longer.', vals: [0.06, 1], effects: [{ k: 'spell', match: { names: ['Soul Harvest'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Soul Harvest'] }, field: 'duration', op: 'add', per: 1 }] },
          { id: 'nec_soul_3', tier: 3, name: 'Soul Leech', maxRank: 3, desc: 'Soul Leech +%%1 damage and ticks %%2 harder.', vals: [0.06, 0.05], effects: [{ k: 'spell', match: { names: ['Soul Leech'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Soul Leech'] }, field: 'tickDamage', op: 'mul', per: 0.05 }] },
          { id: 'nec_soul_4', tier: 4, name: 'Reaper\'s Mark', maxRank: 2, desc: 'Damage to targets below 30% HP +%%1.', vals: [0.10], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.10, when: { targetHpBelow: 0.30 } }] },
          { id: 'nec_soul_5', tier: 5, name: 'Soul Harvest', maxRank: 1, capstone: true, desc: 'On kill, heal 10% max HP, restore 8% mana, and gain +12% spell damage for 10s.', vals: [], effects: [cap('nec_soul_harvest', 'Soul Harvest', 'onKill', { chance: 1, icd: 10, color: '#8a4a6a', log: 'Soul consumed.' }, [{ type: 'healPct', pct: 0.10 }, { type: 'manaPct', pct: 0.08 }, { type: 'dynamicMod', mod: 'damageDone', op: 'mul', value: 1.12, duration: 10 }])] }
        ] }
    ]
  };

  DR.TALENT_TREES.Cleric = {
    className: 'Cleric', role: 'Healer',
    specs: [
      { id: 'cleric_radiant', name: 'Radiant Healer', role: 'Direct healing', summary: 'Big heals, right when they are needed.', color: '#ffe08a',
        empowers: ['Minor Heal', 'Greater Heal', 'Radiant Touch', 'Divine Light', 'Divine Intervention', 'Radiant Revival', 'Avatar of Mercy'],
        nodes: [
          { id: 'cle_rad_1a', tier: 1, name: 'Devotion', maxRank: 3, desc: 'Increases Wisdom by %1 and Healing Power by %2.', vals: [3, 8], effects: [{ k: 'stat', stat: 'wisdom', per: 3 }, { k: 'stat', stat: 'healingPower', per: 8 }] },
          { id: 'cle_rad_1b', tier: 1, name: 'Efficient Prayer', maxRank: 3, desc: 'Healing spells cost %%1 less mana.', vals: [0.04], effects: [{ k: 'spell', match: { kinds: ['heal', 'aoeHeal'] }, field: 'cost', op: 'mul', per: -0.04 }] },
          { id: 'cle_rad_2a', tier: 2, name: 'Greater Heal', maxRank: 3, desc: 'Greater Heal heals %%1 more.', vals: [0.06], effects: [{ k: 'spell', match: { names: ['Greater Heal'] }, field: 'heal', op: 'mul', per: 0.06 }] },
          { id: 'cle_rad_2b', tier: 2, name: 'Radiant Touch', maxRank: 3, desc: 'Radiant Touch cooldown -%1s and heals %%2 more.', vals: [0.4, 0.06], effects: [{ k: 'spell', match: { names: ['Radiant Touch'] }, field: 'cooldown', op: 'add', per: -0.4 }, { k: 'spell', match: { names: ['Radiant Touch'] }, field: 'heal', op: 'mul', per: 0.06 }] },
          { id: 'cle_rad_3', tier: 3, name: 'Emergency Save', maxRank: 3, desc: 'Healing to targets below 35% HP +%%1.', vals: [0.06], effects: [{ k: 'mod', mod: 'healingDone', op: 'mul', per: 0.06, when: { targetHpBelow: 0.35 } }] },
          { id: 'cle_rad_4', tier: 4, name: 'Divine Intervention', maxRank: 2, desc: 'Divine Intervention cooldown -%1s and grants %%2 more damage reduction.', vals: [2, 0.03], effects: [{ k: 'spell', match: { names: ['Divine Intervention'] }, field: 'cooldown', op: 'add', per: -2 }, { k: 'spell', match: { names: ['Divine Intervention'] }, field: 'damageTakenMultiplier', op: 'mul', per: -0.03 }] },
          { id: 'cle_rad_5', tier: 5, name: 'Miracle', maxRank: 1, capstone: true, desc: 'After a heal, your healing is increased by 50% for 6s.', vals: [], effects: [cap('cle_miracle', 'Miracle', 'onHealCast', { chance: 1, icd: 120, color: '#ffe08a', log: 'A miracle!' }, [{ type: 'dynamicMod', mod: 'healingDone', op: 'mul', value: 1.5, duration: 6 }])] }
        ] },
      { id: 'cleric_sanctifier', name: 'Sanctifier', role: 'Shield and protection', summary: 'The wall the party hides behind.', color: '#f0d070',
        empowers: ['Holy Ward', 'Sanctuary', 'Blessed Barrier', 'Guardian Prayer', 'Prayer of Mending', 'Hymn of Renewal'],
        nodes: [
          { id: 'cle_sanc_1a', tier: 1, name: 'Warding', maxRank: 3, desc: 'Increases Wisdom by %1 and Defense by %2.', vals: [3, 2], effects: [{ k: 'stat', stat: 'wisdom', per: 3 }, { k: 'stat', stat: 'defense', per: 2 }] },
          { id: 'cle_sanc_1b', tier: 1, name: 'Reinforced Wards', maxRank: 3, desc: 'Your absorb shields +%%1.', vals: [0.06], effects: [{ k: 'mod', mod: 'absorbPower', op: 'mul', per: 0.06 }] },
          { id: 'cle_sanc_2a', tier: 2, name: 'Holy Ward', maxRank: 3, desc: 'Holy Ward absorbs %%1 more and lasts %2s longer.', vals: [0.06, 2], effects: [{ k: 'spell', match: { names: ['Holy Ward'] }, field: 'absorbFlat', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Holy Ward'] }, field: 'duration', op: 'add', per: 2 }] },
          { id: 'cle_sanc_2b', tier: 2, name: 'Blessed Barrier', maxRank: 3, desc: 'Blessed Barrier cooldown -%1s and absorbs %%2 more.', vals: [0.5, 0.06], effects: [{ k: 'spell', match: { names: ['Blessed Barrier'] }, field: 'cooldown', op: 'add', per: -0.5 }, { k: 'spell', match: { names: ['Blessed Barrier'] }, field: 'absorbFlat', op: 'mul', per: 0.06 }] },
          { id: 'cle_sanc_3', tier: 3, name: 'Sanctuary', maxRank: 3, desc: 'Sanctuary radius +%1 and reduces damage taken %%2 more.', vals: [0.2, 0.03], effects: [{ k: 'spell', match: { names: ['Sanctuary'] }, field: 'radius', op: 'add', per: 0.2 }, { k: 'spell', match: { names: ['Sanctuary'] }, field: 'damageTakenMultiplier', op: 'mul', per: -0.03 }] },
          { id: 'cle_sanc_4', tier: 4, name: 'Protection Prayer', maxRank: 2, desc: 'Your absorb shields +%%1.', vals: [0.06], effects: [{ k: 'mod', mod: 'absorbPower', op: 'mul', per: 0.06 }] },
          { id: 'cle_sanc_5', tier: 5, name: 'Aegis of the Faith', maxRank: 1, capstone: true, desc: 'When you take heavy damage, heal 15% max HP and gain 30% damage reduction for 10s.', vals: [], effects: [cap('cle_aegis', 'Aegis of the Faith', 'onDamageTaken', { chance: 0.15, icd: 90, color: '#f0d070', log: 'Aegis of the faith!' }, [{ type: 'healPct', pct: 0.15 }, { type: 'status', status: { id: 'cle_aegis', name: 'Aegis of the Faith', type: 'buff', duration: 10, damageTakenMultiplier: 0.7, color: '#f0d070', hostile: false, tags: ['cleric', 'talent', 'capstone'] } }])] }
        ] },
      { id: 'cleric_exorcist', name: 'Exorcist', role: 'Holy damage / anti-undead hybrid', summary: 'Burn the unclean with holy light.', color: '#f0b050',
        empowers: ['Smite', 'Turn Undead', 'Judgment Light', 'Exorcise Evil', 'Purify Soul', 'Cleanse'],
        nodes: [
          { id: 'cle_exo_1a', tier: 1, name: 'Zealous Faith', maxRank: 3, desc: 'Increases Wisdom by %1 and Spell Power by %2.', vals: [3, 5], effects: [{ k: 'stat', stat: 'wisdom', per: 3 }, { k: 'stat', stat: 'spellPower', per: 5 }] },
          { id: 'cle_exo_1b', tier: 1, name: 'Righteous Fury', maxRank: 3, desc: 'Holy damage +%%1.', vals: [0.06], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.06, when: { damageType: 'holy' } }] },
          { id: 'cle_exo_2a', tier: 2, name: 'Smite', maxRank: 3, desc: 'Smite deals %%1 more damage.', vals: [0.06], effects: [{ k: 'spell', match: { names: ['Smite'] }, field: 'power', op: 'mul', per: 0.06 }] },
          { id: 'cle_exo_2b', tier: 2, name: 'Turn Undead', maxRank: 3, desc: 'Turn Undead cooldown -%1s and +%%2 damage.', vals: [0.5, 0.06], effects: [{ k: 'spell', match: { names: ['Turn Undead'] }, field: 'cooldown', op: 'add', per: -0.5 }, { k: 'spell', match: { names: ['Turn Undead'] }, field: 'power', op: 'mul', per: 0.06 }] },
          { id: 'cle_exo_3', tier: 3, name: 'Judgment Light', maxRank: 3, desc: 'Judgment Light deals %%1 more damage.', vals: [0.06], effects: [{ k: 'spell', match: { names: ['Judgment Light'] }, field: 'power', op: 'mul', per: 0.06 }] },
          { id: 'cle_exo_4', tier: 4, name: 'Cleansing Fire', maxRank: 2, desc: 'Holy damage +%%1.', vals: [0.06], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.06, when: { damageType: 'holy' } }] },
          { id: 'cle_exo_5', tier: 5, name: 'Exorcism', maxRank: 1, capstone: true, desc: 'On a holy crit, 25% chance to burst all nearby enemies for 200% of your attack and heal 5% max HP.', vals: [], effects: [cap('cle_exorcism', 'Exorcism', 'onCrit', { chance: 0.25, icd: 12, color: '#f0b050', log: 'Exorcism!' }, [{ type: 'damageAoe', pctOfAttack: 2.0, radius: 5, damageType: 'holy' }, { type: 'healPct', pct: 0.05 }])] }
        ] }
    ]
  };

  DR.TALENT_TREES.Druid = {
    className: 'Druid', role: 'Healer',
    specs: [
      { id: 'druid_lifebloom', name: 'Lifebloom', role: 'Healing over time', summary: 'Roll HoTs and let the garden grow.', color: '#8fe07d',
        empowers: ['Lifebloom', 'Rejuvenating Vine', 'Wild Growth', 'Verdant Renewal', 'Regrowth Surge', 'Ancient Bloom'],
        nodes: [
          { id: 'dru_life_1a', tier: 1, name: 'Verdant Touch', maxRank: 3, desc: 'Increases Wisdom by %1 and Healing Power by %2.', vals: [3, 8], effects: [{ k: 'stat', stat: 'wisdom', per: 3 }, { k: 'stat', stat: 'healingPower', per: 8 }] },
          { id: 'dru_life_1b', tier: 1, name: 'Deep Roots', maxRank: 3, desc: 'Your heal-over-time effects +%%1.', vals: [0.06], effects: [{ k: 'mod', mod: 'healingDone', op: 'mul', per: 0.06, when: { periodic: true } }] },
          { id: 'dru_life_2a', tier: 2, name: 'Lifebloom', maxRank: 3, desc: 'Lifebloom and Rejuvenating Vine last %1s longer.', vals: [2], effects: [{ k: 'spell', match: { names: ['Lifebloom', 'Rejuvenating Vine'] }, field: 'duration', op: 'add', per: 2 }] },
          { id: 'dru_life_2b', tier: 2, name: 'Rejuvenating Vine', maxRank: 3, desc: 'Rejuvenating Vine costs %%1 less and lasts %2s longer.', vals: [0.05, 1], effects: [{ k: 'spell', match: { names: ['Rejuvenating Vine'] }, field: 'cost', op: 'mul', per: -0.05 }, { k: 'spell', match: { names: ['Rejuvenating Vine'] }, field: 'duration', op: 'add', per: 1 }] },
          { id: 'dru_life_3', tier: 3, name: 'Wild Growth', maxRank: 3, desc: 'Wild Growth radius +%1 and lasts %2s longer.', vals: [0.2, 1], effects: [{ k: 'spell', match: { names: ['Wild Growth'] }, field: 'radius', op: 'add', per: 0.2 }, { k: 'spell', match: { names: ['Wild Growth'] }, field: 'duration', op: 'add', per: 1 }] },
          { id: 'dru_life_4', tier: 4, name: 'Verdant Renewal', maxRank: 2, desc: 'Verdant Renewal heals %%1 more; your healing +%%2.', vals: [0.06, 0.04], effects: [{ k: 'spell', match: { names: ['Verdant Renewal'] }, field: 'heal', op: 'mul', per: 0.06 }, { k: 'mod', mod: 'healingDone', op: 'mul', per: 0.04 }] },
          { id: 'dru_life_5', tier: 5, name: 'Eternal Bloom', maxRank: 1, capstone: true, desc: 'After a heal, 15% chance your healing is increased by 40% for 8s.', vals: [], effects: [cap('dru_eternal_bloom', 'Eternal Bloom', 'onHealCast', { chance: 0.15, icd: 20, color: '#8fe07d', log: 'Eternal bloom.' }, [{ type: 'dynamicMod', mod: 'healingDone', op: 'mul', value: 1.4, duration: 8 }])] }
        ] },
      { id: 'druid_mooncaller', name: 'Mooncaller', role: 'Nature/moon hybrid', summary: 'Draw power from sun and moon.', color: '#a0a0f0',
        empowers: ['Moonfire', 'Starfall Roots', 'Crescent Surge', 'Thorn Whip', 'Moonlit Tranquility', 'Heart of the Wild'],
        nodes: [
          { id: 'dru_moon_1a', tier: 1, name: 'Lunar Focus', maxRank: 3, desc: 'Increases Intelligence by %1 and Spell Power by %2.', vals: [3, 6], effects: [{ k: 'stat', stat: 'intelligence', per: 3 }, { k: 'stat', stat: 'spellPower', per: 6 }] },
          { id: 'dru_moon_1b', tier: 1, name: 'Moonlight', maxRank: 3, desc: 'Lunar and nature damage +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.05, when: { damageType: ['lunar', 'nature'] } }] },
          { id: 'dru_moon_2a', tier: 2, name: 'Moonfire', maxRank: 3, desc: 'Moonfire ticks %%1 harder and lasts %2s longer.', vals: [0.06, 1], effects: [{ k: 'spell', match: { names: ['Moonfire'] }, field: 'tickDamage', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Moonfire'] }, field: 'tickDuration', op: 'add', per: 1 }] },
          { id: 'dru_moon_2b', tier: 2, name: 'Crescent Surge', maxRank: 3, desc: 'Crescent Surge cooldown -%1s and +%%2 damage.', vals: [0.4, 0.05], effects: [{ k: 'spell', match: { names: ['Crescent Surge'] }, field: 'cooldown', op: 'add', per: -0.4 }, { k: 'spell', match: { names: ['Crescent Surge'] }, field: 'power', op: 'mul', per: 0.05 }] },
          { id: 'dru_moon_3', tier: 3, name: 'Starfall Roots', maxRank: 3, desc: 'Starfall Roots radius +%1 and damage +%%2.', vals: [0.2, 0.05], effects: [{ k: 'spell', match: { names: ['Starfall Roots'] }, field: 'radius', op: 'add', per: 0.2 }, { k: 'spell', match: { names: ['Starfall Roots'] }, field: 'power', op: 'mul', per: 0.05 }] },
          { id: 'dru_moon_4', tier: 4, name: 'Balance', maxRank: 2, desc: 'Your damage +%%1.', vals: [0.04], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.04 }] },
          { id: 'dru_moon_5', tier: 5, name: 'Full Moon', maxRank: 1, capstone: true, desc: 'On a lunar/nature crit, 25% chance to gain +25% damage for 10s and heal 5% max HP.', vals: [], effects: [cap('dru_full_moon', 'Full Moon', 'onCrit', { chance: 0.25, icd: 15, color: '#a0a0f0', log: 'Full moon!' }, [{ type: 'dynamicMod', mod: 'damageDone', op: 'mul', value: 1.25, duration: 10 }, { type: 'healPct', pct: 0.05 }])] }
        ] },
      { id: 'druid_wildmender', name: 'Wildmender', role: 'Animal spirit and utility', summary: 'Spirits of the wild mend the pack.', color: '#7ad0a0',
        empowers: ['Spirit Stag', 'Soothing Howl', 'Wild Mend', 'Pack Renewal', 'Cleansing Rain', 'Nature\'s Grasp', 'Barkskin Blessing'],
        nodes: [
          { id: 'dru_wild_1a', tier: 1, name: 'Wild Spirit', maxRank: 3, desc: 'Increases Wisdom by %1 and Speed by %2.', vals: [3, 0.02], effects: [{ k: 'stat', stat: 'wisdom', per: 3 }, { k: 'stat', stat: 'speed', per: 0.02 }] },
          { id: 'dru_wild_1b', tier: 1, name: 'Pack Bond', maxRank: 3, desc: 'Your healing +%%1.', vals: [0.05], effects: [{ k: 'mod', mod: 'healingDone', op: 'mul', per: 0.05 }] },
          { id: 'dru_wild_2a', tier: 2, name: 'Spirit Stag', maxRank: 3, desc: 'Spirit Stag lasts %1s longer and gains +%2 charge.', vals: [2, 1], effects: [{ k: 'spell', match: { names: ['Spirit Stag'] }, field: 'duration', op: 'add', per: 2 }, { k: 'spell', match: { names: ['Spirit Stag'] }, field: 'charges', op: 'add', per: 1 }] },
          { id: 'dru_wild_2b', tier: 2, name: 'Soothing Howl', maxRank: 3, desc: 'Soothing Howl radius +%1 and lasts %2s longer.', vals: [0.2, 1], effects: [{ k: 'spell', match: { names: ['Soothing Howl'] }, field: 'radius', op: 'add', per: 0.2 }, { k: 'spell', match: { names: ['Soothing Howl'] }, field: 'duration', op: 'add', per: 1 }] },
          { id: 'dru_wild_3', tier: 3, name: 'Wild Mend', maxRank: 3, desc: 'Wild Mend cooldown -%1s and heals %%2 more.', vals: [0.5, 0.06], effects: [{ k: 'spell', match: { names: ['Wild Mend'] }, field: 'cooldown', op: 'add', per: -0.5 }, { k: 'spell', match: { names: ['Wild Mend'] }, field: 'heal', op: 'mul', per: 0.06 }] },
          { id: 'dru_wild_4', tier: 4, name: 'Pack Renewal', maxRank: 2, desc: 'Pack Renewal lasts %1s longer; your healing +%%2.', vals: [2, 0.04], effects: [{ k: 'spell', match: { names: ['Pack Renewal'] }, field: 'duration', op: 'add', per: 2 }, { k: 'mod', mod: 'healingDone', op: 'mul', per: 0.04 }] },
          { id: 'dru_wild_5', tier: 5, name: 'Call of the Wild', maxRank: 1, capstone: true, desc: 'When you take heavy damage, heal 15% max HP and gain +30% movement speed for 8s.', vals: [], effects: [cap('dru_cotw', 'Call of the Wild', 'onDamageTaken', { chance: 0.15, icd: 100, color: '#7ad0a0', log: 'Call of the wild!' }, [{ type: 'healPct', pct: 0.15 }, { type: 'status', status: { id: 'dru_cotw', name: 'Call of the Wild', type: 'buff', duration: 8, moveSpeedMultiplier: 1.3, color: '#7ad0a0', hostile: false, tags: ['druid', 'talent', 'capstone'] } }])] }
        ] }
    ]
  };

  DR.TALENT_TREES.Bard = {
    className: 'Bard', role: 'Support / Utility',
    specs: [
      { id: 'bard_minstrel', name: 'Minstrel', role: 'Core buff/support', summary: 'The songs that hold a party together.', color: '#e0b0f0',
        empowers: ['Song of Mending', 'Mana Melody', 'Hymn of Courage', 'Perfect Harmony', 'Chorus of Clarity', 'Songweave'],
        nodes: [
          { id: 'brd_min_1a', tier: 1, name: 'Practiced Hand', maxRank: 3, desc: 'Increases Wisdom by %1 and Mana by %2.', vals: [3, 12], effects: [{ k: 'stat', stat: 'wisdom', per: 3 }, { k: 'stat', stat: 'mana', per: 12 }] },
          { id: 'brd_min_1b', tier: 1, name: 'Resonance', maxRank: 3, desc: 'Your group buffs last %%1 longer.', vals: [0.05], effects: [{ k: 'spell', match: { kind: 'groupBuff' }, field: 'duration', op: 'mul', per: 0.05 }] },
          { id: 'brd_min_2a', tier: 2, name: 'Song of Mending', maxRank: 3, desc: 'Song of Mending radius +%1 and lasts %2s longer.', vals: [0.2, 2], effects: [{ k: 'spell', match: { names: ['Song of Mending'] }, field: 'radius', op: 'add', per: 0.2 }, { k: 'spell', match: { names: ['Song of Mending'] }, field: 'duration', op: 'add', per: 2 }] },
          { id: 'brd_min_2b', tier: 2, name: 'Mana Melody', maxRank: 3, desc: 'Mana Melody lasts %1s longer and costs %%2 less.', vals: [2, 0.05], effects: [{ k: 'spell', match: { names: ['Mana Melody'] }, field: 'duration', op: 'add', per: 2 }, { k: 'spell', match: { names: ['Mana Melody'] }, field: 'cost', op: 'mul', per: -0.05 }] },
          { id: 'brd_min_3', tier: 3, name: 'Perfect Harmony', maxRank: 3, desc: 'Perfect Harmony lasts %1s longer.', vals: [2], effects: [{ k: 'spell', match: { names: ['Perfect Harmony'] }, field: 'duration', op: 'add', per: 2 }] },
          { id: 'brd_min_4', tier: 4, name: 'Meditation Synergy', maxRank: 2, desc: 'Party members near you rest faster while meditating.', vals: [], effects: [{ k: 'flag', flag: 'bardMeditationSynergy' }] },
          { id: 'brd_min_5', tier: 5, name: 'Endless Song', maxRank: 1, capstone: true, desc: 'On cast, 20% chance your healing and support are increased by 30% for 8s.', vals: [], effects: [cap('brd_endless_song', 'Endless Song', 'onCast', { chance: 0.2, icd: 20, color: '#e0b0f0', log: 'The song does not end.' }, [{ type: 'dynamicMod', mod: 'healingDone', op: 'mul', value: 1.3, duration: 8 }])] }
        ] },
      { id: 'bard_warchanter', name: 'War Chanter', role: 'Combat rhythm', summary: 'Songs that turn a party into an army.', color: '#f0a070',
        empowers: ['Battle Hymn', 'Drumbeat Rush', 'Blade Rhythm', 'Chorus of War', 'Legendary Ballad', 'Quick Note'],
        nodes: [
          { id: 'brd_war_1a', tier: 1, name: 'Marching Beat', maxRank: 3, desc: 'Increases Attack by %1 and Speed by %2.', vals: [2, 0.02], effects: [{ k: 'stat', stat: 'attack', per: 2 }, { k: 'stat', stat: 'speed', per: 0.02 }] },
          { id: 'brd_war_1b', tier: 1, name: 'Tempo', maxRank: 3, desc: 'Your damage +%%1.', vals: [0.04], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.04 }] },
          { id: 'brd_war_2a', tier: 2, name: 'Battle Hymn', maxRank: 3, desc: 'Battle Hymn lasts %1s longer.', vals: [2], effects: [{ k: 'spell', match: { names: ['Battle Hymn'] }, field: 'duration', op: 'add', per: 2 }] },
          { id: 'brd_war_2b', tier: 2, name: 'Drumbeat Rush', maxRank: 3, desc: 'Drumbeat Rush lasts %1s longer and cooldown -%2s.', vals: [2, 0.5], effects: [{ k: 'spell', match: { names: ['Drumbeat Rush'] }, field: 'duration', op: 'add', per: 2 }, { k: 'spell', match: { names: ['Drumbeat Rush'] }, field: 'cooldown', op: 'add', per: -0.5 }] },
          { id: 'brd_war_3', tier: 3, name: 'Blade Rhythm', maxRank: 3, desc: 'Blade Rhythm lasts %1s longer; +%2 Crit Chance.', vals: [2, 1], effects: [{ k: 'spell', match: { names: ['Blade Rhythm'] }, field: 'duration', op: 'add', per: 2 }, { k: 'stat', stat: 'critChance', per: 1 }] },
          { id: 'brd_war_4', tier: 4, name: 'Chorus of War', maxRank: 2, desc: 'Chorus of War lasts %1s longer and cooldown -%2s.', vals: [2, 1], effects: [{ k: 'spell', match: { names: ['Chorus of War'] }, field: 'duration', op: 'add', per: 2 }, { k: 'spell', match: { names: ['Chorus of War'] }, field: 'cooldown', op: 'add', per: -1 }] },
          { id: 'brd_war_5', tier: 5, name: 'Crescendo', maxRank: 1, capstone: true, desc: 'On a crit, 10% chance to surge your damage by 25% for 8s.', vals: [], effects: [cap('brd_crescendo', 'Crescendo', 'onCrit', { chance: 0.1, icd: 25, color: '#f0a070', log: 'Crescendo!' }, [{ type: 'dynamicMod', mod: 'damageDone', op: 'mul', value: 1.25, duration: 8 }])] }
        ] },
      { id: 'bard_dirgesinger', name: 'Dirgesinger', role: 'Debuff and enemy weakening', summary: 'A dirge that unmakes your enemies.', color: '#8a6ab0',
        empowers: ['Dissonant Chord', 'Mournful Note', 'Lullaby', 'Dirge of Weakness', 'Final Refrain', 'Echoing Verse'],
        nodes: [
          { id: 'brd_dirge_1a', tier: 1, name: 'Dark Notes', maxRank: 3, desc: 'Increases Intelligence by %1 and Spell Power by %2.', vals: [3, 5], effects: [{ k: 'stat', stat: 'intelligence', per: 3 }, { k: 'stat', stat: 'spellPower', per: 5 }] },
          { id: 'brd_dirge_1b', tier: 1, name: 'Demoralize', maxRank: 3, desc: 'Your debuffs last %%1 longer.', vals: [0.05], effects: [{ k: 'spell', match: { kinds: ['debuff', 'aoeDebuff'] }, field: 'duration', op: 'mul', per: 0.05 }] },
          { id: 'brd_dirge_2a', tier: 2, name: 'Dirge of Weakness', maxRank: 3, desc: 'Dirge of Weakness radius +%1 and damage +%%2.', vals: [0.2, 0.05], effects: [{ k: 'spell', match: { names: ['Dirge of Weakness'] }, field: 'radius', op: 'add', per: 0.2 }, { k: 'spell', match: { names: ['Dirge of Weakness'] }, field: 'power', op: 'mul', per: 0.05 }] },
          { id: 'brd_dirge_2b', tier: 2, name: 'Mournful Note', maxRank: 3, desc: 'Mournful Note +%%1 damage and lasts %2s longer.', vals: [0.06, 1], effects: [{ k: 'spell', match: { names: ['Mournful Note'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Mournful Note'] }, field: 'duration', op: 'add', per: 1 }] },
          { id: 'brd_dirge_3', tier: 3, name: 'Dread Chorus', maxRank: 3, desc: 'Your damage +%%1.', vals: [0.04], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.04 }] },
          { id: 'brd_dirge_4', tier: 4, name: 'Final Refrain', maxRank: 2, desc: 'Final Refrain +%%1 damage and cooldown -%2s.', vals: [0.08, 1], effects: [{ k: 'spell', match: { names: ['Final Refrain'] }, field: 'power', op: 'mul', per: 0.08 }, { k: 'spell', match: { names: ['Final Refrain'] }, field: 'cooldown', op: 'add', per: -1 }] },
          { id: 'brd_dirge_5', tier: 5, name: 'The Last Verse', maxRank: 1, capstone: true, desc: 'On kill, the dirge strikes all nearby enemies for 200% of your attack and fears them.', vals: [], effects: [cap('brd_last_verse', 'The Last Verse', 'onKill', { chance: 1, icd: 18, color: '#8a6ab0', log: 'The last verse.' }, [{ type: 'damageAoe', pctOfAttack: 2.0, radius: 6, damageType: 'sonic' }, { type: 'applyStatusAoe', radius: 6, status: { id: 'brd_fear', name: 'Feared', type: 'debuff', duration: 2, fearDuration: 2, moveSpeedMultiplier: 0.5, hostile: true, tags: ['fear', 'talent'] } }])] }
        ] }
    ]
  };

  DR.TALENT_TREES.Enchanter = {
    className: 'Enchanter', role: 'Support / Utility',
    specs: [
      { id: 'enchanter_mesmerist', name: 'Mesmerist', role: 'Crowd control', summary: 'Lock the battlefield down, mind by mind.', color: '#c0a0f0',
        empowers: ['Mesmerize', 'Sleep Hex', 'Confusing Glare', 'Mind Lock', 'Charm', 'Mass Mesmerize'],
        nodes: [
          { id: 'enc_mes_1a', tier: 1, name: 'Focused Mind', maxRank: 3, desc: 'Increases Intelligence by %1 and Mana by %2.', vals: [3, 12], effects: [{ k: 'stat', stat: 'intelligence', per: 3 }, { k: 'stat', stat: 'mana', per: 12 }] },
          { id: 'enc_mes_1b', tier: 1, name: 'Lasting Hold', maxRank: 3, desc: 'Your control effects last %%1 longer.', vals: [0.04], effects: [{ k: 'spell', match: { kinds: ['debuff', 'aoeDebuff'] }, field: 'duration', op: 'mul', per: 0.04 }] },
          { id: 'enc_mes_2a', tier: 2, name: 'Mesmerize', maxRank: 3, desc: 'Mesmerize lasts %1s longer and costs %%2 less.', vals: [1, 0.05], effects: [{ k: 'spell', match: { names: ['Mesmerize'] }, field: 'duration', op: 'add', per: 1 }, { k: 'spell', match: { names: ['Mesmerize'] }, field: 'cost', op: 'mul', per: -0.05 }] },
          { id: 'enc_mes_2b', tier: 2, name: 'Sleep Hex', maxRank: 3, desc: 'Sleep Hex cooldown -%1s and lasts %2s longer.', vals: [0.5, 1], effects: [{ k: 'spell', match: { names: ['Sleep Hex'] }, field: 'cooldown', op: 'add', per: -0.5 }, { k: 'spell', match: { names: ['Sleep Hex'] }, field: 'duration', op: 'add', per: 1 }] },
          { id: 'enc_mes_3', tier: 3, name: 'Mind Lock', maxRank: 3, desc: 'Mind Lock lasts %1s longer and cooldown -%2s.', vals: [1, 0.4], effects: [{ k: 'spell', match: { names: ['Mind Lock'] }, field: 'duration', op: 'add', per: 1 }, { k: 'spell', match: { names: ['Mind Lock'] }, field: 'cooldown', op: 'add', per: -0.4 }] },
          { id: 'enc_mes_4', tier: 4, name: 'Confusion', maxRank: 2, desc: 'Your damage +%%1.', vals: [0.04], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.04 }] },
          { id: 'enc_mes_5', tier: 5, name: 'Total Domination', maxRank: 1, capstone: true, desc: 'On cast, mesmerize all nearby enemies for 6s.', vals: [], effects: [cap('enc_total_dom', 'Total Domination', 'onCast', { chance: 1, icd: 60, color: '#c0a0f0', log: 'Total domination.' }, [{ type: 'applyStatusAoe', radius: 8, maxTargets: 12, status: { id: 'enc_mesmerize', name: 'Mesmerized', type: 'debuff', duration: 6, rootDuration: 6, moveSpeedMultiplier: 0, hostile: true, tags: ['mesmerize', 'cc', 'talent'] } }])] }
        ] },
      { id: 'enchanter_illusionist', name: 'Illusionist', role: 'Deception and clones', summary: 'Never quite where they strike.', color: '#a0c0f0',
        empowers: ['Mirror Image', 'False Target', 'Illusory Step', 'Phantom Army', 'Memory Fog', 'Disorienting Field'],
        nodes: [
          { id: 'enc_ill_1a', tier: 1, name: 'Misdirection', maxRank: 3, desc: 'Increases Intelligence by %1 and Defense by %2.', vals: [3, 2], effects: [{ k: 'stat', stat: 'intelligence', per: 3 }, { k: 'stat', stat: 'defense', per: 2 }] },
          { id: 'enc_ill_1b', tier: 1, name: 'Fading Form', maxRank: 3, desc: 'You take %%1 less damage.', vals: [0.02], effects: [{ k: 'mod', mod: 'damageTaken', op: 'mul', per: -0.02 }] },
          { id: 'enc_ill_2a', tier: 2, name: 'Mirror Image', maxRank: 3, desc: 'Mirror Image absorbs %%1 more and lasts %2s longer.', vals: [0.06, 2], effects: [{ k: 'spell', match: { names: ['Mirror Image'] }, field: 'absorbFlat', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Mirror Image'] }, field: 'duration', op: 'add', per: 2 }] },
          { id: 'enc_ill_2b', tier: 2, name: 'False Target', maxRank: 3, desc: 'False Target cooldown -%1s and absorbs %%2 more.', vals: [0.5, 0.06], effects: [{ k: 'spell', match: { names: ['False Target'] }, field: 'cooldown', op: 'add', per: -0.5 }, { k: 'spell', match: { names: ['False Target'] }, field: 'absorbFlat', op: 'mul', per: 0.06 }] },
          { id: 'enc_ill_3', tier: 3, name: 'Phantom Army', maxRank: 3, desc: 'Phantom Army +%%1 damage and radius +%2.', vals: [0.06, 0.2], effects: [{ k: 'spell', match: { names: ['Phantom Army'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Phantom Army'] }, field: 'radius', op: 'add', per: 0.2 }] },
          { id: 'enc_ill_4', tier: 4, name: 'Illusory Step', maxRank: 2, desc: 'Illusory Step cooldown -%1s and absorbs %%2 more.', vals: [1, 0.06], effects: [{ k: 'spell', match: { names: ['Illusory Step'] }, field: 'cooldown', op: 'add', per: -1 }, { k: 'spell', match: { names: ['Illusory Step'] }, field: 'absorbFlat', op: 'mul', per: 0.06 }] },
          { id: 'enc_ill_5', tier: 5, name: 'Not There', maxRank: 1, capstone: true, desc: 'At 30% HP: gain 60% damage reduction for 4s and heal 5% max HP.', vals: [], effects: [cap('enc_not_there', 'Not There', 'lowHealth', { threshold: 0.30, chance: 1, icd: 120, color: '#a0c0f0', log: 'You were never there.' }, [{ type: 'status', status: { id: 'enc_not_there', name: 'Not There', type: 'buff', duration: 4, damageTakenMultiplier: 0.4, color: '#a0c0f0', hostile: false, tags: ['enchanter', 'talent', 'capstone'] } }, { type: 'healPct', pct: 0.05 }])] }
        ] },
      { id: 'enchanter_runebinder', name: 'Runebinder', role: 'Arcane buff/debuff', summary: 'Runes that amplify allies and unmake foes.', color: '#f0d0a0',
        empowers: ['Rune of Power', 'Rune of Focus', 'Seal of Frailty', 'Arcane Binding', 'Glyphstorm', 'Grand Rune', 'Reality Rewrite'],
        nodes: [
          { id: 'enc_rune_1a', tier: 1, name: 'Runic Study', maxRank: 3, desc: 'Increases Intelligence by %1 and Spell Power by %2.', vals: [3, 6], effects: [{ k: 'stat', stat: 'intelligence', per: 3 }, { k: 'stat', stat: 'spellPower', per: 6 }] },
          { id: 'enc_rune_1b', tier: 1, name: 'Inscription', maxRank: 3, desc: 'Your runes and seals last %%1 longer.', vals: [0.05], effects: [{ k: 'spell', match: { kinds: ['buff', 'groupBuff'] }, field: 'duration', op: 'mul', per: 0.05 }] },
          { id: 'enc_rune_2a', tier: 2, name: 'Rune of Power', maxRank: 3, desc: 'Rune of Power lasts %1s longer and gains +%2 charge.', vals: [2, 1], effects: [{ k: 'spell', match: { names: ['Rune of Power'] }, field: 'duration', op: 'add', per: 2 }, { k: 'spell', match: { names: ['Rune of Power'] }, field: 'charges', op: 'add', per: 1 }] },
          { id: 'enc_rune_2b', tier: 2, name: 'Seal of Frailty', maxRank: 3, desc: 'Seal of Frailty weakens %%1 more and costs %%2 less.', vals: [0.02, 0.05], effects: [{ k: 'spell', match: { names: ['Seal of Frailty'] }, field: 'damageTakenMultiplier', op: 'mul', per: 0.02 }, { k: 'spell', match: { names: ['Seal of Frailty'] }, field: 'cost', op: 'mul', per: -0.05 }] },
          { id: 'enc_rune_3', tier: 3, name: 'Arcane Binding', maxRank: 3, desc: 'Arcane Binding +%%1 damage and lasts %2s longer.', vals: [0.06, 1], effects: [{ k: 'spell', match: { names: ['Arcane Binding'] }, field: 'power', op: 'mul', per: 0.06 }, { k: 'spell', match: { names: ['Arcane Binding'] }, field: 'duration', op: 'add', per: 1 }] },
          { id: 'enc_rune_4', tier: 4, name: 'Amplification', maxRank: 2, desc: 'Your damage +%%1.', vals: [0.04], effects: [{ k: 'mod', mod: 'damageDone', op: 'mul', per: 0.04 }] },
          { id: 'enc_rune_5', tier: 5, name: 'Glyphstorm', maxRank: 1, capstone: true, desc: 'On cast, detonate your runes for 200% of your attack to all nearby enemies.', vals: [], effects: [cap('enc_glyphstorm', 'Glyphstorm', 'onCast', { chance: 1, icd: 45, color: '#f0d0a0', log: 'Glyphstorm!' }, [{ type: 'damageAoe', pctOfAttack: 2.0, radius: 5, damageType: 'arcane' }])] }
        ] }
    ]
  };
})();
