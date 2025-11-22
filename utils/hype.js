import { showToast } from './notify.js';

const HYPE_MESSAGES = [
  'Team {TEAM} is on fire!',
  '{TEAM} turning up the heat!',
  '{TEAM} are flying!',
  'Unstoppable {TEAM}!',
  '{TEAM} with a statement win!',
  '{TEAM} grind it out!',
  'Clinical from {TEAM}.',
  '{TEAM} take the spoils!',
  '{TEAM} are cooking!',
  '{TEAM} bringing the smoke!',
  'Another one for {TEAM}!',
  '{TEAM} mean business!',
  '{TEAM} hit different today!',
  '{TEAM} ice cold.',
  '{TEAM} lock it in.',
  '{TEAM} with the dagger!',
  '{TEAM} seal the deal!',
  'Big dub for {TEAM}!',
  '{TEAM} with the clean finish!',
  '{TEAM} levels up!',
  'Momentum with {TEAM}!',
  '{TEAM} marches on!',
  'Vintage {TEAM}!',
];
const DRAW_MESSAGES = [
  'All square — what a battle!',
  'Deadlock! Nothing between them.',
  'Honors even!',
  'Stalemate — tight one.',
  'Shared spoils!',
];

export function showHypeToastForMatch({ matchId, state, computeStreaksUpTo, getFixedOrderedPairs }){
  const rec = state.results[matchId];
  if(!rec) return;
  const { ga, gb } = rec;
  if(ga === gb){
    const msg = DRAW_MESSAGES[Math.floor(Math.random()*DRAW_MESSAGES.length)];
    showToast(msg);
    return;
  }
  const fixedOrdered = getFixedOrderedPairs(); // ensure deterministic order exists
  const streaks = computeStreaksUpTo(matchId);
  const aTeam = state.teams.find(t => t.id === rec.a);
  const bTeam = state.teams.find(t => t.id === rec.b);
  if(!aTeam || !bTeam) return;
  const aSt = streaks.get(aTeam.id) || { type:null, len:0 };
  const bSt = streaks.get(bTeam.id) || { type:null, len:0 };
  const winner = ga > gb ? aTeam : bTeam;
  const loser = ga > gb ? bTeam : aTeam;
  const wSt = ga > gb ? aSt : bSt;
  const lSt = ga > gb ? bSt : aSt;
  const WNAME = String(winner.name || 'Winners').toUpperCase();
  const LNAME = String(loser.name || 'Losers').toUpperCase();

  let line = '';
  if(wSt.type === 'W' && wSt.len >= 2){
    const streakStr = (wSt.len === 2) ? 'two in a row' : (wSt.len === 3 ? 'a hat‑trick of wins' : `${wSt.len} straight`);
    const winStreakMsgs = [
      `TEAM ${WNAME} keep rolling — ${streakStr}!`,
      `TEAM ${WNAME} extend the streak: ${streakStr}!`,
      `Unbeatable! TEAM ${WNAME} now on ${streakStr}.`,
      `Momentum with TEAM ${WNAME}: ${streakStr}!`,
    ];
    line = winStreakMsgs[Math.floor(Math.random()*winStreakMsgs.length)];
  } else {
    const winMsgs = [
      `TEAM ${WNAME} take it!`,
      `Big win for TEAM ${WNAME}!`,
      `Clinical from TEAM ${WNAME}.`,
      `Statement win by TEAM ${WNAME}!`,
      `TEAM ${WNAME} seal the deal!`,
    ];
    line = winMsgs[Math.floor(Math.random()*winMsgs.length)];
  }

  if(lSt.type === 'L' && lSt.len >= 2){
    const losingStr = (lSt.len === 2) ? 'two on the bounce' : `${lSt.len} straight`;
    const loseMsgs = [
      ` Tough stretch for TEAM ${LNAME} — ${losingStr}.`,
      ` TEAM ${LNAME} drop ${losingStr}.`,
      ` Skid continues for TEAM ${LNAME}: ${losingStr}.`,
    ];
    line += loseMsgs[Math.floor(Math.random()*loseMsgs.length)];
  } else {
    const singleLoseMsgs = [
      ` Tough one for TEAM ${LNAME}.`,
      ` TEAM ${LNAME} will look to bounce back.`,
      ` TEAM ${LNAME} just short today.`,
    ];
    line += singleLoseMsgs[Math.floor(Math.random()*singleLoseMsgs.length)];
  }

  showToast(line);
}
