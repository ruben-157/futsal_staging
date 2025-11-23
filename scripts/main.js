import { state, loadState, saveTimestamp } from './state/storage.js';
import { generateTeams, resetState } from './logic/actions.js';
import { renderRoster, setupDnD, clampPlayLimit } from './ui/roster.js';
import { renderTeams, copyTeams } from './ui/teams.js';
import { renderSchedule } from './ui/schedule.js';
import { renderLeaderboard } from './ui/leaderboard.js';
import { renderAllTime } from './ui/alltime.js';
import {
  openAddPlayerModal,
  openResetModal,
  openTeamCountModal,
  openEndTournamentModal,
  openRemoveRoundModal
} from './ui/modals.js';
import { logError } from './utils/logging.js';

// ----- Tabs & UI Orchestration -----
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

function switchTab(which) {
  const hasTeams = state.teams && state.teams.length > 0;
  if ((which === 'teams' || which === 'matches' || which === 'leaderboard') && !hasTeams) return; // disabled
  currentTab = which;
  for (const [k, btn] of Object.entries(tabs)) {
    const active = k === which;
    if (btn) {
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    }
  }
  for (const [k, el] of Object.entries(panels)) {
    if (el) el.hidden = k !== which;
  }
  // Reflect active state on All-Time header button
  const btnAllTimeHeaderEl = document.getElementById('btnAllTimeHeader');
  if (btnAllTimeHeaderEl) { btnAllTimeHeaderEl.classList.toggle('active', which === 'alltime'); }
  const btnAllTimeRefreshEl = document.getElementById('btnAllTimeRefresh');
  if (btnAllTimeRefreshEl) { btnAllTimeRefreshEl.hidden = (which !== 'alltime'); }

  if (which === 'players') {
    renderRoster(); // ensure lock state reflected immediately
  } else if (which === 'alltime') {
    renderAllTime(true);
  }
  syncStickyOffsets();
}

function updateTabsUI() {
  const hasTeams = state.teams && state.teams.length > 0;
  if (tabs.teams) tabs.teams.disabled = !hasTeams;
  if (tabs.matches) tabs.matches.disabled = !hasTeams;
  if (tabs.leaderboard) tabs.leaderboard.disabled = !hasTeams;

  const btnResetTop = document.getElementById('btnResetPlayersTop');
  const playersTopBar = document.getElementById('playersTopBar');
  if (btnResetTop) { btnResetTop.hidden = !hasTeams; }
  if (playersTopBar) { playersTopBar.style.display = hasTeams ? 'flex' : 'none'; }

  if (!hasTeams && (currentTab === 'teams' || currentTab === 'matches' || currentTab === 'leaderboard')) {
    switchTab('players');
  }
}

function syncStickyOffsets() {
  const stickyEls = document.querySelectorAll('.sticky-header');
  let offset = 0;
  stickyEls.forEach(el => {
    if (el.offsetParent !== null) { // visible
      el.style.top = offset + 'px';
      offset += el.offsetHeight;
    }
  });
}

// ----- Event Wiring -----
document.addEventListener('DOMContentLoaded', () => {
  // Buttons
  const btnGen = document.getElementById('btnGenerateBottom');
  if (btnGen) {
    btnGen.addEventListener('click', () => {
      const n = state.attendees.length;
      if (n < 8) {
        // Error handled by renderRoster/UI updates usually, or we can show alert
        // But generateTeams check is inside actions.js? No, actions.js doesn't check min 8?
        // main.js (Step 142) checked n < 8.
        // I should check here.
        const err = document.getElementById('genError');
        if (err) { err.textContent = 'Need at least 8 attendees.'; err.style.display = ''; }
        return;
      }
      if (n === 11) {
        openTeamCountModal([2, 3], 11);
      } else {
        generateTeams();
      }
    });
  }

  const btnResetTop = document.getElementById('btnResetPlayersTop');
  if (btnResetTop) btnResetTop.addEventListener('click', openResetModal);

  const btnAdd = document.getElementById('btnAddPlayer');
  if (btnAdd) btnAdd.addEventListener('click', openAddPlayerModal);

  const btnCopy = document.getElementById('btnCopy');
  if (btnCopy) btnCopy.addEventListener('click', copyTeams);

  // Tabs
  if (tabs.players) tabs.players.addEventListener('click', () => switchTab('players'));
  if (tabs.teams) tabs.teams.addEventListener('click', () => switchTab('teams'));
  if (tabs.matches) tabs.matches.addEventListener('click', () => switchTab('matches'));
  if (tabs.leaderboard) tabs.leaderboard.addEventListener('click', () => switchTab('leaderboard'));

  const btnAllTimeHeader = document.getElementById('btnAllTimeHeader');
  if (btnAllTimeHeader) btnAllTimeHeader.addEventListener('click', () => switchTab('alltime'));

  const btnAllTimeRefresh = document.getElementById('btnAllTimeRefresh');
  if (btnAllTimeRefresh) btnAllTimeRefresh.addEventListener('click', () => renderAllTime(true));

  // Global State Change Listener
  document.addEventListener('futsal:state-changed', () => {
    renderRoster();
    renderTeams();
    renderSchedule();
    renderLeaderboard();
    updateTabsUI();
    // If we are on all-time tab, maybe refresh it? 
    // Usually all-time is separate data (CSV), but if it depends on current session (e.g. live updates), we might want to.
    // But renderAllTime is async and heavy. Let's leave it to manual refresh or tab switch.
  });

  document.addEventListener('futsal:gen-error', (e) => {
    const msg = e.detail;
    const el = document.getElementById('genError');
    if (el) {
      if (msg) { el.textContent = msg; el.style.display = ''; }
      else { el.textContent = ''; el.style.display = 'none'; }
    }
  });

  document.addEventListener('futsal:tournament-end', () => {
    switchTab('leaderboard');
  });

  // Init
  loadState();
  setupDnD();

  // Initial Render
  renderRoster();
  renderTeams();
  renderSchedule();
  renderLeaderboard();
  renderAllTime(true); // Load all-time data once

  clampPlayLimit();
  updateTabsUI();

  // If we have teams, default to teams tab? Or stay on players?
  // main.js logic: switchTab('teams') after generation.
  // But on reload, we might want to stay on players or restore last tab?
  // For now, default to players, unless teams exist?
  // main.js (Step 142) had switchTab('teams') inside generateTeams.
  // Since generateTeams is now in actions.js and dispatches event, we can't easily switch tab *only* on generation vs reload.
  // We could add a specific event 'futsal:teams-generated'.
  // But for now, let's just respect the current state.
  // If teams exist, we enable tabs.

  syncStickyOffsets();
  window.addEventListener('resize', syncStickyOffsets);
});
