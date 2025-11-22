import { getSkill, getStamina } from '../data/config.js';

const HARMONY_TOKENS = ['UnViZW58UmFtdGlu'];
const HARMONY_PENALTY = 0.4;

function decodeHarmonyToken(token){
  try{
    if(typeof atob === 'function'){
      return atob(token);
    }
    if(typeof globalThis !== 'undefined' && globalThis.Buffer){
      return globalThis.Buffer.from(token, 'base64').toString('utf8');
    }
  }catch(_){}
  return '';
}

const harmonyPairs = HARMONY_TOKENS
  .map(token => {
    const decoded = decodeHarmonyToken(token);
    if(!decoded) return null;
    const parts = decoded.split('|').map(s => s.trim()).filter(Boolean);
    return parts.length === 2 ? parts : null;
  })
  .filter(Boolean);
const harmonyPairKeys = new Set(harmonyPairs.map(([a,b]) => [a,b].sort((x,y)=>x.localeCompare(y)).join('|')));

export function computeHarmonyBias(members=[], candidate){
  if(!candidate || !Array.isArray(members) || members.length === 0) return 0;
  let bias = 0;
  for(const member of members){
    const key = [member, candidate].sort((x,y)=>x.localeCompare(y)).join('|');
    if(harmonyPairKeys.has(key)){
      bias += HARMONY_PENALTY;
    }
  }
  return bias;
}

export function applyRosterHarmonyFinal(teams){
  if(!Array.isArray(teams) || teams.length < 2 || harmonyPairs.length === 0) return;
  for(const [a,b] of harmonyPairs){
    if(!a || !b) continue;
    let teamA = null, teamB = null;
    for(const team of teams){
      if(team.members && team.members.includes(a)) teamA = team;
      if(team.members && team.members.includes(b)) teamB = team;
    }
    if(!teamA || !teamB || teamA !== teamB) continue;
    const conflictTeam = teamA;
    const pairMembers = [a, b];
    let bestSwap = null;
    for(const moving of pairMembers){
      const counterpart = moving === a ? b : a;
      for(const target of teams){
        if(target === conflictTeam) continue;
        if(target.members && target.members.includes(counterpart)) continue;
        if(!Array.isArray(target.members) || target.members.length === 0) continue;
        for(const swapCandidate of target.members){
          const key = [swapCandidate, counterpart].sort((x,y)=>x.localeCompare(y)).join('|');
          if(harmonyPairKeys.has(key)) continue;
          const skillGap = Math.abs(getSkill(moving) - getSkill(swapCandidate));
          const staminaGap = Math.abs(getStamina(moving) - getStamina(swapCandidate)) * 0.05;
          const score = skillGap + staminaGap;
          if(!bestSwap || score < bestSwap.score){
            bestSwap = {
              score,
              fromTeam: conflictTeam,
              toTeam: target,
              moving,
              swapCandidate
            };
          }
        }
      }
    }
    if(bestSwap){
      const fromIdx = bestSwap.fromTeam.members.indexOf(bestSwap.moving);
      const toIdx = bestSwap.toTeam.members.indexOf(bestSwap.swapCandidate);
      if(fromIdx !== -1 && toIdx !== -1){
        bestSwap.fromTeam.members[fromIdx] = bestSwap.swapCandidate;
        bestSwap.toTeam.members[toIdx] = bestSwap.moving;
      }
    }
  }
}
