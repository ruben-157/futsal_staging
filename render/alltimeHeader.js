import { aggregateAllTime } from '../logic/alltime.js';

export function buildLatestSyncPill(latestDate){
  if(!latestDate) return null;
  const pillBar = document.createElement('div');
  pillBar.style.display = 'flex';
  pillBar.style.justifyContent = 'flex-end';
  pillBar.style.marginBottom = '8px';
  const pill = document.createElement('span');
  pill.className = 'mini-pill';
  pill.textContent = `Latest: ${latestDate}`;
  pillBar.appendChild(pill);
  return pillBar;
}

function buildCard({ emoji, title, value, sub, valueClass }){
  const card = document.createElement('div');
  card.className = 'stat-card';
  card.tabIndex = 0;
  const icon = document.createElement('div');
  icon.className = 'stat-emoji';
  icon.textContent = emoji;
  const meta = document.createElement('div');
  meta.className = 'stat-meta';
  const t = document.createElement('div');
  t.className = 'stat-title';
  t.textContent = title;
  const v = document.createElement('div');
  v.className = 'stat-value' + (valueClass ? ` ${valueClass}` : '');
  v.textContent = value;
  meta.appendChild(t);
  meta.appendChild(v);
  if(sub){
    const s = document.createElement('div');
    s.className = 'stat-sub';
    s.textContent = sub;
    meta.appendChild(s);
  }
  card.appendChild(icon);
  card.appendChild(meta);
  return card;
}

function sortForRank(stats, basis='points'){
  const arr = [...stats];
  arr.sort((a,b)=>{
    if(basis === 'ppm'){
      if(b.ppm !== a.ppm) return b.ppm - a.ppm;
      if(b.points !== a.points) return b.points - a.points;
      if(b.matches !== a.matches) return b.matches - a.matches;
      return a.player.localeCompare(b.player);
    }
    // points basis
    if(b.points !== a.points) return b.points - a.points;
    if(b.ppm !== a.ppm) return b.ppm - a.ppm;
    if(b.matches !== a.matches) return b.matches - a.matches;
    return a.player.localeCompare(b.player);
  });
  return arr;
}

function makeRankMap(sorted){
  const map = new Map();
  for(let i=0;i<sorted.length;i++){
    map.set(sorted[i].player, i);
  }
  return map;
}

function toPercent(delta){
  const rounded = Math.round(delta * 10) / 10;
  if(Object.is(rounded, -0)) return '0%';
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

export function buildAllTimeHeaderCards(preRows, rows, byDate, latestDate, basis){
  if(!rows || !rows.length || !latestDate) return null;
  const container = document.createElement('div');
  container.className = 'stat-cards';
  container.setAttribute('data-basis', basis || 'points');
  const basisLabel = basis === 'ppm' ? 'Pts/Session' : 'Points';

  const hasHistory = Array.isArray(preRows) && preRows.length > 0;
  const preStats = hasHistory ? aggregateAllTime(preRows) : [];
  const preRanked = hasHistory ? sortForRank(preStats, basis) : [];
  const postRanked = sortForRank(rows, basis);
  const preRanks = makeRankMap(preRanked);
  const postRanks = makeRankMap(postRanked);

  // Rank moves
  let bestGain = null;
  let bestLoss = null;
  if(hasHistory){
    for(const [player, postRank] of postRanks.entries()){
      if(!preRanks.has(player)) continue;
      const preRank = preRanks.get(player);
      const delta = preRank - postRank; // positive = improved
      if(delta > 0){
        if(!bestGain || delta > bestGain.delta || (delta === bestGain.delta && postRank < bestGain.postRank)){
          bestGain = { player, delta, postRank };
        }
      } else if(delta < 0){
        if(!bestLoss || delta < bestLoss.delta || (delta === bestLoss.delta && postRank > bestLoss.postRank)){
          bestLoss = { player, delta, postRank };
        }
      }
    }
  }

  if(bestGain){
    container.appendChild(buildCard({
      emoji: '📈',
      title: 'Largest Rank Gain',
      value: `${bestGain.player}`,
      sub: `+${bestGain.delta} vs last session (${basisLabel})`,
      valueClass: 'delta-pos'
    }));
  }
  if(bestLoss){
    container.appendChild(buildCard({
      emoji: '📉',
      title: 'Largest Rank Loss',
      value: `${bestLoss.player}`,
      sub: `${bestLoss.delta} vs last session (${basisLabel})`,
      valueClass: 'delta-neg'
    }));
  }

  // Pts/Session swings (requires prior matches)
  let bestPpmUp = null;
  let bestPpmDown = null;
  const preMap = new Map(preStats.map(s => [s.player, s]));
  const postMap = new Map(rows.map(s => [s.player, s]));
  for(const [player, post] of postMap.entries()){
    const prev = preMap.get(player);
    if(!prev || !prev.matches || prev.ppm <= 0) continue;
    const delta = post.ppm - prev.ppm;
    const pct = (delta / prev.ppm) * 100;
    if(!Number.isFinite(pct)) continue;
    if(pct > 0){
      if(!bestPpmUp || pct > bestPpmUp.pct){
        bestPpmUp = { player, pct, from: prev.ppm, to: post.ppm };
      }
    } else if(pct < 0){
      if(!bestPpmDown || pct < bestPpmDown.pct){
        bestPpmDown = { player, pct, from: prev.ppm, to: post.ppm };
      }
    }
  }

  if(bestPpmUp){
    container.appendChild(buildCard({
      emoji: '🚀',
      title: 'Pts/Session Increase',
      value: `${bestPpmUp.player}`,
      sub: `${toPercent(bestPpmUp.pct)} (${bestPpmUp.from.toFixed(2)} → ${bestPpmUp.to.toFixed(2)})`,
      valueClass: 'delta-pos'
    }));
  }
  if(bestPpmDown){
    container.appendChild(buildCard({
      emoji: '🪂',
      title: 'Pts/Session Decrease',
      value: `${bestPpmDown.player}`,
      sub: `${toPercent(bestPpmDown.pct)} (${bestPpmDown.from.toFixed(2)} → ${bestPpmDown.to.toFixed(2)})`,
      valueClass: 'delta-neg'
    }));
  }

  if(!container.children.length){
    container.appendChild(buildCard({
      emoji: '⏳',
      title: 'Insights Pending',
      value: 'Need 2+ sessions',
      sub: 'Add another session to see rank and PPM swings'
    }));
  }
  return container;
}
