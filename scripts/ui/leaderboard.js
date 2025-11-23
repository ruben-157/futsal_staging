import { state, getPrevRanks, savePrevRanksFromRows } from '../state/storage.js';
import { computeGoalStats, buildShareText, buildEmailSummaryText } from '../logic/stats.js';

export function renderLeaderboard() {
    const lb = document.getElementById('leaderboardSection');
    if (!lb) return;
    lb.innerHTML = '';
    if (!state.teams || state.teams.length === 0) {
        const info = document.createElement('div');
        info.className = 'notice';
        info.textContent = 'Generate teams to see the leaderboard.';
        lb.appendChild(info);
        return;
    }

    // Compute points per team
    const byId = new Map(state.teams.map(t => [t.id, { team: t, pts: 0, played: 0, gf: 0, ga: 0 }]));
    for (const key of Object.keys(state.results || {})) {
        const r = state.results[key];
        if (!r) continue;
        const { a, b, ga, gb } = r;
        if (ga === null || gb === null || ga === undefined || gb === undefined) continue;
        const A = byId.get(a); const B = byId.get(b);
        if (!A || !B) continue;
        A.played++; B.played++;
        A.gf += ga; B.gf += gb;
        A.ga += gb; B.ga += ga;
        if (ga > gb) { A.pts += 3; }
        else if (gb > ga) { B.pts += 3; }
        else { A.pts += 1; B.pts += 1; }
    }
    const rows = Array.from(byId.values()).sort((x, y) => y.pts - x.pts || y.gf - x.gf || x.team.name.localeCompare(y.team.name));

    const tournamentComplete = areAllMatchesScored();
    const prevRanks = getPrevRanks();
    // Winner banner if tournament complete
    let winningTeamIds = null;
    if (tournamentComplete && rows.length) {
        const topPts = rows[0].pts;
        const topGD = (rows[0].gf - (rows[0].ga || 0));
        const coWinners = rows.filter(r => r.pts === topPts && ((r.gf - (r.ga || 0)) === topGD));
        winningTeamIds = new Set(coWinners.map(r => r.team.id));
        const names = coWinners.map(r => r.team.name.toUpperCase());
        const list = names.length === 1 ? names[0]
            : (names.length === 2 ? `${names[0]} & ${names[1]}`
                : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`);
        const win = document.createElement('div');
        win.className = 'winner-banner';
        win.textContent = `${names.length > 1 ? 'WINNERS' : 'WINNER'}: ${list}!!`;
        lb.appendChild(win);
    }

    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const table = document.createElement('table');
    table.className = 'alltime-table wide-table';
    table.setAttribute('aria-label', 'Tournament leaderboard');
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th style="width:50%">Team</th><th>Played</th><th>Points</th><th>GS</th><th>GA</th><th>GD</th></tr>';
    const tbody = document.createElement('tbody');
    rows.forEach((r, idx) => {
        const tr = document.createElement('tr');
        const tdTeam = document.createElement('td');
        const pill = document.createElement('span');
        pill.className = 'team-pill';
        pill.style.borderColor = r.team.color;
        const label = document.createElement('span');
        label.textContent = r.team.name;
        pill.appendChild(label);
        tdTeam.appendChild(pill);
        // Rank change indicator (compare against previous render ranks)
        const prev = prevRanks[String(r.team.id)];
        const curr = idx;
        if (prev !== undefined && prev !== curr) {
            const arrow = document.createElement('span');
            arrow.style.marginLeft = '6px';
            arrow.style.fontWeight = '700';
            arrow.style.fontSize = '14px';
            if (prev > curr) { arrow.textContent = ' ▲'; arrow.style.color = 'var(--accent-2)'; }
            else { arrow.textContent = ' ▼'; arrow.style.color = 'var(--danger)'; }
            tdTeam.appendChild(arrow);
        }
        if (winningTeamIds && winningTeamIds.has(r.team.id)) {
            const trophy = document.createElement('span');
            trophy.textContent = ' 🏆';
            trophy.style.marginLeft = '6px';
            tdTeam.appendChild(trophy);
        }
        const membersSmall = document.createElement('div');
        membersSmall.className = 'team-sub';
        membersSmall.textContent = r.team.members.join(', ');
        tdTeam.appendChild(membersSmall);
        const tdPlayed = document.createElement('td');
        tdPlayed.textContent = String(r.played);
        const tdPts = document.createElement('td');
        tdPts.textContent = String(r.pts);
        const tdGS = document.createElement('td');
        tdGS.textContent = String(r.gf);
        const tdGA = document.createElement('td');
        tdGA.textContent = String(r.ga || 0);
        const tdGD = document.createElement('td');
        const gd = (r.gf - (r.ga || 0));
        tdGD.textContent = String(gd);
        if (gd > 0) tdGD.classList.add('gd-pos');
        else if (gd < 0) tdGD.classList.add('gd-neg');
        tr.appendChild(tdTeam);
        tr.appendChild(tdPlayed);
        tr.appendChild(tdPts);
        tr.appendChild(tdGS);
        tr.appendChild(tdGA);
        tr.appendChild(tdGD);
        tbody.appendChild(tr);
    });
    table.appendChild(thead); table.appendChild(tbody);
    wrap.appendChild(table);
    lb.appendChild(wrap);
    // Save current ranks for next comparison
    savePrevRanksFromRows(rows);

    // Top Scorers (only players with >=1 goal), with AVG (goals per match)
    const { totals: scorerTotals, playedCounts } = computeGoalStats(state.teams, state.results);
    const scorers = Array.from(scorerTotals.entries())
        .filter(([_, n]) => n > 0)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (scorers.length) {
        const sTitle = document.createElement('h3'); sTitle.textContent = 'Top Scorers'; sTitle.style.margin = '12px 0 6px 0';
        lb.appendChild(sTitle);
        const sTable = document.createElement('table');
        const sHead = document.createElement('thead'); sHead.innerHTML = '<tr><th style="width:60%">Player</th><th>Goals</th><th>GPM</th></tr>';
        const sBody = document.createElement('tbody');
        const topGoals = scorers[0][1];
        for (const [name, goals] of scorers) {
            const played = playedCounts.get(name) || 0;
            const avg = played ? (goals / played) : 0;
            const tr = document.createElement('tr');
            const tdN = document.createElement('td');
            tdN.textContent = name + ((tournamentComplete && goals === topGoals) ? ' 🏆' : '');
            const tdG = document.createElement('td'); tdG.textContent = String(goals);
            const tdAvg = document.createElement('td'); tdAvg.textContent = avg.toFixed(1);
            tr.appendChild(tdN); tr.appendChild(tdG); tr.appendChild(tdAvg); sBody.appendChild(tr);
        }
        sTable.appendChild(sHead); sTable.appendChild(sBody);
        lb.appendChild(sTable);
    }

    // ----- Share controls when tournament complete -----
    if (tournamentComplete && rows.length) {
        const shareWrap = document.createElement('div');
        shareWrap.style.margin = '14px 0 0 0';
        shareWrap.style.paddingTop = '10px';
        shareWrap.style.borderTop = '1px solid var(--border)';
        const btns = document.createElement('div');
        btns.style.display = 'flex';
        btns.style.gap = '8px';
        btns.style.marginTop = '8px';
        const copyBtn = document.createElement('button'); copyBtn.className = 'btn primary'; copyBtn.type = 'button'; copyBtn.textContent = 'Copy results';
        const emailBtn = document.createElement('button'); emailBtn.className = 'btn'; emailBtn.type = 'button'; emailBtn.textContent = 'Email summary';
        btns.appendChild(copyBtn);
        btns.appendChild(emailBtn);
        shareWrap.appendChild(btns);
        lb.appendChild(shareWrap);

        function doText() { return buildShareText(state.teams, state.results); }
        copyBtn.onclick = async () => {
            const text = doText();
            try {
                await navigator.clipboard.writeText(text);
            } catch {
                // no clipboard: show text in prompt as a last resort
                window.prompt('Copy the results:', text);
            }
        };
        emailBtn.onclick = () => { emailSummary(); };
    }
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

function emailSummary() {
    const subjectDate = new Date();
    const yyyy = subjectDate.getFullYear();
    const mm = String(subjectDate.getMonth() + 1).padStart(2, '0');
    const dd = String(subjectDate.getDate()).padStart(2, '0');
    const subject = `Futsal Teams & Results — ${yyyy}-${mm}-${dd}`;
    const body = buildEmailSummaryText(state.teams, state.results);
    const to = 'rubenvdkamp@gmail.com';
    const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    // Open default mail client with prefilled To/Subject/Body (mobile-friendly)
    window.location.href = mailto;
}
