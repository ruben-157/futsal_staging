export function splitCSVLine(line){
  const out = [];
  let cur = '';
  let inQuotes = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch === '"'){
      if(inQuotes && line[i+1] === '"'){ cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    }else if(ch === ',' && !inQuotes){
      out.push(cur.trim());
      cur = '';
    }else{
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function parseCSVSimple(text){
  // Handle BOM and normalize newlines
  const t = text.replace(/^\uFEFF/, '');
  const lines = t.split(/\r?\n/).map(l => l.trimEnd());
  const out = [];
  const warnings = [];
  let skipped = 0;
  for(let i=0;i<lines.length;i++){
    const line = lines[i];
    if(!line) continue;
    const normalized = line.replace(/\s+/g,'').toLowerCase();
    if(i===0 && (normalized === 'date,player,points' || normalized === 'date,player,points,goals')) continue; // skip header
    const parts = splitCSVLine(line);
    if(parts.length < 3){
      skipped++; warnings.push({ line: i+1, reason: 'Too few columns' });
      continue;
    }
    const date = (parts[0] || '').trim();
    const player = (parts[1] || '').trim();
    const pointsStr = (parts[2] || '').trim();
    const goalsStr = (parts[3] || '').trim();
    const points = Number(pointsStr);
    let goals = null;
    if(parts.length >= 4){
      if(goalsStr === ''){ goals = 0; }
      else {
        const gNum = Number(goalsStr);
        if(Number.isFinite(gNum)){ goals = gNum; }
        else { goals = 0; warnings.push({ line: i+1, reason: 'Goals not a number; defaulted to 0' }); }
      }
    }
    if(!date || !player || !Number.isFinite(points)){
      skipped++;
      warnings.push({ line: i+1, reason: 'Missing date/player/points' });
      continue;
    }
    out.push({ date, player, points, goals });
  }
  return { rows: out, warnings, skipped };
}

export function aggregateAllTime(rows){
  const map = new Map();
  for(const { player, points, goals } of rows){
    const cur = map.get(player) || { player, matches:0, points:0, goals:0, goalSessions:0 };
    cur.matches += 1;
    cur.points += Number(points) || 0;
    if(goals != null){
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

export function countUniqueSessions(rows){
  const dates = new Set();
  for(const r of rows){ if(r && r.date) dates.add(r.date); }
  return dates.size;
}

export function buildAllTimeSeries(rows){
  // Returns Map<Player, number[]> sorted by date ascending (points)
  const byPlayer = new Map();
  const byDate = new Map();
  for(const r of rows){
    if(!r || !r.player || !r.date || !Number.isFinite(r.points)) continue;
    if(!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push({ player: r.player, points: Number(r.points) || 0 });
  }
  const dates = Array.from(byDate.keys()).sort();
  for(const d of dates){
    const entries = byDate.get(d) || [];
    for(const e of entries){
      const arr = byPlayer.get(e.player) || [];
      arr.push(e.points);
      byPlayer.set(e.player, arr);
    }
  }
  return byPlayer;
}

export function buildAllTimeGoalSeries(rows){
  const byPlayer = new Map();
  const byDate = new Map();
  for(const r of rows){
    if(!r || !r.player || !r.date) continue;
    if(!byDate.has(r.date)) byDate.set(r.date, []);
    const goalVal = (r.goals == null) ? null : (Number(r.goals) || 0);
    byDate.get(r.date).push({ player: r.player, goals: goalVal });
  }
  const dates = Array.from(byDate.keys()).sort();
  for(const d of dates){
    const entries = byDate.get(d) || [];
    for(const e of entries){
      if(e.goals == null) continue;
      const arr = byPlayer.get(e.player) || [];
      arr.push(e.goals);
      byPlayer.set(e.player, arr);
    }
  }
  return byPlayer;
}

export function buildAllTimeByDate(rows){
  const byDate = new Map();
  for(const r of rows){
    if(!r || !r.player || !r.date || !Number.isFinite(r.points)) continue;
    if(!byDate.has(r.date)) byDate.set(r.date, []);
    const goalVal = (r.goals == null) ? null : (Number(r.goals)||0);
    byDate.get(r.date).push({ player: r.player, points: Number(r.points)||0, goals: goalVal });
  }
  return byDate;
}

const PLAYMAKER_CUTOFF_DATE = '2025-11-12';

export function computeAllTimeBadges(rows, byDate, statsMap, preRanks, postRanks){
  const badgeMap = new Map();
  if(!rows || !rows.length || !byDate) return badgeMap;
  const dates = Array.from(byDate.keys()).sort();
  if(!dates.length) return badgeMap;
  const players = Array.from(statsMap.keys());
  const perPlayer = new Map(players.map(p => [p, { goalStreak:0, bestGoalStreak:0, attendStreak:0, bestAttendStreak:0, winStreak:0, bestWinStreak:0 }]));
  const cumulative = new Map(players.map(p => [p, { matches:0, points:0, goals:0, goalSessions:0 }]));
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
  function addHistory(map, player, date){
    const cur = map.get(player) || { count:0, dates:[] };
    cur.count += 1;
    cur.dates.push(date);
    map.set(player, cur);
  }
  function addHistoryOnce(map, player, date){
    if(map.has(player)) return;
    map.set(player, { count: 1, dates: [date] });
  }
  for(let di=0; di<dates.length; di++){
    const d = dates[di];
    const entries = byDate.get(d) || [];
    const entryMap = new Map(entries.map(e => [e.player, e]));
    let maxPoints = -Infinity;
    let minPoints = Infinity;
    let sessionMaxGoals = null;
    let sessionMaxContribution = -Infinity;
    for(const e of entries){
      const pts = Number(e.points) || 0;
      if(pts > maxPoints) maxPoints = pts;
      if(pts < minPoints) minPoints = pts;
      const gVal = (e.goals != null) ? (Number(e.goals) || 0) : 0;
      if(gVal > 0 && (sessionMaxGoals === null || gVal > sessionMaxGoals)){ sessionMaxGoals = gVal; }
      const contrib = pts + gVal;
      if(contrib > sessionMaxContribution){ sessionMaxContribution = contrib; }
    }
    const hasWin = (entries.length > 0) && (maxPoints > minPoints);
    const winners = new Set();
    if(hasWin){
      for(const e of entries){
        const pts = Number(e.points) || 0;
        if(pts === maxPoints) winners.add(e.player);
      }
    }
    if(entries.length && maxPoints > -Infinity){
      for(const e of entries){
        const pts = Number(e.points) || 0;
        if(pts === maxPoints){
          sessionAceCounts.set(e.player, (sessionAceCounts.get(e.player)||0) + 1);
        }
      }
    }
    for(const player of players){
      const stat = perPlayer.get(player);
      const entry = entryMap.get(player);
      if(entry){
        stat.attendStreak += 1;
        if(stat.attendStreak > stat.bestAttendStreak) stat.bestAttendStreak = stat.attendStreak;
        if(entry.goals != null && Number(entry.goals) > 0){
          stat.goalStreak += 1;
        } else {
          stat.goalStreak = 0;
        }
        cumulative.set(player, {
          matches: (cumulative.get(player)?.matches || 0) + 1,
          points: (cumulative.get(player)?.points || 0) + (Number(entry.points)||0),
          goals: (cumulative.get(player)?.goals || 0) + ((entry.goals == null) ? 0 : (Number(entry.goals)||0)),
          goalSessions: (cumulative.get(player)?.goalSessions || 0) + ((entry.goals == null || Number(entry.goals) === 0) ? 0 : 1),
        });
        const ptsArr = pointsHistory.get(player) || [];
        ptsArr.push(Number(entry.points) || 0);
        pointsHistory.set(player, ptsArr);
      } else {
        stat.attendStreak = 0;
        stat.goalStreak = 0;
      }
      if(hasWin && winners.has(player)){
        stat.winStreak += 1;
        if(stat.winStreak > stat.bestWinStreak) stat.bestWinStreak = stat.winStreak;
      } else {
        stat.winStreak = 0;
      }
      perPlayer.set(player, stat);
    }
    // Session badges (latest top scorer, playmaker, clinical)
    if(sessionMaxGoals !== null){
      for(const e of entries){
        const gVal = (e.goals != null) ? (Number(e.goals) || 0) : 0;
        if(gVal === sessionMaxGoals){
          addHistoryOnce(badgeHistory.latestTop, e.player, d);
        }
        if(gVal >= 5){ addHistoryOnce(badgeHistory.clinical, e.player, d); }
      }
    }
    // Playmaker (points+goals contribution), only after cutoff date
    if(sessionMaxContribution > -Infinity && d >= PLAYMAKER_CUTOFF_DATE){
      for(const e of entries){
        const pts = Number(e.points) || 0;
        const gVal = (e.goals != null) ? (Number(e.goals) || 0) : 0;
        const contrib = pts + gVal;
        if(contrib === sessionMaxContribution){
          addHistoryOnce(badgeHistory.playmaker, e.player, d);
        }
      }
    }
  }
  // Career badges
  let allTimeTop = null;
  let allTimeTopGoals = -Infinity;
  for(const [player, { goals }] of cumulative.entries()){
    if(goals > allTimeTopGoals){
      allTimeTopGoals = goals;
      allTimeTop = player;
    }
  }
  if(allTimeTop){ addHistoryOnce(badgeHistory.allTimeTop, allTimeTop, dates[dates.length-1]); }

  // MVP (Pts/Session with attendance threshold)
  let bestPPM = -Infinity; let mvpPlayer = null;
  for(const [player, stat] of cumulative.entries()){
    const ppm = stat.matches ? stat.points / stat.matches : 0;
    if(stat.matches >= Math.max(1, Math.floor(dates.length * 0.6))){ // 60% attendance
      if(ppm > bestPPM){ bestPPM = ppm; mvpPlayer = player; }
    }
  }
  if(mvpPlayer){ addHistoryOnce(badgeHistory.mvp, mvpPlayer, dates[dates.length-1]); }

  // Attendance streaks (iron man, marathon)
  for(const [player, streaks] of perPlayer.entries()){
    if(streaks.bestAttendStreak >= 6){ addHistoryOnce(badgeHistory.ironMan, player, dates[dates.length-1]); }
    if(streaks.bestAttendStreak >= 15){ addHistoryOnce(badgeHistory.marathon, player, dates[dates.length-1]); }
  }

  // Win streaks (elite, master, legend)
  for(const [player, streaks] of perPlayer.entries()){
    if(streaks.bestWinStreak >= 3){ addHistoryOnce(badgeHistory.elite, player, dates[dates.length-1]); }
    if(streaks.bestWinStreak >= 4){ addHistoryOnce(badgeHistory.master, player, dates[dates.length-1]); }
    if(streaks.bestWinStreak >= 5){ addHistoryOnce(badgeHistory.legend, player, dates[dates.length-1]); }
  }

  // Form badges (last 3 vs career)
  for(const [player, hist] of pointsHistory.entries()){
    const last3 = hist.slice(-3);
    const last3Avg = last3.length ? last3.reduce((s,v)=> s+v,0) / last3.length : 0;
    const career = cumulative.get(player)?.matches ? (cumulative.get(player).points / cumulative.get(player).matches) : 0;
    const delta = last3Avg - career;
    const minSessions = 3;
    if(hist.length >= minSessions){
      addHistory(badgeHistory.form, player, { delta, last3Avg, career });
    }
  }

  // Session Ace counts
  for(const [player, count] of sessionAceCounts.entries()){
    if(count >= 1){ addHistoryOnce(badgeHistory.latestTop, player, dates[dates.length-1]); }
  }

  // Compute form/cold streak winners
  let formLeader = null; let formDelta = -Infinity;
  let coldLeader = null; let coldDelta = Infinity;
  for(const [player, info] of badgeHistory.form.entries()){
    if(typeof info.delta !== 'number') continue;
    if(info.delta > formDelta){ formDelta = info.delta; formLeader = player; }
    if(info.delta < coldDelta){ coldDelta = info.delta; coldLeader = player; }
  }
  if(formLeader){ badgeMap.set(formLeader, (badgeMap.get(formLeader)||new Set()).add('form')); }
  if(coldLeader){ badgeMap.set(coldLeader, (badgeMap.get(coldLeader)||new Set()).add('coldStreak')); }

  // Trophy badges
  for(const [player, streaks] of perPlayer.entries()){
    const set = badgeMap.get(player) || new Set();
    if(streaks.bestGoalStreak >= 3) set.add('hatTrick');
    if(streaks.bestGoalStreak >= 4) set.add('fourRow');
    if(streaks.bestGoalStreak >= 5) set.add('fiveRow');
    if(streaks.bestGoalStreak >= 6) set.add('sixRow');
    if(streaks.bestGoalStreak >= 7) set.add('sevenRow');
    if(streaks.bestGoalStreak >= 8) set.add('eightRow');
    if(streaks.bestGoalStreak >= 9) set.add('nineRow');
    if(streaks.bestGoalStreak >= 10) set.add('tenRow');
    if(streaks.bestAttendStreak >= 6) set.add('ironMan');
    if(streaks.bestAttendStreak >= 15) set.add('marathon');
    if(streaks.bestWinStreak >= 3) set.add('elite');
    if(streaks.bestWinStreak >= 4) set.add('master');
    if(streaks.bestWinStreak >= 5) set.add('legend');
    badgeMap.set(player, set);
  }

  if(allTimeTop){ badgeMap.set(allTimeTop, (badgeMap.get(allTimeTop)||new Set()).add('allTimeTop')); }
  if(mvpPlayer){ badgeMap.set(mvpPlayer, (badgeMap.get(mvpPlayer)||new Set()).add('mvp')); }
  for(const [player] of badgeHistory.latestTop.entries()){
    badgeMap.set(player, (badgeMap.get(player)||new Set()).add('latestTop'));
  }
  for(const [player] of badgeHistory.playmaker.entries()){
    badgeMap.set(player, (badgeMap.get(player)||new Set()).add('playmaker'));
  }
  for(const [player] of badgeHistory.clinical.entries()){
    badgeMap.set(player, (badgeMap.get(player)||new Set()).add('clinical'));
  }
  let aceLeader = null; let aceCount = -Infinity;
  for(const [player, count] of sessionAceCounts.entries()){
    if(count > aceCount){ aceCount = count; aceLeader = player; }
  }
  if(aceLeader){ badgeMap.set(aceLeader, (badgeMap.get(aceLeader)||new Set()).add('clutch')); }

  return badgeMap;
}
