import { state, saveTeams } from '../state/storage.js';
import { getSkill, getStamina } from '../data/config.js';
import { updateTeamName } from '../logic/actions.js';

export function renderTeams() {
    const table = document.getElementById('teamsTable');
    if (!table) return;
    const headerLabels = ['Team', 'Members', 'Size', 'Avg Skill', 'Avg Stamina'];
    const thead = table.tHead || table.createTHead();
    const headerRow = document.createElement('tr');
    headerLabels.forEach(label => {
        const th = document.createElement('th');
        th.textContent = label;
        headerRow.appendChild(th);
    });
    thead.innerHTML = '';
    thead.appendChild(headerRow);
    const existingBody = document.getElementById('teamsBody') || table.tBodies[0];
    const tbody = document.createElement('tbody');
    tbody.id = 'teamsBody';
    if (existingBody) existingBody.replaceWith(tbody);
    else table.appendChild(tbody);
    if (!state.teams || state.teams.length === 0) {
        // No teams yet: leave table empty
        return;
    }
    for (const team of state.teams) {
        const tr = document.createElement('tr');
        const tdTeam = document.createElement('td');
        const pill = document.createElement('span');
        pill.className = 'team-pill';
        pill.style.borderColor = team.color;
        const nameSpan = document.createElement('span');
        nameSpan.className = 'team-name';
        nameSpan.contentEditable = 'true';
        nameSpan.textContent = team.name;
        nameSpan.dataset.teamId = String(team.id);
        nameSpan.ariaLabel = `Edit name for ${team.name}`;
        nameSpan.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); nameSpan.blur(); }
        });
        nameSpan.addEventListener('blur', () => {
            const val = (nameSpan.textContent || '').trim();
            if (val && val !== team.name) {
                updateTeamName(team.id, val);
            } else {
                nameSpan.textContent = team.name; // Revert if empty
            }
        });
        pill.appendChild(nameSpan);
        tdTeam.appendChild(pill);

        const tdMembers = document.createElement('td');
        const membersSorted = [...team.members].sort((a, b) => a.localeCompare(b));
        tdMembers.textContent = membersSorted.join(', ');

        const tdSize = document.createElement('td');
        tdSize.textContent = String(team.members.length);

        const tdAvgSkill = document.createElement('td');
        const tdAvgStamina = document.createElement('td');
        const count = team.members.length;
        if (count > 0) {
            const totalSkill = team.members.reduce((s, name) => s + getSkill(name), 0);
            const totalStamina = team.members.reduce((s, name) => s + getStamina(name), 0);
            const avgSkill = totalSkill / count;
            const avgStam = totalStamina / count;
            tdAvgSkill.textContent = avgSkill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            tdAvgStamina.textContent = avgStam.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
            tdAvgSkill.textContent = '—';
            tdAvgStamina.textContent = '—';
        }

        tr.appendChild(tdTeam);
        tr.appendChild(tdMembers);
        tr.appendChild(tdSize);
        tr.appendChild(tdAvgSkill);
        tr.appendChild(tdAvgStamina);
        tbody.appendChild(tr);
    }
}

export function copyTeams() {
    if (!navigator.clipboard) return;
    const lines = [];
    for (const t of state.teams) {
        lines.push(`${t.name}: ${t.members.join(', ')}`);
    }
    const txt = lines.join('\n');
    navigator.clipboard.writeText(txt).then(() => {
        const btn = document.getElementById('btnCopy');
        if (btn) {
            const old = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = old, 1200);
        }
    });
}
