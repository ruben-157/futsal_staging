import { parseCSVSimple, aggregateAllTime, countUniqueSessions, buildAllTimeSeries, buildAllTimeGoalSeries, buildAllTimeByDate, computeAllTimeBadges } from '../logic/alltime.js';

test('parseCSVSimple handles header, skips bad rows, and defaults goals', ()=>{
  const csv = `Date,Player,Points,Goals
2025-01-01,A,3,2
2025-01-01,B,1,notnum
badrow
2025-01-02,C,2,`;
  const { rows, warnings, skipped } = parseCSVSimple(csv);
  assertEqual(rows.length, 3);
  assertEqual(skipped, 1);
  assert(warnings.some(w => w.reason.includes('Goals')));
  const b = rows.find(r => r.player === 'B');
  assertEqual(b.goals, 0);
  const c = rows.find(r => r.player === 'C');
  assertEqual(c.goals, 0);
});

test('aggregateAllTime computes matches and rates', ()=>{
  const rows = [
    { player:'A', points:3, goals:2 },
    { player:'A', points:1, goals:0 },
    { player:'B', points:0, goals:null },
  ];
  const stats = aggregateAllTime(rows);
  const a = stats.find(s => s.player === 'A');
  assertEqual(a.matches, 2);
  assertEqual(a.points, 4);
  assertEqual(a.goals, 2);
  assert(a.ppm > 0);
  assert(a.gpm > 0);
});

test('countUniqueSessions counts dates', ()=>{
  const rows = [{ date:'2025-01-01' }, { date:'2025-01-02' }, { date:'2025-01-01' }];
  assertEqual(countUniqueSessions(rows), 2);
});

test('buildAllTimeSeries orders by date', ()=>{
  const rows = [
    { date:'2025-01-02', player:'A', points:2 },
    { date:'2025-01-01', player:'A', points:3 },
  ];
  const series = buildAllTimeSeries(rows);
  assertDeepEqual(series.get('A'), [3,2]);
});

test('buildAllTimeGoalSeries ignores null goals', ()=>{
  const rows = [
    { date:'2025-01-01', player:'A', goals:null },
    { date:'2025-01-02', player:'A', goals:1 },
  ];
  const series = buildAllTimeGoalSeries(rows);
  assertDeepEqual(series.get('A'), [1]);
});

test('buildAllTimeByDate groups entries', ()=>{
  const rows = [
    { date:'2025-01-01', player:'A', points:3, goals:1 },
    { date:'2025-01-01', player:'B', points:1, goals:0 },
  ];
  const byDate = buildAllTimeByDate(rows);
  assertEqual(byDate.get('2025-01-01').length, 2);
});

test('computeAllTimeBadges assigns latest top scorer and all-time top', ()=>{
  const rows = [
    { date:'2025-01-01', player:'A', points:3, goals:2 },
    { date:'2025-01-01', player:'B', points:1, goals:0 },
    { date:'2025-01-02', player:'A', points:2, goals:1 },
    { date:'2025-01-02', player:'B', points:3, goals:3 },
  ];
  const byDate = buildAllTimeByDate(rows);
  const stats = aggregateAllTime(rows);
  const statsMap = new Map(stats.map(s => [s.player, s]));
  const badgeMap = computeAllTimeBadges(rows, byDate, statsMap, null, null);
  const badgesA = badgeMap.get('A') || new Set();
  const badgesB = badgeMap.get('B') || new Set();
  assert(badgesA.has('allTimeTop'), 'A should be all-time top for goals');
  assert(badgesB.has('latestTop'), 'B should have latest top scorer for second session');
});

test('computeAllTimeBadges respects playmaker cutoff date', ()=>{
  const rows = [
    { date:'2025-11-01', player:'A', points:3, goals:2 }, // before cutoff
    { date:'2025-11-01', player:'B', points:4, goals:0 },
    { date:'2025-11-20', player:'C', points:5, goals:1 }, // after cutoff, top contrib
    { date:'2025-11-20', player:'A', points:3, goals:0 },
  ];
  const byDate = buildAllTimeByDate(rows);
  const stats = aggregateAllTime(rows);
  const statsMap = new Map(stats.map(s => [s.player, s]));
  const badges = computeAllTimeBadges(rows, byDate, statsMap, null, null);
  const preCut = badges.get('B') || new Set();
  const postCut = badges.get('C') || new Set();
  assert(!preCut.has('playmaker'), 'Playmaker should not be awarded before cutoff');
  assert(postCut.has('playmaker'), 'Playmaker should be awarded after cutoff');
});

test('computeAllTimeBadges enforces MVP attendance threshold', ()=>{
  // 5 sessions → need >=3 attendance for MVP eligibility
  const rows = [
    { date:'2025-01-01', player:'A', points:5, goals:0 },
    { date:'2025-01-02', player:'A', points:5, goals:0 },
    { date:'2025-01-03', player:'A', points:5, goals:0 },
    { date:'2025-01-04', player:'B', points:10, goals:0 },
    { date:'2025-01-05', player:'B', points:10, goals:0 },
  ];
  const byDate = buildAllTimeByDate(rows);
  const stats = aggregateAllTime(rows);
  const statsMap = new Map(stats.map(s => [s.player, s]));
  const badges = computeAllTimeBadges(rows, byDate, statsMap, null, null);
  const a = badges.get('A') || new Set();
  const b = badges.get('B') || new Set();
  assert(a.has('mvp'), 'A should be MVP with 60%+ attendance');
  assert(!b.has('mvp'), 'B should not be MVP due to low attendance');
});
