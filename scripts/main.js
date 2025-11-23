import {
  COLORS,
  MAX_ATTENDEES,
  getSkill,
  getStamina,
  STAMINA,
  DEFAULT_STAMINA,
  SKILLS,
  DEFAULT_SKILL,
  RATING_STEP,
  normalizeRating,
  snapToRatingStep
} from './data/config.js';
import {
  state,
  loadState,
  saveAttendees,
  savePlayers,
  saveTeams,
  saveTimestamp,
  saveResults,
  saveRounds,
  getTrackScorersPref,
  setTrackScorersPref,
  getPrevRanks,
  KEYS,
  savePrevRanksFromRows
} from './state/storage.js';
import { computeStableSeedFromAttendees, shuffleSeeded } from './utils/random.js';
import { balanceSkillToTargets, balanceStaminaEqualSkill } from './logic/balance.js';
import { reportWarning } from './utils/validation.js';
import { logError } from './utils/logging.js';
import { parseCSVSimple, aggregateAllTime, countUniqueSessions, buildAllTimeSeries, buildAllTimeGoalSeries, buildAllTimeByDate, computeAllTimeBadges } from './logic/alltime.js';
import { buildEmailSummaryText, buildEmailSubject, buildMailtoLink } from './logic/share.js';
import { renderAllTimeView } from './render/alltimeView.js';
import { buildLatestSyncPill, buildAllTimeHeaderCards } from './render/alltimeHeader.js';
import { renderRoster } from './render/players.js';
import { renderTeams } from './render/teams.js';
import { renderLeaderboard } from './render/leaderboard.js';
import { renderSchedule } from './render/matches.js';
import { attachResultModal } from './modals/result.js';
import { attachResetModal } from './modals/reset.js';
import { attachTeamCountModal } from './modals/teamCount.js';
import { attachEndTournamentModal } from './modals/endTournament.js';
import { attachRemoveRoundModal } from './modals/removeRound.js';
import { attachAddPlayerModal } from './modals/addPlayer.js';
import { attachPlayerHistoryModal } from './modals/playerHistory.js';
import {
  formatDateShort,
  avgLastN,
  getPlayerPointsAcrossDates,
  getPlayerGoalsAcrossDates,
  getPlayerRankAcrossDates,
  buildBarChart,
  buildLineChart,
  getPlayerBadges,
  getPlayerBadgeHistory,
  buildPlayerInsightCards
} from './logic/playerHistory.js';
import { showToast, launchConfetti } from './utils/notify.js';
import { showHypeToastForMatch as showHypeToastExternal } from './utils/hype.js';
import { orderRoundPairings, computeStreaksUpTo as computeStreaksUpToLogic } from './logic/schedule.js';
import { computeHarmonyBias, applyRosterHarmonyFinal } from './logic/harmony.js';

// Modal/renderer instances (initialized later)
let resultModal = null;
let resetModal = null;
let teamCountModal = null;
let endTournamentModal = null;
let removeRoundModal = null;
let addPlayerModal = null;
let playerHistoryModal = null;


function clampPlayLimit(){
  const over = state.attendees.length > MAX_ATTENDEES;
  if(over){
    state.attendees = state.attendees.slice(0, MAX_ATTENDEES);
    saveAttendees();
  }
  const notice = document.getElementById('limitNotice');
  if(notice){
    notice.textContent = `Limit reached: maximum ${MAX_ATTENDEES} players.`;
  }
  if(state.attendees.length >= MAX_ATTENDEES){
    notice.style.display = '';
  } else {
    notice.style.display = 'none';
  }
}

// ----- Rendering -----

function createListItem(name, isSelected){
  const div = document.createElement('div');
  div.className = 'item';
  div.setAttribute('role','listitem');
  const locked = state.teams && state.teams.length>0;
  div.setAttribute('draggable', 'false');
  div.dataset.name = name;
  div.dataset.side = isSelected ? 'playing' : 'not';

  // state icon
  const icon = document.createElement('span');
  icon.textContent = isSelected ? '✓' : '';
  icon.style.minWidth = '16px';

  const label = document.createElement('div');
  label.textContent = name;
  label.style.flex = '1';

  if(isSelected){ div.classList.add('selected'); }

  // Click anywhere on item toggles
  div.tabIndex = 0;
  const onToggle = () => {
    if(state.teams && state.teams.length>0) return; // locked
    if(state.attendees.includes(name)) { moveToNot(name); } else { moveToPlay(name); }
  };
  div.addEventListener('click', (e)=>{ onToggle(); });
  div.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); onToggle(); }
  });

  // Disable DnD for simplified UI
  div.addEventListener('dragstart', (e)=>{ e.preventDefault(); });

  div.appendChild(label);
  div.appendChild(icon);
  return div;
}

function setupDnD(){ /* DnD disabled in single-list selection UI */ }



// Order pairings within a round to avoid any team playing 3 matches in a row across the schedule
function emailSummary(appState, computeGoalStatsFn){
  const subject = buildEmailSubject(new Date());
  const body = buildEmailSummaryText(appState, computeGoalStatsFn);
  const to = 'rubenvdkamp@gmail.com';
  const mailto = buildMailtoLink(to, subject, body);
  window.location.href = mailto;
}

// Aggregate per-player goal totals and appearance counts for the active tournament
function computeGoalStats(){
  const totals = new Map();
  const playedCounts = new Map();
  if(!state.teams || state.teams.length === 0) return { totals, playedCounts };
  const teamById = new Map(state.teams.map(t => [t.id, t]));
  const isGuest = (name)=> String(name||'').trim().toLowerCase() === 'guest player';
  for(const key of Object.keys(state.results || {})){
    const r = state.results[key]; if(!r) continue;
    const { a, b, ga, gb, gpa, gpb } = r || {};
    if(gpa){
      for(const [name, n] of Object.entries(gpa)){
        if(n>0 && !isGuest(name)){
          totals.set(name, (totals.get(name)||0) + n);
        }
      }
    }
    if(gpb){
      for(const [name, n] of Object.entries(gpb)){
        if(n>0 && !isGuest(name)){
          totals.set(name, (totals.get(name)||0) + n);
        }
      }
    }
    const played = ga != null && gb != null;
    if(played){
      const teamA = teamById.get(a);
      const teamB = teamById.get(b);
      if(teamA){
        for(const name of teamA.members){
          playedCounts.set(name, (playedCounts.get(name)||0) + 1);
        }
      }
      if(teamB){
        for(const name of teamB.members){
          playedCounts.set(name, (playedCounts.get(name)||0) + 1);
        }
      }
    }
  }
  return { totals, playedCounts };
}

// Build a concise summary of what is shown on the Leaderboard
function buildShareText(){
  if(!state.teams || state.teams.length===0) return 'Futsal results';
  // Leaderboard data
  const byId = new Map(state.teams.map(t => [t.id, { team: t, pts: 0, played: 0, gf: 0, ga: 0 }]));
  for(const key of Object.keys(state.results || {})){
    const r = state.results[key]; if(!r) continue;
    const { a, b, ga, gb } = r;
    if(ga == null || gb == null) continue;
    const A = byId.get(a); const B = byId.get(b); if(!A||!B) continue;
    A.played++; B.played++;
    A.gf += ga; B.gf += gb;
    A.ga += gb; B.ga += ga;
    if(ga > gb) A.pts += 3; else if(gb > ga) B.pts += 3; else { A.pts += 1; B.pts += 1; }
  }
  const rows = Array.from(byId.values()).sort((x,y)=> y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.team.name.localeCompare(y.team.name));
  let winnerLine = 'Winner';
  if(rows.length){
    const topPts = rows[0].pts;
    const topGD = (rows[0].gf - rows[0].ga);
    const coWinners = rows.filter(r => r.pts === topPts && ((r.gf - r.ga) === topGD));
    const names = coWinners.map(r => r.team.name);
    const list = names.length === 1 ? names[0]
      : (names.length === 2 ? `${names[0]} & ${names[1]}`
         : `${names.slice(0, -1).join(', ')} & ${names[names.length-1]}`);
    winnerLine = `${names.length > 1 ? 'WINNERS' : 'WINNER'}: ${list}`;
  }
  const lines = [];
  lines.push(`🏆 ${winnerLine}`);
  lines.push('Standings:');
  rows.forEach((r, i)=>{
    const gd = r.gf - r.ga; const gdStr = gd>=0? `+${gd}`: `${gd}`;
    const members = r.team.members.join(', ');
    lines.push(`${i+1}) ${r.team.name} — ${r.pts} pts (GD ${gdStr}) • ${members}`);
  });
  // Include Top Scorers section if it is visible in the view
  const scorerTotals = new Map();
  const isGuest = (name)=> String(name||'').trim().toLowerCase() === 'guest player';
  for(const key of Object.keys(state.results || {})){
    const r = state.results[key]; if(!r) continue;
    const { gpa, gpb } = r;
    if(gpa){ for(const [name, n] of Object.entries(gpa)){ if(n>0 && !isGuest(name)){ scorerTotals.set(name, (scorerTotals.get(name)||0)+n); } } }
    if(gpb){ for(const [name, n] of Object.entries(gpb)){ if(n>0 && !isGuest(name)){ scorerTotals.set(name, (scorerTotals.get(name)||0)+n); } } }
  }
  const scorerRows = Array.from(scorerTotals.entries()).filter(([_,n])=> n>0).sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]));
  if(scorerRows.length){
    lines.push('Top Scorers:');
    const top = scorerRows.slice(0, 8);
    lines.push(top.map(([n,g])=> `${n} ${g}`).join(', '));
  }
  return lines.join('\n');
}

// CSV escaper for fields (wrap in quotes and escape quotes)
function csvEscape(s){
  const str = String(s ?? '');
  if(/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

// Build per-player points+goals summary as CSV: Date,Player,Points,Goals

function updateGenError(msg){
  const el = document.getElementById('genError');
  if(msg){ el.textContent = msg; el.style.display = ''; }
  else { el.textContent=''; el.style.display='none'; }
}

// ----- Modal: Choose team count when n=11 -----
function generateTeamsOverride(tOverride){
  const n = state.attendees.length;
  if(!state.timestamp){ state.timestamp = Date.now(); saveTimestamp(); }
  const t = tOverride;
  const stableSeed = computeStableSeedFromAttendees(state.attendees);
  const shuffled = shuffleSeeded(state.attendees, stableSeed);
  // Average stamina across current attendees for stamina-aware tie-breaks
  const totalStaminaOv = state.attendees.reduce((s, name)=> s + getStamina(name), 0);
  const avgStaminaOv = n > 0 ? (totalStaminaOv / n) : DEFAULT_STAMINA;
  // Evenly distribute capacities for override
  const base = Array(t).fill(Math.floor(n/t));
  const r = n % t;
  for(let i=t-r; i<t; i++) if(i>=0 && i<t) base[i] += 1;
  const colors = COLORS.slice(0, Math.min(t, COLORS.length));
  const totalSkillOv = state.attendees.reduce((s, name)=> s + getSkill(name), 0);
  const avgSkillOv = totalSkillOv / n;
  const teamInfos = base.map((size, i) => ({
    cap: size,
    target: size * avgSkillOv,
    skillSum: 0,
    staminaSum: 0,
    team: { id: i+1, name: colors[i].name, color: colors[i].hex, members: [] }
  }));
  const orderIndex = new Map(shuffled.map((name, idx) => [name, idx]));
  const playersSorted = [...state.attendees].sort((a,b)=>{
    const sa = getSkill(a), sb = getSkill(b);
    if(sb !== sa) return sb - sa;
    return (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0);
  });
  for(const player of playersSorted){
    const s = getSkill(player);
    const st = getStamina(player);
    let best = -1;
    let bestScore = -Infinity;
    for(let i=0;i<teamInfos.length;i++){
      const info = teamInfos[i];
      if(info.team.members.length < info.cap){
        const def = info.target - info.skillSum;
        const harmonyBias = computeHarmonyBias(info.team.members, player);
        const score = def - harmonyBias;
        if(score > bestScore + 1e-9){ bestScore = score; best = i; }
        else if(Math.abs(score - bestScore) <= 1e-9 && best !== -1){
          const bi = teamInfos[best];
          // Stamina-aware tie-break: only within skill tie
          if(st >= avgStaminaOv){
            // Prefer smaller-capacity team when player's stamina is high
            if(info.cap < bi.cap) { best = i; }
            else if(info.cap === bi.cap){
              // If capacities equal, prefer team with lower current staminaSum to even out
              if(info.staminaSum < bi.staminaSum) best = i;
            }
          }
          // Existing deterministic tie-breakers
          const bestIdx = best; // might have changed above
          const bi2 = teamInfos[bestIdx];
          if(info.team.members.length < bi2.team.members.length) best = i;
          else if(info.team.members.length === bi2.team.members.length && info.skillSum < bi2.skillSum) best = i;
          else if(info.team.members.length === bi2.team.members.length && info.skillSum === bi2.skillSum && i < bestIdx) best = i;
        }
      }
    }
    if(best === -1) best = 0;
    const tgt = teamInfos[best];
    tgt.team.members.push(player);
    tgt.skillSum += s;
    tgt.staminaSum += st;
  }
  state.teams = teamInfos.map(x => x.team);
  // Post-pass: skill balancer then stamina smoothing (equal-skill swaps)
  try { balanceSkillToTargets(state.teams, state.attendees, getSkill); } catch(_) { /* best-effort */ }
  try { balanceStaminaEqualSkill(state.teams, getSkill, getStamina); } catch(_) { /* best-effort */ }
  try { applyRosterHarmonyFinal(state.teams); } catch(_) { /* best-effort */ }
  state.results = {};
  state.rounds = 2;
  localStorage.removeItem(KEYS.prevRanks);
  saveTeams(); saveResults(); saveRounds();
  renderTeams(state); renderRosterUI(); renderSchedule(state, { resultModal, orderRoundPairings, computeStableSeedFromAttendees }); renderLeaderboard(state);
  switchTab('teams'); updateTabsUI();
}

// Compute a sizes descriptor string using even distribution (e.g., 11 with 2 -> 6-5, with 3 -> 4-4-3)
function sizesDesc(n, t){
  const base = Array(t).fill(Math.floor(n/t));
  const r = n % t;
  for(let i=t-r; i<t; i++) if(i>=0 && i<t) base[i] += 1;
  // Present in descending order for readability (e.g., 6-5, 4-4-3, 4-4-4-3)
  return base.sort((a,b)=> b-a).join('-');
}

// ----- Actions -----
function moveToPlay(name){
  if(state.attendees.includes(name)) return;
  if(state.attendees.length >= MAX_ATTENDEES){
    clampPlayLimit();
    return;
  }
  state.attendees.push(name);
  saveAttendees();
  // keep teams if any? Spec doesn't forbid changing attendees post teams; leave teams intact.
  clampPlayLimit();
  renderRosterUI();
  syncGenerateButton();
  updateTabsUI();
}
function moveToNot(name){
  const idx = state.attendees.indexOf(name);
  if(idx>=0){
    state.attendees.splice(idx,1);
    saveAttendees();
    clampPlayLimit();
    renderRosterUI();
    syncGenerateButton();
    updateTabsUI();
  }
}

const rosterActions = {
  addPlayer: moveToPlay,
  removePlayer: moveToNot,
  movePlayer: ()=>{}
};
function renderRosterUI(){
  renderRoster(state, rosterActions);
}

function closeResultModal(){
  try{
    if(resultModal && typeof resultModal.close === 'function'){
      resultModal.close();
    }
    const overlay = document.getElementById('overlay');
    if(overlay){ overlay.hidden = true; }
  }catch(_){}
}

function syncGenerateButton(){
  const btn = document.getElementById('btnGenerateBottom');
  if(!btn) return;
  const hasTeams = state.teams && state.teams.length > 0;
  const minNeeded = 8;
  const enough = (state.attendees || []).length >= minNeeded;
  if(hasTeams){
    btn.disabled = true;
    updateGenError('Players are locked — teams have been generated. Tap Start new match to generate again.');
    return;
  }
  btn.disabled = !enough;
  updateGenError(enough ? '' : `Select at least ${minNeeded} players to generate teams.`);
}

function resetAll(){
  state.attendees = [];
  state.teams = [];
  state.results = {};
  state.timestamp = Date.now();
  state.rounds = 2;
  saveAttendees();
  saveTeams();
  saveResults();
  saveTimestamp();
  saveRounds();
  updateGenError('');
  closeResultModal();
  renderRosterUI();
  renderTeams(state);
  renderSchedule(state, { resultModal, orderRoundPairings, computeStableSeedFromAttendees });
  renderLeaderboard(state);
  switchTab('players');
  updateTabsUI();
  syncGenerateButton();
}

function addAdditionalRound(){
  if(!state.teams || state.teams.length < 2) return;
  state.rounds = Math.max(1, Number(state.rounds) || 2) + 1;
  state.celebrated = false;
  saveRounds();
  renderSchedule(state, { resultModal, orderRoundPairings, computeStableSeedFromAttendees });
}

// Utility: does a given round have any recorded results?
function roundHasResults(r){
  for(const key of Object.keys(state.results || {})){
    const rec = state.results[key];
    if(rec && Number(rec.round) === Number(r) && rec.ga != null && rec.gb != null){
      return true;
    }
  }
  return false;
}

function removeLastRound(r){
  if(roundHasResults(r)){
    // Suppress toast; rely on modal messaging/disabled confirm
    return;
  }
  // Remove all results for round r, decrement rounds, save, and re-render
  const keys = Object.keys(state.results || {});
  for(const k of keys){
    const rec = state.results[k];
    if(rec && Number(rec.round) === Number(r)){
      delete state.results[k];
    }
  }
  state.rounds = Math.max(2, Number(r) - 1); // ensure rounds never drop below 2 via this action
  state.celebrated = false;
  saveResults();
  saveRounds();
  renderSchedule(state, { resultModal, orderRoundPairings, computeStableSeedFromAttendees });
  renderLeaderboard(state);
}

// clearTeams replaced by resetAll (single reset action)

function computeTeamCount(n){
  return Math.max(1, Math.min(4, Math.floor(n/4)));
}

function getPairings(){
  const pairs = [];
  if(!state.teams) return pairs;
  for(let i=0;i<state.teams.length;i++){
    for(let j=i+1;j<state.teams.length;j++){
      pairs.push([state.teams[i], state.teams[j]]);
    }
  }
  return pairs;
}

function areAllMatchesScored(){
  if(!state.teams || state.teams.length < 2) return false;
  const pairings = getPairings();
  const rounds = Math.max(1, Number(state.rounds) || 2);
  for(let r=1;r<=rounds;r++){
    for(const [a,b] of pairings){
      const id = `${Math.min(a.id,b.id)}-${Math.max(a.id,b.id)}-r${r}`;
      const rec = state.results[id];
      if(!rec || rec.ga == null || rec.gb == null) return false;
    }
  }
  return true;
}

function celebrateWinner(){
  // Compute winners (supports co-winners on equal Pts and GD)
  const byId = new Map(state.teams.map(t => [t.id, { team: t, pts: 0, played: 0, gf: 0, ga: 0 }]));
  for(const key of Object.keys(state.results || {})){
    const r = state.results[key];
    if(!r) continue;
    const { a, b, ga, gb } = r;
    if(ga == null || gb == null) continue;
    const A = byId.get(a); const B = byId.get(b);
    if(!A || !B) continue;
    A.played++; B.played++;
    A.gf += ga; B.gf += gb;
    A.ga += gb; B.ga += ga;
    if(ga > gb){ A.pts += 3; } else if(gb > ga){ B.pts += 3; } else { A.pts += 1; B.pts += 1; }
  }
  const rows = Array.from(byId.values()).sort((x,y)=> y.pts - x.pts || y.gf - x.gf || x.team.name.localeCompare(y.team.name));
  if(rows.length){
    const topPts = rows[0].pts;
    const topGD = (rows[0].gf - (rows[0].ga || 0));
    const coWinners = rows.filter(r => r.pts === topPts && ((r.gf - (r.ga || 0)) === topGD));
    const names = coWinners.map(r => r.team.name.toUpperCase());
    const list = names.length === 1 ? names[0]
      : (names.length === 2 ? `${names[0]} & ${names[1]}`
         : `${names.slice(0, -1).join(', ')} & ${names[names.length-1]}`);
    showToast(`🎉 ${names.length > 1 ? 'WINNERS' : 'WINNER'}: ${list}!!`, 'winner');
  }
  launchConfetti();
}

// Schedule helper used by streak computation and sharing
function getFixedOrderedPairs(){
  if(!state.teams || state.teams.length < 2) return [];
  const pairings = [];
  for(let i=0;i<state.teams.length;i++){
    for(let j=i+1;j<state.teams.length;j++){
      pairings.push([state.teams[i], state.teams[j]]);
    }
  }
  const stableSeed = computeStableSeedFromAttendees(state.attendees || []);
  const baseStreak = new Map(state.teams.map(t => [t.id, 0]));
  const baseOrdered = orderRoundPairings(pairings, baseStreak, stableSeed);
  const totalRounds = Math.max(1, Number(state.rounds) || 2);
  function createsTriple(order){
    const ids = state.teams.map(t=>t.id);
    const streak = new Map(ids.map(id=>[id,0]));
    for(let r=0;r<Math.min(totalRounds,3);r++){
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
  function rotate(arr, k){ const n=arr.length; const out=new Array(n); for(let i=0;i<n;i++){ out[i]=arr[(i+k)%n]; } return out; }
  let fixedOrdered = baseOrdered;
  if(createsTriple(fixedOrdered)){
    const rev = [...baseOrdered].reverse();
    if(!createsTriple(rev)) fixedOrdered = rev; else {
      for(let k=1;k<baseOrdered.length;k++){ const rot = rotate(baseOrdered, k); if(!createsTriple(rot)){ fixedOrdered = rot; break; } }
    }
  }
  return fixedOrdered;
}

// Compute current W/L/D streaks up to and including a specific match
function computeStreaksUpTo(matchId){
  return computeStreaksUpToLogic(state, matchId, getFixedOrderedPairs);
}

function showHypeToastForMatch(matchId, aTeam, bTeam){
  showHypeToastExternal({
    matchId,
    state,
    computeStreaksUpTo,
    getFixedOrderedPairs
  });
}

function generateTeams(){
  const n = state.attendees.length;
  if(n < 8){
    updateGenError('Need at least 8 attendees to generate teams.');
    return;
  }
  updateGenError('');
  if(n === 11){
    if(teamCountModal){
      teamCountModal.open({ options:[2,3], count: 11 });
      return;
    }
    return;
  }
  // For 15 players, default to 3 teams (5-5-5); no choice modal
  if(!state.timestamp){ state.timestamp = Date.now(); saveTimestamp(); }

  const t = computeTeamCount(n);
  const stableSeed = computeStableSeedFromAttendees(state.attendees);
  const shuffled = shuffleSeeded(state.attendees, stableSeed);
  // Average stamina across current attendees for stamina-aware tie-breaks
  const totalStamina = state.attendees.reduce((s, name)=> s + getStamina(name), 0);
  const avgStamina = n > 0 ? (totalStamina / n) : DEFAULT_STAMINA;
  // target sizes: base 4, last r teams +1
  const base = Array(t).fill(4);
  const r = n - 4*t;
  for(let i=t-r; i<t; i++) if(i>=0 && i<t) base[i] += 1;

  const colors = COLORS.slice(0, Math.min(t, COLORS.length));
  // Build teams with capacity and targets based on average skill per slot
  const totalSkill = state.attendees.reduce((s, name)=> s + getSkill(name), 0);
  const avgSkill = totalSkill / n;
  const teamInfos = base.map((size, i) => ({
    cap: size,
    target: size * avgSkill,
    skillSum: 0,
    staminaSum: 0,
    team: {
      id: i+1,
      name: colors[i].name,
      color: colors[i].hex,
      members: []
    }
  }));

  // Assign players sorted by skill desc (tie-broken by seeded shuffle)
  // Choose the team with the greatest deficit (target - currentSum), respecting capacity
  const orderIndex = new Map(shuffled.map((name, idx) => [name, idx]));
  const playersSorted = [...state.attendees].sort((a,b)=>{
    const sa = getSkill(a), sb = getSkill(b);
    if(sb !== sa) return sb - sa; // higher skill first
    return (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0); // deterministic tie-breaker
  });
  for(const player of playersSorted){
    const s = getSkill(player);
    const st = getStamina(player);
    let best = -1;
    let bestScore = -Infinity;
    for(let i=0;i<teamInfos.length;i++){
      const info = teamInfos[i];
      if(info.team.members.length < info.cap){
        const def = info.target - info.skillSum;
        const harmonyBias = computeHarmonyBias(info.team.members, player);
        const score = def - harmonyBias;
        if(score > bestScore + 1e-9){ bestScore = score; best = i; }
        else if(Math.abs(score - bestScore) <= 1e-9 && best !== -1){
          const bi = teamInfos[best];
          // Stamina-aware tie-break: only within skill tie
          if(st >= avgStamina){
            // Prefer smaller-capacity team when player's stamina is high
            if(info.cap < bi.cap) { best = i; }
            else if(info.cap === bi.cap){
              // If capacities equal, prefer team with lower current staminaSum to even out
              if(info.staminaSum < bi.staminaSum) best = i;
            }
          }
          // Existing deterministic tie-breakers
          const bestIdx = best; // may have changed above
          const bi2 = teamInfos[bestIdx];
          if(info.team.members.length < bi2.team.members.length) best = i;
          else if(info.team.members.length === bi2.team.members.length && info.skillSum < bi2.skillSum) best = i;
          else if(info.team.members.length === bi2.team.members.length && info.skillSum === bi2.skillSum && i < bestIdx) best = i;
        }
      }
    }
    if(best === -1) best = 0;
    const tgt = teamInfos[best];
    tgt.team.members.push(player);
    tgt.skillSum += s;
    tgt.staminaSum += st;
  }

  state.teams = teamInfos.map(x => x.team);
  // Post-pass: skill balancer then stamina smoothing (equal-skill swaps)
  try { balanceSkillToTargets(state.teams, state.attendees, getSkill); } catch(_) { /* best-effort */ }
  try { balanceStaminaEqualSkill(state.teams, getSkill, getStamina); } catch(_) { /* best-effort */ }
  try { applyRosterHarmonyFinal(state.teams); } catch(_) { /* best-effort */ }
  state.results = {};
  state.rounds = 2;
  saveTeams();
  saveResults();
  saveRounds();
  renderTeams(state);
  renderRosterUI();
  renderSchedule(state, { resultModal, orderRoundPairings, computeStableSeedFromAttendees });
  renderLeaderboard(state);
  switchTab('teams');
  updateTabsUI();
}

function copyTeams(){
  if(!navigator.clipboard){ return; }
  const lines = [];
  for(const t of state.teams){
    lines.push(`${t.name}: ${t.members.join(', ')}`);
  }
  const txt = lines.join('\n');
  navigator.clipboard.writeText(txt).then(()=>{
    const btn = document.getElementById('btnCopy');
    if(btn){
      const old = btn.textContent; btn.textContent = 'Copied!';
      setTimeout(()=> btn.textContent = old, 1200);
    }
  });
}




const BADGE_CONFIG = {
  latestTop: { icon:'⭐', label:'Session Top Scorer', short:'Session Top Scorer', desc:'Led the latest session in goals.' },
  playmaker: { icon:'🎖️', label:'Playmaker', short:'Playmaker', desc:'Highest points+goals contribution in the latest session.' },
  allTimeTop: { icon:'🥇', label:'All-Time Topscorer', short:'All-Time Topscorer', desc:'Most total goals across all sessions.' },
  clutch: { icon:'🏆', label:'Session Ace', short:'Session Ace', desc:'Most sessions finishing with the highest points.' },
  hatTrick: { icon:'⚽', label:'Three In A Row', short:'Three In A Row', desc:'Scored in 3+ consecutive goal-tracked sessions.' },
  fourRow: { icon:'⚽', label:'Four In A Row', short:'Four In A Row', desc:'Scored in 4+ consecutive goal-tracked sessions.' },
  fiveRow: { icon:'⚽', label:'Five In A Row', short:'Five In A Row', desc:'Scored in 5+ consecutive goal-tracked sessions.' },
  sixRow: { icon:'⚽', label:'Six In A Row', short:'Six In A Row', desc:'Scored in 6+ consecutive goal-tracked sessions.' },
  sevenRow: { icon:'⚽', label:'Seven In A Row', short:'Seven In A Row', desc:'Scored in 7+ consecutive goal-tracked sessions.' },
  eightRow: { icon:'⚽', label:'Eight In A Row', short:'Eight In A Row', desc:'Scored in 8+ consecutive goal-tracked sessions.' },
  nineRow: { icon:'⚽', label:'Nine In A Row', short:'Nine In A Row', desc:'Scored in 9+ consecutive goal-tracked sessions.' },
  tenRow: { icon:'⚽', label:'Ten In A Row', short:'Ten In A Row', desc:'Scored in 10+ consecutive goal-tracked sessions.' },
  sharpshooter: { icon:'🎯', label:'Sharpshooter', short:'Sharpshooter', desc:'Averages 2+ goals per tracked session.' },
  ironMan: { icon:'🛡️', label:'Iron Man', short:'Iron Man', desc:'Current streak of 6+ consecutive sessions.' },
  marathon: { icon:'🏃‍♂️', label:'Marathon Man', short:'Marathon Man', desc:'Current streak of 15 consecutive sessions.' },
  addict: { icon:'🔥', label:'Addict', short:'Addict', desc:'90%+ attendance this season.' },
  clinical: { icon:'🥾', label:'Clinical Finisher', short:'Clinical Finisher', desc:'Scored 5+ goals in a single session.' },
  elite: { icon:'🧠', label:'Elite', short:'Elite', desc:'On the winning team in 3 consecutive sessions.' },
  master: { icon:'🥋', label:'Master', desc:'On the winning team in 4 consecutive sessions.', short:'Master' },
  legend: { icon:'🦁', label:'Legend', short:'Legend', desc:'On the winning team in 5 consecutive sessions.' },
  rocket: { icon:'📈', label:'Rocket Rank', short:'Rocket Rank', desc:'Improved rank by 5+ positions since last session.' },
  form: { icon:'⚡', label:'On Fire', short:'On Fire', desc:'Largest positive form swing (last 3 vs career PPM).' },
  coldStreak: { icon:'🥶', label:'Cold Streak', short:'Cold Streak', desc:'Largest negative form swing (last 3 vs career PPM).' },
  mvp: { icon:'👑', label:'Most Valuable Player', short:'Most Valuable Player', desc:'Highest Pts/Session with ≥60% attendance.' },
};
const TROPHY_DESC = {
  latestTop: 'Held the Session Top Scorer badge for {N} sessions.',
  playmaker: 'Held the Playmaker badge for {N} sessions.',
  allTimeTop: 'Held the All-Time Topscorer badge for {N} sessions.',
  mvp: 'Held the Most Valuable Player badge for {N} sessions.',
  form: 'Held the On Fire badge for {N} sessions.',
  ironMan: 'Completed a 6+ session attendance streak.',
  marathon: 'Completed a 15-session attendance streak.',
  clinical: 'Held the Clinical Finisher badge for {N} sessions.',
  elite: 'On the winning team in 3 consecutive sessions.',
  master: 'On the winning team in 4 consecutive sessions.',
  legend: 'On the winning team in 5 consecutive sessions.',
  clutch: 'Most sessions finishing with the highest points.',
  hatTrick: 'Scored in 3+ consecutive goal-tracked sessions.',
  fourRow: 'Scored in 4+ consecutive goal-tracked sessions.',
  fiveRow: 'Scored in 5+ consecutive goal-tracked sessions.',
  sixRow: 'Scored in 6+ consecutive goal-tracked sessions.',
  sevenRow: 'Scored in 7+ consecutive goal-tracked sessions.',
  eightRow: 'Scored in 8+ consecutive goal-tracked sessions.',
  nineRow: 'Scored in 9+ consecutive goal-tracked sessions.',
  tenRow: 'Scored in 10+ consecutive goal-tracked sessions.',
  sharpshooter: 'Averages 2+ goals per tracked session.',
  rocket: 'Improved rank by 5+ positions since last session.',
  coldStreak: 'Largest negative form swing (last 3 vs career PPM).'
};
const BADGE_PRIORITY = ['playmaker','clutch','latestTop','allTimeTop','mvp','clinical','legend','master','elite','tenRow','nineRow','eightRow','sevenRow','sixRow','fiveRow','fourRow','hatTrick','sharpshooter','form','coldStreak','ironMan','marathon','addict','rocket'];

// ----- Wire up -----
resultModal = attachResultModal({
  state,
  getTrackScorersPref,
  setTrackScorersPref,
  saveResults,
  renderSchedule,
  renderLeaderboard,
  computeGoalStats,
  logError,
  areAllMatchesScored,
  closeOverlay: ()=>{ const overlay = document.getElementById('overlay'); if(overlay) overlay.hidden = true; },
  onTournamentComplete: ()=>{ endTournamentModal?.open(); }
});
teamCountModal = attachTeamCountModal({ sizesDesc, onSelect: generateTeamsOverride });
resetModal = attachResetModal({ resetAll });
endTournamentModal = attachEndTournamentModal({
  onAddRound: addAdditionalRound,
  onEnd: ()=>{ switchTab('leaderboard'); celebrateWinner(); state.celebrated = true; },
  lockBodyScroll: ()=>{ __openModalEl = document.getElementById('endTournamentModal'); lockBodyScroll(); },
  unlockBodyScroll: ()=>{ __openModalEl = null; unlockBodyScroll(); }
});
removeRoundModal = attachRemoveRoundModal({
  roundHasResults,
  onRemove: removeLastRound
});
addPlayerModal = attachAddPlayerModal({
  state,
  savePlayers,
  saveAttendees,
  clampPlayLimit,
  renderRoster: renderRosterUI,
  updateTabsUI,
  MAX_ATTENDEES,
  SKILLS,
  STAMINA,
  DEFAULT_SKILL,
  DEFAULT_STAMINA,
  RATING_STEP,
  normalizeRating,
  snapToRatingStep
});
playerHistoryModal = attachPlayerHistoryModal({
  getPlayerBadges,
  getPlayerBadgeHistory,
  buildPlayerInsightCards,
  getPlayerPointsAcrossDates,
  getPlayerGoalsAcrossDates,
  getPlayerRankAcrossDates,
  buildBarChart,
  buildLineChart,
  avgLastN,
  BADGE_CONFIG,
  TROPHY_DESC,
  lockBodyScroll,
  unlockBodyScroll,
  setOpenModalEl
});
document.getElementById('btnGenerateBottom').addEventListener('click', generateTeams);
const btnResetPlayersTop = document.getElementById('btnResetPlayersTop');
if(btnResetPlayersTop){ btnResetPlayersTop.addEventListener('click', ()=> resetModal?.open()); }
const btnAddPlayer = document.getElementById('btnAddPlayer');
if(btnAddPlayer){ btnAddPlayer.addEventListener('click', ()=> addPlayerModal?.open()); }

// Drop zones setup runs once; items are re-rendered each time
setupDnD();

// ----- Tabs -----
const tabs = {
  players: document.getElementById('tabPlayers'),
  teams: document.getElementById('tabTeams'),
  matches: document.getElementById('tabMatches'),
  leaderboard: document.getElementById('tabLeaderboard'),
};
const panels = {
  players: document.getElementById('playersSection'),
  teams: document.getElementById('teamsSection'),
  matches: document.getElementById('matchesSection'),
  leaderboard: document.getElementById('leaderboardSection'),
  alltime: document.getElementById('allTimeSection'),
};
let currentTab = 'players';
function switchTab(which){
  const hasTeams = state.teams && state.teams.length > 0;
  if((which === 'teams' || which === 'matches' || which === 'leaderboard') && !hasTeams) return; // disabled
  currentTab = which;
  for(const [k,btn] of Object.entries(tabs)){
    const active = k === which;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  for(const [k,el] of Object.entries(panels)){
    el.hidden = k !== which;
  }
  // Reflect active state on All-Time header button
  const btnAllTimeHeaderEl = document.getElementById('btnAllTimeHeader');
  if(btnAllTimeHeaderEl){ btnAllTimeHeaderEl.classList.toggle('active', which === 'alltime'); }
  const btnAllTimeRefreshEl = document.getElementById('btnAllTimeRefresh');
  if(btnAllTimeRefreshEl){ btnAllTimeRefreshEl.hidden = (which !== 'alltime'); }
  if(which === 'players'){
    renderRosterUI(); // ensure lock state reflected immediately
  } else if(which === 'alltime'){
    renderAllTime(true);
  }
  syncStickyOffsets();
  // Header has no explicit refresh button; All-Time reloads when opened
}
function updateTabsUI(){
  const hasTeams = state.teams && state.teams.length > 0;
  tabs.teams.disabled = !hasTeams;
  tabs.matches.disabled = !hasTeams;
  tabs.leaderboard.disabled = !hasTeams;
  const btnResetTop = document.getElementById('btnResetPlayersTop');
  const playersTopBar = document.getElementById('playersTopBar');
  if(btnResetTop){ btnResetTop.hidden = !hasTeams; }
  if(playersTopBar){ playersTopBar.style.display = hasTeams ? 'flex' : 'none'; }
  if(!hasTeams && (currentTab === 'teams' || currentTab === 'matches' || currentTab === 'leaderboard')) switchTab('players');
}
tabs.players.addEventListener('click', ()=> switchTab('players'));
tabs.teams.addEventListener('click', ()=> switchTab('teams'));
tabs.matches.addEventListener('click', ()=> switchTab('matches'));
tabs.leaderboard.addEventListener('click', ()=> switchTab('leaderboard'));
const btnAllTimeHeader = document.getElementById('btnAllTimeHeader');
if(btnAllTimeHeader){ btnAllTimeHeader.addEventListener('click', ()=> switchTab('alltime')); }
const btnAllTimeRefresh = document.getElementById('btnAllTimeRefresh');
if(btnAllTimeRefresh){ btnAllTimeRefresh.addEventListener('click', ()=> renderAllTime(true)); }

// ----- All-Time Leaderboard (CSV: ecgfutsal2025-26.txt) -----
let allTimeCache = { rows: null, warnings: [], skipped: 0, ts: 0 };
let allTimeSort = { key: 'points', dir: 'desc' }; // default: Total Points desc
// Basis for header insight cards' rank comparisons (only changes when user selects Points or Pts/Session)
let allTimeInsightBasis = 'points'; // 'points' | 'ppm'
const ALLTIME_ALPHA = 5; // smoothing factor for Pts/Session thresholds
async function renderAllTime(force=false){
  const wrap = document.getElementById('allTimeContent');
  if(!wrap) return;
  // Render guard: if cached and not forced, reuse existing DOM except sort rerenders handled elsewhere
  if(allTimeCache.rows && !force){
    // No-op; sorting handler will rebuild table only
    return;
  }
  wrap.setAttribute('aria-busy','true');
  wrap.innerHTML = '';
  const loading = document.createElement('div');
  loading.className = 'notice';
  loading.textContent = 'Loading all-time stats…';
  loading.setAttribute('role','status');
  loading.setAttribute('aria-live','polite');
  wrap.appendChild(loading);

  try{
    const { rows, warnings, skipped } = await loadAllTimeCSV(force);
    const data = rows || [];
    window.__allTimeBadges = new Map();
    const stats = aggregateAllTime(data);
    const statsMap = new Map(stats.map(s => [s.player, s]));
    sortAllTimeStats(stats);
    const totalSessions = countUniqueSessions(data);
    const series = buildAllTimeSeries(data);
    const goalSeries = buildAllTimeGoalSeries(data);
    const byDate = buildAllTimeByDate(data);
    window.__allTimeSeries = series; // cache for modal
    window.__allTimeGoalSeries = goalSeries;
    window.__allTimeByDate = byDate;
    window.__allTimeRows = data;
    const latestDate = data.map(r=>r.date).sort().slice(-1)[0];
    const preRows = data.filter(r => r.date !== latestDate);
    const preStats = aggregateAllTime(preRows);
    sortAllTimeStats(preStats);
    const preRanks = makeRankMap(preStats);
    const postRanks = makeRankMap(stats);
    window.__allTimeBadges = computeAllTimeBadges(data, byDate, statsMap, preRanks, postRanks);
    renderAllTimeView({
      container: wrap,
      stats,
      totalSessions,
      series,
      goalSeries,
      byDate,
      badges: window.__allTimeBadges,
      warnings,
      skipped,
      latestDate,
      preRows,
      preRanks,
      postRanks,
      sort: allTimeSort,
      badgePriority: BADGE_PRIORITY,
      badgeConfig: BADGE_CONFIG,
      onSort: handleAllTimeSort,
      pillBuilder: buildLatestSyncPill,
      headerCardsBuilder: (pre, rows, byD, latest, basis)=> buildAllTimeHeaderCards(pre, rows, byD, latest, allTimeInsightBasis)
    });
    // no updated timestamp shown
    wrap.setAttribute('aria-busy','false');
  }catch(err){
    wrap.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'notice error';
    msg.textContent = 'Failed to load all-time data. Ensure the file exists and is accessible.';
    msg.setAttribute('role','alert');
    msg.setAttribute('aria-live','assertive');
    wrap.appendChild(msg);
    wrap.setAttribute('aria-busy','false');
  }
}

function handleAllTimeSort(colKey){
  if(!allTimeCache.rows) return;
  if(allTimeSort.key === colKey){
    allTimeSort.dir = (allTimeSort.dir === 'asc') ? 'desc' : 'asc';
  } else {
    allTimeSort.key = colKey;
    allTimeSort.dir = (colKey === 'player') ? 'asc' : 'desc';
  }
  const container = document.getElementById('allTimeContent');
  const stats = aggregateAllTime(allTimeCache.rows);
  const statsMap = new Map(stats.map(s => [s.player, s]));
  sortAllTimeStats(stats);
  const totalSessions = countUniqueSessions(allTimeCache.rows);
  const series = buildAllTimeSeries(allTimeCache.rows);
  const goalSeries = buildAllTimeGoalSeries(allTimeCache.rows);
  const byDate = buildAllTimeByDate(allTimeCache.rows);
  window.__allTimeSeries = series; window.__allTimeGoalSeries = goalSeries; window.__allTimeByDate = byDate; window.__allTimeRows = allTimeCache.rows;
  const latestDate = allTimeCache.rows.map(r=>r.date).sort().slice(-1)[0];
  const preRows = allTimeCache.rows.filter(r => r.date !== latestDate);
  const preStats = aggregateAllTime(preRows);
  sortAllTimeStats(preStats);
  const preRanks = makeRankMap(preStats);
  const postRanks = makeRankMap(stats);
  window.__allTimeBadges = computeAllTimeBadges(allTimeCache.rows, byDate, statsMap, preRanks, postRanks);
  if(colKey === 'points' || colKey === 'ppm'){
    allTimeInsightBasis = colKey;
  }
  renderAllTimeView({
    container,
    stats,
    totalSessions,
    series,
    goalSeries,
    byDate,
    badges: window.__allTimeBadges,
    warnings: allTimeCache.warnings,
    skipped: allTimeCache.skipped,
    latestDate,
    preRows,
    preRanks,
    postRanks,
    sort: allTimeSort,
    badgePriority: BADGE_PRIORITY,
    badgeConfig: BADGE_CONFIG,
    onSort: handleAllTimeSort,
    pillBuilder: buildLatestSyncPill,
    headerCardsBuilder: (pre, rows, byD, latest, basis)=> buildAllTimeHeaderCards(pre, rows, byD, latest, allTimeInsightBasis)
  });
}

async function loadAllTimeCSV(force=false){
  // Simple cache to avoid re-fetching on tab toggles unless forced
  if(allTimeCache.rows && !force){ return allTimeCache; }
  const url = 'ecgfutsal2025-26.txt?ts=' + Date.now();
  const res = await fetch(url, { cache: 'no-store' });
  if(!res.ok){
    reportWarning('AT001', 'All-Time fetch failed', { status: res.status, statusText: res.statusText });
    throw new Error('HTTP ' + res.status);
  }
  const text = await res.text();
  const parsed = parseCSVSimple(text);
  allTimeCache = { rows: parsed.rows, warnings: parsed.warnings, skipped: parsed.skipped, ts: Date.now() };
  if(parsed.skipped > 0 || (parsed.warnings && parsed.warnings.length)){
    reportWarning('AT201', `All-Time CSV skipped ${parsed.skipped} row(s)`, parsed.warnings);
  }
  return allTimeCache;
}

function syncStickyOffsets(){
  try{
    const headerEl = document.querySelector('header');
    if(headerEl){
      const h = headerEl.getBoundingClientRect().height;
      if(h > 0){
        document.documentElement.style.setProperty('--header-height', `${Math.round(h)}px`);
      }
    }
  }catch(_){}
}

function sortAllTimeStats(stats){
  const k = allTimeSort.key; const dir = allTimeSort.dir === 'asc' ? 1 : -1;
  stats.sort((a,b)=>{
    if(k === 'player') return a.player.localeCompare(b.player) * dir;
    if(k === 'matches') return (a.matches - b.matches) * dir || a.player.localeCompare(b.player);
    if(k === 'points') return (a.points - b.points) * dir || (a.ppm - b.ppm) * dir || (a.matches - b.matches) * dir || a.player.localeCompare(b.player);
    if(k === 'ppm') return ((a.ppm - b.ppm) * dir) || (a.points - b.points) * dir || (a.matches - b.matches) * dir || a.player.localeCompare(b.player);
    if(k === 'goals') return (a.goals - b.goals) * dir || ((a.gpm || 0) - (b.gpm || 0)) * dir || (a.matches - b.matches) * dir || a.player.localeCompare(b.player);
    if(k === 'gpm'){
      const aHas = a.goalSessions && a.goalSessions > 0;
      const bHas = b.goalSessions && b.goalSessions > 0;
      if(aHas && !bHas) return -1;
      if(!aHas && bHas) return 1;
      if(!aHas && !bHas) return (a.points - b.points) * dir || a.player.localeCompare(b.player);
      const cmp = (a.gpm - b.gpm) * dir;
      if(cmp !== 0) return cmp;
      return (a.goals - b.goals) * dir || (a.matches - b.matches) * dir || a.player.localeCompare(b.player);
    }
    return 0;
  });
}

function makeRankMap(sortedStats){
  const map = new Map();
  for(let i=0;i<sortedStats.length;i++){
    map.set(sortedStats[i].player, i);
  }
  return map;
}


// Removed dedicated refresh button; data reloads on tab open and page refresh

// ----- Scroll Lock Helpers for Modals -----
let __prevHtmlOverflow = '';
let __prevBodyOverflow = '';
let __preventTouchMove = null;
let __openModalEl = null;
function setOpenModalEl(el){ __openModalEl = el; }
function lockBodyScroll(){
  try{
    __prevHtmlOverflow = document.documentElement.style.overflow;
    __prevBodyOverflow = document.body.style.overflow;
    // Prevent root scrolling
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    // Prevent touchmove outside modal (iOS Safari)
    __preventTouchMove = function(e){
      const modal = __openModalEl;
      if(!modal) { e.preventDefault(); return; }
      if(!modal.contains(e.target)){
        e.preventDefault();
      }
    };
    document.addEventListener('touchmove', __preventTouchMove, { passive: false });
  }catch(_){/* no-op */}
}
function unlockBodyScroll(){
  try{
    document.documentElement.style.overflow = __prevHtmlOverflow || '';
    document.body.style.overflow = __prevBodyOverflow || '';
    if(__preventTouchMove){ document.removeEventListener('touchmove', __preventTouchMove); __preventTouchMove = null; }
  }catch(_){/* no-op */}
}

// ----- Init -----
loadState();
// Initial UI
renderRosterUI();
renderTeams(state);
renderSchedule(state, { resultModal, orderRoundPairings, computeStableSeedFromAttendees });
renderLeaderboard(state);
renderAllTime(true);
clampPlayLimit();
syncGenerateButton();
// Ensure buttons/visibility synced on first load
updateTabsUI();
updateTabsUI();
switchTab('players');
syncStickyOffsets();
window.addEventListener('resize', ()=> syncStickyOffsets());
  
