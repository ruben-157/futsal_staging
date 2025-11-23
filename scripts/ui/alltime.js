import {
    allTimeCache, allTimeSort, allTimeInsightBasis,
    setAllTimeSort, setAllTimeInsightBasis,
    loadAllTimeCSV, aggregateAllTime, countUniqueSessions,
    buildAllTimeSeries, buildAllTimeGoalSeries, buildAllTimeByDate,
    computeAllTimeBadges, getPlayerBadges, getPlayerBadgeHistory,
    getAllDatesAsc, getPlayerPointsAcrossDates, getPlayerGoalsAcrossDates,
    getPlayerRankAcrossDates, avgLastN, sortAllTimeStats, makeRankMap,
    BADGE_CONFIG, TROPHY_DESC
} from '../logic/alltime.js';
import { buildBarChart, buildLineChart } from './charts.js';
import { reportWarning } from '../utils/validation.js';

// Helper: Date formatting
function formatDateLong(iso) {
    if (!iso || typeof iso !== 'string') return iso || '';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    const [y, m, d] = parts;
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const mi = Math.max(1, Math.min(12, parseInt(m, 10))) - 1;
    const di = parseInt(d, 10);
    return `${isNaN(di) ? d : di} ${months[mi] || m} ${y}`;
}
function formatDateShort(iso) {
    if (!iso || typeof iso !== 'string') return iso || '';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    const [y, m, d] = parts;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mi = Math.max(1, Math.min(12, parseInt(m, 10))) - 1;
    const di = parseInt(d, 10);
    return `${isNaN(di) ? d : di} ${months[mi] || m}`;
}

// Helper: Scroll locking
let __prevHtmlOverflow = '';
let __prevBodyOverflow = '';
let __preventTouchMove = null;
let __openModalEl = null;
function lockBodyScroll() {
    try {
        __prevHtmlOverflow = document.documentElement.style.overflow;
        __prevBodyOverflow = document.body.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        __preventTouchMove = function (e) {
            const modal = __openModalEl;
            if (!modal) { e.preventDefault(); return; }
            if (!modal.contains(e.target)) { e.preventDefault(); }
        };
        document.addEventListener('touchmove', __preventTouchMove, { passive: false });
    } catch (_) { }
}
function unlockBodyScroll() {
    try {
        document.documentElement.style.overflow = __prevHtmlOverflow || '';
        document.body.style.overflow = __prevBodyOverflow || '';
        if (__preventTouchMove) { document.removeEventListener('touchmove', __preventTouchMove); __preventTouchMove = null; }
    } catch (_) { }
}

export async function renderAllTime(force = false) {
    const wrap = document.getElementById('allTimeContent');
    if (!wrap) return;
    wrap.setAttribute('aria-busy', 'true');
    wrap.innerHTML = '';
    const loading = document.createElement('div');
    loading.className = 'notice';
    loading.textContent = 'Loading all-time stats…';
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-live', 'polite');
    wrap.appendChild(loading);

    try {
        const { rows, warnings, skipped } = await loadAllTimeCSV(force);
        const data = rows || [];
        // window.__allTimeBadges = new Map(); // Handled in logic module if needed, but logic module exports state
        const stats = aggregateAllTime(data);
        const statsMap = new Map(stats.map(s => [s.player, s]));
        sortAllTimeStats(stats);
        wrap.innerHTML = '';
        if (stats.length === 0) {
            const warnNotice = buildAllTimeCSVWarningNotice(warnings, skipped);
            if (warnNotice) wrap.appendChild(warnNotice);
            const empty = document.createElement('div');
            empty.className = 'notice';
            empty.textContent = 'No data found.';
            wrap.appendChild(empty);
        } else {
            const totalSessions = countUniqueSessions(data);
            const series = buildAllTimeSeries(data);
            const goalSeries = buildAllTimeGoalSeries(data);
            const byDate = buildAllTimeByDate(data);
            // Update global caches for modal access (if needed by other modules, though we import from logic)
            // logic module updates its own state, but we might need to sync window globals if legacy code relies on them
            // For now, we rely on logic module exports.

            const latestDate = data.map(r => r.date).sort().slice(-1)[0];
            const preRows = data.filter(r => r.date !== latestDate);
            const preStats = aggregateAllTime(preRows);
            sortAllTimeStats(preStats);
            const preRanks = makeRankMap(preStats);
            const postRanks = makeRankMap(stats);

            // Compute badges (updates internal state in logic module)
            computeAllTimeBadges(data, byDate, statsMap, preRanks, postRanks);

            const warnNotice = buildAllTimeCSVWarningNotice(warnings, skipped);
            if (warnNotice) wrap.appendChild(warnNotice);

            const pillBar = buildLatestSyncPill(latestDate);
            if (pillBar) wrap.appendChild(pillBar);

            const headerCards = buildAllTimeHeaderCards(preRows, data, byDate, latestDate, allTimeInsightBasis);
            if (headerCards) wrap.appendChild(headerCards);

            wrap.appendChild(buildAllTimeTable(stats, totalSessions, series, preRanks, postRanks, latestDate));
        }
        wrap.setAttribute('aria-busy', 'false');
    } catch (err) {
        wrap.innerHTML = '';
        const msg = document.createElement('div');
        msg.className = 'notice error';
        msg.textContent = 'Failed to load all-time data. Ensure the file exists and is accessible.';
        msg.setAttribute('role', 'alert');
        msg.setAttribute('aria-live', 'assertive');
        wrap.appendChild(msg);
        wrap.setAttribute('aria-busy', 'false');
        console.error(err);
    }
}

function buildAllTimeCSVWarningNotice(warnings, skipped) {
    if ((!warnings || !warnings.length) && !skipped) return null;
    const div = document.createElement('div');
    div.className = 'notice warning';
    div.style.marginBottom = '16px';
    const parts = [];
    if (skipped) parts.push(`Skipped ${skipped} invalid rows.`);
    if (warnings && warnings.length) parts.push(`${warnings.length} warnings (e.g. line ${warnings[0].line}: ${warnings[0].reason}).`);
    div.textContent = 'Data issues: ' + parts.join(' ');
    return div;
}

function buildLatestSyncPill(latestDate) {
    if (!latestDate) return null;
    const headerBar = document.createElement('div');
    headerBar.style.display = 'flex';
    headerBar.style.justifyContent = 'flex-end';
    headerBar.style.alignItems = 'center';
    headerBar.style.margin = '0 0 6px 0';
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('width', '14');
    icon.setAttribute('height', '14');
    icon.setAttribute('aria-hidden', 'true');
    icon.style.marginRight = '6px';
    icon.style.flexShrink = '0';
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '3'); rect.setAttribute('y', '5'); rect.setAttribute('width', '18'); rect.setAttribute('height', '16'); rect.setAttribute('rx', '2');
    rect.setAttribute('fill', 'none'); rect.setAttribute('stroke', 'var(--muted)'); rect.setAttribute('stroke-width', '2');
    const divider = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    divider.setAttribute('x1', '3'); divider.setAttribute('y1', '9'); divider.setAttribute('x2', '21'); divider.setAttribute('y2', '9');
    divider.setAttribute('stroke', 'var(--muted)'); divider.setAttribute('stroke-width', '2'); divider.setAttribute('stroke-linecap', 'round');
    const ringL = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ringL.setAttribute('x1', '8'); ringL.setAttribute('y1', '3'); ringL.setAttribute('x2', '8'); ringL.setAttribute('y2', '7');
    ringL.setAttribute('stroke', 'var(--muted)'); ringL.setAttribute('stroke-width', '2'); ringL.setAttribute('stroke-linecap', 'round');
    const ringR = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ringR.setAttribute('x1', '16'); ringR.setAttribute('y1', '3'); ringR.setAttribute('x2', '16'); ringR.setAttribute('y2', '7');
    ringR.setAttribute('stroke', 'var(--muted)'); ringR.setAttribute('stroke-width', '2'); ringR.setAttribute('stroke-linecap', 'round');
    icon.appendChild(rect); icon.appendChild(divider); icon.appendChild(ringL); icon.appendChild(ringR);
    const label = document.createElement('span');
    label.title = 'Latest session date';
    label.textContent = 'Synced with latest match: ' + formatDateLong(latestDate);
    label.style.color = 'var(--muted)';
    label.style.fontSize = '12px';
    headerBar.appendChild(icon);
    headerBar.appendChild(label);
    return headerBar;
}

function buildAllTimeHeaderCards(preRows, rows, byDate, latestDate, basis) {
    if (!rows || !rows.length) return null;
    const preAggArr = aggregateAllTime(preRows || []);
    const postAggArr = aggregateAllTime(rows);
    const preAgg = new Map(preAggArr.map(x => [x.player, x]));
    const postAgg = new Map(postAggArr.map(x => [x.player, x]));
    const cards = document.createElement('div');
    cards.className = 'stat-cards';

    function makeCard(title, labelText, deltaConf, sub, onClick, emoji) {
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
        if (emoji) {
            const em = document.createElement('span');
            em.className = 'stat-emoji';
            em.textContent = emoji;
            em.setAttribute('aria-hidden', 'true');
            card.appendChild(em);
        }
        const meta = document.createElement('div'); meta.className = 'stat-meta';
        const t = document.createElement('div'); t.className = 'stat-title'; t.textContent = title;
        const v = document.createElement('div'); v.className = 'stat-value';
        if (labelText) {
            const left = document.createElement('span');
            left.textContent = labelText + ' ';
            v.appendChild(left);
        }
        if (deltaConf && typeof deltaConf.value === 'number') {
            const val = deltaConf.value;
            const decimals = (typeof deltaConf.decimals === 'number') ? deltaConf.decimals : 0;
            const suffix = deltaConf.suffix || '';
            const sign = val >= 0 ? '+' : '-';
            const span = document.createElement('span');
            span.className = (val >= 0 ? 'delta-pos' : 'delta-neg');
            span.textContent = sign + Math.abs(val).toFixed(decimals) + suffix;
            v.appendChild(span);
        }
        const s = document.createElement('div'); s.className = 'stat-sub'; s.textContent = sub || '';
        meta.appendChild(t); meta.appendChild(v); meta.appendChild(s);
        card.appendChild(meta);
        if (typeof onClick === 'function') {
            card.addEventListener('click', onClick);
            card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } });
        }
        return card;
    }

    function sortByBasis(arr, key) {
        const a = arr.slice();
        if (key === 'ppm') {
            a.sort((x, y) => (y.ppm - x.ppm) || (y.points - x.points) || (y.matches - x.matches) || x.player.localeCompare(y.player));
        } else {
            a.sort((x, y) => (y.points - x.points) || (y.ppm - x.ppm) || (y.matches - x.matches) || x.player.localeCompare(y.player));
        }
        return a;
    }
    const preOrder = sortByBasis(preAggArr, basis === 'ppm' ? 'ppm' : 'points');
    const postOrder = sortByBasis(postAggArr, basis === 'ppm' ? 'ppm' : 'points');
    const preRanks = new Map(preOrder.map((s, i) => [s.player, i]));
    const postRanks = new Map(postOrder.map((s, i) => [s.player, i]));

    let up = null, down = null;
    postRanks.forEach((postIdx, player) => {
        const preIdx = preRanks.get(player);
        if (preIdx !== undefined) {
            const move = preIdx - postIdx;
            if (up === null || move > up.move || (move === up.move && (postIdx < up.postRank || (postIdx === up.postRank && player < up.player)))) {
                up = { player, move, preRank: preIdx, postRank: postIdx };
            }
            if (down === null || move < down.move || (move === down.move && (postIdx > down.postRank || (postIdx === down.postRank && player < down.player)))) {
                down = { player, move, preRank: preIdx, postRank: postIdx };
            }
        }
    });

    const latestEntries = (byDate && latestDate) ? (byDate.get(latestDate) || []) : [];
    const playedLatest = new Set(latestEntries.map(e => e.player));
    const MIN_PRE = 3;
    function ppmDeltaCandidates(minPre) {
        const arr = [];
        playedLatest.forEach(p => {
            const pre = preAgg.get(p);
            const post = postAgg.get(p);
            if (!post) return;
            const preM = pre ? pre.matches : 0;
            const prePPM = pre ? pre.ppm : 0;
            const postPPM = post.ppm;
            if (preM >= minPre && prePPM > 0) {
                const delta = postPPM - prePPM;
                const pct = (delta / prePPM) * 100;
                arr.push({ player: p, delta, pct, prePPM, postPPM, preM });
            }
        });
        return arr;
    }
    let deltas = ppmDeltaCandidates(MIN_PRE);
    if (deltas.length === 0) { deltas = ppmDeltaCandidates(1); }
    let upPPM = null, downPPM = null;
    if (deltas.length) {
        for (const d of deltas) {
            if (upPPM === null || d.pct > upPPM.pct || (d.pct === upPPM.pct && (d.preM > upPPM.preM || (d.preM === upPPM.preM && d.player < upPPM.player)))) upPPM = d;
            if (downPPM === null || d.pct < downPPM.pct || (d.pct === downPPM.pct && (d.preM < downPPM.preM || (d.preM === downPPM.preM && d.player < downPPM.player)))) downPPM = d;
        }
    }

    if (up) {
        const climberCard = makeCard('Largest Rank Gain', up.player, { value: up.move, decimals: 0 }, `${up.preRank + 1} → ${up.postRank + 1}`, () => openPlayerModal(up.player), '📈');
        cards.appendChild(climberCard);
    }
    if (down) {
        const declinerCard = makeCard('Largest Rank Loss', down.player, { value: down.move, decimals: 0 }, `${down.preRank + 1} → ${down.postRank + 1}`, () => openPlayerModal(down.player), '📉');
        cards.appendChild(declinerCard);
    }
    if (upPPM) {
        const incCard = makeCard('Largest Pts/Session Increase', upPPM.player, { value: upPPM.pct, decimals: 1, suffix: '%' }, `${(upPPM.prePPM ?? 0).toFixed(2)} → ${(upPPM.postPPM ?? 0).toFixed(2)}`, () => openPlayerModal(upPPM.player), '➕');
        cards.appendChild(incCard);
    }
    if (downPPM) {
        const decCard = makeCard('Largest Pts/Session Decrease', downPPM.player, { value: downPPM.pct, decimals: 1, suffix: '%' }, `${(downPPM.prePPM ?? 0).toFixed(2)} → ${(downPPM.postPPM ?? 0).toFixed(2)}`, () => openPlayerModal(downPPM.player), '➖');
        cards.appendChild(decCard);
    }
    return cards;
}

function buildAllTimeTable(stats, totalSessions, series, preRanks, postRanks, latestDate) {
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const table = document.createElement('table');
    table.className = 'wide-table';
    table.setAttribute('aria-label', 'All-Time leaderboard');
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    const thRank = document.createElement('th');
    thRank.textContent = '#';
    thRank.setAttribute('scope', 'col');
    trHead.appendChild(thRank);
    const cols = [
        { key: 'player', label: 'Player', style: 'width:36%' },
        { key: 'badges', label: 'Badges', sortable: false },
        { key: 'matches', label: 'Matches' },
        { key: 'points', label: 'Points' },
        { key: 'ppm', label: 'Pts/Session' },
        { key: 'goals', label: 'Goals' },
        { key: 'gpm', label: 'Goals/Session' },
    ];
    for (const col of cols) {
        const th = document.createElement('th');
        if (col.style) th.setAttribute('style', col.style);
        const sortable = col.sortable !== false && col.key !== 'badges';
        th.textContent = col.label + (sortable && allTimeSort.key === col.key ? (allTimeSort.dir === 'asc' ? ' ▲' : ' ▼') : '');
        th.className = sortable ? 'sortable' : '';
        th.setAttribute('scope', 'col');
        if (sortable) {
            th.setAttribute('aria-sort', allTimeSort.key === col.key ? (allTimeSort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
            th.style.cursor = 'pointer';
            th.title = 'Sort by ' + col.label;
            th.addEventListener('click', () => {
                if (allTimeSort.key === col.key) {
                    setAllTimeSort(col.key, (allTimeSort.dir === 'asc') ? 'desc' : 'asc');
                } else {
                    setAllTimeSort(col.key, (col.key === 'player') ? 'asc' : 'desc');
                }
                if (col.key === 'points' || col.key === 'ppm') {
                    setAllTimeInsightBasis(col.key);
                }
                renderAllTime(false);
            });
        }
        if (col.key === 'badges') {
            th.style.textAlign = 'right';
            th.classList.add('badges-col');
        }
        trHead.appendChild(th);
    }
    thead.appendChild(trHead);
    const tbody = document.createElement('tbody');
    const podiumActive = (allTimeSort && (allTimeSort.key === 'points' || allTimeSort.key === 'ppm'));

    // We need to identify cold streak player here or rely on logic module
    // Logic module sets window.__coldStreakPlayer, we can access it or recompute.
    // Accessing window.__coldStreakPlayer is easiest as logic module sets it.
    const coldStreakPlayer = typeof window !== 'undefined' ? window.__coldStreakPlayer : null;

    stats.forEach((r, idx) => {
        const tr = document.createElement('tr');
        const tdPos = document.createElement('td');
        if (podiumActive && idx === 0) { tdPos.textContent = '🥇'; }
        else if (podiumActive && idx === 1) { tdPos.textContent = '🥈'; }
        else if (podiumActive && idx === 2) { tdPos.textContent = '🥉'; }
        else { tdPos.textContent = String(idx + 1); }
        const tdN = document.createElement('td');
        tdN.className = 'player-row-name';
        const nameLine = document.createElement('span');
        nameLine.className = 'player-name-line';
        nameLine.textContent = r.player;
        if (podiumActive && preRanks && postRanks) {
            const pre = preRanks.get(r.player);
            const post = postRanks.get(r.player);
            if (pre !== undefined && post !== undefined) {
                const move = pre - post;
                if (move !== 0) {
                    const arrow = document.createElement('span');
                    arrow.style.marginLeft = '6px';
                    arrow.style.fontWeight = '700';
                    arrow.style.fontSize = '14px';
                    const signed = move > 0 ? `+${move}` : `${move}`;
                    if (move > 0) { arrow.textContent = ` ▲ ${signed}`; arrow.style.color = 'var(--accent-2)'; }
                    else { arrow.textContent = ` ▼ ${signed}`; arrow.style.color = 'var(--danger)'; }
                    arrow.title = `Position: ${pre + 1} → ${post + 1} (${signed} since last session)`;
                    nameLine.appendChild(arrow);
                }
            }
        }
        let badgeList = getPlayerBadges(r.player);
        if ((!badgeList || badgeList.length === 0) && coldStreakPlayer === r.player) {
            badgeList = ['coldStreak'];
        }
        tdN.appendChild(nameLine);
        const tdB = document.createElement('td');
        tdB.className = 'badges-cell';
        tdB.style.minWidth = '200px';
        tdB.style.textAlign = 'right';
        tdB.style.whiteSpace = 'nowrap';
        tdB.style.paddingRight = '12px';
        if (badgeList && badgeList.length) {
            const badgesWrap = document.createElement('span');
            badgesWrap.className = 'player-badges';
            badgesWrap.style.flexWrap = 'nowrap';
            badgesWrap.style.whiteSpace = 'nowrap';
            badgesWrap.style.justifyContent = 'flex-end';
            badgesWrap.style.marginLeft = '0';
            badgesWrap.style.display = 'inline-flex';
            badgesWrap.style.alignItems = 'center';
            for (const id of badgeList) {
                const badgeEl = renderPlayerBadge(id, 'short');
                if (badgeEl) { badgesWrap.appendChild(badgeEl); }
            }
            if (badgesWrap.childNodes.length > 0) { tdB.appendChild(badgesWrap); }
        } else {
            tdB.textContent = '—';
            tdB.style.color = 'var(--muted)';
        }
        const tdM = document.createElement('td');
        tdM.textContent = (totalSessions && totalSessions > 0) ? `${r.matches}/${totalSessions}` : String(r.matches);
        const tdP = document.createElement('td'); tdP.textContent = String(r.points);
        const tdA = document.createElement('td');
        const ppmBadge = document.createElement('span');
        const ppm = r.ppm;
        ppmBadge.textContent = ppm.toFixed(2);
        if (ppm > 6) { ppmBadge.className = 'badge badge-good'; ppmBadge.title = 'Good: > 6 pts/session'; }
        else if (ppm >= 4) { ppmBadge.className = 'badge badge-avg'; ppmBadge.title = 'Average: 4–6 pts/session'; }
        else { ppmBadge.className = 'badge badge-low'; ppmBadge.title = 'Low: < 4 pts/session'; }
        tdA.appendChild(ppmBadge);
        const tdGoals = document.createElement('td');
        tdGoals.textContent = String(r.goals || 0);
        const tdGpm = document.createElement('td');
        if (r.goalSessions && r.goalSessions > 0) {
            const gpmBadge = document.createElement('span');
            const gpm = r.gpm || 0;
            gpmBadge.textContent = gpm.toFixed(2);
            if (gpm <= 0.5) { gpmBadge.className = 'badge badge-low'; }
            else if (gpm <= 1) { gpmBadge.className = 'badge badge-avg'; }
            else { gpmBadge.className = 'badge badge-good'; }
            gpmBadge.title = `Goals per session (${r.goalSessions} tracked)`;
            tdGpm.appendChild(gpmBadge);
        } else {
            tdGpm.textContent = '—';
            tdGpm.style.color = 'var(--muted)';
        }
        tr.appendChild(tdPos); tr.appendChild(tdN); tr.appendChild(tdB); tr.appendChild(tdM); tr.appendChild(tdP); tr.appendChild(tdA); tr.appendChild(tdGoals); tr.appendChild(tdGpm);
        tr.style.cursor = 'pointer';
        tr.title = 'View player history';
        tr.addEventListener('click', () => openPlayerModal(r.player));
        tbody.appendChild(tr);
    });
    table.appendChild(thead); table.appendChild(tbody); wrap.appendChild(table);
    return wrap;
}

function renderPlayerBadge(id, variant) {
    const conf = BADGE_CONFIG[id];
    if (!conf) return null;
    const span = document.createElement('span');
    span.className = 'player-badge' + (id === 'mvp' ? ' player-badge-premium' : '');
    span.setAttribute('aria-label', conf.label);
    span.title = conf.desc;
    const icon = document.createElement('strong');
    icon.textContent = conf.icon;
    span.appendChild(icon);
    if (variant === 'long') {
        const text = document.createElement('span');
        text.textContent = conf.label;
        span.appendChild(text);
    } else {
        if (id === 'mvp') {
            const text = document.createElement('span');
            text.textContent = conf.short || conf.label;
            span.appendChild(text);
        }
    }
    return span;
}

export function openPlayerModal(player) {
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('playerModal');
    const title = document.getElementById('playerModalTitle');
    const body = document.getElementById('playerModalBody');
    title.textContent = '👤 ' + player;
    body.innerHTML = '';
    __openModalEl = modal;
    lockBodyScroll();
    function preventOverlayScroll(e) { e.preventDefault(); }

    const modalBadges = getPlayerBadges(player);
    if (modalBadges && modalBadges.length) {
        const badgeTitle = document.createElement('div');
        badgeTitle.className = 'stat-title';
        badgeTitle.style.margin = '0 0 4px 0';
        badgeTitle.textContent = 'Current Badges';
        body.appendChild(badgeTitle);
        const badgeWrap = document.createElement('div');
        badgeWrap.style.display = 'flex';
        badgeWrap.style.flexDirection = 'column';
        badgeWrap.style.gap = '8px';
        for (const id of modalBadges) {
            const card = document.createElement('div');
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.style.gap = '12px';
            card.style.padding = '10px 12px';
            card.style.border = '1px solid var(--border)';
            card.style.borderRadius = '12px';
            card.style.background = '#fff';
            card.style.boxShadow = '0 1px 2px rgba(15,23,42,0.05)';
            const icon = document.createElement('div');
            icon.style.fontSize = '24px';
            icon.textContent = BADGE_CONFIG[id]?.icon || '🏅';
            const meta = document.createElement('div');
            meta.style.display = 'flex';
            meta.style.flexDirection = 'column';
            meta.style.gap = '2px';
            const titleEl = document.createElement('div');
            titleEl.style.fontWeight = '700';
            titleEl.textContent = BADGE_CONFIG[id]?.label || 'Badge';
            const desc = document.createElement('div');
            desc.className = 'stat-sub';
            desc.textContent = BADGE_CONFIG[id]?.desc || '';
            meta.appendChild(titleEl);
            meta.appendChild(desc);
            card.appendChild(icon);
            card.appendChild(meta);
            badgeWrap.appendChild(card);
        }
        body.appendChild(badgeWrap);
    }

    const badgeHistory = getPlayerBadgeHistory(player).filter(h => (h.count || 0) > 0);
    if (badgeHistory.length) {
        const histTitle = document.createElement('div');
        histTitle.className = 'stat-title';
        histTitle.style.margin = '8px 0 4px 0';
        histTitle.textContent = 'Trophy Room';
        body.appendChild(histTitle);
        const histWrap = document.createElement('div');
        histWrap.style.display = 'flex';
        histWrap.style.flexDirection = 'column';
        histWrap.style.gap = '10px';
        histWrap.style.padding = '10px';
        histWrap.style.borderRadius = '14px';
        histWrap.style.background = 'linear-gradient(135deg, #fef3c7 0%, #f5f3ff 50%, #e0f2fe 100%)';
        histWrap.style.border = '1px solid var(--border)';
        for (const entry of badgeHistory) {
            const card = document.createElement('div');
            card.style.display = 'flex';
            card.style.alignItems = 'center';
            card.style.gap = '14px';
            card.style.padding = '10px 12px';
            card.style.border = '1px solid var(--border)';
            card.style.borderRadius = '12px';
            card.style.background = '#fff';
            card.style.boxShadow = '0 1px 2px rgba(15,23,42,0.05)';
            const icon = document.createElement('div');
            icon.style.fontSize = '24px';
            icon.textContent = BADGE_CONFIG[entry.key]?.icon || '🏅';
            const meta = document.createElement('div');
            meta.style.display = 'flex';
            meta.style.flexDirection = 'column';
            meta.style.gap = '2px';
            meta.style.flex = '1';
            const titleEl = document.createElement('div');
            titleEl.style.fontWeight = '700';
            titleEl.textContent = entry.label;
            const desc = document.createElement('div');
            desc.className = 'stat-sub';
            const baseDesc = TROPHY_DESC[entry.key] || BADGE_CONFIG[entry.key]?.desc || 'Badge earned';
            const descText = baseDesc && baseDesc.includes('{N}') ? baseDesc.replace('{N}', String(entry.count || 0)) : baseDesc;
            desc.textContent = descText;
            meta.appendChild(titleEl);
            meta.appendChild(desc);
            const count = document.createElement('div');
            count.style.fontWeight = '800';
            count.style.fontSize = '16px';
            count.style.color = '#ffffff';
            count.style.padding = '6px 12px';
            count.style.borderRadius = '999px';
            count.style.background = 'linear-gradient(135deg, #fde68a, #a855f7, #38bdf8)';
            count.style.border = '1px solid rgba(255,255,255,0.7)';
            count.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
            count.textContent = String(entry.count || 0);
            card.appendChild(icon);
            card.appendChild(meta);
            card.appendChild(count);
            histWrap.appendChild(card);
        }
        body.appendChild(histWrap);
    }

    try {
        const cards = buildPlayerInsightCards(player);
        if (cards) body.appendChild(cards);
    } catch (_) { }

    // Charts
    try {
        const seriesAll = getPlayerPointsAcrossDates(player);
        if (seriesAll && seriesAll.points && seriesAll.points.length) {
            const titlePts = document.createElement('div');
            titlePts.className = 'stat-title';
            titlePts.style.margin = '4px 0';
            titlePts.textContent = 'Points per Session';
            body.appendChild(titlePts);
            const chartWrap = document.createElement('div');
            chartWrap.style.marginBottom = '8px';
            chartWrap.style.width = '100%';
            const byDate = buildAllTimeByDate(allTimeCache.rows || []);
            const tops = seriesAll.dates.map(d => {
                const arr = byDate.get(d) || [];
                if (!arr.length) return false;
                let maxPts = -Infinity; for (const e of arr) { const v = Number(e.points) || 0; if (v > maxPts) maxPts = v; }
                return arr.some(e => e.player === player && (Number(e.points) || 0) === maxPts);
            });
            const svg = buildBarChart(seriesAll.points, { width: 360, height: 160, fill: 'var(--accent)', labels: seriesAll.dates, absences: seriesAll.absent, tops, formatDate: formatDateShort });
            if (svg) {
                chartWrap.appendChild(svg);
                const legend = document.createElement('div');
                legend.className = 'stat-sub';
                legend.style.display = 'flex'; legend.style.alignItems = 'center'; legend.style.gap = '12px'; legend.style.marginTop = '4px';
                const item1 = document.createElement('div'); item1.style.display = 'flex'; item1.style.alignItems = 'center'; item1.style.gap = '6px';
                item1.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="6" width="14" height="12" fill="currentColor"/></svg><span>Points (present)</span>`;
                const item2 = document.createElement('div'); item2.style.display = 'flex'; item2.style.alignItems = 'center'; item2.style.gap = '6px';
                item2.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="3" fill="currentColor"/></svg><span>0 points (present)</span>`;
                const item3 = document.createElement('div'); item3.style.display = 'flex'; item3.style.alignItems = 'center'; item3.style.gap = '6px';
                item3.innerHTML = `<span style="display:inline-block; width:14px; height:14px; line-height:14px; text-align:center; color:#9ca3af; font-weight:700">×</span><span>Absent</span>`;
                const item4 = document.createElement('div'); item4.style.display = 'flex'; item4.style.alignItems = 'center'; item4.style.gap = '6px'; item4.innerHTML = `<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"5\" y=\"6\" width=\"14\" height=\"12\" fill=\"#f59e0b\"/></svg><span>Highest of session</span>`; legend.appendChild(item1); legend.appendChild(item2); legend.appendChild(item3); legend.appendChild(item4);
                chartWrap.appendChild(legend);
                body.appendChild(chartWrap);
            }
        }
    } catch (_) { }

    try {
        const goalsSeries = getPlayerGoalsAcrossDates(player);
        if (goalsSeries && goalsSeries.goals && goalsSeries.goals.some(v => v !== null)) {
            const titleGoals = document.createElement('div');
            titleGoals.className = 'stat-title';
            titleGoals.style.margin = '4px 0';
            titleGoals.textContent = 'Goals per Session';
            body.appendChild(titleGoals);
            const chartWrap = document.createElement('div');
            chartWrap.style.marginBottom = '8px';
            chartWrap.style.width = '100%';
            const values = goalsSeries.goals.map(v => v == null ? 0 : v);
            const noDataFlags = goalsSeries.goals.map(v => v == null);
            const svg = buildBarChart(values, { width: 360, height: 160, fill: 'var(--accent-2)', labels: goalsSeries.dates, absences: noDataFlags, formatDate: formatDateShort });
            if (svg) {
                chartWrap.appendChild(svg);
                const legend = document.createElement('div');
                legend.className = 'stat-sub';
                legend.style.display = 'flex';
                legend.style.alignItems = 'center';
                legend.style.gap = '12px';
                legend.style.marginTop = '4px';
                const item1 = document.createElement('div'); item1.style.display = 'flex'; item1.style.alignItems = 'center'; item1.style.gap = '6px';
                item1.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="6" width="14" height="12" fill="currentColor"/></svg><span>Goals (present)</span>`;
                const item2 = document.createElement('div'); item2.style.display = 'flex'; item2.style.alignItems = 'center'; item2.style.gap = '6px';
                item2.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="3" fill="currentColor"/></svg><span>0 goals (present)</span>`;
                const item3 = document.createElement('div'); item3.style.display = 'flex'; item3.style.alignItems = 'center'; item3.style.gap = '6px';
                item3.innerHTML = `<span style="display:inline-block; width:14px; height:14px; line-height:14px; text-align:center; color:#9ca3af; font-weight:700">×</span><span>No goal data (absent or pre-tracking)</span>`;
                legend.appendChild(item1); legend.appendChild(item2); legend.appendChild(item3);
                chartWrap.appendChild(legend);
                body.appendChild(chartWrap);
            }
        }
    } catch (_) { }

    try {
        const rankSeries = getPlayerRankAcrossDates(player);
        if (rankSeries && rankSeries.ranks && rankSeries.ranks.length) {
            const titleRank = document.createElement('div');
            titleRank.className = 'stat-title';
            titleRank.style.margin = '4px 0';
            titleRank.textContent = 'Rank by Total Points';
            body.appendChild(titleRank);
            const chartWrap2 = document.createElement('div');
            chartWrap2.style.marginBottom = '8px';
            chartWrap2.style.width = '100%';
            const svg2 = buildLineChart(rankSeries.ranks, { width: 360, height: 140, stroke: '#6B7280', strokeWidth: 2, dotRadius: 2, labels: rankSeries.dates, min: 1, formatDate: formatDateShort });
            if (svg2) { chartWrap2.appendChild(svg2); body.appendChild(chartWrap2); }
        }
    } catch (_) { }

    const rows = (allTimeCache.rows || []).filter(r => r.player === player);
    const matches = rows.length;
    const totalPts = rows.reduce((s, r) => s + (Number(r.points) || 0), 0);
    const ppm = matches ? (totalPts / matches) : 0;
    const series = (window.__allTimeSeries && window.__allTimeSeries.get(player)) || rows.map(r => Number(r.points) || 0);
    const last3 = avgLastN(series, 3);
    const goalRows = rows.filter(r => r.goals != null);
    const goalSessions = goalRows.length;
    const totalGoals = goalRows.reduce((s, r) => s + (Number(r.goals) || 0), 0);
    const gpm = goalSessions ? (totalGoals / goalSessions) : 0;
    const goalSeries = (window.__allTimeGoalSeries && window.__allTimeGoalSeries.get(player)) || goalRows.map(r => Number(r.goals) || 0);
    const last3Goals = avgLastN(goalSeries, 3);
    const headerStats = document.createElement('div');
    headerStats.className = 'notice';
    headerStats.style.marginBottom = '8px';
    const delta = last3 - ppm;
    const arrow = Math.abs(delta) >= 0.5 ? (delta > 0 ? ' ▲' : ' ▼') : '';
    let goalText = ' • Goals: —';
    if (goalSessions) {
        const goalDelta = last3Goals - gpm;
        const goalArrow = Math.abs(goalDelta) >= 0.3 ? (goalDelta > 0 ? ' ▲' : ' ▼') : '';
        const goalSuffix = goalArrow ? ` • Last 3 Goals: ${last3Goals.toFixed(2)}${goalArrow}` : '';
        goalText = ` • Goals: ${totalGoals} • Goals/Session: ${gpm.toFixed(2)}${goalSuffix}`;
    }
    headerStats.textContent = `Matches: ${matches} • Points: ${totalPts} • Pts/Session: ${ppm.toFixed(2)}${arrow ? ` • Last 3: ${last3.toFixed(2)}${arrow}` : ''}${goalText}`;
    body.appendChild(headerStats);

    const closeBtn = document.getElementById('playerModalClose');
    const close = () => { overlay.hidden = true; modal.hidden = true; closeBtn.onclick = null; overlay.onclick = null; overlay.removeEventListener('touchmove', preventOverlayScroll); __openModalEl = null; unlockBodyScroll(); };
    closeBtn.onclick = close;
    overlay.onclick = close;
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); } }, { once: true });

    overlay.hidden = false; modal.hidden = false;
    overlay.addEventListener('touchmove', preventOverlayScroll, { passive: false });
}

function buildPlayerInsightCards(player) {
    const rows = allTimeCache.rows || [];
    const byDate = buildAllTimeByDate(rows);
    const datesAsc = getAllDatesAsc();
    const pointsSeries = getPlayerPointsAcrossDates(player);
    const attendedFlags = pointsSeries.absent.map(a => !a);
    const attendedCount = attendedFlags.filter(Boolean).length;
    const totalSessions = datesAsc.length;
    const latestDate = datesAsc[datesAsc.length - 1] || '';

    const cardWrap = document.createElement('div');
    cardWrap.className = 'stat-cards';
    function makeCard(title, mainEl, subText) {
        const card = document.createElement('div');
        card.className = 'stat-card';
        const meta = document.createElement('div'); meta.className = 'stat-meta';
        const t = document.createElement('div'); t.className = 'stat-title'; t.textContent = title;
        const v = document.createElement('div'); v.className = 'stat-value';
        if (typeof mainEl === 'string') { v.textContent = mainEl; } else if (mainEl) { v.appendChild(mainEl); }
        const s = document.createElement('div'); s.className = 'stat-sub'; s.textContent = subText || '';
        meta.appendChild(t); meta.appendChild(v); meta.appendChild(s);
        card.appendChild(meta);
        return card;
    }

    try {
        let topDays = 0;
        for (const d of datesAsc) {
            const arr = byDate.get(d) || [];
            if (!arr.length) continue;
            let maxPts = -Infinity; for (const e of arr) { const v = Number(e.points) || 0; if (v > maxPts) maxPts = v; }
            if (arr.some(e => e.player === player && (Number(e.points) || 0) === maxPts)) topDays++;
        }
        const pctTop = attendedCount > 0 ? Math.round((topDays / attendedCount) * 100) : 0;
        const full = makeCard('Percent of Sessions with highest score', `${pctTop}%`, `${topDays} / ${attendedCount}`);
        full.style.gridColumn = '1 / -1';
        cardWrap.appendChild(full);
    } catch (_) { }

    const attPct = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 0;
    cardWrap.appendChild(makeCard('Attendance Rate', `${attendedCount}/${totalSessions} • ${attPct}%`, latestDate ? `Latest: ${formatDateShort(latestDate)}` : ''));

    let longest = 0, current = 0;
    for (let i = 0; i < attendedFlags.length; i++) {
        if (attendedFlags[i]) { current += 1; longest = Math.max(longest, current); }
        else { current = 0; }
    }
    cardWrap.appendChild(makeCard('Longest Streak', `${longest} sessions`, current > 0 ? `Current: ${current}` : ''));

    const ptsAttended = pointsSeries.points.filter((v, idx) => attendedFlags[idx]);
    const matches = ptsAttended.length;
    const totalPts = ptsAttended.reduce((s, v) => s + v, 0);
    const careerPPM = matches > 0 ? (totalPts / matches) : 0;
    const last3Vals = ptsAttended.slice(-3);
    const last3 = last3Vals.length > 0 ? (last3Vals.reduce((s, v) => s + v, 0) / last3Vals.length) : 0;
    let deltaPct = null;
    if (matches >= 2) { deltaPct = (careerPPM > 0 ? ((last3 - careerPPM) / careerPPM * 100) : (last3 > 0 ? Infinity : 0)); }
    const formVal = document.createElement('span');
    if (deltaPct === null) { formVal.textContent = '—'; }
    else if (!Number.isFinite(deltaPct)) {
        formVal.className = 'delta-pos'; formVal.textContent = '+∞%';
    } else {
        formVal.className = deltaPct >= 0 ? 'delta-pos' : 'delta-neg';
        const sign = deltaPct >= 0 ? '+' : '-';
        formVal.textContent = `${sign}${Math.abs(deltaPct).toFixed(1)}%`;
    }
    cardWrap.appendChild(makeCard('Form (Last 3 vs Career)', formVal, `${last3.toFixed(2)} vs ${careerPPM.toFixed(2)}`));

    let bestStreak = 0, bestStartIdx = -1, bestEndIdx = -1;
    let curStreak = 0, curStartIdx = -1;
    for (let i = 0; i < datesAsc.length; i++) {
        const d = datesAsc[i];
        const arr = byDate.get(d) || [];
        if (!arr.length) { curStreak = 0; curStartIdx = -1; continue; }
        let maxPts = -Infinity; for (const e of arr) { if (typeof e.points === 'number' && e.points > maxPts) maxPts = e.points; }
        const won = arr.some(e => e.player === player && e.points === maxPts);
        if (won) {
            if (curStreak === 0) curStartIdx = i;
            curStreak += 1;
            if (curStreak > bestStreak) { bestStreak = curStreak; bestStartIdx = curStartIdx; bestEndIdx = i; }
        } else {
            curStreak = 0; curStartIdx = -1;
        }
    }
    let rangeText = '';
    if (bestStreak > 0 && bestStartIdx !== -1 && bestEndIdx !== -1) {
        const rs = datesAsc[bestStartIdx];
        const re = datesAsc[bestEndIdx];
        const rsTxt = formatDateShort(rs);
        const reTxt = formatDateShort(re);
        rangeText = (rs === re) ? (`${rsTxt}`) : (`${rsTxt} – ${reTxt}`);
    }
    cardWrap.appendChild(makeCard('Highest Score Streak', `${bestStreak} sessions`, rangeText));

    return cardWrap;
}
