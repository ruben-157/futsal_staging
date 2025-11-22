export function attachResultModal({ state, getTrackScorersPref, setTrackScorersPref, saveResults, renderSchedule, renderLeaderboard, renderTopScorers, computeGoalStats, logError, areAllMatchesScored, closeOverlay, onTournamentComplete }){
  let modalCtx = null; // { matchId, aId, bId, round }
  const overlay = document.getElementById('overlay');
  const modal = document.getElementById('resultModal');
  const aName = document.getElementById('modalTeamAName');
  const bName = document.getElementById('modalTeamBName');
  const aInput = document.getElementById('modalTeamAScore');
  const bInput = document.getElementById('modalTeamBScore');
  const aMinus = document.getElementById('modalATeamMinus');
  const aPlus = document.getElementById('modalATeamPlus');
  const bMinus = document.getElementById('modalBTeamMinus');
  const bPlus = document.getElementById('modalBTeamPlus');
  const label = document.getElementById('modalMatchLabel');
  const saveBtn = document.getElementById('modalSave');
  const saveError = document.getElementById('modalSaveError');
  const trackToggle = document.getElementById('modalTrackScorers');
  const scorersWrap = document.getElementById('modalScorers');
  const cancelBtn = document.getElementById('modalCancel');

  function open({ matchId, a, b, round }){
    modalCtx = { matchId, aId: a.id, bId: b.id, round };
    aName.textContent = '';
    bName.textContent = '';
    label.textContent = `Round ${round} — ${a.name} vs ${b.name}`;
    aInput.value = '0'; bInput.value = '0';
    saveBtn.disabled = true; saveError.style.display = 'none';
    const pillA = document.createElement('span'); pillA.className = 'team-pill'; pillA.style.borderColor = a.color; pillA.appendChild(document.createTextNode(a.name));
    const pillB = document.createElement('span'); pillB.className = 'team-pill'; pillB.style.borderColor = b.color; pillB.appendChild(document.createTextNode(b.name));
    aName.appendChild(pillA); const subA = document.createElement('div'); subA.className = 'team-sub'; subA.textContent = (a.members || []).join(', '); aName.appendChild(subA);
    bName.appendChild(pillB); const subB = document.createElement('div'); subB.className = 'team-sub'; subB.textContent = (b.members || []).join(', '); bName.appendChild(subB);
    overlay.hidden = false; modal.hidden = false; modal.focus();
    setupTrackers(a, b);
  }

  function close(){
    if(overlay) overlay.hidden = true;
    if(modal) modal.hidden = true;
    modalCtx = null;
    if(closeOverlay) closeOverlay();
  }

  function setupTrackers(a, b){
    const aInputs = new Map(); const bInputs = new Map();
    scorersWrap.innerHTML = '';
    const createCard = (team)=>{
      const card = document.createElement('div');
      card.className = 'scorer-card';
      const title = document.createElement('div'); title.className = 'scorer-title'; title.textContent = team.name;
      card.appendChild(title);
      return card;
    };
    const aCard = createCard(a); const bCard = createCard(b);
    scorersWrap.appendChild(aCard); scorersWrap.appendChild(bCard);
    const gpa = {}; const gpb = {};
    function makeRow(name, val, map, parent){
      const row = document.createElement('label'); row.className = 'score-row';
      const label = document.createElement('span'); label.textContent = name;
      const inp = document.createElement('input'); inp.className = 'scorer-input'; inp.type = 'number'; inp.inputMode='numeric'; inp.min='0'; inp.value = val;
      row.appendChild(label); row.appendChild(inp);
      parent.appendChild(row);
      map.set(name, inp);
    }
    for(const p of a.members){ makeRow(p, gpa[p] ?? 0, aInputs, aCard); }
    if((a.members || []).length === 3){ makeRow('Guest player', gpa['Guest player'] ?? 0, aInputs, aCard); }
    for(const p of b.members){ makeRow(p, gpb[p] ?? 0, bInputs, bCard); }
    if((b.members || []).length === 3){ makeRow('Guest player', gpb['Guest player'] ?? 0, bInputs, bCard); }

    function sumMapVals(map){ let s=0; map.forEach((el)=>{ s += Math.max(0, parseInt(el.value||'0',10)); }); return s; }
    function updateTotalsFromPlayers(){
      const sa = sumMapVals(aInputs);
      const sb = sumMapVals(bInputs);
      const ca = Math.max(0, parseInt(aInput.value||'0',10));
      const cb = Math.max(0, parseInt(bInput.value||'0',10));
      const na = Math.max(ca, sa);
      const nb = Math.max(cb, sb);
      aInput.value = String(na);
      bInput.value = String(nb);
    }
    function onInput(){ saveBtn.disabled = false; }
    function syncIfTracking(){ if(trackToggle.checked){ updateTotalsFromPlayers(); onInput(); } }
    const applyToggle = ()=>{
      scorersWrap.style.display = trackToggle.checked ? '' : 'none';
      aInput.disabled = trackToggle.checked;
      bInput.disabled = trackToggle.checked;
      if(trackToggle.checked){ updateTotalsFromPlayers(); onInput(); }
    };
    applyToggle();
    trackToggle.onchange = ()=>{ applyToggle(); setTrackScorersPref(trackToggle.checked); };
    trackToggle.checked = getTrackScorersPref();

    const bindStep = (inp, minus, plus)=>{
      const change = (delta)=>{
        const cur = Math.max(0, parseInt(inp.value||'0',10) + delta);
        inp.value = String(cur);
        onInput();
        if(trackToggle.checked) syncIfTracking();
      };
      minus.onclick = ()=> change(-1);
      plus.onclick = ()=> change(+1);
      inp.oninput = ()=>{ const v = parseInt(inp.value||'0',10); if(isNaN(v)){ inp.value='0'; } onInput(); if(trackToggle.checked) syncIfTracking(); };
    };
    bindStep(aInput, aMinus, aPlus);
    bindStep(bInput, bMinus, bPlus);

    saveBtn.onclick = () => {
      const ga = Math.max(0, parseInt(aInput.value, 10));
      const gb = Math.max(0, parseInt(bInput.value, 10));
      if(!Number.isFinite(ga) || !Number.isFinite(gb)) return;
      if(trackToggle.checked){
        let sa=0,sb=0; aInputs.forEach((el)=>{ sa += Math.max(0, parseInt(el.value||'0',10)); });
        bInputs.forEach((el)=>{ sb += Math.max(0, parseInt(el.value||'0',10)); });
        const finalA = Math.max(ga, sa);
        const finalB = Math.max(gb, sb);
        if(sa < finalA || sb < finalB){
          saveError.style.display='';
          saveError.textContent = `Distribute all goals to players: need ${finalA}-${finalB}, have ${sa}-${sb}.`;
          return;
        }
        saveError.style.display='none';
        const outA = {}; aInputs.forEach((el, name)=>{ const n = Math.max(0, parseInt(el.value||'0',10)); if(n>0) outA[name]=n; });
        const outB = {}; bInputs.forEach((el, name)=>{ const n = Math.max(0, parseInt(el.value||'0',10)); if(n>0) outB[name]=n; });
        state.results[modalCtx.matchId] = { a: modalCtx.aId, b: modalCtx.bId, round: modalCtx.round, ga: finalA, gb: finalB, gpa: outA, gpb: outB };
      } else {
        saveError.style.display='none';
        state.results[modalCtx.matchId] = { a: modalCtx.aId, b: modalCtx.bId, round: modalCtx.round, ga, gb };
      }
      try{
        delete state.results[modalCtx.matchId].gaDraft;
        delete state.results[modalCtx.matchId].gbDraft;
        delete state.results[modalCtx.matchId].gpaDraft;
        delete state.results[modalCtx.matchId].gpbDraft;
      }catch(_){ }
      const ok = saveResults();
      if(!ok){
        saveError.textContent = 'Could not save results. Storage may be full or blocked. Retry or clear storage.';
        saveError.style.display = '';
        logError('ERR_SAVE_RESULTS', 'Failed to persist results', { matchId: modalCtx.matchId });
        return;
      }
      const completedNow = areAllMatchesScored() && !state.celebrated;
      if(completedNow){
        try{
          modal.hidden = true;
          if(overlay) overlay.onclick = null;
        }catch(_){}
        renderSchedule();
        renderLeaderboard();
        // no toast; end tournament modal handles celebration
        close();
        if(typeof onTournamentComplete === 'function'){
          onTournamentComplete();
        }
      } else {
        close();
        renderSchedule();
        renderLeaderboard();
      }
    };
  }

  cancelBtn.onclick = close;
  if(overlay){ overlay.addEventListener('click', (e)=>{ if(e.target === overlay) close(); }); }

  return { open: ({ matchId, a, b, round }) => open({ matchId, a, b, round }), close };
}
