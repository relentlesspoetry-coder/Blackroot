(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  DR.MERC_ROLES = {
    guardian: {
      label: 'Guardian', className: 'Fighter', cost: 25, color: '#d0b070', hp: 126, mana: 30, attack: 10, defense: 11, range: 1.4,
      desc: 'Tank'
    },
    cleric: {
      label: 'Field Cleric', className: 'Cleric', cost: 35, color: '#f0e6a0', hp: 92, mana: 130, attack: 6, defense: 5, range: 6.0,
      desc: 'Healer'
    },
    adept: {
      label: 'Arcane Adept', className: 'Enchanter', cost: 32, color: '#83b7ff', hp: 80, mana: 135, attack: 15, defense: 3, range: 6.5,
      desc: 'Magic DPS'
    },
    scout: {
      label: 'Blade Scout', className: 'Rogue', cost: 28, color: '#cfd4d9', hp: 88, mana: 55, attack: 16, defense: 4, range: 1.5,
      desc: 'Melee DPS'
    }
  };
})();
