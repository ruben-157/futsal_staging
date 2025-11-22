// Lightweight UI notifications shared across the app
export function showToast(text, extraClass){
  const t = document.createElement('div');
  t.className = 'toast' + (extraClass ? (' ' + extraClass) : '');
  t.setAttribute('role','status');
  t.setAttribute('aria-live','polite');
  t.innerHTML = `<span class="emoji">🎉</span><span>${text}</span>`;
  document.body.appendChild(t);
  setTimeout(()=>{ t.remove(); }, 4000);
}

export function launchConfetti(){
  const colors = ['#EF4444','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899'];
  const count = 80;
  const nodes = [];
  for(let i=0;i<count;i++){
    const c = document.createElement('div');
    c.className = 'confetti';
    const left = Math.random()*100;
    const dur = 2.8 + Math.random()*1.8;
    const delay = Math.random()*0.5;
    c.style.left = left + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.animation = `confetti-fall ${dur}s linear ${delay}s forwards`;
    document.body.appendChild(c);
    nodes.push(c);
  }
  setTimeout(()=> nodes.forEach(n=> n.remove()), 5000);
}
