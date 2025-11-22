export function attachAddPlayerModal(deps){
  const {
    state,
    savePlayers,
    saveAttendees,
    clampPlayLimit,
    renderRoster,
    updateTabsUI,
    MAX_ATTENDEES,
    SKILLS,
    STAMINA,
    DEFAULT_SKILL,
    DEFAULT_STAMINA,
    RATING_STEP,
    normalizeRating,
    snapToRatingStep
  } = deps || {};
  const overlay = document.getElementById('overlay');
  const modal = document.getElementById('addPlayerModal');
  const input = document.getElementById('addPlayerName');
  const skillInput = document.getElementById('addPlayerSkill');
  const skillMinus = document.getElementById('addPlayerSkillMinus');
  const skillPlus = document.getElementById('addPlayerSkillPlus');
  const staminaInput = document.getElementById('addPlayerStamina');
  const staminaMinus = document.getElementById('addPlayerStaminaMinus');
  const staminaPlus = document.getElementById('addPlayerStaminaPlus');
  const err = document.getElementById('addPlayerError');
  const save = document.getElementById('addPlayerSave');
  const cancel = document.getElementById('addPlayerCancel');

  function close(){
    if(overlay) overlay.hidden = true;
    if(modal) modal.hidden = true;
    if(cancel) cancel.onclick = null;
    if(save) save.onclick = null;
    if(overlay) overlay.onclick = null;
  }

  function formatRating(val){
    const num = Number(val);
    if(Number.isNaN(num)) return '';
    return Number.isInteger(num) ? String(Math.trunc(num)) : num.toFixed(1);
  }
  const clampInputValue = (el, fallback)=>{
    const v = snapToRatingStep(el.value, fallback);
    el.value = formatRating(v);
    return v;
  };
  const adjustInput = (el, fallback, delta)=> {
    const current = snapToRatingStep(el.value, fallback);
    const next = snapToRatingStep(current + delta, fallback);
    el.value = formatRating(next);
  };

  function open(){
    if(!overlay || !modal || !input || !skillInput || !staminaInput || !save || !cancel) return;
    err.style.display = 'none';
    err.textContent = '';
    input.value = '';
    skillInput.value = formatRating(snapToRatingStep(DEFAULT_SKILL, DEFAULT_SKILL));
    staminaInput.value = formatRating(snapToRatingStep(DEFAULT_STAMINA, DEFAULT_STAMINA));
    save.disabled = true;

    function update(){ save.disabled = input.value.trim().length === 0; }
    input.oninput = update;
    skillMinus.onclick = ()=> adjustInput(skillInput, DEFAULT_SKILL, -RATING_STEP);
    skillPlus.onclick = ()=> adjustInput(skillInput, DEFAULT_SKILL, RATING_STEP);
    skillInput.oninput = ()=>{ clampInputValue(skillInput, DEFAULT_SKILL); };
    staminaMinus.onclick = ()=> adjustInput(staminaInput, DEFAULT_STAMINA, -RATING_STEP);
    staminaPlus.onclick = ()=> adjustInput(staminaInput, DEFAULT_STAMINA, RATING_STEP);
    staminaInput.oninput = ()=>{ clampInputValue(staminaInput, DEFAULT_STAMINA); };

    overlay.hidden = false; modal.hidden = false; setTimeout(()=> input.focus(), 0);
    overlay.onclick = close;
    cancel.onclick = close;
    document.addEventListener('keydown', function esc(e){ if(e.key==='Escape'){ close(); } }, { once:true });

    save.onclick = ()=>{
      const name = input.value.trim();
      if(!name){ return; }
      if(state.attendees.length >= MAX_ATTENDEES){
        err.textContent = `Cannot add more than ${MAX_ATTENDEES} attendees.`;
        err.style.display = '';
        return;
      }
      const lowerExisting = new Set([...state.players, ...state.attendees].map(x=>x.toLowerCase()));
      let finalName = name;
      if(lowerExisting.has(finalName.toLowerCase())){
        let i = 2;
        while(lowerExisting.has((name + ' ('+i+')').toLowerCase())) i++;
        finalName = name + ' ('+i+')';
      }
      SKILLS[finalName] = normalizeRating(skillInput.value, DEFAULT_SKILL);
      STAMINA[finalName] = normalizeRating(staminaInput.value, DEFAULT_STAMINA);
      if(!state.players.some(p => p.toLowerCase() === finalName.toLowerCase())){
        state.players.push(finalName);
        savePlayers();
      }
      state.attendees.push(finalName);
      saveAttendees();
      close();
      clampPlayLimit();
      renderRoster();
      updateTabsUI();
    };
  }

  return { open, close };
}
