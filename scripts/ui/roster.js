import { state } from '../state/storage.js';
import { addToAttendees, removeFromAttendees } from '../logic/actions.js';
import { MAX_ATTENDEES } from '../data/config.js';

export function renderRoster() {
    const listNot = document.getElementById('listNot');
    if (!listNot) return;
    listNot.innerHTML = '';

    const playSet = new Set(state.attendees);
    const allPlayers = state.players
        .slice()
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    for (const name of allPlayers) {
        const selected = playSet.has(name);
        const item = createListItem(name, selected);
        listNot.appendChild(item);
    }

    const genBtn = document.getElementById('btnGenerateBottom');
    if (genBtn) genBtn.textContent = `Generate Teams (${state.attendees.length})`;

    const hasTeams = state.teams && state.teams.length > 0;
    const canGen = state.attendees.length >= 8 && !hasTeams;
    if (genBtn) genBtn.disabled = !canGen;

    const addBtn = document.getElementById('btnAddPlayer');
    if (addBtn) addBtn.disabled = !!hasTeams;

    const info = document.getElementById('genError');
    if (info) {
        info.textContent = '';
        info.style.display = 'none';
    }

    const sec = document.getElementById('playersSection');
    if (sec) sec.classList.toggle('locked', !!hasTeams);

    clampPlayLimit();
}

function createListItem(name, isSelected) {
    const div = document.createElement('div');
    div.className = 'item';
    div.setAttribute('role', 'listitem');
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

    if (isSelected) { div.classList.add('selected'); }

    // Click anywhere on item toggles
    div.tabIndex = 0;
    const onToggle = () => {
        if (state.teams && state.teams.length > 0) return; // locked
        if (state.attendees.includes(name)) {
            removeFromAttendees(name);
        } else {
            addToAttendees(name);
        }
    };
    div.addEventListener('click', (e) => { onToggle(); });
    div.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
    });

    div.addEventListener('dragstart', (e) => { e.preventDefault(); });

    div.appendChild(label);
    div.appendChild(icon);
    return div;
}

export function setupDnD() { /* DnD disabled in single-list selection UI */ }

function clampPlayLimit() {
    const notice = document.getElementById('limitNotice');
    if (notice) {
        notice.textContent = `Limit reached: maximum ${MAX_ATTENDEES} players.`;
        if (state.attendees.length >= MAX_ATTENDEES) {
            notice.style.display = '';
        } else {
            notice.style.display = 'none';
        }
    }
}
