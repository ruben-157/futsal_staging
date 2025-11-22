function csvEscape(str=''){
  return String(str).includes(',') ? `"${String(str).replace(/"/g,'""')}"` : String(str);
}

export function buildEmailSummaryText(state, computeGoalStats){
  const dateStr = new Date().toISOString().slice(0,10);
  const lines = [];
  const { totals: goalTotals } = computeGoalStats();
  if(!state.teams || state.teams.length < 2){
    lines.push('Date,Player,Points,Goals');
    return lines.join('\n');
  }
  const teamById = new Map(state.teams.map(t => [t.id, t]));
  const points = new Map();
  for(const t of state.teams){ for(const name of (t.members||[])) points.set(name, 0); }
  for(const key of Object.keys(state.results || {})){
    const r = state.results[key]; if(!r) continue;
    const { a, b, ga, gb } = r;
    if(ga == null || gb == null) continue;
    const ta = teamById.get(a); const tb = teamById.get(b); if(!ta || !tb) continue;
    if(ga > gb){ for(const n of (ta.members||[])) points.set(n, (points.get(n)||0) + 3); }
    else if(gb > ga){ for(const n of (tb.members||[])) points.set(n, (points.get(n)||0) + 3); }
    else { for(const n of (ta.members||[])) points.set(n, (points.get(n)||0) + 1); for(const n of (tb.members||[])) points.set(n, (points.get(n)||0) + 1); }
  }
  const rows = Array.from(points.entries()).sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]));
  lines.push('Date,Player,Points,Goals');
  for(const [name, pts] of rows){
    const goals = goalTotals.get(name) || 0;
    lines.push(`${dateStr},${csvEscape(name)},${pts},${goals}`);
  }
  return lines.join('\n');
}

export function buildEmailSubject(date = new Date()){
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth()+1).padStart(2,'0');
  const dd = String(date.getDate()).padStart(2,'0');
  return `Futsal Teams & Results — ${yyyy}-${mm}-${dd}`;
}

export function buildMailtoLink(to, subject, body){
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
