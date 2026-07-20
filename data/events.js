// Dream Realms event type data
// Modular Pass 24: editor event marker definitions.
(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  const EVENT_TYPES = [
    {
      id: 'event_marker',
      name: 'Event Marker',
      category: 'generic',
      color: '#ffd66e',
      label: 'E',
      trigger: 'interact',
      note: 'Generic interaction marker for later command scripting.'
    },
    {
      id: 'dialogue',
      name: 'Dialogue Event',
      category: 'dialogue',
      color: '#9fd7ff',
      label: 'D',
      trigger: 'interact',
      commands: [{ type: 'showText', text: 'The air feels strange here.' }],
      note: 'NPC/sign/object dialogue starter.'
    },
    {
      id: 'chest_event',
      name: 'Chest Event',
      category: 'chest',
      color: '#d8ad57',
      label: 'C',
      trigger: 'interact',
      commands: [{ type: 'openChest', lootTable: 'common_chest' }],
      note: 'Scriptable chest or loot container.'
    },
    {
      id: 'quest_hook',
      name: 'Quest Hook',
      category: 'quest',
      color: '#c991ff',
      label: 'Q',
      trigger: 'interact',
      commands: [{ type: 'questHook', questId: 'quest_darkwood_first_steps' }],
      note: 'Quest start, progress, or completion hook.'
    },
    {
      id: 'shop_event',
      name: 'Shop Event',
      category: 'shop',
      color: '#7fe0a1',
      label: '$',
      trigger: 'interact',
      commands: [{ type: 'openShop', shopId: 'general_goods' }],
      note: 'Shop opener placeholder.'
    },
    {
      id: 'warp_event',
      name: 'Warp Event',
      category: 'warp',
      color: '#fff08a',
      label: 'W',
      trigger: 'touch',
      commands: [{ type: 'warp', targetZone: 'dark_woods' }],
      note: 'Scripted warp/transition event placeholder.'
    }
  ];

  DR.EVENT_TYPES = EVENT_TYPES;
  DR.EVENT_BY_ID = Object.freeze(Object.fromEntries(EVENT_TYPES.map(event => [event.id, event])));
})();
