import { state } from '../state/storage.js';
import { computeStableSeedFromAttendees, mulberry32 } from '../utils/random.js';
import { orderRoundPairings, createsTriple, rotate } from '../logic/scheduler.js';
import { addRound, removeRound } from '../logic/actions.js';
import { openResultModal, openRemoveRoundModal } from './modals.js';

export function renderSchedule() {
    const schedSec = document.getElementById('matchesSection');
    const list = document.getElementById('matchesList');
    if (!list) return;
    list.innerHTML = '';
    if (!state.teams || state.teams.length < 2) {
        const info = document.createElement('div');
        info.className = 'notice';
        info.textContent = 'Generate teams to see the match schedule.';
        list.appendChild(info);
        return;
    }
    const stableSeed = computeStableSeedFromAttendees(state.attendees || []);
    // Build all unique pairings
    const pairings = [];
    for (let i = 0; i < state.teams.length; i++) {
        for (let j = i + 1; j < state.teams.length; j++) {
            pairings.push([state.teams[i], state.teams[j]]);
        }
    }
    const totalRounds = Math.max(1, Number(state.rounds) || 2);
    let nextMarked = false;
    // Compute a single deterministic round order and repeat it for all rounds
    const baseStreak = new Map(state.teams.map(t => [t.id, 0]));
    const baseOrdered = orderRoundPairings(state.teams, pairings, baseStreak, stableSeed);

    let fixedOrdered = baseOrdered;
    if (createsTriple(state.teams, totalRounds, fixedOrdered)) {
        // Try reversed order
        const rev = [...baseOrdered].reverse();
        if (!createsTriple(state.teams, totalRounds, rev)) fixedOrdered = rev; else {
            // Try rotations
            for (let k = 1; k < baseOrdered.length; k++) {
                const rot = rotate(baseOrdered, k);
                if (!createsTriple(state.teams, totalRounds, rot)) { fixedOrdered = rot; break; }
            }
        }
    }
    // Flatten schedule for kickoff fairness and next-match detection
    const flat = [];
    for (let roundIdx = 0; roundIdx < totalRounds; roundIdx++) {
        for (const [a, b] of fixedOrdered) {
            const matchId = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}-r${roundIdx + 1}`;
            flat.push({ a, b, roundIdx, matchId });
        }
    }

    // Compute kickoff for the next unplayed match to balance starts evenly
    const startCounts = new Map(state.teams.map(t => [t.id, 0]));
    let nextKickoffId = null;
    const rng = mulberry32((stableSeed + 0x9e3779b9) >>> 0);
    let nextIndex = -1;
    for (let i = 0; i < flat.length; i++) {
        const { a, b, matchId } = flat[i];
        const rec = state.results[matchId];
        const played = rec && rec.ga != null && rec.gb != null;
        if (!played && nextIndex === -1) { nextIndex = i; break; }
        // assign historical kickoff deterministically for balancing, even if not stored
        const ca = startCounts.get(a.id) || 0;
        const cb = startCounts.get(b.id) || 0;
        let starter = null;
        if (ca < cb) starter = a.id; else if (cb < ca) starter = b.id; else starter = (rng() < 0.5 ? a.id : b.id);
        startCounts.set(starter, (startCounts.get(starter) || 0) + 1);
    }
    if (nextIndex >= 0) {
        const { a, b } = flat[nextIndex];
        const ca = startCounts.get(a.id) || 0;
        const cb = startCounts.get(b.id) || 0;
        if (ca < cb) nextKickoffId = a.id; else if (cb < ca) nextKickoffId = b.id; else nextKickoffId = (rng() < 0.5 ? a.id : b.id);
    }

    // Render rounds using the fixed baseOrdered sequence for each round
    let flatCursor = 0;
    for (let roundIdx = 0; roundIdx < totalRounds; roundIdx++) {
        // Add round heading now, followed by its matches
        const h = document.createElement('div');
        h.style.marginTop = roundIdx === 0 ? '0' : '12px';
        h.style.fontWeight = '700';
        h.style.color = 'var(--muted)';
        h.textContent = `Round ${roundIdx + 1}`;
        list.appendChild(h);
        fixedOrdered.forEach(([a, b]) => {
            const matchId = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}-r${roundIdx + 1}`;
            const rec = state.results[matchId] || null;

            const row = document.createElement('div');
            row.className = 'pair';
            row.style.display = 'flex';
            row.style.flexWrap = 'wrap';
            row.style.gap = '8px 12px';
            row.style.alignItems = 'center';

            const label = document.createElement('div');
            label.style.flex = '1 1 220px';
            label.style.display = 'flex';
            label.style.gap = '8px';
            label.style.flexWrap = 'nowrap';
            label.style.flexDirection = 'column';
            label.style.alignItems = 'flex-start';
            // On tablet, CSS overrides this to a three-column grid via .match-label
            label.classList.add('match-label');
            const teamABox = document.createElement('div');
            teamABox.style.display = 'flex';
            teamABox.style.flexDirection = 'column';
            teamABox.style.alignItems = 'flex-start';
            const pillA = document.createElement('span');
            pillA.className = 'team-pill';
            pillA.style.borderColor = a.color;
            pillA.appendChild(document.createTextNode(a.name));
            const subA = document.createElement('div');
            subA.className = 'team-sub';
            subA.textContent = (a.members || []).join(', ');
            teamABox.appendChild(pillA);
            teamABox.appendChild(subA);
            teamABox.classList.add('match-team', 'a', 'team-card');
            // Insert explicit VS on tablet layout
            const teamBBox = document.createElement('div');
            teamBBox.style.display = 'flex';
            teamBBox.style.flexDirection = 'column';
            teamBBox.style.alignItems = 'flex-start';
            const pillB = document.createElement('span');
            pillB.className = 'team-pill';
            pillB.style.borderColor = b.color;
            pillB.appendChild(document.createTextNode(b.name));
            const subB = document.createElement('div');
            subB.className = 'team-sub';
            subB.textContent = (b.members || []).join(', ');
            teamBBox.appendChild(pillB);
            teamBBox.appendChild(subB);
            teamBBox.classList.add('match-team', 'b', 'team-card');
            const vsEl = document.createElement('div');
            vsEl.className = 'vs';
            vsEl.textContent = 'vs.';
            label.appendChild(teamABox);
            label.appendChild(vsEl);
            label.appendChild(teamBBox);

            const score = document.createElement('div');
            score.className = 'match-score';
            score.style.minWidth = '90px';
            score.style.fontWeight = '600';
            const isPlayed = rec && rec.ga != null && rec.gb != null;
            score.style.color = isPlayed ? '#111827' : 'var(--muted)';
            score.textContent = '';
            if (isPlayed) { row.classList.add('played'); }
            // Insert Next match heading above the first unplayed match and emphasize the card
            if (!isPlayed && !nextMarked) {
                const head = document.createElement('div');
                head.className = 'next-heading';
                head.textContent = 'Next Match';
                list.appendChild(head);
                row.classList.add('next');
                nextMarked = true;
                // Show kickoff indicator only on the first upcoming match
                if (nextKickoffId != null) {
                    if (nextKickoffId === a.id) {
                        const ball = document.createElement('span');
                        ball.textContent = ' ⚽️';
                        pillA.appendChild(ball);
                    } else if (nextKickoffId === b.id) {
                        const ball = document.createElement('span');
                        ball.textContent = ' ⚽️';
                        pillB.appendChild(ball);
                    }
                }
            }
            // Dim all future matches (after the immediate next unplayed)
            const currentIdx = flatCursor; // index in the flattened schedule
            if (!isPlayed && nextIndex >= 0 && currentIdx > nextIndex) {
                row.classList.add('future');
            }
            // Winner styling: solid team-color pill with white text
            if (isPlayed) {
                if (rec.ga > rec.gb) {
                    pillA.classList.add('winner');
                    pillA.style.background = a.color; pillA.style.borderColor = a.color; pillA.style.color = '#fff';
                } else if (rec.gb > rec.ga) {
                    pillB.classList.add('winner');
                    pillB.style.background = b.color; pillB.style.borderColor = b.color; pillB.style.color = '#fff';
                }
            }

            // Button handling: show score as a button when played; otherwise show Set Result
            if (isPlayed) {
                const scoreBtn = document.createElement('button');
                scoreBtn.type = 'button';
                scoreBtn.className = 'btn slim';
                scoreBtn.textContent = `${rec.ga} - ${rec.gb}`;
                scoreBtn.addEventListener('click', () => openResultModal({ matchId, a, b, round: roundIdx + 1 }));
                score.appendChild(scoreBtn);
            } else {
                const setBtn = document.createElement('button');
                setBtn.type = 'button';
                setBtn.className = 'btn slim';
                setBtn.textContent = 'Set Result';
                setBtn.addEventListener('click', () => openResultModal({ matchId, a, b, round: roundIdx + 1 }));
                score.appendChild(setBtn);
            }
            // Players are always shown; no toggle button

            row.appendChild(label);
            row.appendChild(score);
            list.appendChild(row);
            flatCursor++;
        });
    }
    // Add bottom controls: Remove round X (if >2 rounds) and Add additional round
    const addWrap = document.createElement('div');
    addWrap.style.margin = '12px 0 0 0';
    addWrap.style.display = 'flex';
    addWrap.style.justifyContent = 'flex-end';
    addWrap.style.gap = '8px';
    if (totalRounds > 2 && !roundHasResults(totalRounds)) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button'; removeBtn.className = 'btn danger';
        removeBtn.textContent = `Remove round ${totalRounds}`;
        removeBtn.addEventListener('click', openRemoveRoundModal);
        addWrap.appendChild(removeBtn);
    }
    const addBtn = document.createElement('button');
    addBtn.type = 'button'; addBtn.className = 'btn'; addBtn.textContent = 'Add additional round';
    addBtn.addEventListener('click', addRound);
    addWrap.appendChild(addBtn);
    list.appendChild(addWrap);
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
