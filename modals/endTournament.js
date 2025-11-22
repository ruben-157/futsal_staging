export function attachEndTournamentModal({ onAddRound, onEnd, lockBodyScroll, unlockBodyScroll }){
  const overlay = document.getElementById('overlay');
  const modal = document.getElementById('endTournamentModal');
  const yes = document.getElementById('endTournamentYes');
  const add = document.getElementById('endTournamentAddRound');

  function close(){
    if(overlay){ overlay.hidden = true; overlay.onclick = null; }
    if(modal) modal.hidden = true;
    if(yes) yes.onclick = null;
    if(add) add.onclick = null;
    document.removeEventListener('keydown', escHandler);
    try{ unlockBodyScroll && unlockBodyScroll(); }catch(_){/* no-op */}
  }

  function escHandler(e){
    if(e.key === 'Escape'){ close(); }
  }

  function open(){
    if(!overlay || !modal || !yes || !add) return;
    overlay.hidden = false;
    modal.hidden = false;
    try{
      lockBodyScroll && lockBodyScroll();
    }catch(_){/* no-op */}
    document.addEventListener('keydown', escHandler);
    overlay.onclick = close;
    add.onclick = ()=>{ onAddRound && onAddRound(); close(); };
    yes.onclick = ()=>{ onEnd && onEnd(); close(); };
  }

  return { open, close };
}
