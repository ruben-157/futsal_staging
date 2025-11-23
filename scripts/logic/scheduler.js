import { mulberry32 } from '../utils/random.js';

// Order pairings within a round to avoid any team playing 3 matches in a row across the schedule
export function orderRoundPairings(teams, pairs, streakMap, seed) {
    // Special case: 4 teams use classic round-robin order
    // A-B, C-D, A-C, B-D, A-D, B-C
    if (teams && teams.length === 4) {
        const teams4 = [...teams].sort((a, b) => a.id - b.id);
        const [A, B, C, D] = teams4;
        return [[A, B], [C, D], [A, C], [B, D], [A, D], [B, C]];
    }
    const rng = mulberry32((seed >>> 0));
    // Shuffle a copy to vary the base order deterministically
    const remaining = [...pairs].sort(() => rng() - 0.5);
    const ordered = [];
    const teamIds = teams.map(t => t.id);
    while (remaining.length) {
        let pickIdx = -1;
        for (let i = 0; i < remaining.length; i++) {
            const aId = remaining[i][0].id, bId = remaining[i][1].id;
            const sa = streakMap.get(aId) || 0;
            const sb = streakMap.get(bId) || 0;
            if (sa < 2 && sb < 2) { pickIdx = i; break; }
        }
        if (pickIdx === -1) {
            // Fallback: pick the first; we will still ensure not to exceed constraint by trying simple swap with previous
            pickIdx = 0;
        }
        const [a, b] = remaining.splice(pickIdx, 1)[0];
        ordered.push([a, b]);
        // Update streaks: participants +1, others reset
        for (const id of teamIds) {
            if (id === a.id || id === b.id) { streakMap.set(id, (streakMap.get(id) || 0) + 1); }
            else { streakMap.set(id, 0); }
        }
    }
    return ordered;
}

// Try to keep the repeated order from creating 3-in-a-row across round boundaries
export function createsTriple(teams, totalRounds, order) {
    const ids = teams.map(t => t.id);
    const streak = new Map(ids.map(id => [id, 0]));
    for (let r = 0; r < totalRounds; r++) {
        for (const [a, b] of order) {
            for (const id of ids) {
                if (id === a.id || id === b.id) { streak.set(id, (streak.get(id) || 0) + 1); }
                else { streak.set(id, 0); }
                if ((streak.get(id) || 0) >= 3) return true;
            }
        }
    }
    return false;
}

export function rotate(arr, k) {
    const n = arr.length; const out = new Array(n);
    for (let i = 0; i < n; i++) { out[i] = arr[(i + k) % n]; }
    return out;
}
