import { state, getTrackScorersPref, setTrackScorersPref } from '../state/storage.js';
import {
    saveMatchResult,
    saveMatchDraft,
    addIncidentalPlayer,
    resetState,
    addRound,
    removeRound,
    generateTeams,
    setCelebrated
} from '../logic/actions.js';
import { DEFAULT_SKILL, DEFAULT_STAMINA, RATING_STEP, snapToRatingStep, MAX_ATTENDEES } from '../data/config.js';
import { logError } from '../utils/logging.js';
import { celebrateWinner } from './notifications.js';

// ----- Modal: Set Result -----
let modalCtx = null; // { matchId, aId, bId, round }

export function openResultModal({ matchId, a, b, round }) {
    modalCtx = { matchId, aId: a.id, bId: b.id, round };
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

    // Render team pills in modal
    aName.textContent = '';
    bName.textContent = '';
    const pillA = document.createElement('span');
    pillA.className = 'team-pill';
    pillA.style.borderColor = a.color;
    pillA.appendChild(document.createTextNode(a.name));
    const pillB = document.createElement('span');
    pillB.className = 'team-pill';
    pillB.style.borderColor = b.color;
    pillB.appendChild(document.createTextNode(b.name));
    aName.appendChild(pillA);
    const subA = document.createElement('div');
    subA.className = 'team-sub';
    subA.textContent = (a.members || []).join(', ');
    aName.appendChild(subA);
    bName.appendChild(pillB);
    const subB = document.createElement('div');
    subB.className = 'team-sub';
    subB.textContent = (b.members || []).join(', ');
    bName.appendChild(subB);
    label.textContent = `${a.name} vs ${b.name} • Round ${round}`;

    const existing = state.results[matchId];
    // Prefill totals from draft if present, else from final, else 0
    const initialA = (existing && (existing.gaDraft != null)) ? existing.gaDraft : (existing && (existing.ga != null) ? existing.ga : 0);
    const initialB = (existing && (existing.gbDraft != null)) ? existing.gbDraft : (existing && (existing.gb != null) ? existing.gb : 0);
    aInput.value = String(initialA);
    bInput.value = String(initialB);

    function canSave() { return aInput.value !== '' && bInput.value !== ''; }
    saveBtn.disabled = !canSave();
    const onInput = () => { saveBtn.disabled = !canSave(); };
    aInput.oninput = onInput; bInput.oninput = onInput;

    overlay.hidden = false; modal.hidden = false;
    setTimeout(() => aInput.focus(), 0);

    function escHandler(e) { if (e.key === 'Escape') { closeResultModal(); } }
    document.addEventListener('keydown', escHandler, { once: true });

    document.getElementById('modalCancel').onclick = closeResultModal;
    overlay.onclick = closeResultModal;
    function step(input, delta) {
        const cur = parseInt(input.value || '0', 10);
        let v = Number.isFinite(cur) ? cur : 0;
        v = Math.max(0, v + delta);
        input.value = String(v);
        onInput();
    }
    aMinus.onclick = () => step(aInput, -1);
    aPlus.onclick = () => step(aInput, +1);
    bMinus.onclick = () => step(bInput, -1);
    bPlus.onclick = () => step(bInput, +1);

    // ----- Per-player scorers -----
    const scorersWrap = document.getElementById('modalScorers');
    scorersWrap.innerHTML = '';
    const aCard = document.createElement('div'); aCard.className = 'scorer-card';
    const aTitle = document.createElement('div'); aTitle.className = 'scorer-title'; aTitle.textContent = `${a.name} scorers`;
    aCard.appendChild(aTitle);
    const bCard = document.createElement('div'); bCard.className = 'scorer-card';
    const bTitle = document.createElement('div'); bTitle.className = 'scorer-title'; bTitle.textContent = `${b.name} scorers`;
    bCard.appendChild(bTitle);
    scorersWrap.appendChild(aCard); scorersWrap.appendChild(bCard);

    // Prefill per-player scorers from draft if present, else from final
    const gpa = (existing && (existing.gpaDraft || existing.gpa)) ? (existing.gpaDraft || existing.gpa) : {};
    const gpb = (existing && (existing.gpbDraft || existing.gpb)) ? (existing.gpbDraft || existing.gpb) : {};
    const aInputs = new Map();
    const bInputs = new Map();
    function makeRow(name, initial, map, parent) {
        const row = document.createElement('div'); row.className = 'scorer-row';
        const label = document.createElement('div'); label.textContent = name; label.style.flex = '1';
        const minus = document.createElement('button'); minus.type = 'button'; minus.className = 'btn mini-step'; minus.textContent = '−';
        const inp = document.createElement('input'); inp.type = 'number'; inp.min = '0'; inp.inputMode = 'numeric'; inp.className = 'scorer-input'; inp.value = (initial ?? 0);
        const plus = document.createElement('button'); plus.type = 'button'; plus.className = 'btn mini-step'; plus.textContent = '+';
        const change = (delta) => {
            const v = Math.max(0, parseInt(inp.value || '0', 10) + (delta || 0));
            inp.value = String(v);
            syncIfTracking();
        };
        minus.onclick = () => change(-1);
        plus.onclick = () => change(+1);
        // independent inputs unless tracking is enabled
        inp.oninput = () => syncIfTracking();
        row.appendChild(label); row.appendChild(minus); row.appendChild(inp); row.appendChild(plus);
        parent.appendChild(row);
        map.set(name, inp);
    }
    for (const p of a.members) { makeRow(p, gpa[p] ?? 0, aInputs, aCard); }
    // If team A has only 3 players, add a Guest player row (excluded from leaderboards)
    if ((a.members || []).length === 3) { makeRow('Guest player', gpa['Guest player'] ?? 0, aInputs, aCard); }
    for (const p of b.members) { makeRow(p, gpb[p] ?? 0, bInputs, bCard); }
    // If team B has only 3 players, add a Guest player row (excluded from leaderboards)
    if ((b.members || []).length === 3) { makeRow('Guest player', gpb['Guest player'] ?? 0, bInputs, bCard); }

    // Toggle tracking visibility
    const trackToggle = document.getElementById('modalTrackScorers');
    const existingHasScorers = (Object.keys(gpa).length > 0 || Object.keys(gpb).length > 0);
    trackToggle.checked = existingHasScorers ? true : getTrackScorersPref();
    function sumMapVals(map) { let s = 0; map.forEach((el) => { s += Math.max(0, parseInt(el.value || '0', 10)); }); return s; }
    function updateTotalsFromPlayers() {
        const sa = sumMapVals(aInputs);
        const sb = sumMapVals(bInputs);
        const ca = Math.max(0, parseInt(aInput.value || '0', 10));
        const cb = Math.max(0, parseInt(bInput.value || '0', 10));
        // Only raise totals; never reduce below what user set
        const na = Math.max(ca, sa);
        const nb = Math.max(cb, sb);
        aInput.value = String(na);
        bInput.value = String(nb);
    }
    function syncIfTracking() { if (trackToggle.checked) { updateTotalsFromPlayers(); onInput(); } }
    const applyToggle = () => {
        scorersWrap.style.display = trackToggle.checked ? '' : 'none';
        aInput.disabled = trackToggle.checked;
        bInput.disabled = trackToggle.checked;
        if (trackToggle.checked) { updateTotalsFromPlayers(); onInput(); }
    };
    applyToggle();
    trackToggle.onchange = () => { applyToggle(); setTrackScorersPref(trackToggle.checked); };
    const saveError = document.getElementById('modalSaveError');
    saveBtn.onclick = () => {
        const ga = Math.max(0, parseInt(aInput.value, 10));
        const gb = Math.max(0, parseInt(bInput.value, 10));
        if (!Number.isFinite(ga) || !Number.isFinite(gb)) return;
        let resultData = { a: modalCtx.aId, b: modalCtx.bId, round: modalCtx.round, ga, gb };

        if (trackToggle.checked) {
            let sa = 0, sb = 0; aInputs.forEach((el) => { sa += Math.max(0, parseInt(el.value || '0', 10)); });
            bInputs.forEach((el) => { sb += Math.max(0, parseInt(el.value || '0', 10)); });
            // Auto-raise totals if player sums surpass them; never decrease totals
            const finalA = Math.max(ga, sa);
            const finalB = Math.max(gb, sb);
            // Strict validation: if player sums are below totals, block save
            if (sa < finalA || sb < finalB) {
                saveError.style.display = '';
                saveError.textContent = `Distribute all goals to players: need ${finalA}-${finalB}, have ${sa}-${sb}.`;
                return;
            }
            saveError.style.display = 'none';
            const outA = {}; aInputs.forEach((el, name) => { const n = Math.max(0, parseInt(el.value || '0', 10)); if (n > 0) outA[name] = n; });
            const outB = {}; bInputs.forEach((el, name) => { const n = Math.max(0, parseInt(el.value || '0', 10)); if (n > 0) outB[name] = n; });
            resultData = { ...resultData, ga: finalA, gb: finalB, gpa: outA, gpb: outB };
        } else {
            saveError.style.display = 'none';
        }

        const ok = saveMatchResult(matchId, resultData);
        if (!ok) {
            saveError.textContent = 'Could not save results. Storage may be full or blocked. Retry or clear storage.';
            saveError.style.display = '';
            return;
        }

        const completedNow = areAllMatchesScored() && !state.celebrated;
        if (completedNow) {
            // Hide only the result modal; keep overlay visible for confirmation modal
            try {
                const modal = document.getElementById('resultModal');
                if (modal) modal.hidden = true;
                const overlay = document.getElementById('overlay');
                if (overlay) overlay.onclick = null; // rebind in confirmation modal
            } catch (_) {/* no-op */ }
            // Update views in the background (handled by event listener in main.js)
            openEndTournamentModal();
            // Clear modalCtx since the result modal is done
            modalCtx = null;
        } else {
            closeResultModal();
            // Suppress non-final toasts; only celebrate winner at tournament end
        }
    };
}

export function closeResultModal() {
    // Persist current inputs as a draft only if this match is not finalized
    try {
        if (modalCtx && modalCtx.matchId) {
            const matchId = modalCtx.matchId;
            const rec = state.results[matchId];
            const isFinal = rec && rec.ga != null && rec.gb != null;
            if (!isFinal) {
                const aInput = document.getElementById('modalTeamAScore');
                const bInput = document.getElementById('modalTeamBScore');
                const gaDraft = Math.max(0, parseInt(aInput.value || '0', 10));
                const gbDraft = Math.max(0, parseInt(bInput.value || '0', 10));
                const scorersWrap = document.getElementById('modalScorers');
                const cards = scorersWrap ? scorersWrap.querySelectorAll('.scorer-card') : null;
                let gpaDraft = {}, gpbDraft = {};
                if (cards && cards.length >= 2) {
                    const aCard = cards[0];
                    const bCard = cards[1];
                    const readCard = (card) => {
                        const map = {};
                        if (!card) return map;
                        const rows = card.querySelectorAll('.scorer-row');
                        rows.forEach(row => {
                            const nameEl = row.children[0];
                            const inp = row.querySelector('input.scorer-input');
                            const name = nameEl ? String(nameEl.textContent || '').trim() : '';
                            const v = Math.max(0, parseInt((inp && inp.value) || '0', 10));
                            if (name && v > 0) { map[name] = v; }
                        });
                        return map;
                    };
                    gpaDraft = readCard(aCard);
                    gpbDraft = readCard(bCard);
                }
                saveMatchDraft(matchId, { gaDraft, gbDraft, gpaDraft, gpbDraft });
            }
        }
    } catch (_) { /* draft save is best-effort */ }
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('resultModal');
    overlay.hidden = true; modal.hidden = true; modalCtx = null;
}

// ----- Modal: Add Player -----
export function openAddPlayerModal() {
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

    err.style.display = 'none';
    err.textContent = '';
    input.value = '';
    const formatRating = (val) => {
        const num = Number(val);
        if (Number.isNaN(num)) return '';
        return Number.isInteger(num) ? String(Math.trunc(num)) : num.toFixed(1);
    };
    const clampInputValue = (el, fallback) => {
        const v = snapToRatingStep(el.value, fallback);
        el.value = formatRating(v);
        return v;
    };
    const adjustInput = (el, fallback, delta) => {
        const current = snapToRatingStep(el.value, fallback);
        const next = snapToRatingStep(current + delta, fallback);
        el.value = formatRating(next);
    };
    skillInput.value = formatRating(snapToRatingStep(DEFAULT_SKILL, DEFAULT_SKILL));
    staminaInput.value = formatRating(snapToRatingStep(DEFAULT_STAMINA, DEFAULT_STAMINA));
    save.disabled = true;

    function update() { save.disabled = input.value.trim().length === 0; }
    input.oninput = update;
    skillMinus.onclick = () => adjustInput(skillInput, DEFAULT_SKILL, -RATING_STEP);
    skillPlus.onclick = () => adjustInput(skillInput, DEFAULT_SKILL, RATING_STEP);
    skillInput.oninput = () => { clampInputValue(skillInput, DEFAULT_SKILL); };
    staminaMinus.onclick = () => adjustInput(staminaInput, DEFAULT_STAMINA, -RATING_STEP);
    staminaPlus.onclick = () => adjustInput(staminaInput, DEFAULT_STAMINA, RATING_STEP);
    staminaInput.oninput = () => { clampInputValue(staminaInput, DEFAULT_STAMINA); };

    overlay.hidden = false; modal.hidden = false; setTimeout(() => input.focus(), 0);
    overlay.onclick = closeAddPlayerModal;
    cancel.onclick = closeAddPlayerModal;
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { closeAddPlayerModal(); } }, { once: true });

    save.onclick = () => {
        const name = input.value.trim();
        if (!name) { return; }
        if (state.attendees.length >= MAX_ATTENDEES) {
            err.textContent = `Cannot add more than ${MAX_ATTENDEES} attendees.`;
            err.style.display = '';
            return;
        }
        addIncidentalPlayer(name, skillInput.value, staminaInput.value);
        closeAddPlayerModal();
    };
}

export function closeAddPlayerModal() {
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('addPlayerModal');
    overlay.hidden = true; modal.hidden = true;
}

// ----- Modal: Reset Confirmation -----
export function openResetModal() {
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('resetModal');
    const cancel = document.getElementById('resetCancel');
    const confirm = document.getElementById('resetConfirm');

    overlay.hidden = false; modal.hidden = false;
    overlay.onclick = closeResetModal;
    cancel.onclick = closeResetModal;
    confirm.onclick = () => { closeResetModal(); resetState(); };
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { closeResetModal(); } }, { once: true });
}

export function closeResetModal() {
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('resetModal');
    overlay.hidden = true; modal.hidden = true;
}

// ----- Modal: Choose team count when n=11 -----
export function openTeamCountModal(options = [2, 3], nOverride) {
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('teamCountModal');
    const btn2 = document.getElementById('teamCount2');
    const btn3 = document.getElementById('teamCount3');
    overlay.hidden = false; modal.hidden = false;
    const body = modal.querySelector('.modal-body');
    const n = nOverride || state.attendees.length;
    const a = options[0], b = options[1];
    const sizesA = sizesDesc(n, a);
    const sizesB = sizesDesc(n, b);
    body.innerHTML = `<div class="notice" style="font-weight:600; margin-bottom:8px">You have ${n} players. Choose ${a} or ${b} teams.</div>
                    <div class="notice">${a} teams: ${sizesA} &nbsp; • &nbsp; ${b} teams: ${sizesB}</div>`;
    btn2.textContent = `${a} Teams`;
    btn3.textContent = `${b} Teams`;
    const close = () => { overlay.hidden = true; modal.hidden = true; btn2.onclick = null; btn3.onclick = null; };
    overlay.onclick = close;
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); } }, { once: true });
    btn2.onclick = () => { close(); generateTeams(a); };
    btn3.onclick = () => { close(); generateTeams(b); };
}

// Compute a sizes descriptor string using even distribution
function sizesDesc(n, t) {
    const base = Array(t).fill(Math.floor(n / t));
    const r = n % t;
    for (let i = t - r; i < t; i++) if (i >= 0 && i < t) base[i] += 1;
    return base.sort((a, b) => b - a).join('-');
}

// ----- Modal: End Tournament Confirmation -----
export function openEndTournamentModal() {
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('endTournamentModal');
    const yes = document.getElementById('endTournamentYes');
    const add = document.getElementById('endTournamentAddRound');
    overlay.hidden = false; modal.hidden = false;
    // Lock scrolling while modal is open (consistent UX)
    try { document.body.style.overflow = 'hidden'; } catch (_) {/* no-op */ }
    function close() {
        overlay.hidden = true; modal.hidden = true;
        overlay.onclick = null; yes.onclick = null; add.onclick = null;
        document.removeEventListener('keydown', escHandler);
        try { document.body.style.overflow = ''; } catch (_) {/* no-op */ }
    }
    function escHandler(e) { if (e.key === 'Escape') { close(); } }
    document.addEventListener('keydown', escHandler);
    overlay.onclick = close;
    add.onclick = () => { addRound(); close(); };
    yes.onclick = () => {
        // Switch to leaderboard is handled by main.js listener or we can dispatch event
        // But we need to trigger celebration
        celebrateWinner();
        setCelebrated(true);
        close();
        // Dispatch event to ensure UI updates (e.g. switch tab)
        document.dispatchEvent(new CustomEvent('futsal:tournament-end'));
    };
}

// ----- Modal: Remove Last Round -----
export function openRemoveRoundModal() {
    const r = Math.max(1, Number(state.rounds) || 2);
    if (r <= 2) return; // Only removable when > 2
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('removeRoundModal');
    const title = document.getElementById('removeRoundTitle');
    const info = document.getElementById('removeRoundInfo');
    const cancel = document.getElementById('removeRoundCancel');
    const confirm = document.getElementById('removeRoundConfirm');
    const blocked = roundHasResults(r);
    title.textContent = blocked ? `Cannot remove Round ${r}` : `Remove Round ${r}?`;
    info.textContent = blocked ? `Round ${r} has recorded results and cannot be removed. You can only remove an empty round.` : `Are you sure you want to remove round ${r}?`;
    overlay.hidden = false; modal.hidden = false;
    const close = () => { overlay.hidden = true; modal.hidden = true; cancel.onclick = null; confirm.onclick = null; };
    overlay.onclick = close;
    cancel.onclick = close;
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); } }, { once: true });
    if (blocked) {
        confirm.disabled = true;
    } else {
        confirm.disabled = false;
        confirm.onclick = () => { removeRound(r); close(); };
    }
}

function roundHasResults(r) {
    for (const key of Object.keys(state.results || {})) {
        const rec = state.results[key];
        if (rec && Number(rec.round) === Number(r) && rec.ga != null && rec.gb != null) {
            return true;
        }
    }
    return false;
}

function areAllMatchesScored() {
    if (!state.teams || state.teams.length < 2) return false;
    const pairings = [];
    for (let i = 0; i < state.teams.length; i++) {
        for (let j = i + 1; j < state.teams.length; j++) {
            pairings.push([state.teams[i], state.teams[j]]);
        }
    }
    const rounds = Math.max(1, Number(state.rounds) || 2);
    for (let r = 1; r <= rounds; r++) {
        for (const [a, b] of pairings) {
            const id = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}-r${r}`;
            const rec = state.results[id];
            if (!rec || rec.ga == null || rec.gb == null) return false;
        }
    }
    return true;
}
