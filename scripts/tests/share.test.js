import { buildEmailSummaryText, buildEmailSubject, buildMailtoLink } from '../logic/share.js';

test('buildEmailSummaryText returns header when no teams', ()=>{
  const state = { teams: [], results:{}, attendees:[] };
  const computeGoalStats = ()=> ({ totals: new Map() });
  const body = buildEmailSummaryText(state, computeGoalStats);
  assert(body.startsWith('Date,Player,Points,Goals'));
});

test('buildEmailSubject formats date', ()=>{
  const date = new Date('2025-01-15T00:00:00Z');
  const subject = buildEmailSubject(date);
  assert(subject.includes('2025-01-15'));
});

test('buildMailtoLink encodes subject and body', ()=>{
  const link = buildMailtoLink('a@b.com', 'Hello World', 'Line1\nLine2');
  assert(link.includes('mailto:a@b.com'));
  assert(link.includes('Hello%20World'));
});
