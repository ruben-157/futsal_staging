export function attachPlayerHistoryModal(deps){
  const {
    getPlayerBadges,
    getPlayerBadgeHistory,
    buildPlayerInsightCards,
    getPlayerPointsAcrossDates,
    getPlayerGoalsAcrossDates,
    getPlayerRankAcrossDates,
    buildBarChart,
    buildLineChart,
    avgLastN,
    BADGE_CONFIG,
    TROPHY_DESC,
    lockBodyScroll,
    unlockBodyScroll,
    setOpenModalEl
  } = deps || {};

  const overlay = document.getElementById('overlay');
  const modal = document.getElementById('playerModal');
  const title = document.getElementById('playerModalTitle');
  const body = document.getElementById('playerModalBody');
  const closeBtn = document.getElementById('playerModalClose');

  function close(preventOverlayScroll){
    if(overlay){
      overlay.hidden = true;
      overlay.onclick = null;
      if(preventOverlayScroll){ overlay.removeEventListener('touchmove', preventOverlayScroll); }
    }
    if(modal) modal.hidden = true;
    if(closeBtn) closeBtn.onclick = null;
    document.removeEventListener('keydown', escHandler);
    setOpenModalEl && setOpenModalEl(null);
    unlockBodyScroll && unlockBodyScroll();
  }

  function escHandler(e){
    if(e.key === 'Escape'){ close(); }
  }

  function open(player){
    if(!overlay || !modal || !title || !body) return;
    title.textContent = '👤 ' + player;
    body.innerHTML = '';
    setOpenModalEl && setOpenModalEl(modal);
    lockBodyScroll && lockBodyScroll();
    function preventOverlayScroll(e){ e.preventDefault(); }

    const modalBadges = getPlayerBadges(player);
    if(modalBadges && modalBadges.length){
      const badgeTitle = document.createElement('div');
      badgeTitle.className = 'stat-title';
      badgeTitle.style.margin = '0 0 4px 0';
      badgeTitle.textContent = 'Current Badges';
      body.appendChild(badgeTitle);
      const badgeWrap = document.createElement('div');
      badgeWrap.style.display = 'flex';
      badgeWrap.style.flexDirection = 'column';
      badgeWrap.style.gap = '8px';
      for(const id of modalBadges){
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
    if(badgeHistory.length){
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
      for(const entry of badgeHistory){
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
        const descText = baseDesc && baseDesc.includes('{N}')
          ? baseDesc.replace('{N}', String(entry.count || 0))
          : baseDesc;
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

    try{
      const cards = buildPlayerInsightCards(player);
      if(cards) body.appendChild(cards);
    }catch(_){ /* best-effort */ }

    // Points chart
    try{
      const seriesAll = getPlayerPointsAcrossDates(player);
      if(seriesAll && seriesAll.points && seriesAll.points.length){
        const titlePts = document.createElement('div');
        titlePts.className = 'stat-title';
        titlePts.style.margin = '4px 0';
        titlePts.textContent = 'Points per Session';
        body.appendChild(titlePts);
        const chartWrap = document.createElement('div');
        chartWrap.style.marginBottom = '8px';
        chartWrap.style.width = '100%';
        const byDate = window.__allTimeByDate || new Map();
        const tops = seriesAll.dates.map(d => {
          const arr = byDate.get(d) || [];
          if(!arr.length) return false;
          let maxPts = -Infinity; for(const e of arr){ const v = Number(e.points)||0; if(v > maxPts) maxPts = v; }
          return arr.some(e => e.player === player && (Number(e.points)||0) === maxPts);
        });
        const svg = buildBarChart(seriesAll.points, { width: 360, height: 160, fill: 'var(--accent)', labels: seriesAll.dates, absences: seriesAll.absent, tops });
        if(svg){
          chartWrap.appendChild(svg);
          const legend = document.createElement('div');
          legend.className = 'stat-sub';
          legend.style.display = 'flex'; legend.style.alignItems = 'center'; legend.style.gap = '12px'; legend.style.marginTop = '4px';
          const item1 = document.createElement('div'); item1.style.display='flex'; item1.style.alignItems='center'; item1.style.gap='6px';
          item1.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="6" width="14" height="12" fill="currentColor"/></svg><span>Points (present)</span>`;
          const item2 = document.createElement('div'); item2.style.display='flex'; item2.style.alignItems='center'; item2.style.gap='6px';
          item2.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="3" fill="currentColor"/></svg><span>0 points (present)</span>`;
          const item3 = document.createElement('div'); item3.style.display='flex'; item3.style.alignItems='center'; item3.style.gap='6px';
          item3.innerHTML = `<span style="display:inline-block; width:14px; height:14px; line-height:14px; text-align:center; color:#9ca3af; font-weight:700">×</span><span>Absent</span>`;
          const item4 = document.createElement('div'); item4.style.display='flex'; item4.style.alignItems='center'; item4.style.gap='6px'; item4.innerHTML = `<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"5\" y=\"6\" width=\"14\" height=\"12\" fill=\"#f59e0b\"/></svg><span>Highest of session</span>`;
          legend.appendChild(item1); legend.appendChild(item2); legend.appendChild(item3); legend.appendChild(item4);
          chartWrap.appendChild(legend);
          body.appendChild(chartWrap);
        }
      }
    }catch(_){ /* best-effort chart */ }

    // Goals chart
    try{
      const goalsSeries = getPlayerGoalsAcrossDates(player);
      if(goalsSeries && goalsSeries.goals && goalsSeries.goals.some(v => v !== null)){
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
        const svg = buildBarChart(values, { width: 360, height: 160, fill: 'var(--accent-2)', labels: goalsSeries.dates, absences: noDataFlags });
        if(svg){
          chartWrap.appendChild(svg);
          const legend = document.createElement('div');
          legend.className = 'stat-sub';
          legend.style.display = 'flex';
          legend.style.alignItems = 'center';
          legend.style.gap = '12px';
          legend.style.marginTop = '4px';
          const item1 = document.createElement('div'); item1.style.display='flex'; item1.style.alignItems='center'; item1.style.gap='6px';
          item1.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="6" width="14" height="12" fill="currentColor"/></svg><span>Goals (present)</span>`;
          const item2 = document.createElement('div'); item2.style.display='flex'; item2.style.alignItems='center'; item2.style.gap='6px';
          item2.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="3" fill="currentColor"/></svg><span>0 goals (present)</span>`;
          const item3 = document.createElement('div'); item3.style.display='flex'; item3.style.alignItems='center'; item3.style.gap='6px';
          item3.innerHTML = `<span style="display:inline-block; width:14px; height:14px; line-height:14px; text-align:center; color:#9ca3af; font-weight:700">×</span><span>No goal data (absent or pre-tracking)</span>`;
          legend.appendChild(item1); legend.appendChild(item2); legend.appendChild(item3);
          chartWrap.appendChild(legend);
          body.appendChild(chartWrap);
        }
      }
    }catch(_){ /* best-effort goals chart */ }

    // Rank chart
    try{
      const rankSeries = getPlayerRankAcrossDates(player);
      if(rankSeries && rankSeries.ranks && rankSeries.ranks.length){
        const titleRank = document.createElement('div');
        titleRank.className = 'stat-title';
        titleRank.style.margin = '4px 0';
        titleRank.textContent = 'Rank by Total Points';
        body.appendChild(titleRank);
        const chartWrap2 = document.createElement('div');
        chartWrap2.style.marginBottom = '8px';
        chartWrap2.style.width = '100%';
        const svg2 = buildLineChart(rankSeries.ranks, { width: 360, height: 140, stroke: '#6B7280', strokeWidth: 2, dotRadius: 2, labels: rankSeries.dates, min: 1 });
        if(svg2){ chartWrap2.appendChild(svg2); body.appendChild(chartWrap2); }
      }
    }catch(_){ /* best-effort rank chart */ }

    // Quick stats
    const rows = (window.__allTimeRows || []).filter(r => r.player === player);
    const matches = rows.length;
    const totalPts = rows.reduce((s,r)=> s + (Number(r.points)||0), 0);
    const ppm = matches ? (totalPts / matches) : 0;
    const series = (window.__allTimeSeries && window.__allTimeSeries.get(player)) || rows.map(r=> Number(r.points)||0);
    const last3 = avgLastN(series, 3);
    const goalRows = rows.filter(r => r.goals != null);
    const goalSessions = goalRows.length;
    const totalGoals = goalRows.reduce((s,r)=> s + (Number(r.goals)||0), 0);
    const gpm = goalSessions ? (totalGoals / goalSessions) : 0;
    const goalSeries = (window.__allTimeGoalSeries && window.__allTimeGoalSeries.get(player)) || goalRows.map(r=> Number(r.goals)||0);
    const last3Goals = avgLastN(goalSeries, 3);
    const headerStats = document.createElement('div');
    headerStats.className = 'notice';
    headerStats.style.marginBottom = '8px';
    const delta = last3 - ppm;
    const arrow = Math.abs(delta) >= 0.5 ? (delta>0 ? ' ▲' : ' ▼') : '';
    let goalText = ' • Goals: —';
    if(goalSessions){
      const goalDelta = last3Goals - gpm;
      const goalArrow = Math.abs(goalDelta) >= 0.3 ? (goalDelta>0 ? ' ▲' : ' ▼') : '';
      const goalSuffix = goalArrow ? ` • Last 3 Goals: ${last3Goals.toFixed(2)}${goalArrow}` : '';
      goalText = ` • Goals: ${totalGoals} • Goals/Session: ${gpm.toFixed(2)}${goalSuffix}`;
    }
    headerStats.textContent = `Matches: ${matches} • Points: ${totalPts} • Pts/Session: ${ppm.toFixed(2)}${arrow ? ` • Last 3: ${last3.toFixed(2)}${arrow}` : ''}${goalText}`;
    body.appendChild(headerStats);

    if(closeBtn){
      closeBtn.onclick = ()=> close(preventOverlayScroll);
    }
    overlay.onclick = ()=> close(preventOverlayScroll);
    document.addEventListener('keydown', escHandler, { once:true });
    overlay.hidden = false; modal.hidden = false;
    overlay.addEventListener('touchmove', preventOverlayScroll, { passive: false });
  }

  return { open, close };
}
