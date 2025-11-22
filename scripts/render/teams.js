export function renderTeams(state){
  const tbody = document.getElementById('teamsBody');
  if(!tbody) return;
  tbody.innerHTML = '';
  if(!state.teams || state.teams.length === 0) return;
  for(const t of state.teams){
    const tr = document.createElement('tr');
    const tdTeam = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = 'team-pill';
    pill.style.borderColor = t.color;
    pill.textContent = t.name;
    tdTeam.appendChild(pill);
    const tdMembers = document.createElement('td'); tdMembers.textContent = (t.members||[]).join(', ');
    const tdSize = document.createElement('td'); tdSize.textContent = String((t.members||[]).length);
    const tdSkill = document.createElement('td'); tdSkill.textContent = (t.avgSkill || 0).toFixed(2);
    const tdStam = document.createElement('td'); tdStam.textContent = (t.avgStamina || 0).toFixed(2);
    [tdTeam, tdMembers, tdSize, tdSkill, tdStam].forEach(td => tr.appendChild(td));
    tbody.appendChild(tr);
  }
}
