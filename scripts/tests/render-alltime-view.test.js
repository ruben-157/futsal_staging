import { renderAllTimeView } from '../render/alltimeView.js';

function makeDomStub(){
  const createElement = (tag) => {
    const el = {
      tag,
      children: [],
      className: '',
      style: {},
      attributes: {},
      events: {},
      classList: {
        list: [],
        add(cls){ this.list.push(cls); }
      },
      appendChild(child){ this.children.push(child); return child; },
      setAttribute(name, value){ this.attributes[name] = String(value); },
      addEventListener(type, handler){ this.events[type] = handler; },
      set textContent(val){ this._text = val; },
      get textContent(){ return this._text; }
    };
    return el;
  };
  const original = global.document;
  global.document = { createElement };
  return ()=>{ global.document = original; };
}

test('renderAllTimeView renders warning and empty when no stats', ()=>{
  const restore = makeDomStub();
  try{
    const container = { children: [], appendChild(el){ this.children.push(el); }, innerHTML:'' };
    renderAllTimeView({
      container,
      stats: [],
      warnings: [{ reason:'bad' }],
      skipped: 1
    });
    assert(container.children.length >= 1, 'should render notice');
    assert(container.children[0].className === 'notice', 'warning notice rendered');
  }finally{
    restore();
  }
});

test('renderAllTimeView renders table and header content when stats present', ()=>{
  const restore = makeDomStub();
  try{
    const container = { children: [], appendChild(el){ this.children.push(el); }, innerHTML:'' };
    const stats = [{ player:'A', matches:1, points:3, ppm:3, goals:1, goalSessions:1, gpm:1 }];
    const badges = new Map([['A', [{ key:'allTimeTop', label:'All-Time Topscorer' }]]]);
    const byDate = new Map([['2025-01-01', [{ player:'A', points:3, goals:1 }]]]);
    renderAllTimeView({
      container,
      stats,
      totalSessions: 1,
      series: new Map([['A',[3]]]),
      goalSeries: new Map([['A',[1]]]),
      byDate,
      badges,
      warnings: [],
      skipped: 0,
      latestDate: '2025-01-01',
      preRows: [],
      preRanks: new Map(),
      postRanks: new Map(),
      sort: { key:'points', dir:'desc' },
      badgePriority: [],
      badgeConfig: {},
      onSort: ()=>{},
      pillBuilder: (date)=> {
        const el = document.createElement('div'); el.tag = 'pill'; return el;
      },
      headerCardsBuilder: ()=> {
        const el = document.createElement('div'); el.tag = 'headerCards'; return el;
      }
    });
    const hasTable = container.children.some(c => c.className === 'table-wrap');
    assert(hasTable, 'Table rendered');
  }finally{
    restore();
  }
});
