export function attachTeamCountModal({ sizesDesc, onSelect }){
  const overlay = document.getElementById('overlay');
  const modal = document.getElementById('teamCountModal');
  const btn2 = document.getElementById('teamCount2');
  const btn3 = document.getElementById('teamCount3');
  const body = modal ? modal.querySelector('.modal-body') : null;

  function close(){
    if(overlay) overlay.hidden = true;
    if(modal) modal.hidden = true;
    if(btn2) btn2.onclick = null;
    if(btn3) btn3.onclick = null;
    if(overlay) overlay.onclick = null;
  }

  function open({ options=[2,3], count } = {}){
    if(!overlay || !modal || !btn2 || !btn3 || !body) return;
    const a = options[0];
    const b = options[1];
    const n = count || 0;
    const sizesA = sizesDesc ? sizesDesc(n, a) : '';
    const sizesB = sizesDesc ? sizesDesc(n, b) : '';
    body.innerHTML = `<div class="notice" style="font-weight:600; margin-bottom:8px">You have ${n} players. Choose ${a} or ${b} teams.</div>
                      <div class="notice">${a} teams: ${sizesA} &nbsp; • &nbsp; ${b} teams: ${sizesB}</div>`;
    btn2.textContent = `${a} Teams`;
    btn3.textContent = `${b} Teams`;
    overlay.hidden = false;
    modal.hidden = false;
    overlay.onclick = close;
    document.addEventListener('keydown', function esc(e){ if(e.key === 'Escape'){ close(); } }, { once:true });
    btn2.onclick = ()=>{ close(); onSelect && onSelect(a); };
    btn3.onclick = ()=>{ close(); onSelect && onSelect(b); };
  }

  return { open, close };
}
