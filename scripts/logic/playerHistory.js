export function formatDateShort(dateStr){
  if(!dateStr) return '';
  const d = new Date(dateStr);
  if(Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

export function avgLastN(arr, n){
  if(!arr || arr.length === 0) return 0;
  const start = Math.max(0, arr.length - n);
  let sum = 0; let cnt = 0;
  for(let i=start;i<arr.length;i++){ sum += arr[i]; cnt++; }
  return cnt ? (sum/cnt) : 0;
}

export function getAllDatesAsc(byDate = window.__allTimeByDate || new Map()){
  return Array.from(byDate.keys()).sort();
}

export function getPlayerPointsAcrossDates(player, byDate = window.__allTimeByDate || new Map()){
  const dates = getAllDatesAsc(byDate);
  const points = [];
  const absent = [];
  for(const d of dates){
    const arr = byDate.get(d) || [];
    const hit = arr.find(e => e.player === player);
    if(hit){
      points.push(Number(hit.points) || 0);
      absent.push(false);
    } else {
      points.push(0);
      absent.push(true);
    }
  }
  return { dates, points, absent };
}

export function getPlayerGoalsAcrossDates(player, byDate = window.__allTimeByDate || new Map()){
  const dates = getAllDatesAsc(byDate);
  const goals = [];
  const absent = [];
  for(const d of dates){
    const arr = byDate.get(d) || [];
    const hit = arr.find(e => e.player === player);
    if(hit){
      if(hit.goals == null){
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

export function getAllPlayers(rows = window.__allTimeRows || []){
  const set = new Set();
  for(const r of rows){ if(r && r.player) set.add(r.player); }
  return Array.from(set.values()).sort((a,b)=> a.localeCompare(b));
}

export function getPlayerRankAcrossDates(player, byDate = window.__allTimeByDate || new Map(), rows = window.__allTimeRows || []){
  const dates = getAllDatesAsc(byDate);
  const allPlayers = getAllPlayers(rows);
  const cumPts = new Map();
  const cumMat = new Map();
  for(const p of allPlayers){ cumPts.set(p, 0); cumMat.set(p, 0); }
  const ranks = [];
  for(const d of dates){
    const arr = byDate.get(d) || [];
    for(const e of arr){
      const p = e.player; const pts = Number(e.points) || 0;
      cumPts.set(p, (cumPts.get(p)||0) + pts);
      cumMat.set(p, (cumMat.get(p)||0) + 1);
    }
    const snap = allPlayers.map(p => {
      const pts = cumPts.get(p)||0; const m = cumMat.get(p)||0;
      const ppm = m>0 ? (pts/m) : 0;
      return { player:p, points:pts, matches:m, ppm };
    });
    snap.sort((a,b)=> (b.points - a.points) || (b.ppm - a.ppm) || (b.matches - a.matches) || a.player.localeCompare(b.player));
    const idx = snap.findIndex(x => x.player === player);
    ranks.push(idx >= 0 ? (idx+1) : allPlayers.length);
  }
  return { dates, ranks };
}

export function buildLineChart(points, opts){
  const width = (opts && opts.width) || 360;
  const height = (opts && opts.height) || 140;
  const padTop = 8;
  const padRight = 10;
  const padBottom = 22;
  const padLeft = 34;
  const stroke = (opts && opts.stroke) || 'var(--accent)';
  const strokeWidth = (opts && opts.strokeWidth) || 2;
  const dot = (opts && opts.dotRadius) || 2;
  const labels = (opts && opts.labels) || null;
  const absences = (opts && opts.absences) || null;
  const arr = Array.isArray(points) ? points.map(v => (typeof v === 'number' && Number.isFinite(v)) ? v : null) : [];
  const n = arr.length;
  const numericVals = arr.filter(v => v !== null);
  if(!n || numericVals.length === 0){ return null; }
  const maxVal = Math.max(0, ...numericVals);
  const minVal = (opts && typeof opts.min === 'number') ? opts.min : 0;
  const innerW = Math.max(1, width - padLeft - padRight);
  const innerH = Math.max(1, height - padTop - padBottom);
  const dx = n > 1 ? (innerW / (n-1)) : 0;
  const range = Math.max(1e-6, maxVal - minVal);
  function xAt(i){ return padLeft + i*dx; }
  function yAt(v){ return padTop + (1 - (v - minVal) / range) * innerH; }

  let d = '';
  let segmentOpen = false;
  for(let i=0;i<n;i++){
    const isAbsent = !!(absences && absences[i]);
    const val = arr[i];
    if(isAbsent || val === null){ segmentOpen = false; continue; }
    const x = xAt(i); const y = yAt(val);
    if(!segmentOpen){ d += 'M' + x + ' ' + y + ' '; segmentOpen = true; }
    else{ d += 'L' + x + ' ' + y + ' '; }
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label','Points by session');

  function computeYTicks(minV, maxV){
    if(maxV <= minV) return [minV, maxV];
    let span = maxV - minV;
    let step = 1;
    if(span > 20) step = 5; else if(span > 10) step = 2; else step = 1;
    const out = [];
    let start = Math.ceil(minV / step) * step;
    if(start > minV) start = minV;
    for(let v=start; v<=maxV; v+=step){ out.push(v); }
    if(out[0] !== minV) out.unshift(minV);
    if(out[out.length-1] !== maxV) out.push(maxV);
    return Array.from(new Set(out));
  }
  const yTicks = computeYTicks(minVal, maxVal);
  const yAxis = document.createElementNS('http://www.w3.org/2000/svg','line');
  yAxis.setAttribute('x1', String(padLeft)); yAxis.setAttribute('x2', String(padLeft));
  yAxis.setAttribute('y1', String(padTop)); yAxis.setAttribute('y2', String(padTop + innerH));
  yAxis.setAttribute('stroke', 'var(--border)'); yAxis.setAttribute('stroke-width', '1');
  svg.appendChild(yAxis);
  yTicks.forEach(v => {
    const y = yAt(v);
    const grid = document.createElementNS('http://www.w3.org/2000/svg','line');
    grid.setAttribute('x1', String(padLeft)); grid.setAttribute('x2', String(padLeft + innerW));
    grid.setAttribute('y1', String(y)); grid.setAttribute('y2', String(y));
    grid.setAttribute('stroke', 'var(--border)'); grid.setAttribute('stroke-width', '1'); grid.setAttribute('opacity', '0.7');
    svg.appendChild(grid);
    const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x', String(padLeft - 6));
    txt.setAttribute('y', String(y + 3));
    txt.setAttribute('text-anchor', 'end');
    txt.setAttribute('font-size', '10');
    txt.setAttribute('fill', 'var(--muted)');
    txt.textContent = String(v);
    svg.appendChild(txt);
  });

  const baseY = yAt(minVal);
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg','line');
  xAxis.setAttribute('x1', String(padLeft)); xAxis.setAttribute('x2', String(padLeft + innerW));
  xAxis.setAttribute('y1', String(baseY)); xAxis.setAttribute('y2', String(baseY));
  xAxis.setAttribute('stroke', 'var(--border)'); xAxis.setAttribute('stroke-width', '1');
  svg.appendChild(xAxis);

  if(n >= 1){
    const maxTicks = Math.min(6, n);
    const step = Math.max(1, Math.ceil((n-1) / (maxTicks-1)));
    for(let i=0;i<n;i+=step){
      const x = xAt(i);
      const tick = document.createElementNS('http://www.w3.org/2000/svg','line');
      tick.setAttribute('x1', String(x)); tick.setAttribute('x2', String(x));
      tick.setAttribute('y1', String(baseY)); tick.setAttribute('y2', String(baseY + 4));
      tick.setAttribute('stroke', 'var(--border)'); tick.setAttribute('stroke-width', '1');
      svg.appendChild(tick);
      const label = document.createElementNS('http://www.w3.org/2000/svg','text');
      label.setAttribute('x', String(x));
      label.setAttribute('y', String(baseY + 14));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '10');
      label.setAttribute('fill', 'var(--muted)');
      let text = String(i+1);
      if(labels && labels[i]){
        text = formatDateShort(labels[i]);
      }
      label.textContent = text;
      svg.appendChild(label);
    }
    if((n-1) % step !== 0){
      const i = n-1; const x = xAt(i);
      const label = document.createElementNS('http://www.w3.org/2000/svg','text');
      label.setAttribute('x', String(x));
      label.setAttribute('y', String(baseY + 14));
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('font-size', '10');
      label.setAttribute('fill', 'var(--muted)');
      const text = labels && labels[i] ? formatDateShort(labels[i]) : String(i+1);
      label.textContent = text;
      svg.appendChild(label);
    }
  }

  const path = document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d', d.trim());
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', stroke);
  path.setAttribute('stroke-width', String(strokeWidth));
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.appendChild(path);

  for(let i=0;i<n;i++){
    const x = xAt(i);
    const val = arr[i];
    const isAbsent = !!(absences && absences[i]);
    if(isAbsent){
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x', String(x));
      t.setAttribute('y', String(yAt(minVal)));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dominant-baseline', 'central');
      t.setAttribute('font-size', '12');
      t.setAttribute('fill', '#9ca3af');
      t.textContent = '×';
      svg.appendChild(t);
    } else if(val !== null){
      const y = yAt(val);
      const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
      c.setAttribute('cx', String(x)); c.setAttribute('cy', String(y));
      c.setAttribute('r', String(dot));
      c.setAttribute('fill', stroke);
      c.setAttribute('opacity', '0.9');
      svg.appendChild(c);
    }
  }
  return svg;
}

export function buildBarChart(points, opts){
  const width = (opts && opts.width) || 360;
  const height = (opts && opts.height) || 160;
  const padTop = 8;
  const padRight = 10;
  const padBottom = 22;
  const padLeft = 34;
  const fill = (opts && opts.fill) || 'var(--accent)';
  const fillTop = (opts && opts.fillTop) || '#f59e0b';
  const labels = (opts && opts.labels) || null;
  const absences = (opts && opts.absences) || null;
  const tops = (opts && opts.tops) || null;
  const n = Array.isArray(points) ? points.length : 0;
  if(!n){ return null; }
  const maxVal = Math.max(0, ...points);
  const minVal = 0;
  const innerW = Math.max(1, width - padLeft - padRight);
  const innerH = Math.max(1, height - padTop - padBottom);
  const slotW = innerW / n;
  const range = Math.max(1e-6, maxVal - minVal);
  function xCenterAt(i){ return padLeft + slotW * (i + 0.5); }
  function yAt(v){ return padTop + (1 - (v - minVal) / range) * innerH; }
  const barW = Math.max(2, Math.min(slotW * 0.7, 18));

  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label','Points by session (bar)');

  function computeYTicks(minV, maxV){
    if(maxV <= minV) return [minV, maxV];
    let span = maxV - minV;
    let step = 1;
    if(span > 20) step = 5; else if(span > 10) step = 2; else step = 1;
    const out = [];
    let start = Math.ceil(minV / step) * step;
    if(start > minV) start = minV;
    for(let v=start; v<=maxV; v+=step){ out.push(v); }
    if(out[0] !== minV) out.unshift(minV);
    if(out[out.length-1] !== maxV) out.push(maxV);
    return Array.from(new Set(out));
  }
  const yTicks = computeYTicks(minVal, maxVal);
  const yAxis = document.createElementNS('http://www.w3.org/2000/svg','line');
  yAxis.setAttribute('x1', String(padLeft)); yAxis.setAttribute('x2', String(padLeft));
  yAxis.setAttribute('y1', String(padTop)); yAxis.setAttribute('y2', String(padTop + innerH));
  yAxis.setAttribute('stroke', 'var(--border)'); yAxis.setAttribute('stroke-width', '1');
  svg.appendChild(yAxis);
  yTicks.forEach(v => {
    const y = yAt(v);
    const grid = document.createElementNS('http://www.w3.org/2000/svg','line');
    grid.setAttribute('x1', String(padLeft)); grid.setAttribute('x2', String(padLeft + innerW));
    grid.setAttribute('y1', String(y)); grid.setAttribute('y2', String(y));
    grid.setAttribute('stroke', 'var(--border)'); grid.setAttribute('stroke-width', '1'); grid.setAttribute('opacity', '0.7');
    svg.appendChild(grid);
    const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x', String(padLeft - 6));
    txt.setAttribute('y', String(y + 3));
    txt.setAttribute('text-anchor', 'end');
    txt.setAttribute('font-size', '10');
    txt.setAttribute('fill', 'var(--muted)');
    txt.textContent = String(v);
    svg.appendChild(txt);
  });

  const baseY = yAt(minVal);
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg','line');
  xAxis.setAttribute('x1', String(padLeft)); xAxis.setAttribute('x2', String(padLeft + innerW));
  xAxis.setAttribute('y1', String(baseY)); xAxis.setAttribute('y2', String(baseY));
  xAxis.setAttribute('stroke', 'var(--border)'); xAxis.setAttribute('stroke-width', '1');
  svg.appendChild(xAxis);

  const maxTicks = Math.min(6, n);
  const step = Math.max(1, Math.ceil(n / maxTicks));
  for(let i=0;i<n;i++){
    const bar = points[i] || 0;
    const xCenter = xCenterAt(i);
    const y = yAt(bar);
    const baseYVal = yAt(minVal);
    const h = Math.max(2, baseYVal - y);
    const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
    rect.setAttribute('x', String(xCenter - barW/2));
    rect.setAttribute('y', String(baseYVal - h));
    rect.setAttribute('width', String(barW));
    rect.setAttribute('height', String(h));
    const isTop = !!(tops && tops[i]);
    rect.setAttribute('fill', isTop ? fillTop : fill);
    rect.setAttribute('opacity', bar > 0 ? '0.95' : '0.7');
    svg.appendChild(rect);

    if(bar > 0){
      const val = document.createElementNS('http://www.w3.org/2000/svg','text');
      val.setAttribute('x', String(xCenter));
      val.setAttribute('text-anchor', 'middle');
      val.setAttribute('font-size', '10');
      let valY;
      if(h >= 16){
        const basePos = baseYVal - Math.min(h - 3, 12);
        valY = basePos;
        val.setAttribute('fill', '#ffffff');
      } else {
        const basePos = Math.max(padTop + 10, (baseYVal - h) - 2);
        valY = basePos;
        val.setAttribute('fill', 'var(--muted)');
      }
      val.setAttribute('y', String(valY));
      val.textContent = String(bar);
      svg.appendChild(val);
    }
    if(absences && absences[i]){
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x', String(xCenter));
      t.setAttribute('y', String(baseYVal));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dominant-baseline', 'central');
      t.setAttribute('font-size', '12');
      t.setAttribute('fill', '#9ca3af');
      t.textContent = '×';
      svg.appendChild(t);
    }
  }

  for(let i=0;i<n;i+=step){
    const xCenter = xCenterAt(i);
    const label = document.createElementNS('http://www.w3.org/2000/svg','text');
    label.setAttribute('x', String(xCenter));
    label.setAttribute('y', String(yAt(minVal) + 14));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '10');
    label.setAttribute('fill', 'var(--muted)');
    let text = String(i+1);
    if(labels && labels[i]){
      text = formatDateShort(labels[i]);
    }
    label.textContent = text;
    svg.appendChild(label);
  }
  if((n-1) % step !== 0){
    const i = n-1;
    const xCenter = xCenterAt(i);
    const label = document.createElementNS('http://www.w3.org/2000/svg','text');
    label.setAttribute('x', String(xCenter));
    label.setAttribute('y', String(yAt(minVal) + 14));
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('font-size', '10');
    label.setAttribute('fill', 'var(--muted)');
    const text = labels && labels[i] ? formatDateShort(labels[i]) : String(i+1);
    label.textContent = text;
    svg.appendChild(label);
  }

  return svg;
}

export function getPlayerBadges(player){
  const map = window.__allTimeBadges;
  if(!map) return [];
  return map.get(player) || [];
}

export function getPlayerBadgeHistory(player){
  const hist = window.__badgeHistory || {};
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
  for(const key of Object.keys(labels)){
    const map = hist[key];
    if(map && map.has(player)){
      const entry = map.get(player) || { count:0, dates:[] };
      out.push({ key, label: labels[key], count: entry.count || 0, dates: entry.dates || [] });
    }
  }
  return out;
}

export function renderPlayerBadge(id, variant, BADGE_CONFIG){
  const conf = BADGE_CONFIG[id];
  if(!conf) return null;
  const span = document.createElement('span');
  span.className = 'player-badge' + (id === 'mvp' ? ' player-badge-premium' : '');
  span.setAttribute('aria-label', conf.label);
  span.title = conf.desc;
  const icon = document.createElement('strong');
  icon.textContent = conf.icon;
  span.appendChild(icon);
  if(variant === 'long'){
    const text = document.createElement('span');
    text.textContent = conf.label;
    span.appendChild(text);
  } else if(id === 'mvp'){
    const text = document.createElement('span');
    text.textContent = conf.short || conf.label;
    span.appendChild(text);
  }
  return span;
}

export function buildPlayerInsightCards(player, BADGE_CONFIG){
  const rows = window.__allTimeRows || [];
  const byDate = window.__allTimeByDate || new Map();
  const datesAsc = getAllDatesAsc(byDate);
  const pointsSeries = getPlayerPointsAcrossDates(player, byDate);
  const attendedFlags = pointsSeries.absent.map(a => !a);
  const attendedCount = attendedFlags.filter(Boolean).length;
  const totalSessions = datesAsc.length;
  const latestDate = datesAsc[datesAsc.length-1] || '';

  const cardWrap = document.createElement('div');
  cardWrap.className = 'stat-cards';
  function makeCard(title, mainEl, subText){
    const card = document.createElement('div');
    card.className = 'stat-card';
    const meta = document.createElement('div'); meta.className = 'stat-meta';
    const t = document.createElement('div'); t.className = 'stat-title'; t.textContent = title;
    const v = document.createElement('div'); v.className = 'stat-value';
    if(typeof mainEl === 'string'){ v.textContent = mainEl; } else if(mainEl){ v.appendChild(mainEl); }
    const s = document.createElement('div'); s.className = 'stat-sub'; s.textContent = subText || '';
    meta.appendChild(t); meta.appendChild(v); meta.appendChild(s);
    card.appendChild(meta);
    return card;
  }

  try{
    let topDays = 0;
    for(const d of datesAsc){
      const arr = byDate.get(d) || [];
      if(!arr.length) continue;
      let maxPts = -Infinity; for(const e of arr){ const v = Number(e.points)||0; if(v > maxPts) maxPts = v; }
      if(arr.some(e => e.player === player && (Number(e.points)||0) === maxPts)) topDays++;
    }
    const pctTop = attendedCount>0 ? Math.round((topDays/attendedCount)*100) : 0;
    const full = makeCard('Percent of Sessions with highest score', `${pctTop}%`, `${topDays} / ${attendedCount}`);
    full.style.gridColumn = '1 / -1';
    cardWrap.appendChild(full);
  }catch(_){}

  const attPct = totalSessions > 0 ? Math.round((attendedCount/totalSessions)*100) : 0;
  cardWrap.appendChild(makeCard('Attendance Rate', `${attendedCount}/${totalSessions} • ${attPct}%`, latestDate ? `Latest: ${formatDateShort(latestDate)}` : ''));

  let longest = 0, current = 0;
  for(let i=0;i<attendedFlags.length;i++){
    if(attendedFlags[i]){ current += 1; longest = Math.max(longest, current); }
    else { current = 0; }
  }
  cardWrap.appendChild(makeCard('Longest Streak', `${longest} sessions`, current>0 ? `Current: ${current}` : ''));

  const ptsAttended = pointsSeries.points.filter((v,idx)=> attendedFlags[idx]);
  const matches = ptsAttended.length;
  const totalPts = ptsAttended.reduce((s,v)=> s+v, 0);
  const careerPPM = matches>0 ? (totalPts/matches) : 0;
  const last3Vals = ptsAttended.slice(-3);
  const last3 = last3Vals.length>0 ? (last3Vals.reduce((s,v)=>s+v,0)/last3Vals.length) : 0;
  let deltaPct = null;
  if(matches>=2){ deltaPct = (careerPPM>0 ? ((last3 - careerPPM)/careerPPM*100) : (last3>0 ? Infinity : 0)); }
  const formVal = document.createElement('span');
  if(deltaPct === null){ formVal.textContent = '—'; }
  else if(!Number.isFinite(deltaPct)){
    formVal.className = 'delta-pos'; formVal.textContent = '+∞%';
  } else {
    formVal.className = deltaPct>=0 ? 'delta-pos' : 'delta-neg';
    const sign = deltaPct>=0 ? '+' : '-';
    formVal.textContent = `${sign}${Math.abs(deltaPct).toFixed(1)}%`;
  }
  cardWrap.appendChild(makeCard('Form (Last 3 vs Career)', formVal, `${last3.toFixed(2)} vs ${careerPPM.toFixed(2)}`));

  let bestStreak = 0, bestStartIdx = -1, bestEndIdx = -1;
  let curStreak = 0, curStartIdx = -1;
  for(let i=0;i<datesAsc.length;i++){
    const d = datesAsc[i];
    const arr = byDate.get(d) || [];
    if(!arr.length){ curStreak = 0; curStartIdx = -1; continue; }
    let maxPts = -Infinity; for(const e of arr){ if(typeof e.points === 'number' && e.points > maxPts) maxPts = e.points; }
    const won = arr.some(e => e.player === player && e.points === maxPts);
    if(won){
      if(curStreak === 0) curStartIdx = i;
      curStreak += 1;
      if(curStreak > bestStreak){ bestStreak = curStreak; bestStartIdx = curStartIdx; bestEndIdx = i; }
    } else {
      curStreak = 0; curStartIdx = -1;
    }
  }
  let rangeText = '';
  if(bestStreak > 0 && bestStartIdx !== -1 && bestEndIdx !== -1){
    const rs = datesAsc[bestStartIdx];
    const re = datesAsc[bestEndIdx];
    const rsTxt = formatDateShort(rs);
    const reTxt = formatDateShort(re);
    rangeText = (rs === re) ? (`${rsTxt}`) : (`${rsTxt} – ${reTxt}`);
  }
  cardWrap.appendChild(makeCard('Highest Score Streak', `${bestStreak} sessions`, rangeText));

  return cardWrap;
}
