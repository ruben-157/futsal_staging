import { reportWarning } from '../utils/validation.js';

export const ALLTIME_ALPHA = 5;
export const PLAYMAKER_CUTOFF_DATE = '2025-11-12';

export const BADGE_CONFIG = {
    latestTop: { icon: '⭐', label: 'Session Top Scorer', short: 'Session Top Scorer', desc: 'Led the latest session in goals.' },
    playmaker: { icon: '🎖️', label: 'Playmaker', short: 'Playmaker', desc: 'Highest points+goals contribution in the latest session.' },
    allTimeTop: { icon: '🥇', label: 'All-Time Topscorer', short: 'All-Time Topscorer', desc: 'Most total goals across all sessions.' },
    clutch: { icon: '🏆', label: 'Session Ace', short: 'Session Ace', desc: 'Most sessions finishing with the highest points.' },
    hatTrick: { icon: '⚽', label: 'Three In A Row', short: 'Three In A Row', desc: 'Scored in 3+ consecutive goal-tracked sessions.' },
    fourRow: { icon: '⚽', label: 'Four In A Row', short: 'Four In A Row', desc: 'Scored in 4+ consecutive goal-tracked sessions.' },
    fiveRow: { icon: '⚽', label: 'Five In A Row', short: 'Five In A Row', desc: 'Scored in 5+ consecutive goal-tracked sessions.' },
    sixRow: { icon: '⚽', label: 'Six In A Row', short: 'Six In A Row', desc: 'Scored in 6+ consecutive goal-tracked sessions.' },
    sevenRow: { icon: '⚽', label: 'Seven In A Row', short: 'Seven In A Row', desc: 'Scored in 7+ consecutive goal-tracked sessions.' },
    eightRow: { icon: '⚽', label: 'Eight In A Row', short: 'Eight In A Row', desc: 'Scored in 8+ consecutive goal-tracked sessions.' },
    nineRow: { icon: '⚽', label: 'Nine In A Row', short: 'Nine In A Row', desc: 'Scored in 9+ consecutive goal-tracked sessions.' },
    tenRow: { icon: '⚽', label: 'Ten In A Row', short: 'Ten In A Row', desc: 'Scored in 10+ consecutive goal-tracked sessions.' },
    sharpshooter: { icon: '🎯', label: 'Sharpshooter', short: 'Sharpshooter', desc: 'Averages 2+ goals per tracked session.' },
    ironMan: { icon: '🛡️', label: 'Iron Man', short: 'Iron Man', desc: 'Current streak of 6+ consecutive sessions.' },
    marathon: { icon: '🏃‍♂️', label: 'Marathon Man', short: 'Marathon Man', desc: 'Current streak of 15 consecutive sessions.' },
    addict: { icon: '🔥', label: 'Addict', short: 'Addict', desc: '90%+ attendance this season.' },
    clinical: { icon: '🥾', label: 'Clinical Finisher', short: 'Clinical Finisher', desc: 'Scored 5+ goals in a single session.' },
    elite: { icon: '🧠', label: 'Elite', short: 'Elite', desc: 'On the winning team in 3 consecutive sessions.' },
    master: { icon: '🥋', label: 'Master', short: 'Master', desc: 'On the winning team in 4 consecutive sessions.' },
    legend: { icon: '🦁', label: 'Legend', short: 'Legend', desc: 'On the winning team in 5 consecutive sessions.' },
    rocket: { icon: '📈', label: 'Rocket Rank', short: 'Rocket Rank', desc: 'Improved rank by 5+ positions since last session.' },
    form: { icon: '⚡', label: 'On Fire', short: 'On Fire', desc: 'Largest positive form swing (last 3 vs career PPM).' },
    coldStreak: { icon: '🥶', label: 'Cold Streak', short: 'Cold Streak', desc: 'Largest negative form swing (last 3 vs career PPM).' },
    mvp: { icon: '👑', label: 'Most Valuable Player', short: 'Most Valuable Player', desc: 'Highest Pts/Session with ≥60% attendance.' },
};

export const TROPHY_DESC = {
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

export const BADGE_PRIORITY = ['playmaker', 'clutch', 'latestTop', 'allTimeTop', 'mvp', 'clinical', 'legend', 'master', 'elite', 'tenRow', 'nineRow', 'eightRow', 'sevenRow', 'sixRow', 'fiveRow', 'fourRow', 'hatTrick', 'sharpshooter', 'form', 'coldStreak', 'ironMan', 'marathon', 'addict', 'rocket'];

// State for All-Time data
export let allTimeCache = { rows: null, warnings: [], skipped: 0, ts: 0 };
export let allTimeSort = { key: 'points', dir: 'desc' };
export let allTimeInsightBasis = 'points';

// Global caches for modal access
if (typeof window !== 'undefined') {
    window.__allTimeBadges = new Map();
    window.__allTimeSeries = null;
    window.__allTimeGoalSeries = null;
    window.__allTimeByDate = null;
    window.__allTimeRows = null;
    window.__badgeHistory = null;
    window.__coldStreakPlayer = null;
}

export function setAllTimeSort(key, dir) {
    allTimeSort.key = key;
    allTimeSort.dir = dir;
}

export function setAllTimeInsightBasis(basis) {
    allTimeInsightBasis = basis;
}

export async function loadAllTimeCSV(force = false) {
    if (allTimeCache.rows && !force) { return allTimeCache; }
    const url = 'ecgfutsal2025-26.txt?ts=' + Date.now();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
        reportWarning('AT001', 'All-Time fetch failed', { status: res.status, statusText: res.statusText });
        throw new Error('HTTP ' + res.status);
    }
    const text = await res.text();
    const parsed = parseCSVSimple(text);
    allTimeCache = { rows: parsed.rows, warnings: parsed.warnings, skipped: parsed.skipped, ts: Date.now() };
    if (parsed.skipped > 0 || (parsed.warnings && parsed.warnings.length)) {
        reportWarning('AT201', `All-Time CSV skipped ${parsed.skipped} row(s)`, parsed.warnings);
    }
    return allTimeCache;
}

export function splitCSVLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
            else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
            out.push(cur.trim());
            cur = '';
        } else {
            cur += ch;
        }
    }
    out.push(cur.trim());
    return out;
}

export function parseCSVSimple(text) {
    const t = text.replace(/^\uFEFF/, '');
    const lines = t.split(/\r?\n/).map(l => l.trimEnd());
    const out = [];
    const warnings = [];
    let skipped = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const normalized = line.replace(/\s+/g, '').toLowerCase();
        if (i === 0 && (normalized === 'date,player,points' || normalized === 'date,player,points,goals')) continue;
        const parts = splitCSVLine(line);
        if (parts.length < 3) {
            skipped++; warnings.push({ line: i + 1, reason: 'Too few columns' });
            continue;
        }
        const date = (parts[0] || '').trim();
        const player = (parts[1] || '').trim();
        const pointsStr = (parts[2] || '').trim();
        const goalsStr = (parts[3] || '').trim();
        const points = Number(pointsStr);
        let goals = null;
        if (parts.length >= 4) {
            if (goalsStr === '') { goals = 0; }
            else {
                const gNum = Number(goalsStr);
                if (Number.isFinite(gNum)) { goals = gNum; }
                else { goals = 0; warnings.push({ line: i + 1, reason: 'Goals not a number; defaulted to 0' }); }
            }
        }
        if (!date || !player || !Number.isFinite(points)) {
            skipped++;
            warnings.push({ line: i + 1, reason: 'Missing date/player/points' });
            continue;
        }
        out.push({ date, player, points, goals });
    }
    return { rows: out, warnings, skipped };
}

export function aggregateAllTime(rows) {
    const map = new Map();
    for (const { player, points, goals } of rows) {
        const cur = map.get(player) || { player, matches: 0, points: 0, goals: 0, goalSessions: 0 };
        cur.matches += 1;
        cur.points += Number(points) || 0;
        if (goals != null) {
            cur.goals += Number(goals) || 0;
            cur.goalSessions += 1;
        }
        map.set(player, cur);
    }
    return Array.from(map.values()).map(x => ({
        ...x,
        ppm: x.matches ? x.points / x.matches : 0,
        gpm: x.goalSessions ? x.goals / x.goalSessions : 0,
    }));
}

export function computeAllTimeThresholds(stats, totalSessions, alpha) {
    let totalPoints = 0, totalMatches = 0;
    for (const s of stats) { totalPoints += s.points; totalMatches += s.matches; }
    const mu = totalMatches > 0 ? (totalPoints / totalMatches) : 0;
    const minMatches = Math.max(2, Math.ceil((totalSessions || 0) * 0.1));
    const vals = []; const wts = [];
    for (const s of stats) {
        if (s.matches >= minMatches) {
            const smoothed = (s.points + alpha * mu) / (s.matches + alpha);
            vals.push(smoothed); wts.push(s.matches);
        }
    }
    let low, high;
    if (vals.length >= 5) {
        low = weightedPercentile(vals, wts, 1 / 3);
        high = weightedPercentile(vals, wts, 2 / 3);
    } else if (vals.length > 0) {
        low = Math.max(0, mu * 0.9);
        high = mu * 1.1;
        if (high - low < 0.1) { high = low + 0.1; }
    } else {
        low = 1.0; high = 2.0;
    }
    return { mu, alpha, minMatches, low, high };
}

export function weightedPercentile(values, weights, p) {
    const arr = values.map((v, i) => ({ v, w: weights[i] })).sort((a, b) => a.v - b.v);
    const totalW = arr.reduce((s, x) => s + x.w, 0);
    if (totalW <= 0) return arr.length ? arr[0].v : 0;
    const target = p * totalW;
    let cum = 0;
    for (const x of arr) {
        cum += x.w;
        if (cum >= target) return x.v;
    }
    return arr[arr.length - 1]?.v ?? 0;
}

export function countUniqueSessions(rows) {
    const dates = new Set();
    for (const r of rows) { if (r && r.date) dates.add(r.date); }
    return dates.size;
}

export function buildAllTimeSeries(rows) {
    const byPlayer = new Map();
    const byDate = new Map();
    for (const r of rows) {
        if (!r || !r.player || !r.date || !Number.isFinite(r.points)) continue;
        if (!byDate.has(r.date)) byDate.set(r.date, []);
        byDate.get(r.date).push({ player: r.player, points: Number(r.points) || 0 });
    }
    const dates = Array.from(byDate.keys()).sort();
    for (const d of dates) {
        const entries = byDate.get(d) || [];
        for (const e of entries) {
            const arr = byPlayer.get(e.player) || [];
            arr.push(e.points);
            byPlayer.set(e.player, arr);
        }
    }
    return byPlayer;
}

export function buildAllTimeGoalSeries(rows) {
    const byPlayer = new Map();
    const byDate = new Map();
    for (const r of rows) {
        if (!r || !r.player || !r.date) continue;
        if (!byDate.has(r.date)) byDate.set(r.date, []);
        const goalVal = (r.goals == null) ? null : (Number(r.goals) || 0);
        byDate.get(r.date).push({ player: r.player, goals: goalVal });
    }
    const dates = Array.from(byDate.keys()).sort();
    for (const d of dates) {
        const entries = byDate.get(d) || [];
        for (const e of entries) {
            if (e.goals == null) continue;
            const arr = byPlayer.get(e.player) || [];
            arr.push(e.goals);
            byPlayer.set(e.player, arr);
        }
    }
    return byPlayer;
}

export function buildAllTimeByDate(rows) {
    const byDate = new Map();
    for (const r of rows) {
        if (!r || !r.player || !r.date || !Number.isFinite(r.points)) continue;
        if (!byDate.has(r.date)) byDate.set(r.date, []);
        const goalVal = (r.goals == null) ? null : (Number(r.goals) || 0);
        byDate.get(r.date).push({ player: r.player, points: Number(r.points) || 0, goals: goalVal });
    }
    return byDate;
}

export function computeAllTimeBadges(rows, byDate, statsMap, preRanks, postRanks) {
    const badgeMap = new Map();
    if (!rows || !rows.length || !byDate) return badgeMap;
    const dates = Array.from(byDate.keys()).sort();
    if (!dates.length) return badgeMap;
    const players = Array.from(statsMap.keys());
    const perPlayer = new Map(players.map(p => [p, { goalStreak: 0, bestGoalStreak: 0, attendStreak: 0, bestAttendStreak: 0, winStreak: 0, bestWinStreak: 0 }]));
    const cumulative = new Map(players.map(p => [p, { matches: 0, points: 0, goals: 0, goalSessions: 0 }]));
    const pointsHistory = new Map(players.map(p => [p, []]));
    const sessionAceCounts = new Map(players.map(p => [p, 0]));
    const badgeHistory = {
        mvp: new Map(),
        latestTop: new Map(),
        allTimeTop: new Map(),
        playmaker: new Map(),
        ironMan: new Map(),
        marathon: new Map(),
        clinical: new Map(),
        elite: new Map(),
        master: new Map(),
        legend: new Map(),
        form: new Map(),
    };
    function addHistory(map, player, date) {
        const cur = map.get(player) || { count: 0, dates: [] };
        cur.count += 1;
        cur.dates.push(date);
        map.set(player, cur);
    }
    function addHistoryOnce(map, player, date) {
        if (map.has(player)) return;
        map.set(player, { count: 1, dates: [date] });
    }
    for (let di = 0; di < dates.length; di++) {
        const d = dates[di];
        const entries = byDate.get(d) || [];
        const entryMap = new Map(entries.map(e => [e.player, e]));
        let maxPoints = -Infinity;
        let minPoints = Infinity;
        let sessionMaxGoals = null;
        let sessionMaxContribution = -Infinity;
        for (const e of entries) {
            const pts = Number(e.points) || 0;
            if (pts > maxPoints) maxPoints = pts;
            if (pts < minPoints) minPoints = pts;
            const gVal = (e.goals != null) ? (Number(e.goals) || 0) : 0;
            if (gVal > 0 && (sessionMaxGoals === null || gVal > sessionMaxGoals)) { sessionMaxGoals = gVal; }
            const contrib = pts + gVal;
            if (contrib > sessionMaxContribution) { sessionMaxContribution = contrib; }
        }
        const hasWin = (entries.length > 0) && (maxPoints > minPoints);
        const winners = new Set();
        if (hasWin) {
            for (const e of entries) {
                const pts = Number(e.points) || 0;
                if (pts === maxPoints) winners.add(e.player);
            }
        }
        if (entries.length && maxPoints > -Infinity) {
            for (const e of entries) {
                const pts = Number(e.points) || 0;
                if (pts === maxPoints) {
                    sessionAceCounts.set(e.player, (sessionAceCounts.get(e.player) || 0) + 1);
                }
            }
        }
        for (const player of players) {
            const stat = perPlayer.get(player);
            const entry = entryMap.get(player);
            if (entry) {
                stat.attendStreak += 1;
                if (stat.attendStreak > stat.bestAttendStreak) stat.bestAttendStreak = stat.attendStreak;
                if (entry.goals != null && Number(entry.goals) > 0) {
                    stat.goalStreak += 1;
                } else {
                    stat.goalStreak = 0;
                }
                if (stat.goalStreak > stat.bestGoalStreak) stat.bestGoalStreak = stat.goalStreak;
                if (hasWin && winners.has(player)) {
                    stat.winStreak += 1;
                    if (stat.winStreak > stat.bestWinStreak) stat.bestWinStreak = stat.winStreak;
                    if (stat.winStreak === 3) {
                        addHistoryOnce(badgeHistory.elite, player, d);
                    }
                    if (stat.winStreak === 4) {
                        addHistoryOnce(badgeHistory.master, player, d);
                    }
                    if (stat.winStreak === 5) {
                        addHistoryOnce(badgeHistory.legend, player, d);
                    }
                } else {
                    stat.winStreak = 0;
                }
                const arr = pointsHistory.get(player);
                if (arr) { arr.push(Number(entry.points) || 0); }
                const agg = cumulative.get(player);
                if (agg) {
                    agg.matches += 1;
                    agg.points += Number(entry.points) || 0;
                    if (entry.goals != null) {
                        agg.goals += Number(entry.goals) || 0;
                        agg.goalSessions += 1;
                    }
                }
            } else {
                stat.attendStreak = 0;
                stat.winStreak = 0;
            }
        }
        for (const player of players) {
            const stat = perPlayer.get(player);
            if (stat && stat.attendStreak === 6) {
                addHistoryOnce(badgeHistory.ironMan, player, d);
            }
            if (stat && stat.attendStreak === 15) {
                addHistoryOnce(badgeHistory.marathon, player, d);
            }
        }
        if (sessionMaxGoals != null && sessionMaxGoals > 0) {
            for (const e of entries) {
                const gVal = (e.goals != null) ? (Number(e.goals) || 0) : 0;
                if (gVal === sessionMaxGoals) {
                    addHistory(badgeHistory.latestTop, e.player, d);
                    if (gVal >= 5) { addHistoryOnce(badgeHistory.clinical, e.player, d); }
                }
            }
        }
        if (entries.length && sessionMaxContribution > -Infinity && d >= PLAYMAKER_CUTOFF_DATE) {
            const contribList = entries.map(e => ({
                player: e.player,
                contrib: (Number(e.points) || 0) + ((e.goals != null) ? (Number(e.goals) || 0) : 0),
                goals: (e.goals != null) ? (Number(e.goals) || 0) : 0,
                points: Number(e.points) || 0
            }));
            contribList.sort((a, b) => b.contrib - a.contrib || b.goals - a.goals || b.points - a.points || a.player.localeCompare(b.player));
            const top = contribList[0];
            if (top && top.contrib === sessionMaxContribution) {
                addHistory(badgeHistory.playmaker, top.player, d);
            }
        }
        let maxGoalTotal = 0;
        for (const agg of cumulative.values()) {
            if (agg.goals > maxGoalTotal) maxGoalTotal = agg.goals;
        }
        if (maxGoalTotal > 0) {
            for (const [player, agg] of cumulative.entries()) {
                if (agg.goals === maxGoalTotal) { addHistory(badgeHistory.allTimeTop, player, d); }
            }
        }
        const totalSessionsSoFar = di + 1;
        let mvpPlayerSession = null;
        let bestPPMSession = 0;
        for (const [player, agg] of cumulative.entries()) {
            if (agg.matches <= 0) continue;
            const attendanceRate = agg.matches / totalSessionsSoFar;
            if (attendanceRate < 0.6) continue;
            const ppmVal = agg.points / agg.matches;
            if (ppmVal > bestPPMSession) {
                bestPPMSession = ppmVal;
                mvpPlayerSession = player;
            }
        }
        if (mvpPlayerSession && bestPPMSession > 0) {
            addHistory(badgeHistory.mvp, mvpPlayerSession, d);
        }
        let sessionBestFormPlayer = null;
        let sessionBestFormDelta = 0;
        for (const player of players) {
            if (!entryMap.has(player)) continue;
            const historyPts = pointsHistory.get(player) || [];
            const last3 = historyPts.slice(-3);
            const last3Avg = last3.length ? (last3.reduce((s, v) => s + v, 0) / last3.length) : 0;
            const agg = cumulative.get(player) || {};
            const career = agg.matches ? (agg.points / agg.matches) : 0;
            const delta = last3Avg - career;
            if (delta > 0 && (sessionBestFormPlayer === null || delta > sessionBestFormDelta)) {
                sessionBestFormPlayer = player;
                sessionBestFormDelta = delta;
            }
        }
        if (sessionBestFormPlayer) {
            addHistory(badgeHistory.form, sessionBestFormPlayer, d);
        }
    }
    const latestDate = dates[dates.length - 1];
    const latestEntries = byDate.get(latestDate) || [];
    const latestMap = new Map(latestEntries.map(e => [e.player, e]));
    let maxGoals = null;
    for (const entry of latestEntries) {
        if (entry && entry.goals != null) {
            const g = Number(entry.goals) || 0;
            if (g > 0 && (maxGoals === null || g > maxGoals)) { maxGoals = g; }
        }
    }
    let bestFormPlayer = null;
    let bestFormDelta = 0;
    const formDeltas = new Map();
    let mvpPlayer = null;
    let bestPPM = 0;
    let allTimeTopPlayer = null;
    let maxTotalGoals = 0;
    let playmakerPlayer = null;
    let bestContribution = -Infinity;
    for (const player of players) {
        const stats = perPlayer.get(player) || { bestGoalStreak: 0, bestAttendStreak: 0 };
        const agg = statsMap.get(player) || {};
        const hasGoalData = agg.goalSessions && agg.goalSessions > 0;
        const history = pointsHistory.get(player) || [];
        const last3 = history.slice(-3);
        const last3Avg = last3.length ? (last3.reduce((s, v) => s + v, 0) / last3.length) : 0;
        const career = agg.ppm || 0;
        const deltaForm = last3Avg - career;
        const flags = {
            latestTop: false,
            allTimeTop: false,
            clutch: false,
            mvp: false,
            hatTrick: false,
            fourRow: false,
            fiveRow: false,
            sixRow: false,
            sevenRow: false,
            eightRow: false,
            nineRow: false,
            tenRow: false,
            sharpshooter: hasGoalData && (agg.gpm || 0) >= 2,
            ironMan: stats.attendStreak >= 6 && stats.attendStreak < 15,
            marathon: stats.attendStreak >= 15,
            addict: false,
            clinical: false,
            elite: stats.winStreak >= 3 && stats.winStreak < 4,
            master: stats.winStreak >= 4 && stats.winStreak < 5,
            legend: stats.winStreak >= 5,
            rocket: false,
            form: false,
            coldStreak: false,
        };
        const streakTiers = [
            { key: 'tenRow', min: 10 },
            { key: 'nineRow', min: 9 },
            { key: 'eightRow', min: 8 },
            { key: 'sevenRow', min: 7 },
            { key: 'sixRow', min: 6 },
            { key: 'fiveRow', min: 5 },
            { key: 'fourRow', min: 4 },
            { key: 'hatTrick', min: 3 },
        ];
        const bestGoalStreak = stats.bestGoalStreak || 0;
        const earnedStreak = streakTiers.find(t => bestGoalStreak >= t.min);
        if (earnedStreak) { flags[earnedStreak.key] = true; }
        formDeltas.set(player, deltaForm);
        if (deltaForm > 0) {
            if (!bestFormPlayer || deltaForm > bestFormDelta) {
                bestFormPlayer = player;
                bestFormDelta = deltaForm;
            }
        }
        if (preRanks && postRanks) {
            const pre = preRanks.get(player);
            const post = postRanks.get(player);
            if (pre != null && post != null && (pre - post) >= 5) {
                flags.rocket = true;
            }
        }
        const totalSessions = dates.length;
        if (totalSessions > 0) {
            const attendanceRate = (agg.matches || 0) / totalSessions;
            if (attendanceRate >= 0.6) {
                if (!mvpPlayer || (agg.ppm || 0) > bestPPM) {
                    mvpPlayer = player;
                    bestPPM = agg.ppm || 0;
                }
            }
            if (attendanceRate > 0.9) {
                flags.addict = true;
            }
        }
        if ((agg.goals || 0) > maxTotalGoals) {
            maxTotalGoals = agg.goals || 0;
            allTimeTopPlayer = player;
        }
        const latestEntry = latestMap.get(player);
        if (latestEntry) {
            const goalsVal = latestEntry.goals != null ? Number(latestEntry.goals) || 0 : 0;
            if (maxGoals != null && goalsVal > 0 && goalsVal === maxGoals) {
                flags.latestTop = true;
                if (goalsVal >= 5) {
                    flags.clinical = true;
                }
            }
            const contribution = (Number(latestEntry.points) || 0) + goalsVal;
            if (contribution > bestContribution) {
                bestContribution = contribution;
                playmakerPlayer = player;
            }
        }
        const badgeList = BADGE_PRIORITY.filter(id => flags[id]);
        badgeMap.set(player, badgeList);
    }
    if (bestFormPlayer && bestFormDelta > 0 && badgeMap.has(bestFormPlayer)) {
        const list = badgeMap.get(bestFormPlayer);
        if (list && !list.includes('form')) list.unshift('form');
    }
    let coldStreakPlayer = null;
    let coldStreakDelta = null;
    for (const [player, delta] of formDeltas.entries()) {
        if (delta < 0 && (coldStreakDelta === null || delta < coldStreakDelta)) {
            coldStreakDelta = delta;
            coldStreakPlayer = player;
        }
    }
    if (typeof window !== 'undefined') window.__coldStreakPlayer = coldStreakPlayer;
    if (coldStreakPlayer != null) {
        const existing = badgeMap.get(coldStreakPlayer) || [];
        if (!existing.includes('coldStreak')) {
            badgeMap.set(coldStreakPlayer, ['coldStreak', ...existing]);
        }
    }
    if (playmakerPlayer && bestContribution > -Infinity && latestDate >= PLAYMAKER_CUTOFF_DATE && badgeMap.has(playmakerPlayer)) {
        const list = badgeMap.get(playmakerPlayer);
        if (list && !list.includes('playmaker')) list.unshift('playmaker');
    }
    if (mvpPlayer && badgeMap.has(mvpPlayer)) {
        const list = badgeMap.get(mvpPlayer);
        if (list && !list.includes('mvp')) list.unshift('mvp');
    }
    const topAce = Math.max(0, ...sessionAceCounts.values());
    if (topAce > 0) {
        for (const [player, count] of sessionAceCounts.entries()) {
            if (count === topAce && badgeMap.has(player)) {
                const list = badgeMap.get(player);
                if (list && !list.includes('clutch')) list.unshift('clutch');
            }
        }
    }
    if (allTimeTopPlayer && badgeMap.has(allTimeTopPlayer)) {
        const list = badgeMap.get(allTimeTopPlayer);
        if (list && !list.includes('allTimeTop')) list.unshift('allTimeTop');
    }
    if (typeof window !== 'undefined') window.__badgeHistory = badgeHistory;
    return badgeMap;
}

export function getPlayerBadges(player) {
    const map = typeof window !== 'undefined' ? window.__allTimeBadges : null;
    if (!map) return [];
    return map.get(player) || [];
}

export function getPlayerBadgeHistory(player) {
    const hist = typeof window !== 'undefined' ? (window.__badgeHistory || {}) : {};
    const labels = {
        mvp: 'Most Valuable Player',
        latestTop: 'Session Top Scorer',
        allTimeTop: 'All-Time Topscorer',
        playmaker: 'Playmaker',
        ironMan: 'Iron Man',
        marathon: 'Marathon Man',
        clinical: 'Clinical Finisher',
        elite: 'Elite',
        master: 'Master',
        legend: 'Legend',
        form: 'On Fire'
    };
    const out = [];
    for (const key of Object.keys(labels)) {
        const map = hist[key];
        if (map && map.has(player)) {
            const entry = map.get(player) || { count: 0, dates: [] };
            out.push({ key, label: labels[key], count: entry.count || 0, dates: entry.dates || [] });
        }
    }
    return out;
}

export function getAllDatesAsc() {
    const byDate = typeof window !== 'undefined' ? (window.__allTimeByDate || new Map()) : new Map();
    return Array.from(byDate.keys()).sort();
}

export function getPlayerPointsAcrossDates(player) {
    const byDate = typeof window !== 'undefined' ? (window.__allTimeByDate || new Map()) : new Map();
    const dates = getAllDatesAsc();
    const points = [];
    const absent = [];
    for (const d of dates) {
        const arr = byDate.get(d) || [];
        const hit = arr.find(e => e.player === player);
        if (hit) {
            points.push(Number(hit.points) || 0);
            absent.push(false);
        } else {
            points.push(0);
            absent.push(true);
        }
    }
    return { dates, points, absent };
}

export function getPlayerGoalsAcrossDates(player) {
    const byDate = typeof window !== 'undefined' ? (window.__allTimeByDate || new Map()) : new Map();
    const dates = getAllDatesAsc();
    const goals = [];
    const absent = [];
    for (const d of dates) {
        const arr = byDate.get(d) || [];
        const hit = arr.find(e => e.player === player);
        if (hit) {
            if (hit.goals == null) {
                goals.push(null);
            } else {
                goals.push(Number(hit.goals) || 0);
            }
            absent.push(false);
        } else {
            goals.push(null);
            absent.push(true);
        }
    }
    return { dates, goals, absent };
}

export function getAllPlayers() {
    const rows = typeof window !== 'undefined' ? (window.__allTimeRows || []) : [];
    const set = new Set();
    for (const r of rows) { if (r && r.player) set.add(r.player); }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
}

export function getPlayerRankAcrossDates(player) {
    const byDate = typeof window !== 'undefined' ? (window.__allTimeByDate || new Map()) : new Map();
    const dates = getAllDatesAsc();
    const allPlayers = getAllPlayers();
    const cumPts = new Map();
    const cumMat = new Map();
    for (const p of allPlayers) { cumPts.set(p, 0); cumMat.set(p, 0); }
    const ranks = [];
    for (const d of dates) {
        const arr = byDate.get(d) || [];
        for (const e of arr) {
            const p = e.player; const pts = Number(e.points) || 0;
            cumPts.set(p, (cumPts.get(p) || 0) + pts);
            cumMat.set(p, (cumMat.get(p) || 0) + 1);
        }
        const snap = allPlayers.map(p => {
            const pts = cumPts.get(p) || 0; const m = cumMat.get(p) || 0;
            const ppm = m > 0 ? (pts / m) : 0;
            return { player: p, points: pts, matches: m, ppm };
        });
        snap.sort((a, b) => (b.points - a.points) || (b.ppm - a.ppm) || (b.matches - a.matches) || a.player.localeCompare(b.player));
        const idx = snap.findIndex(x => x.player === player);
        ranks.push(idx >= 0 ? (idx + 1) : allPlayers.length);
    }
    return { dates, ranks };
}

export function avgLastN(arr, n) {
    if (!arr || arr.length === 0) return 0;
    const start = Math.max(0, arr.length - n);
    let sum = 0; let cnt = 0;
    for (let i = start; i < arr.length; i++) { sum += arr[i]; cnt++; }
    return cnt ? (sum / cnt) : 0;
}

export function sortAllTimeStats(stats) {
    const k = allTimeSort.key; const dir = allTimeSort.dir === 'asc' ? 1 : -1;
    stats.sort((a, b) => {
        if (k === 'player') return a.player.localeCompare(b.player) * dir;
        if (k === 'matches') return (a.matches - b.matches) * dir || a.player.localeCompare(b.player);
        if (k === 'points') return (a.points - b.points) * dir || (a.ppm - b.ppm) * dir || (a.matches - b.matches) * dir || a.player.localeCompare(b.player);
        if (k === 'ppm') return ((a.ppm - b.ppm) * dir) || (a.points - b.points) * dir || (a.matches - b.matches) * dir || a.player.localeCompare(b.player);
        if (k === 'goals') return (a.goals - b.goals) * dir || ((a.gpm || 0) - (b.gpm || 0)) * dir || (a.matches - b.matches) * dir || a.player.localeCompare(b.player);
        if (k === 'gpm') {
            const aHas = a.goalSessions && a.goalSessions > 0;
            const bHas = b.goalSessions && b.goalSessions > 0;
            if (aHas && !bHas) return -1;
            if (!aHas && bHas) return 1;
            if (!aHas && !bHas) return (a.points - b.points) * dir || a.player.localeCompare(b.player);
            const cmp = (a.gpm - b.gpm) * dir;
            if (cmp !== 0) return cmp;
            return (a.goals - b.goals) * dir || (a.matches - b.matches) * dir || a.player.localeCompare(b.player);
        }
        return 0;
    });
}

export function makeRankMap(sortedStats) {
    const map = new Map();
    for (let i = 0; i < sortedStats.length; i++) {
        map.set(sortedStats[i].player, i);
    }
    return map;
}
