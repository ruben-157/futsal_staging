import { attachTeamCountModal } from '../modals/teamCount.js';
import { attachEndTournamentModal } from '../modals/endTournament.js';
import { attachRemoveRoundModal } from '../modals/removeRound.js';

function makeEl(id){
  return {
    id,
    hidden: true,
    onclick: null,
    textContent: '',
    innerHTML: '',
    disabled: false,
    style: {},
    events: {},
    querySelector: ()=> null,
    addEventListener(type, handler){ this.events[type] = handler; },
  };
}

function withDom(map, fn){
  const originalDoc = global.document;
  const doc = {
    getElementById: (id)=> map.get(id) || null,
    addEventListener: ()=> {},
    removeEventListener: ()=> {},
  };
  global.document = doc;
  try{ fn(); }finally{ global.document = originalDoc; }
}

test('team count modal renders copy and calls onSelect', ()=>{
  const overlay = makeEl('overlay');
  const modal = makeEl('teamCountModal');
  const body = makeEl('body');
  modal.querySelector = ()=> body;
  const btn2 = makeEl('teamCount2');
  const btn3 = makeEl('teamCount3');
  const map = new Map([
    ['overlay', overlay],
    ['teamCountModal', modal],
    ['teamCount2', btn2],
    ['teamCount3', btn3],
  ]);
  let picked = null;
  withDom(map, ()=>{
    const modalApi = attachTeamCountModal({
      sizesDesc: (n,t)=> `${n}-${t}`,
      onSelect: (t)=>{ picked = t; }
    });
    modalApi.open({ options:[2,3], count: 11 });
    assert(overlay.hidden === false, 'overlay shown');
    assert(modal.hidden === false, 'modal shown');
    assert(body.innerHTML.includes('11'), 'copy shows player count');
    btn2.onclick();
    assert(picked === 2, 'first option selected');
    assert(overlay.hidden === true, 'overlay hidden after close');
  });
});

test('end tournament modal wires add round and end callbacks', ()=>{
  const overlay = makeEl('overlay');
  const modal = makeEl('endTournamentModal');
  const yes = makeEl('endTournamentYes');
  const add = makeEl('endTournamentAddRound');
  const map = new Map([
    ['overlay', overlay],
    ['endTournamentModal', modal],
    ['endTournamentYes', yes],
    ['endTournamentAddRound', add],
  ]);
  let addCalled = 0;
  let endCalled = 0;
  let locked = 0;
  let unlocked = 0;
  withDom(map, ()=>{
    const modalApi = attachEndTournamentModal({
      onAddRound: ()=>{ addCalled++; },
      onEnd: ()=>{ endCalled++; },
      lockBodyScroll: ()=>{ locked++; },
      unlockBodyScroll: ()=>{ unlocked++; }
    });
    modalApi.open();
    assert(overlay.hidden === false && modal.hidden === false, 'modal opened');
    assert(locked === 1, 'lock called');
    add.onclick();
    assert(addCalled === 1, 'add round called');
    assert(overlay.hidden === true, 'closed after add');
    modalApi.open();
    yes.onclick();
    assert(endCalled === 1, 'end called');
    assert(unlocked >= 1, 'unlock called on close');
  });
});

test('remove round modal blocks when results exist and calls onRemove otherwise', ()=>{
  const overlay = makeEl('overlay');
  const modal = makeEl('removeRoundModal');
  const title = makeEl('removeRoundTitle');
  const info = makeEl('removeRoundInfo');
  const cancel = makeEl('removeRoundCancel');
  const confirm = makeEl('removeRoundConfirm');
  const map = new Map([
    ['overlay', overlay],
    ['removeRoundModal', modal],
    ['removeRoundTitle', title],
    ['removeRoundInfo', info],
    ['removeRoundCancel', cancel],
    ['removeRoundConfirm', confirm],
  ]);
  let removed = null;
  withDom(map, ()=>{
    const modalApi = attachRemoveRoundModal({
      roundHasResults: (r)=> r === 3,
      onRemove: (r)=>{ removed = r; }
    });
    modalApi.open(3);
    assert(confirm.disabled === true, 'confirm disabled when blocked');
    modalApi.open(4);
    assert(confirm.disabled === false, 'confirm enabled');
    confirm.onclick();
    assert(removed === 4, 'remove callback invoked');
    assert(overlay.hidden === true, 'modal closed after action');
  });
});
