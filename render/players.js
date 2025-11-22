export function renderRoster(state, actions){
  const { addPlayer, removePlayer, movePlayer } = actions;
  const listNot = document.getElementById('listNot');
  const listSel = document.getElementById('listSel');
  if(!listNot || !listSel) return;
  listNot.innerHTML = '';
  listSel.innerHTML = '';
  const fragNot = document.createDocumentFragment();
  const fragSel = document.createDocumentFragment();
  const makeItem = (name, selected)=>{
    const item = document.createElement('div');
    item.className = 'item' + (selected ? ' selected' : '');
    item.tabIndex = 0;
    item.setAttribute('role','listitem');
    const span = document.createElement('span'); span.textContent = name;
    item.appendChild(span);
    const btn = document.createElement('button'); btn.type='button'; btn.textContent = selected ? '−' : '+';
    btn.addEventListener('click', ()=> (selected ? removePlayer(name) : addPlayer(name)));
    item.appendChild(btn);
    return item;
  };
  for(const name of state.players){
    if(state.attendees.includes(name)) continue;
    fragNot.appendChild(makeItem(name, false));
  }
  for(const name of state.attendees){
    fragSel.appendChild(makeItem(name, true));
  }
  listNot.appendChild(fragNot);
  listSel.appendChild(fragSel);
}
