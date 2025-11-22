export function attachRemoveRoundModal({ roundHasResults, onRemove }){
  const overlay = document.getElementById('overlay');
  const modal = document.getElementById('removeRoundModal');
  const title = document.getElementById('removeRoundTitle');
  const info = document.getElementById('removeRoundInfo');
  const cancel = document.getElementById('removeRoundCancel');
  const confirm = document.getElementById('removeRoundConfirm');
  const trigger = document.getElementById('btnRemoveRound');
  if(trigger){
    trigger.onclick = ()=> {
      const r = trigger.dataset.round ? Number(trigger.dataset.round) : null;
      const roundNum = Number.isFinite(r) ? r : null;
      if(roundNum != null){ open(roundNum); }
    };
  }

  function close(){
    if(overlay){ overlay.hidden = true; overlay.onclick = null; }
    if(modal) modal.hidden = true;
    if(cancel) cancel.onclick = null;
    if(confirm) confirm.onclick = null;
  }

  function open(roundNumber){
    if(!overlay || !modal || !title || !info || !cancel || !confirm) return;
    const blocked = roundHasResults(roundNumber);
    title.textContent = blocked ? `Cannot remove Round ${roundNumber}` : `Remove Round ${roundNumber}?`;
    info.textContent = blocked ? `Round ${roundNumber} has recorded results and cannot be removed. You can only remove an empty round.` : `Are you sure you want to remove round ${roundNumber}?`;
    overlay.hidden = false;
    modal.hidden = false;
    overlay.onclick = close;
    cancel.onclick = close;
    document.addEventListener('keydown', function esc(e){ if(e.key==='Escape'){ close(); } }, { once:true });
    if(blocked){
      confirm.disabled = true;
      confirm.onclick = null;
    } else {
      confirm.disabled = false;
      confirm.onclick = ()=>{ onRemove && onRemove(roundNumber); close(); };
    }
  }

  return { open, close };
}
