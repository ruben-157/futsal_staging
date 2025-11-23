import { state } from '../state/storage.js';

export function celebrateWinner() {
    // Compute winners (supports co-winners on equal Pts and GD)
    const byId = new Map(state.teams.map(t => [t.id, { team: t, pts: 0, played: 0, gf: 0, ga: 0 }]));
    for (const key of Object.keys(state.results || {})) {
        const r = state.results[key];
        if (!r) continue;
        const { a, b, ga, gb } = r;
        if (ga == null || gb == null) continue;
        const A = byId.get(a); const B = byId.get(b);
        if (!A || !B) continue;
        A.played++; B.played++;
        A.gf += ga; B.gf += gb;
        A.ga += gb; B.ga += ga;
        if (ga > gb) { A.pts += 3; } else if (gb > ga) { B.pts += 3; } else { A.pts += 1; B.pts += 1; }
    }
    const rows = Array.from(byId.values()).sort((x, y) => y.pts - x.pts || y.gf - x.gf || x.team.name.localeCompare(y.team.name));
    if (rows.length) {
        const topPts = rows[0].pts;
        const topGD = (rows[0].gf - (rows[0].ga || 0));
        const coWinners = rows.filter(r => r.pts === topPts && ((r.gf - (r.ga || 0)) === topGD));
        const names = coWinners.map(r => r.team.name.toUpperCase());
        const list = names.length === 1 ? names[0]
            : (names.length === 2 ? `${names[0]} & ${names[1]}`
                : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`);
        showToast(`🎉 ${names.length > 1 ? 'WINNERS' : 'WINNER'}: ${list}!!`, 'winner');
    }
    launchConfetti();
}

export function showToast(text, extraClass) {
    const t = document.createElement('div');
    t.className = 'toast' + (extraClass ? (' ' + extraClass) : '');
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    t.innerHTML = `<span class="emoji">🎉</span><span>${text}</span>`;
    document.body.appendChild(t);
    setTimeout(() => { t.remove(); }, 4000);
}

export function launchConfetti() {
    // Simple confetti implementation
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
    const count = 100;
    for (let i = 0; i < count; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.background = colors[Math.floor(Math.random() * colors.length)];
        c.style.left = Math.random() * 100 + 'vw';
        c.style.animationDuration = (Math.random() * 2 + 2) + 's';
        c.style.opacity = Math.random();
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 4000);
    }
}
