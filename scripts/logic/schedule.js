import { mulberry32 } from '../utils/random.js';

export function orderRoundPairings(state, pairs, streakMap, seed){
  if(state.teams && state.teams.length === 4){
    const teams4 = [...state.teams].sort((a,b)=> a.id - b.id);
    const [A,B,C,D] = teams4;
    return [[A,B],[C,D],[A,C],[B,D],[A,D],[B,C]];
  }
  const rng = mulberry32((seed >>> 0));
  const remaining = [...pairs].sort(() => rng() - 0.5);
  const ordered = [];
  const teamIds = state.teams.map(t => t.id);
  while(remaining.length){
    let pickIdx = -1;
    for(let i=0;i<remaining.length;i++){
      const aId = remaining[i][0].id, bId = remaining[i][1].id;
      const sa = streakMap.get(aId) || 0;
      const sb = streakMap.get(bId) || 0;
      if(sa < 2 && sb < 2){ pickIdx = i; break; }
    }
    if(pickIdx === -1){
      pickIdx = 0;
    }
    const [a,b] = remaining.splice(pickIdx,1)[0];
    ordered.push([a,b]);
    for(const id of teamIds){
      if(id === a.id || id === b.id){ streakMap.set(id, (streakMap.get(id)||0) + 1); }
      else { streakMap.set(id, 0); }
    }
  }
  return ordered;
}

export function computeStreaksUpTo(state, matchId, getFixedOrderedPairs){
  const streaks = new Map();
  for(const t of (state.teams||[])) streaks.set(t.id, { type: null, len: 0 });
  if(!state.teams || state.teams.length<2) return streaks;
  const totalRounds = Math.max(1, Number(state.rounds) || 2);
  const fixedOrdered = getFixedOrderedPairs();
  const endOn = String(matchId);
  let done = false;
  for(let r=1; r<=totalRounds && !done; r++){
    for(const [a,b] of fixedOrdered){
      const id = `${Math.min(a.id,b.id)}-${Math.max(a.id,b.id)}-r${r}`;
      const rec = state.results[id];
      if(!rec || rec.ga==null || rec.gb==null){
        if(id === endOn){ done = true; break; }
        continue;
      }
      let aType = 'D', bType = 'D';
      if(rec.ga > rec.gb){ aType='W'; bType='L'; }
      else if(rec.gb > rec.ga){ aType='L'; bType='W'; }
      const sa = streaks.get(a.id); const sb = streaks.get(b.id);
      if(sa.type === aType){ sa.len += 1; } else { sa.type = aType; sa.len = 1; }
      if(sb.type === bType){ sb.len += 1; } else { sb.type = bType; sb.len = 1; }
      if(id === endOn){ done = true; break; }
    }
  }
  return streaks;
}
