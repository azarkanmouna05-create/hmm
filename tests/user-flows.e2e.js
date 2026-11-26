// End-to-end check of MP4 Flows 1–8 (run against a running app: BASE defaults to http://localhost:4177). Result on 2026-11-26: 31 passed, 0 failed.
// Walks Flows 1–8 from the MP4 PDF and checks each arrow lands on the expected screen.
const { chromium } = require('playwright');
const B = 'http://localhost:4177';
let pass = 0, fail = 0;
const ok = (flow, step, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? '✅' : '❌'} Flow ${flow} · ${step}${extra ? ' — ' + extra : ''}`); };
(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  const newp = async () => { const c = await b.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true }); const p = await c.newPage(); p.on('dialog', d => d.accept('Thu 4pm')); p.on('pageerror', e => console.log('   PAGEERR', e.message)); return p; };
  const title = (p) => p.locator('.apphead__title').first().innerText().catch(() => '');
  const wait = (p, ms = 1800) => p.waitForTimeout(ms);
  const waitAI = (p, n) => p.waitForFunction((n) => document.querySelectorAll('.turn--ai').length >= n && !document.querySelector('.thinking'), n, { timeout: 30000 }).then(() => true).catch(() => false);

  // reset demo so Mouna is first-time
  await fetch(B + '/api/demo-reset', { method: 'POST' }).catch(() => {});

  // Flow 1 — first time
  let p = await newp();
  await p.goto(B + '/#/login'); await wait(p, 2500);
  ok(1, 'Open hmm. → S01 Login', (await p.locator('#go').innerText()).includes('Log in'));
  await p.click('[data-demo=student]'); await wait(p, 5000);
  ok(1, 'First time? yes → S02 Learning Snapshot', p.url().includes('/snapshot') && (await title(p)).includes('Learning Snapshot'));
  await p.fill('#name', 'Mouna'); await p.click('#next'); await wait(p);
  ok(1, 'Answer 4 questions (2 of 4 shown)', (await p.locator('.apphead__end').innerText()).includes('2 of 4'));
  await p.click('[data-g=stuck][data-v=hint]'); await wait(p, 1200); await p.click('#next'); await wait(p);
  await p.click('[data-g=tone][data-v=Encouraging]'); await wait(p, 1200); await p.click('#next'); await wait(p);
  ok(1, 'Create Learner Profile (summary + engine note)', await p.locator('.engine').count() > 0);
  await p.click('#next'); await wait(p, 4500);
  ok(1, 'Home, tuned to me → S03 (adaptation strip)', (await title(p)).startsWith('Hi') && (await p.locator('.engine').first().innerText()).toLowerCase().includes('today you are on'));

  // Flow 2 — Socrates
  await p.click('[data-free=socrates]'); await wait(p, 1500);
  if (await p.locator('.sheet [data-c]').count()) await p.click('.sheet [data-c="MATH 1101"]'); await wait(p, 2000);
  ok(2, 'Choose Socrates (S03) → S04a asks to type the problem', p.url().includes('/session/socrates') && (await p.locator('#ask-topic').count()) === 1);
  await p.fill('#say', 'Find the derivative of x^3 e^x'); await p.press('#say', 'Enter');
  ok(2, 'Engine reads profile → asks a guiding question', await waitAI(p, 1));
  await p.click('#hint'); ok(2, 'Reply or take a hint (hint ladder)', await waitAI(p, 2), (await p.locator('.ladder__title').innerText()));
  await p.fill('#say', 'so it is 3x^2 e^x + x^3 e^x'); await p.press('#say', 'Enter'); await waitAI(p, 3);
  await p.click('#end'); await wait(p, 2000);
  ok(2, 'Solved → End and reflect → S05 Reflection', (await title(p)) === 'Reflect' && (await p.locator('.summary').count()) === 1);

  // Flow 5 — reflect & steer
  await p.fill('#stuck', 'combining the two terms'); await p.fill('#unlocked', 'the hint'); await p.click('[data-conf="5"]'); await p.click('#save');
  await p.waitForURL(u => String(u).includes('/me'), { timeout: 20000 }).catch(() => {});
  await wait(p, 2500); const ag = await p.locator('.agree').count(); ok(5, 'Answer 3 reflection questions → engine updates → S06 Thinking Profile', p.url().includes('/me') && ag === 1, 'url=' + p.url().replace(B,'') + ' agree=' + ag + ' title=' + (await title(p)));
  await p.click('#ch-pace'); await wait(p, 800); await p.click('.sheet [data-v="Small steps"]'); await wait(p, 3000);
  ok(5, 'Agree? no → change hint pace (S06 settings)', (await p.locator('#ch-pace').innerText()).includes('Small'));
  await p.goto(B + '/#/'); await wait(p, 2500);
  ok(5, '→ Back to Home S03', (await title(p)).startsWith('Hi'));

  // Flow 3 — Talmid via an assigned task
  const talmidTask = p.locator('[data-task]').filter({ hasText: 'Talmid' }).first();
  ok(3, 'Open assigned task (S03, suggested Talmid)', await talmidTask.count() > 0);
  await talmidTask.click(); await wait(p, 1200); await p.click('.sheet [data-k=talmid]'); 
  ok(3, 'Talmid asks a naive question (S04b)', await waitAI(p, 1) && (await title(p)).includes('Talmid'));
  await p.fill('#say', 'People switch to cheaper goods and their money buys less'); await p.press('#say', 'Enter'); await waitAI(p, 2);
  ok(3, 'Explain it → understanding meter fills', (await p.locator('.ladder__title').innerText()).includes('Talmid understands'));
  await p.click('#end'); await wait(p, 1500); ok(3, 'End and reflect → S05', (await title(p)) === 'Reflect');
  await p.click('#skip'); await wait(p, 5000);

  // Flow 4 — Rival
  await p.goto(B + '/#/'); await wait(p, 2500);
  await p.click('[data-free=rival]'); await wait(p, 1500);
  if (await p.locator('.sheet [data-c]').count()) await p.click('.sheet [data-c="SAD 3301"]'); await wait(p, 2000);
  ok(4, 'Choose the Rival (S03) → S04c asks to state my claim', p.url().includes('/session/rival') && (await p.locator('#ask-topic').count()) === 1);
  await p.fill('#say', 'Agile is always better than Waterfall'); await p.press('#say', 'Enter');
  ok(4, 'Rival counters at my level', await waitAI(p, 1));
  await p.fill('#say', 'Agile adapts when requirements change'); await p.press('#say', 'Enter'); await waitAI(p, 2);
  ok(4, 'Defend my point → points vs counters + strength', (await p.locator('#board').innerText()).length > 10 && (await p.locator('.ladder__title').innerText()).includes('Argument strength'));
  await p.click('#end'); await wait(p, 1500); ok(4, 'End and reflect → S05', (await title(p)) === 'Reflect');
  await p.click('#skip'); await wait(p, 5000);

  // Flow 6 & 7 — professor
  p = await newp(); await p.goto(B + '/#/login'); await wait(p, 2000); await p.click('[data-demo=professor]'); await wait(p, 7000);
  ok(6, 'Open class pulse → S07 My classes', (await title(p)) === 'My classes' && (await p.locator('.pulse-card').count()) >= 1);
  await p.click('.pulse-card[href*="MATH"]'); await wait(p, 4000);
  ok(6, 'Open Class Insights → S09 (privacy banner)', (await title(p)) === 'Insights' && (await p.locator('.privacy-banner').count()) === 1);
  ok(6, 'Review stuck concepts (chart) + misconceptions', (await p.locator('.viz-cols').count()) === 1);
  ok(6, 'Suggest next moves (3 cards)', (await p.locator('.move-card').count()) === 3);
  await p.click('.move-card button:has-text("Add to lecture plan")'); await wait(p, 3000);
  ok(6, 'Change how I teach? yes → add re-teach → back to class pulse S07', (await title(p)) === 'My classes');
  // Flow 7
  await p.click('.move-card a:has-text("Create task")'); await wait(p, 2000);
  ok(7, 'Tap Create task on a move → S08 pre-filled (From insight)', (await title(p)) === 'New assignment' && (await p.locator('#topic').inputValue()).length > 3 && (await p.locator('.privacy-banner').count()) === 1);
  await p.fill('#instr', 'Explain it in your own words.'); await p.fill('#maxh', '9'); await p.locator('#maxh').dispatchEvent('change'); await wait(p, 300);
  ok(7, 'Within campus limits? no → capped to admin limit', (await p.locator('#maxh').inputValue()) === '4' && (await p.locator('#msg').innerText()).includes('Capped'));
  await p.click('button:has-text("Publish")'); await wait(p, 3500);
  ok(7, 'Publish (hmm. suggests a character to each) → back to S07', (await title(p)) === 'My classes');

  // Flow 8 — admin
  p = await newp(); await p.goto(B + '/#/login'); await wait(p, 2000); await p.click('[data-demo=admin]'); await wait(p, 7000);
  ok(8, 'Log in (admin) → S10 Campus dashboard', (await title(p)) === 'Campus dashboard');
  await p.click('.tabbar a[href="#/rules"]'); await wait(p, 2500);
  ok(8, 'Policy change needed → S11 Rules & settings', (await title(p)) === 'Rules & settings');
  await p.click('[data-c="SAD 3301"][data-k="talmid"]'); await p.click('#save'); await wait(p, 3000);
  ok(8, 'Adjust → Save: rules apply to every course', (await p.locator('#msg').innerText()).includes('Saved'));

  // tidy up: undo the rule change + demo edits
  await fetch(B + '/api/demo-reset', { method: 'POST' }).catch(() => {});
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
})();
