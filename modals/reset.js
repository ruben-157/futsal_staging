export function attachResetModal({ resetAll }){
  const overlay = document.getElementById('overlay');
  const modal = document.getElementById('resetModal');
  const cancel = document.getElementById('resetCancel');
  const confirm = document.getElementById('resetConfirm');

  function close(){
    if(overlay){ overlay.hidden = true; overlay.onclick = null; }
    if(modal) modal.hidden = true;
    if(cancel) cancel.onclick = null;
    if(confirm) confirm.onclick = null;
  }

  function open(){
    if(!overlay || !modal || !cancel || !confirm) return;
    overlay.hidden = false;
    modal.hidden = false;
    overlay.onclick = close;
    cancel.onclick = close;
    confirm.onclick = () => { close(); resetAll(); };
    document.addEventListener('keydown', function esc(e){
      if(e.key === 'Escape'){ close(); }
    }, { once: true });
  }

  return { open, close };
}
