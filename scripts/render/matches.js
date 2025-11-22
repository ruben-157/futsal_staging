export function renderSchedule(state, opts){
  const {
    resultModal,
    orderRoundPairings,
    computeStableSeedFromAttendees
  } = opts;
  const list = document.getElementById('matchesList');
  if(!list) return;
  list.innerHTML = '';
  if(!state.teams || state.teams.length < 2){
    const info = document.createElement('div');
    info.className = 'notice';
    info.textContent = 'Generate teams to see the match schedule.';
    list.appendChild(info);
    return;
  }
  const stableSeed = computeStableSeedFromAttendees(state.attendees || []);
  const pairings = [];
  for(let i=0;i<state.teams.length;i++){
    for(let j=i+1;j<state.teams.length;j++){
      pairings.push([state.teams[i], state.teams[j]]);
    }
  }
  const totalRounds = Math.max(1, Number(state.rounds) || 2);
  let nextMarked = false;
  const baseStreak = new Map(state.teams.map(t => [t.id, 0]));
  const baseOrdered = orderRoundPairings(pairings, baseStreak, stableSeed);
  function createsTriple(order){
    const ids = state.teams.map(t=>t.id);
    const streak = new Map(ids.map(id=>[id,0]));
    for(let r=0;r<totalRounds;r++){
      for(const [a,b] of order){
        for(const id of ids){
          if(id===a.id || id===b.id){ streak.set(id, (streak.get(id)||0)+1); }
          else { streak.set(id, 0); }
          if((streak.get(id)||0) >= 3) return true;
        }
      }
    }
    return false;
  }
  let ordered = baseOrdered;
  let attempts = 0;
  while(createsTriple(ordered) && attempts < 5){
    ordered = ordered.slice(1).concat([ordered[0]]);
    attempts++;
  }
  const flatList = [];
  for(let roundIdx=0; roundIdx<totalRounds; roundIdx++){
    for(const [a,b] of ordered){ flatList.push({ a, b, round: roundIdx+1 }); }
  }
  const nextIndex = flatList.findIndex(({a,b, round})=>{
    const id = `${Math.min(a.id,b.id)}-${Math.max(a.id,b.id)}-r${round}`;
    const rec = state.results[id];
    return !(rec && rec.ga != null && rec.gb != null);
  });

  for(let roundIdx=0; roundIdx<totalRounds; roundIdx++){
    const roundDiv = document.createElement('div');
    roundDiv.className = 'round';
    const heading = document.createElement('div');
    heading.className = 'round-header';
    heading.textContent = `Round ${roundIdx + 1}`;
    roundDiv.appendChild(heading);
    const pairs = ordered;
    let flatCursor = roundIdx * pairs.length;
    pairs.forEach(([a,b])=>{
      const recId = `${Math.min(a.id,b.id)}-${Math.max(a.id,b.id)}-r${roundIdx+1}`;
      const rec = state.results[recId] || null;
      const isPlayed = rec && rec.ga != null && rec.gb != null;
      const row = document.createElement('div');
      row.className = 'pair';
      const label = document.createElement('div'); label.className = 'pair-label';
      const pillA = document.createElement('span'); pillA.className = 'team-pill'; pillA.style.borderColor = a.color; pillA.textContent = a.name;
      const pillB = document.createElement('span'); pillB.className = 'team-pill'; pillB.style.borderColor = b.color; pillB.textContent = b.name;
      label.appendChild(pillA); label.appendChild(document.createTextNode(' vs ')); label.appendChild(pillB);
      const isNext = !nextMarked && (flatCursor === nextIndex);
      if(isNext){
        nextMarked = true;
        const nextLabel = document.createElement('div');
        nextLabel.className = 'next-heading';
        nextLabel.textContent = 'Next Match';
        roundDiv.insertBefore(nextLabel, heading.nextSibling);
        row.classList.add('next');
      }
      if(!isPlayed && nextIndex >= 0 && flatCursor > nextIndex){ row.classList.add('future'); }
      if(isPlayed){
        if(rec.ga > rec.gb){ pillA.classList.add('winner'); pillA.style.background = a.color; pillA.style.borderColor = a.color; pillA.style.color = '#fff'; }
        else if(rec.gb > rec.ga){ pillB.classList.add('winner'); pillB.style.background = b.color; pillB.style.borderColor = b.color; pillB.style.color = '#fff'; }
      }
      const score = document.createElement('div'); score.className = 'match-score';
      if(isPlayed){
        const scoreBtn = document.createElement('button'); scoreBtn.type='button'; scoreBtn.className='btn slim'; scoreBtn.textContent = `${rec.ga} - ${rec.gb}`; scoreBtn.addEventListener('click', ()=> resultModal.open({ matchId: recId, a, b, round: roundIdx+1 })); score.appendChild(scoreBtn);
      } else {
        const setBtn = document.createElement('button'); setBtn.type='button'; setBtn.className='btn slim'; setBtn.textContent = 'Set Result'; setBtn.addEventListener('click', ()=> resultModal.open({ matchId: recId, a, b, round: roundIdx+1 })); score.appendChild(setBtn);
      }
      row.appendChild(label);
      row.appendChild(score);
      roundDiv.appendChild(row);
      flatCursor++;
    });
    list.appendChild(roundDiv);
  }
}
