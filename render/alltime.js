export function buildAllTimeCSVWarningNotice(warnings=[], skipped=0){
  const skipCount = skipped || 0;
  const hasGoalWarnings = (warnings || []).some(w => typeof w.reason === 'string' && w.reason.toLowerCase().includes('goals'));
  if(!skipCount && !hasGoalWarnings) return null;
  const notice = document.createElement('div');
  notice.className = 'notice';
  notice.style.color = 'var(--danger)';
  notice.setAttribute('role','status');
  notice.setAttribute('aria-live','polite');
  const parts = [];
  if(skipCount){
    parts.push(`Skipped ${skipCount} row${skipCount === 1 ? '' : 's'} with missing date/player/points`);
  }
  if(hasGoalWarnings){
    parts.push('Rows with non-numeric goals were defaulted to 0');
  }
  notice.textContent = parts.join('. ') + '. See console [AT201] for details.';
  return notice;
}

export function buildEmptyAllTimeNotice(){
  const empty = document.createElement('div');
  empty.className = 'notice';
  empty.textContent = 'No data found.';
  empty.setAttribute('role','status');
  empty.setAttribute('aria-live','polite');
  return empty;
}

export function buildAllTimeTable(stats, totalSessions, series, preRanks, postRanks, latestDate, opts={}){
  const { allTimeSort, onSort, badgePriority=[], badgeConfig={}, getPlayerBadges=(()=>[]) } = opts;
  function getColdStreakPlayer(){
    if(typeof window !== 'undefined' && window.__coldStreakPlayer) return window.__coldStreakPlayer;
    const rows = (typeof window !== 'undefined' && window.__allTimeRows) || [];
    const byDate = (typeof window !== 'undefined' && window.__allTimeByDate) || new Map();
    const dates = Array.from(byDate.keys()).sort();
    const players = new Set(rows.map(r => r.player));
    const pointsHistory = new Map(Array.from(players).map(p => [p, []]));
    for(const d of dates){
      const entries = byDate.get(d) || [];
      const entryMap = new Map(entries.map(e => [e.player, e]));
      for(const p of players){
        const entry = entryMap.get(p);
        if(entry){
          const arr = pointsHistory.get(p);
          if(arr) arr.push(Number(entry.points) || 0);
        }
      }
    }
    const statsMap = new Map(stats.map(s => [s.player, s]));
    let coldPlayer = null;
    let coldDelta = null;
    for(const p of players){
      const hist = pointsHistory.get(p) || [];
      const last3 = hist.slice(-3);
      const last3Avg = last3.length ? last3.reduce((s,v)=> s+v,0) / last3.length : 0;
      const career = statsMap.get(p)?.ppm || 0;
      const delta = last3Avg - career;
      if(delta < 0 && (coldDelta === null || delta < coldDelta)){
        coldDelta = delta;
        coldPlayer = p;
      }
    }
    if(typeof window !== 'undefined' && coldPlayer) window.__coldStreakPlayer = coldPlayer;
    return coldPlayer;
  }
  const coldStreakPlayer = getColdStreakPlayer();

  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  const table = document.createElement('table');
  table.className = 'wide-table';
  table.setAttribute('aria-label','All-Time leaderboard');
  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  const thRank = document.createElement('th');
  thRank.textContent = '#';
  thRank.setAttribute('scope','col');
  trHead.appendChild(thRank);
  const cols = [
    { key:'player', label:'Player', style:'width:36%' },
    { key:'badges', label:'Badges', sortable:false },
    { key:'matches', label:'Matches' },
    { key:'points', label:'Points' },
    { key:'ppm', label:'Pts/Session' },
    { key:'goals', label:'Goals' },
    { key:'gpm', label:'Goals/Session' },
  ];
  for(const col of cols){
    const th = document.createElement('th');
    if(col.style) th.setAttribute('style', col.style);
    const sortable = col.sortable !== false && col.key !== 'badges';
    th.textContent = col.label + (sortable && allTimeSort.key === col.key ? (allTimeSort.dir === 'asc' ? ' ▲' : ' ▼') : '');
    th.className = sortable ? 'sortable' : '';
    th.setAttribute('scope','col');
    if(sortable){
      th.setAttribute('aria-sort', allTimeSort.key === col.key ? (allTimeSort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
    }
    if(col.key === 'badges'){
      th.style.textAlign = 'right';
      th.classList.add('badges-col');
    }
    if(sortable){
      th.style.cursor = 'pointer';
      th.title = 'Sort by ' + col.label;
    }
    if(sortable && typeof onSort === 'function'){
      th.addEventListener('click', ()=> onSort(col.key));
    }
    trHead.appendChild(th);
  }
  thead.appendChild(trHead);
  const tbody = document.createElement('tbody');
  const podiumActive = (allTimeSort && (allTimeSort.key === 'points' || allTimeSort.key === 'ppm'));
  stats.forEach((r, idx)=>{
    const tr = document.createElement('tr');
    const tdPos = document.createElement('td');
    if(podiumActive && idx === 0){ tdPos.textContent = '🥇'; }
    else if(podiumActive && idx === 1){ tdPos.textContent = '🥈'; }
    else if(podiumActive && idx === 2){ tdPos.textContent = '🥉'; }
    else { tdPos.textContent = String(idx + 1); }
    const tdN = document.createElement('td');
    tdN.className = 'player-row-name';
    const nameLine = document.createElement('span');
    nameLine.className = 'player-name-line';
    nameLine.textContent = r.player;
    if(podiumActive && preRanks && postRanks){
      const pre = preRanks.get(r.player);
      const post = postRanks.get(r.player);
      if(pre !== undefined && post !== undefined){
        const move = pre - post;
        if(move !== 0){
          const arrow = document.createElement('span');
          arrow.style.marginLeft = '6px';
          arrow.style.fontWeight = '700';
          arrow.style.fontSize = '14px';
          const signed = move > 0 ? `+${move}` : `${move}`;
          if(move > 0){ arrow.textContent = ` ▲ ${signed}`; arrow.style.color = 'var(--accent-2)'; }
          else { arrow.textContent = ` ▼ ${signed}`; arrow.style.color = 'var(--danger)'; }
          arrow.title = `Position: ${pre+1} → ${post+1} (${signed} since last session)`;
          nameLine.appendChild(arrow);
        }
      }
    }
    let badgeList = getPlayerBadges(r.player, badgePriority, badgeConfig);
    if(r.player === coldStreakPlayer){
      badgeList = badgeList.filter(b => b.key !== 'form');
      badgeList.push({ key:'coldStreak', label:'Cold Streak' });
    }
    const totalSess = totalSessions || series?.get(r.player)?.length || 0;
    if(r.matches < Math.max(1, Math.floor(totalSess * 0.6))){
      badgeList = badgeList.filter(b => b.key !== 'mvp');
    }
    if(preRanks && postRanks && preRanks.has(r.player) && postRanks.has(r.player)){
      const move = preRanks.get(r.player) - postRanks.get(r.player);
      if(move >= 5){
        badgeList.push({ key:'rocket', label:'Rocket Rank' });
      }
    }
    tdN.appendChild(nameLine);
    const tdB = document.createElement('td');
    tdB.className = 'badges-cell';
    tdB.style.minWidth = '200px';
    tdB.style.textAlign = 'right';
    tdB.style.whiteSpace = 'nowrap';
    tdB.style.paddingRight = '12px';
    if(badgeList && badgeList.length){
      const badgesWrap = document.createElement('span');
      badgesWrap.className = 'player-badges';
      badgesWrap.style.flexWrap = 'nowrap';
      badgesWrap.style.whiteSpace = 'nowrap';
      badgesWrap.style.justifyContent = 'flex-end';
      badgesWrap.style.marginLeft = '0';
      badgesWrap.style.display = 'inline-flex';
      badgesWrap.style.alignItems = 'center';
      for(const badge of badgeList){
        const pill = document.createElement('span');
        pill.className = 'player-badge';
        const conf = badgeConfig[badge.key];
        pill.textContent = conf?.short || badge.label || badge.key;
        pill.title = conf?.desc || conf?.label || badge.label || badge.key;
        badgesWrap.appendChild(pill);
      }
      tdB.appendChild(badgesWrap);
    } else {
      tdB.textContent = '—';
      tdB.style.color = 'var(--muted)';
    }
    const tdMatches = document.createElement('td'); tdMatches.textContent = String(r.matches);
    const tdPts = document.createElement('td'); tdPts.textContent = String(r.points);
    const tdPPM = document.createElement('td'); tdPPM.textContent = r.ppm.toFixed(2);
    const tdGoals = document.createElement('td'); tdGoals.textContent = String(r.goals || 0);
    const tdGPM = document.createElement('td');
    tdGPM.textContent = (r.goalSessions ? r.gpm.toFixed(2) : '—');
    const cells = [tdPos, tdN, tdB, tdMatches, tdPts, tdPPM, tdGoals, tdGPM];
    cells.forEach(c => tr.appendChild(c));
    tbody.appendChild(tr);
  });
  table.appendChild(thead);
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}
