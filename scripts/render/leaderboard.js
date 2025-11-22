export function renderLeaderboard(state, opts={}){
  const { getPrevRanks, savePrevRanksFromRows } = opts;
  const lb = document.getElementById('leaderboardSection');
  if(!lb) return;
  lb.innerHTML = '';
  if(!state.teams || state.teams.length === 0){
    const info = document.createElement('div');
    info.className = 'notice';
    info.textContent = 'Generate teams to see the leaderboard.';
    lb.appendChild(info);
    return;
  }
  const prevRanks = getPrevRanks ? getPrevRanks() : {};
  const byId = new Map(state.teams.map(t => [t.id, { team: t, pts: 0, played: 0, gf: 0, ga: 0 }]));
  for(const key of Object.keys(state.results || {})){
    const r = state.results[key];
    if(!r) continue;
    const { a, b, ga, gb } = r;
    if(ga === null || gb === null || ga === undefined || gb === undefined) continue;
    const A = byId.get(a); const B = byId.get(b);
    if(!A || !B) continue;
    A.played++; B.played++;
    A.gf += ga; B.gf += gb;
    A.ga += gb; B.ga += ga;
    if(ga > gb){ A.pts += 3; }
    else if(gb > ga){ B.pts += 3; }
    else { A.pts += 1; B.pts += 1; }
  }
  const rows = Array.from(byId.values()).sort((x,y)=> y.pts - x.pts || y.gf - x.gf || x.team.name.localeCompare(y.team.name));
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  const table = document.createElement('table');
  table.className = 'alltime-table wide-table';
  table.setAttribute('aria-label','Tournament leaderboard');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th style=\"width:50%\">Team</th><th>Played</th><th>Points</th><th>GS</th><th>GA</th><th>GD</th></tr>';
  const tbody = document.createElement('tbody');
  rows.forEach((r, idx)=>{
    const tr = document.createElement('tr');
    const tdTeam = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = 'team-pill';
    pill.style.borderColor = r.team.color;
    const label = document.createElement('span');
    label.textContent = r.team.name;
    pill.appendChild(label);
    tdTeam.appendChild(pill);
    const prev = prevRanks[String(r.team.id)];
    if(prev !== undefined && prev !== idx){
      const arrow = document.createElement('span');
      arrow.style.marginLeft = '6px';
      arrow.style.fontWeight = '700';
      arrow.style.fontSize = '14px';
      if(prev > idx){ arrow.textContent = ' ▲'; arrow.style.color = 'var(--accent-2)'; }
      else { arrow.textContent = ' ▼'; arrow.style.color = 'var(--danger)'; }
      tdTeam.appendChild(arrow);
    }
    const membersSmall = document.createElement('div');
    membersSmall.className = 'team-sub';
    membersSmall.textContent = r.team.members.join(', ');
    tdTeam.appendChild(membersSmall);
    const tdPlayed = document.createElement('td'); tdPlayed.textContent = String(r.played);
    const tdPts = document.createElement('td'); tdPts.textContent = String(r.pts);
    const tdGS = document.createElement('td'); tdGS.textContent = String(r.gf);
    const tdGA = document.createElement('td'); tdGA.textContent = String(r.ga || 0);
    const tdGD = document.createElement('td');
    const gd = (r.gf - (r.ga || 0));
    tdGD.textContent = String(gd);
    if(gd > 0) tdGD.classList.add('gd-pos'); else if(gd < 0) tdGD.classList.add('gd-neg');
    [tdTeam, tdPlayed, tdPts, tdGS, tdGA, tdGD].forEach(td => tr.appendChild(td));
    tbody.appendChild(tr);
  });
  table.appendChild(thead); table.appendChild(tbody);
  wrap.appendChild(table);
  lb.appendChild(wrap);
  if(savePrevRanksFromRows){ savePrevRanksFromRows(rows); }
}
