import { buildAllTimeTable } from '../render/alltime.js';

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

test('buildAllTimeTable sets aria-sort on active column', ()=>{
  const restore = makeDomStub();
  try{
    const stats = [
      { player:'A', matches:3, points:10, ppm:3.33, goals:5, goalSessions:2, gpm:2.5 },
      { player:'B', matches:2, points:4, ppm:2, goals:1, goalSessions:1, gpm:1 },
    ];
    const sort = { key:'points', dir:'desc' };
    const tableWrap = buildAllTimeTable(stats, 2, new Map(), new Map(), new Map(), '2025-01-02', { allTimeSort: sort, getPlayerBadges: () => [] });
    const table = tableWrap.children[0];
    const thead = table.children[0];
    const tr = thead.children[0];
    const thPoints = tr.children.find(th => (th._text || '').startsWith('Points'));
    assert(thPoints, 'Points column header present');
    assertEqual(thPoints.attributes['aria-sort'], 'descending');
  }finally{
    restore();
    delete global.getPlayerBadges;
  }
});

test('buildAllTimeTable triggers onSort handler for sortable header', ()=>{
  const restore = makeDomStub();
  try{
    let sortedKey = null;
    const stats = [
      { player:'A', matches:1, points:1, ppm:1, goals:0, goalSessions:0, gpm:0 },
      { player:'B', matches:1, points:2, ppm:2, goals:1, goalSessions:1, gpm:1 },
    ];
    const sort = { key:'player', dir:'asc' };
    const wrap = buildAllTimeTable(stats, 1, new Map(), new Map(), new Map(), '2025-01-01', {
      allTimeSort: sort,
      onSort: (key)=>{ sortedKey = key; },
      getPlayerBadges: () => []
    });
    const table = wrap.children[0];
    const thPoints = table.children[0].children[0].children.find(th => (th._text || '').startsWith('Points'));
    assert(thPoints.events.click, 'Click handler attached');
    thPoints.events.click();
    assertEqual(sortedKey, 'points');
  }finally{
    restore();
  }
});

test('buildAllTimeTable renders badges via getPlayerBadges', ()=>{
  const restore = makeDomStub();
  try{
    const stats = [
      { player:'A', matches:1, points:1, ppm:1, goals:0, goalSessions:0, gpm:0 },
    ];
    const badges = [{ key:'allTimeTop', label:'All-Time Topscorer' }];
    const wrap = buildAllTimeTable(stats, 1, new Map(), new Map(), new Map(), '2025-01-01', {
      allTimeSort: { key:'player', dir:'asc' },
      getPlayerBadges: () => badges,
      badgeConfig: { allTimeTop: { short:'All-Time Topscorer', desc:'Most goals' } }
    });
    const badgeCell = wrap.children[0].children[1].children[0].children[2];
    const pills = badgeCell.children[0].children;
    assert(pills.length === 1, 'One badge pill rendered');
    assert(pills[0]._text || pills[0].textContent, 'Badge text set');
  }finally{
    restore();
  }
});
