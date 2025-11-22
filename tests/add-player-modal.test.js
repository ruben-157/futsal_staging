import { attachAddPlayerModal } from '../modals/addPlayer.js';
import { normalizeRating, snapToRatingStep, DEFAULT_SKILL, DEFAULT_STAMINA, RATING_STEP } from '../data/config.js';

function makeEl(id){
  return {
    id,
    hidden: true,
    value: '',
    textContent: '',
    innerHTML: '',
    onclick: null,
    oninput: null,
    style: {},
    addEventListener: ()=>{},
    removeEventListener: ()=>{}
  };
}

function withDom(map, fn){
  const originalDoc = global.document;
  global.document = {
    getElementById: (id)=> map.get(id) || null,
    addEventListener: ()=>{},
    removeEventListener: ()=>{}
  };
  try{ fn(); } finally { global.document = originalDoc; }
}

test('add player modal saves new unique player and attendee', ()=>{
  const overlay = makeEl('overlay');
  const modal = makeEl('addPlayerModal');
  const nameInput = makeEl('addPlayerName');
  const skillInput = makeEl('addPlayerSkill');
  const staminaInput = makeEl('addPlayerStamina');
  const skillMinus = makeEl('addPlayerSkillMinus');
  const skillPlus = makeEl('addPlayerSkillPlus');
  const staminaMinus = makeEl('addPlayerStaminaMinus');
  const staminaPlus = makeEl('addPlayerStaminaPlus');
  const err = makeEl('addPlayerError');
  const save = makeEl('addPlayerSave');
  const cancel = makeEl('addPlayerCancel');
  const map = new Map([
    ['overlay', overlay],
    ['addPlayerModal', modal],
    ['addPlayerName', nameInput],
    ['addPlayerSkill', skillInput],
    ['addPlayerStamina', staminaInput],
    ['addPlayerSkillMinus', skillMinus],
    ['addPlayerSkillPlus', skillPlus],
    ['addPlayerStaminaMinus', staminaMinus],
    ['addPlayerStaminaPlus', staminaPlus],
    ['addPlayerError', err],
    ['addPlayerSave', save],
    ['addPlayerCancel', cancel],
  ]);
  const state = { players: ['Bob'], attendees: [] };
  const SKILLS = {};
  const STAMINA = {};
  let savedPlayers = 0, savedAtt = 0, clamped = 0, roster = 0, tabs = 0;
  withDom(map, ()=>{
    const modalApi = attachAddPlayerModal({
      state,
      savePlayers: ()=>{ savedPlayers++; },
      saveAttendees: ()=>{ savedAtt++; },
      clampPlayLimit: ()=>{ clamped++; },
      renderRoster: ()=>{ roster++; },
      updateTabsUI: ()=>{ tabs++; },
      MAX_ATTENDEES: 5,
      SKILLS,
      STAMINA,
      DEFAULT_SKILL,
      DEFAULT_STAMINA,
      RATING_STEP,
      normalizeRating,
      snapToRatingStep
    });
    modalApi.open();
    nameInput.value = 'Alice';
    save.onclick();
    assert(state.players.includes('Alice'), 'player added');
    assert(state.attendees.includes('Alice'), 'attendee added');
    assert(SKILLS.Alice !== undefined && STAMINA.Alice !== undefined, 'ratings saved');
    assert(savedPlayers === 1 && savedAtt === 1, 'saves called');
    assert(clamped === 1 && roster === 1 && tabs === 1, 'ui updates called');
    assert(overlay.hidden === true && modal.hidden === true, 'modal closed');
  });
});

test('add player modal enforces max attendees and errors instead of saving', ()=>{
  const overlay = makeEl('overlay');
  const modal = makeEl('addPlayerModal');
  const nameInput = makeEl('addPlayerName');
  const skillInput = makeEl('addPlayerSkill');
  const staminaInput = makeEl('addPlayerStamina');
  const skillMinus = makeEl('addPlayerSkillMinus');
  const skillPlus = makeEl('addPlayerSkillPlus');
  const staminaMinus = makeEl('addPlayerStaminaMinus');
  const staminaPlus = makeEl('addPlayerStaminaPlus');
  const err = makeEl('addPlayerError');
  const save = makeEl('addPlayerSave');
  const cancel = makeEl('addPlayerCancel');
  const map = new Map([
    ['overlay', overlay],
    ['addPlayerModal', modal],
    ['addPlayerName', nameInput],
    ['addPlayerSkill', skillInput],
    ['addPlayerStamina', staminaInput],
    ['addPlayerSkillMinus', skillMinus],
    ['addPlayerSkillPlus', skillPlus],
    ['addPlayerStaminaMinus', staminaMinus],
    ['addPlayerStaminaPlus', staminaPlus],
    ['addPlayerError', err],
    ['addPlayerSave', save],
    ['addPlayerCancel', cancel],
  ]);
  const state = { players: ['Bob'], attendees: ['Bob'] };
  withDom(map, ()=>{
    const modalApi = attachAddPlayerModal({
      state,
      savePlayers: ()=>{},
      saveAttendees: ()=>{},
      clampPlayLimit: ()=>{},
      renderRoster: ()=>{},
      updateTabsUI: ()=>{},
      MAX_ATTENDEES: 1,
      SKILLS: {},
      STAMINA: {},
      DEFAULT_SKILL,
      DEFAULT_STAMINA,
      RATING_STEP,
      normalizeRating,
      snapToRatingStep
    });
    modalApi.open();
    nameInput.value = 'New';
    save.onclick();
    assert(state.attendees.length === 1, 'no new attendee added when at max');
    assert(err.textContent.includes('Cannot add more than'), 'error shown');
    assert(err.style.display === '', 'error visible');
    assert(overlay.hidden === false, 'modal stays open');
  });
});
