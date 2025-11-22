import { buildAllTimeCSVWarningNotice, buildEmptyAllTimeNotice, buildAllTimeTable } from './alltime.js';

export function renderAllTimeView(opts){
  const {
    container,
    stats,
    totalSessions,
    series,
    goalSeries,
    byDate,
    badges,
    warnings,
    skipped,
    latestDate,
    preRows,
    preRanks,
    postRanks,
    sort,
    badgePriority,
    badgeConfig,
    onSort,
    pillBuilder,
    headerCardsBuilder
  } = opts;
  if(!container) return;
  container.innerHTML = '';
  if(!stats || stats.length === 0){
    const warnNotice = buildAllTimeCSVWarningNotice(warnings, skipped);
    if(warnNotice) container.appendChild(warnNotice);
    container.appendChild(buildEmptyAllTimeNotice());
    return;
  }
  const warnNotice = buildAllTimeCSVWarningNotice(warnings, skipped);
  if(warnNotice) container.appendChild(warnNotice);
  if(pillBuilder){
    const pillBar = pillBuilder(latestDate);
    if(pillBar) container.appendChild(pillBar);
  }
  if(headerCardsBuilder){
    const headerCards = headerCardsBuilder(preRows, stats, byDate, latestDate, sort.key);
    if(headerCards) container.appendChild(headerCards);
  }
  const table = buildAllTimeTable(stats, totalSessions, series, preRanks, postRanks, latestDate, {
    allTimeSort: sort,
    onSort,
    badgePriority,
    badgeConfig,
    getPlayerBadges: (player)=> badges.get(player) || []
  });
  container.appendChild(table);
}
