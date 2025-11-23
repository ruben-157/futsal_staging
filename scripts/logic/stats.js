// Aggregate per-player goal totals and appearance counts for the active tournament
export function computeGoalStats(teams, results) {
    const totals = new Map();
    const playedCounts = new Map();
    if (!teams || teams.length === 0) return { totals, playedCounts };
    const teamById = new Map(teams.map(t => [t.id, t]));
    const isGuest = (name) => String(name || '').trim().toLowerCase() === 'guest player';
    for (const key of Object.keys(results || {})) {
        const r = results[key]; if (!r) continue;
        const { a, b, ga, gb, gpa, gpb } = r || {};
        if (gpa) {
            for (const [name, n] of Object.entries(gpa)) {
                if (n > 0 && !isGuest(name)) {
                    totals.set(name, (totals.get(name) || 0) + n);
                }
            }
        }
        if (gpb) {
            for (const [name, n] of Object.entries(gpb)) {
                if (n > 0 && !isGuest(name)) {
                    totals.set(name, (totals.get(name) || 0) + n);
                }
            }
        }
        const played = ga != null && gb != null;
        if (played) {
            const teamA = teamById.get(a);
            const teamB = teamById.get(b);
            if (teamA) {
                for (const name of teamA.members) {
                    playedCounts.set(name, (playedCounts.get(name) || 0) + 1);
                }
            }
            if (teamB) {
                for (const name of teamB.members) {
                    playedCounts.set(name, (playedCounts.get(name) || 0) + 1);
                }
            }
        }
    }
    return { totals, playedCounts };
}

// CSV escaper for fields (wrap in quotes and escape quotes)
export function csvEscape(s) {
    const str = String(s ?? '');
    if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
    return str;
}

// Build per-player points+goals summary as CSV: Date,Player,Points,Goals
export function buildEmailSummaryText(teams, results) {
    const lines = [];
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const { totals: goalTotals } = computeGoalStats(teams, results);
    if (!teams || teams.length < 2) {
        lines.push('Date,Player,Points,Goals');
        return lines.join('\n');
    }
    const teamById = new Map(teams.map(t => [t.id, t]));
    const points = new Map();
    for (const t of teams) { for (const name of (t.members || [])) points.set(name, 0); }
    for (const key of Object.keys(results || {})) {
        const r = results[key]; if (!r) continue;
        const { a, b, ga, gb } = r;
        if (ga == null || gb == null) continue;
        const ta = teamById.get(a); const tb = teamById.get(b); if (!ta || !tb) continue;
        if (ga > gb) { for (const n of (ta.members || [])) points.set(n, (points.get(n) || 0) + 3); }
        else if (gb > ga) { for (const n of (tb.members || [])) points.set(n, (points.get(n) || 0) + 3); }
        else { for (const n of (ta.members || [])) points.set(n, (points.get(n) || 0) + 1); for (const n of (tb.members || [])) points.set(n, (points.get(n) || 0) + 1); }
    }
    const rows = Array.from(points.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    lines.push('Date,Player,Points,Goals');
    for (const [name, pts] of rows) {
        const goals = goalTotals.get(name) || 0;
        lines.push(`${dateStr},${csvEscape(name)},${pts},${goals}`);
    }
    return lines.join('\n');
}

// Build a concise summary of what is shown on the Leaderboard
export function buildShareText(teams, results) {
    if (!teams || teams.length === 0) return 'Futsal results';
    // Leaderboard data
    const byId = new Map(teams.map(t => [t.id, { team: t, pts: 0, played: 0, gf: 0, ga: 0 }]));
    for (const key of Object.keys(results || {})) {
        const r = results[key]; if (!r) continue;
        const { a, b, ga, gb } = r;
        if (ga == null || gb == null) continue;
        const A = byId.get(a); const B = byId.get(b); if (!A || !B) continue;
        A.played++; B.played++;
        A.gf += ga; B.gf += gb;
        A.ga += gb; B.ga += ga;
        if (ga > gb) A.pts += 3; else if (gb > ga) B.pts += 3; else { A.pts += 1; B.pts += 1; }
    }
    const rows = Array.from(byId.values()).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.team.name.localeCompare(y.team.name));
    let winnerLine = 'Winner';
    if (rows.length) {
        const topPts = rows[0].pts;
        const topGD = (rows[0].gf - rows[0].ga);
        const coWinners = rows.filter(r => r.pts === topPts && ((r.gf - r.ga) === topGD));
        const names = coWinners.map(r => r.team.name);
        const list = names.length === 1 ? names[0]
            : (names.length === 2 ? `${names[0]} & ${names[1]}`
                : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`);
        winnerLine = `${names.length > 1 ? 'WINNERS' : 'WINNER'}: ${list}`;
    }
    const lines = [];
    lines.push(`🏆 ${winnerLine}`);
    lines.push('Standings:');
    rows.forEach((r, i) => {
        const gd = r.gf - r.ga; const gdStr = gd >= 0 ? `+${gd}` : `${gd}`;
        const members = r.team.members.join(', ');
        lines.push(`${i + 1}) ${r.team.name} — ${r.pts} pts (GD ${gdStr}) • ${members}`);
    });
    // Include Top Scorers section if it is visible in the view
    const scorerTotals = new Map();
    const isGuest = (name) => String(name || '').trim().toLowerCase() === 'guest player';
    for (const key of Object.keys(results || {})) {
        const r = results[key]; if (!r) continue;
        const { gpa, gpb } = r;
        if (gpa) { for (const [name, n] of Object.entries(gpa)) { if (n > 0 && !isGuest(name)) { scorerTotals.set(name, (scorerTotals.get(name) || 0) + n); } } }
        if (gpb) { for (const [name, n] of Object.entries(gpb)) { if (n > 0 && !isGuest(name)) { scorerTotals.set(name, (scorerTotals.get(name) || 0) + n); } } }
    }
    const scorerRows = Array.from(scorerTotals.entries()).filter(([_, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (scorerRows.length) {
        lines.push('Top Scorers:');
        const top = scorerRows.slice(0, 8);
        lines.push(top.map(([n, g]) => `${n} ${g}`).join(', '));
    }
    return lines.join('\n');
}
