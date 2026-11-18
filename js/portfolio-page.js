/* The portfolio page's own script, as it runs in the dashboard, wrapped so it starts once the data is in. */
function pfMain() {
const ils = v => (v < 0 ? '−' : '') + '₪' + d3.format(',.0f')(Math.abs(v));
const pct = v => d3.format('.1f')(v) + '%';
const num = (v, f) => (v === null || v === undefined || v === '') ? '—' : d3.format(f)(v);
const dmy = s => { const [y, m, d] = s.split('-'); return `${+d}/${+m}`; };
const CFG = window.PF_CFG || {}; const TOP3 = CFG.top3 || []; const DEF = CFG.defense || []; const ISR = CFG.israel || [];
const CONC_MAX = 23, DEF_MAX = 19;
/* concentration rule (10.11.2026): the two largest of the top-3 group, combined target 23% */
const concOf = hs => CFG.conc || TOP3.map(t => hs.find(h => h.ticker === t)).filter(Boolean).sort((a, b) => Number(b.value_ils) - Number(a.value_ils)).slice(0, 2).map(h => h.ticker);
const C = { red: '#E8435F', grn: '#12B07B', blu: '#8B6FE0', gry: '#A3A8CC', fg: '#17142B', mut: '#7E7A96', line: 'rgba(23,20,43,.14)', soft: 'rgba(23,20,43,.05)', band: 'rgba(139,111,224,.12)' };
const riskCol = v => v >= 7 ? C.red : v >= 4 ? C.blu : C.grn;
const riskCls = v => v === null || v === undefined ? '' : v >= 7 ? 't-red' : v >= 4 ? 't-blu' : 't-grn';
const MAX_W = 10;
window.pfC = C;

dash.calc('weights', {
  title: 'משקל כל אחזקה',
  description: 'שווי האחזקה חלקי השווי הכולל של התיק, באחוזים.',
  inputs: ['holdings', 'account'],
  fn: (holdings, account) => holdings.map(h => ({
    ticker: h.ticker, name: h.name, sector: h.sector,
    risk_price: h.risk_price, risk_fund: h.risk_fund,
    weight: Math.round(Number(h.value_ils) / Number(account[0].total_ils) * 1000) / 10
  })).sort((a, b) => b.weight - a.weight)
});

dash.calc('summary', {
  title: 'מדדי סיכום וכללים',
  description: 'חשיפות, ריכוזיות, תזת AI ומזומן מול יעד 25%, מתוך השווי הכולל.',
  inputs: ['holdings', 'account'],
  fn: (holdings, account) => {
    const T = Number(account[0].total_ils), Cs = Number(account[0].cash_ils);
    const sum = ks => holdings.filter(h => ks.includes(h.ticker)).reduce((s, h) => s + Number(h.value_ils), 0);
    const r1 = v => Math.round(v * 10) / 10;
    const top3 = sum(TOP3), def = sum(DEF), isr = sum(ISR);
    const ai = holdings.filter(h => h.sector === 'תשתיות AI').reduce((s, h) => s + Number(h.value_ils), 0);
    const top3_pct = r1(top3 / T * 100), excess = Math.round(top3 - 0.30 * T);
    return [{
      top3_pct, conc_pct: r1(sum(concOf(holdings)) / T * 100), defense_pct: r1(def / T * 100), israel_pct: r1(isr / T * 100),
      cash_pct: r1(Cs / T * 100), cash_gap_ils: Math.round(Cs - 0.25 * T), top3_excess_ils: excess,
      ai_pct: r1(ai / T * 100),
      portfolio_beta: Math.round(holdings.filter(h => h.beta !== null).reduce((s, h) => s + Number(h.value_ils) * Number(h.beta), 0) / T * 100) / 100,
      sentence: `כדי לחזור לתקרת 30% צריך להוריד כ-${Math.round(excess / 1000)} אלף ₪ מ-3 הגדולות.`
    }];
  }
});

/* Control panel: built from the live finance data (the same rows the finance page uses), not a frozen copy. */
dash.calc('fin_base', {
  title: 'בסיס כספים',
  inputs: ['fin_inputs', 'fin_expenses', 'fin_ledger'],
  fn: (inputs, expenses, ledger) => {
    const p = inputs[0] || {}, loanRow = expenses.find(e => /הלוואת רכב/.test(e.name) && !e.starts) || {};
    const done = ledger.filter(r => r.status !== 'expected'), bankNow = done.length ? done.reduce((s, r) => s + Number(r.amount), 0) : Number(p.bank_balance);
    const after = ledger.length ? ledger.reduce((s, r) => s + Number(r.amount), 0) : bankNow;
    const lastExp = ledger.filter(r => r.status === 'expected').map(r => r.date).sort().pop() || null;
    const today = new Date().toISOString().slice(0, 10);
    const monthly = expenses.filter(e => (!e.starts || e.starts <= today) && (e.left_after_current === null || e.left_after_current === '' || Number(e.left_after_current) >= 0)).reduce((s, e) => s + Number(e.amount || 0), 0);
    return [{ loan_principal: Number(p.loan_principal) || 0, loan_left: loanRow.left_after_current === undefined || loanRow.left_after_current === null ? '—' : Number(loanRow.left_after_current) + 1,
      bank_now: Math.round(bankNow), bank_after: Math.round(after), after_date: lastExp, monthly: Math.round(monthly),
      pension: Number(p.pension) || 0, car: Number(p.car_value) || 0 }];
  }
});

dash.calc('networth', {
  title: 'שווי נקי',
  description: 'תיק, פנסיה ורכב, פחות המינוס בבנק ויתרת הלוואת הרכב (כמו בעמוד הכספים).',
  inputs: ['account', 'fin_base'],
  fn: (account, fb) => {
    const p = Number(account[0].total_ils), f = fb[0];
    return [{ net: Math.round(p + f.pension + f.car + Math.min(0, f.bank_now) - f.loan_principal) }];
  }
});

dash.calc('alerts8', {
  title: 'התראת 8% משער הקנייה',
  description: 'אחזקות שהרווח שלהן מהקנייה הוא 8%- או פחות.',
  inputs: ['holdings'],
  fn: (holdings) => holdings.filter(h => h.pnl_pct !== null && Number(h.pnl_pct) <= -8).map(h => ({ ticker: h.ticker, name: h.name, pnl_pct: Number(h.pnl_pct) }))
});

dash.calc('dividends', {
  title: 'דיבידנד צפוי לשנה',
  description: 'שווי כל אחזקה כפול תשואת הדיבידנד שלה.',
  inputs: ['holdings', 'account'],
  fn: (holdings, account) => {
    const a = holdings.reduce((s, h) => s + (h.dividend ? Number(h.value_ils) * Number(h.dividend) / 100 : 0), 0);
    return [{ annual_ils: Math.round(a), yield_pct: Math.round(a / Number(account[0].total_ils) * 1000) / 10 }];
  }
});

dash.calc('progress', {
  title: 'התקדמות התיק',
  description: 'ריכוזיות מ-53.8% אל 30%, ותזות מול היעד שלהן.',
  inputs: ['holdings', 'account', 'theses'],
  fn: (holdings, account, theses) => {
    const T = Number(account[0].total_ils);
    const r1 = v => Math.round(v * 10) / 10, clamp = v => Math.max(0, Math.min(100, v));
    const top = holdings.filter(h => TOP3.includes(h.ticker)).reduce((s, h) => s + Number(h.value_ils), 0) / T * 100;
    const rows = [
      { goal: 'ריכוזיות', now: r1(top), target: 31, progress: Math.round(clamp((53.8 - top) / (53.8 - 31) * 100)) }
    ];
    theses.forEach(th => {
      const tk = String(th.tickers || '').split(',').map(s => s.trim()).filter(Boolean);
      const w = holdings.filter(h => tk.includes(h.ticker)).reduce((s, h) => s + Number(h.value_ils), 0) / T * 100;
      rows.push({ goal: 'תזה: ' + th.name, now: r1(w), target: Number(th.target_pct), progress: Math.round(clamp(w / Number(th.target_pct) * 100)) });
    });
    const overall = Math.round(rows.reduce((s, r) => s + r.progress, 0) / rows.length);
    return rows.map(r => ({ ...r, overall }));
  }
});

/* ---------- performance period ---------- */
document.querySelectorAll('#perf-card .seg button').forEach(b => b.addEventListener('click', () => dash.setParams({ period: b.dataset.p })));

/* ---------- tabs ---------- */
const tabs = { portfolio: document.getElementById('tab-portfolio'), research: document.getElementById('tab-research'), journal: document.getElementById('tab-journal') };
const pages = { portfolio: document.getElementById('page-portfolio'), research: document.getElementById('page-research'), journal: document.getElementById('page-journal') };
window.pfTab = 'portfolio';
const showTab = (k) => {
  window.pfTab = k;
  document.querySelector('.pf').classList.toggle('th-mode', k !== 'portfolio');
  Object.keys(tabs).forEach(t => { tabs[t].setAttribute('aria-selected', t === k ? 'true' : 'false'); pages[t].hidden = t !== k; });
  dash.setLink(k);
  window.scrollTo(0, 0);
  window.pfDraw && window.pfDraw();
};
tabs.portfolio.addEventListener('click', () => showTab('portfolio'));
tabs.research.addEventListener('click', () => showTab('research'));
tabs.journal.addEventListener('click', () => showTab('journal'));
const startHash = location.hash.slice(1);

/* ---------- small helpers ---------- */
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const placeTip = (box, tip, e) => {
  const bb = box.getBoundingClientRect(); tip.style.display = 'block';
  const tx = Math.min(e.clientX - bb.left + 12, bb.width - tip.offsetWidth - 4);
  tip.style.left = Math.max(4, tx) + 'px'; tip.style.top = Math.max(0, e.clientY - bb.top - tip.offsetHeight - 8) + 'px';
};

/* Performance strip: when the tiles don't fit, they glide slowly back and forth; a touch or hover pauses it. */
function pfMarquee(car) {
  if (car._mq) cancelAnimationFrame(car._mq.raf);
  const st = car._mq = { pos: 0, dir: 1, wait: 1.5, hold: false, raf: 0 };
  if (!car._mqBound) {
    car._mqBound = true;
    const on = () => { car._mq.hold = true; }, off = () => { car._mq.hold = false; car._mq.wait = 2; car._mq.pos = Math.abs(car.scrollLeft); };
    car.addEventListener('pointerenter', on); car.addEventListener('pointerleave', off);
    car.addEventListener('touchstart', on, { passive: true }); car.addEventListener('touchend', off, { passive: true });
  }
  const rtl = getComputedStyle(car).direction === 'rtl', sign = rtl ? -1 : 1;
  let last = 0;
  const step = (t) => {
    const dt = last ? Math.min(t - last, 100) / 1000 : 0; last = t;
    const max = car.scrollWidth - car.clientWidth;
    if (max > 4 && !st.hold && !document.hidden) {
      car.style.scrollSnapType = 'none';
      if (st.wait > 0) st.wait -= dt;
      else {
        st.pos += 22 * dt * st.dir;
        if (st.pos >= max) { st.pos = max; st.dir = -1; st.wait = 2; }
        if (st.pos <= 0) { st.pos = 0; st.dir = 1; st.wait = 2; }
        car.scrollLeft = sign * st.pos;
      }
    }
    st.raf = requestAnimationFrame(step);
  };
  st.raf = requestAnimationFrame(step);
}

/* ---------- draw ---------- */
window.pfDraw = () => {
  const D = id => dash.data(id);
  const H = D('holdings'), A = D('account'), W = D('weights'), S = D('summary'), F = D('fin_base');
  const NW = D('networth');

  // value marks
  document.querySelectorAll('[data-source="account"][data-field]').forEach(x => {
    if (A.status !== 'ok') { x.textContent = '—'; return; }
    const f = x.dataset.field, v = A.data[0][f];
    x.textContent = f === 'as_of' ? 'מעודכן ל-' + ((String(v).match(/\d{1,2}\.\d{1,2}\.\d{4}/) || [v])[0]) : f === 'total_ils' ? '₪' + d3.format(',.2f')(v) : f === 'cash_usd' ? d3.format(',.0f')(v) : (f === 'daily_change' || f === 'pnl_total') ? ils(Math.abs(v)) : ils(v);
  });
  document.querySelectorAll('[data-source="summary"][data-field]').forEach(x => {
    if (S.status !== 'ok') { x.textContent = '—'; return; }
    const f = x.dataset.field, v = S.data[0][f];
    x.textContent = f === 'sentence' ? v : f === 'portfolio_beta' ? d3.format('.2f')(v) : pct(v);
  });
  document.querySelectorAll('[data-source="fin_base"][data-field]').forEach(x => {
    if (F.status !== 'ok') { x.textContent = '—'; return; }
    const f = x.dataset.field, v = F.data[0][f];
    x.textContent = ['salary_day', 'charge_day', 'loan_left'].includes(f) ? String(v) : ['salary_normal', 'salary_careful', 'food_normal', 'food_careful'].includes(f) ? d3.format(',')(v) : f === 'loan_principal' ? '₪' + d3.format(',.2f')(v) : f === 'loan_payment' ? '₪' + d3.format(',.2f')(v) : ils(v);
  });
  document.querySelectorAll('[data-source="networth"][data-field]').forEach(x => {
    x.textContent = NW.status === 'ok' ? ils(Math.abs(NW.data[0][x.dataset.field])) : '—';
  });

  if (S.status === 'ok') {
    const kc = document.getElementById('kpi-conc'), kd = document.getElementById('kpi-def');
    if (kc) kc.className = 'v ' + (S.data[0].conc_pct > CONC_MAX ? 't-red' : 't-grn');
    if (kd) kd.className = 'v ' + (S.data[0].defense_pct > DEF_MAX ? 't-red' : 't-blu');
  }
  const al = document.getElementById('alert8'), AL = D('alerts8');
  al.innerHTML = '';
  const hit = AL.status === 'ok' && AL.data.length > 0;
  al.hidden = !hit;
  if (hit) al.append(el('span', 'pill red', 'התראה'), ' ', `ירידה של 8% ומעלה משער הקנייה: ${AL.data.map(a => `${a.name} (${d3.format('.1f')(a.pnl_pct)}%)`).join(', ')}.`);

  {
    const dp = document.getElementById('day-pill');
    const dpc = document.getElementById('day-pct');
    if (A.status === 'ok') {
      const v = Number(A.data[0].daily_change), base = Number(A.data[0].total_ils) - v, p = base ? v / base * 100 : 0;
      dp.className = 'pill day ' + (v < 0 ? 'red' : 'grn');
      dpc.textContent = d3.format('.2f')(Math.abs(p)) + '%';
      document.getElementById('pnl-pill').className = 'pill ' + (Number(A.data[0].pnl_total) < 0 ? 'red' : 'grn');
    } else dpc.textContent = '—';
  }

  // control panel
  {
    const lowEl = document.getElementById('ct-low'), lowD = document.getElementById('ct-low-d'), ex = document.getElementById('ct-exp');
    if (F.status === 'ok' && F.data.length) {
      const f = F.data[0];
      lowEl.textContent = (f.bank_after < 0 ? '-' : '') + ils(Math.abs(f.bank_after)); lowEl.className = 'a ' + (f.bank_after < 0 ? 't-red' : 't-grn');
      lowD.textContent = f.after_date ? 'אחרי ' + dmy(f.after_date) : 'עכשיו';
      ex.textContent = ils(f.monthly);
    } else { lowEl.textContent = '—'; lowD.textContent = '—'; ex.textContent = '—'; }
  }

  if (window.pfTab === 'portfolio') {
    // weights: one stacked bar
    const wbar = document.getElementById('wst-bar'), wleg = document.getElementById('wst-leg');
    wbar.innerHTML = ''; wleg.innerHTML = '';
    if (W.status === 'ok' && S.status === 'ok') {
      const REDS = ['#FF4D6D', '#FF7A90', '#FFADBB'], GRAYS = ['#A8B4D8', '#8794BC', '#6B77A0', '#535E84', '#3F4868'];
      const CC = H.status === 'ok' ? concOf(H.data) : TOP3; const top = W.data.filter(d => CC.includes(d.ticker)), rest = W.data.filter(d => !CC.includes(d.ticker));
      const segs = [...top.map((d, i) => ({ n: d.name, w: d.weight, c: REDS[i] })), ...rest.map((d, i) => ({ n: d.name, w: d.weight, c: GRAYS[i % GRAYS.length] })), { n: 'מזומן', w: S.data[0].cash_pct, c: C.blu }];
      segs.forEach(sg => {
        const b = el('div'); b.style.flex = `${sg.w} 1 0`; b.style.background = sg.c; b.title = `${sg.n}: ${pct(sg.w)}`; wbar.appendChild(b);
        const it = el('span'); const sw = el('i'); sw.style.background = sg.c; it.append(sw, sg.n, el('b', '', pct(sg.w))); wleg.appendChild(it);
      });
    }

    // progress
    {
      const P2 = D('progress'), pr = document.getElementById('pg-rows');
      pr.innerHTML = '';
      if (P2.status === 'ok' && P2.data.length) {
        P2.data.forEach(r => {
          const d = el('div', 'pg-r'); const rw = el('div', 'rw'); rw.append(el('span', '', r.goal), el('b', '', r.progress + '%'));
          const tr = el('div', 'tr'); const fl = el('div', 'fl'); fl.style.width = r.progress + '%'; fl.style.background = r.progress >= 100 ? C.grn : C.blu; tr.appendChild(fl);
          d.append(rw, tr, el('div', 'sub', `${pct(r.now)} · יעד ${r.target}%`)); pr.appendChild(d);
        });
      }
    }

    // cash card
    {
      const pill = document.getElementById('cash-pill'), cf = document.getElementById('cash-fill'), cm = document.getElementById('cash-mark'), cg = document.getElementById('cash-gap');
      const cis = document.getElementById('cash-ils-share'), cus = document.getElementById('cash-usd-ils');
      if (S.status === 'ok' && A.status === 'ok') {
        const s = S.data[0], a = A.data[0], near = s.cash_pct >= 25, sc = 50;
        pill.className = 'pill ' + (near ? 'grn' : 'red'); pill.textContent = near ? 'מעל המינימום' : 'מתחת למינימום';
        cf.style.width = (s.cash_pct / sc * 100) + '%'; cm.style.right = (25 / sc * 100) + '%'; document.getElementById('cash-tgt').style.right = (25 / sc * 100) + '%';
        cg.textContent = s.cash_gap_ils < 0 ? `חסר ${ils(Math.abs(s.cash_gap_ils))} למינימום` : `${ils(s.cash_gap_ils)} מעל המינימום`;
        const usdIls = a.cash_ils - a.cash_ils_part;
        cis.textContent = pct(a.cash_ils_part / a.cash_ils * 100);
        cus.textContent = pct(usdIls / a.cash_ils * 100);
      } else { pill.textContent = '—'; cg.textContent = '—'; cis.textContent = '—'; cus.textContent = '—'; }
    }

    // scatter
    const box = document.getElementById('scatter'), tip = document.getElementById('tip'), detail = document.getElementById('detail');
    box.querySelectorAll('svg').forEach(e => e.remove());
    if (W.status === 'ok' && H.status === 'ok' && box.clientWidth > 0) {
      const pts = W.data.filter(d => d.risk_price !== null && d.risk_price !== undefined).map(d => ({ ...d }));
      const wd = box.clientWidth, ht = 300, m = { t: 14, r: 16, b: 34, l: 34 };
      const x = d3.scaleLinear([0, 10], [m.l, wd - m.r]), y = d3.scaleLinear([0, 10], [ht - m.b, m.t]);
      const r = d3.scaleSqrt([0, d3.max(pts, d => d.weight)], [5, 24]);
      const svg = d3.select(box).insert('svg', ':first-child').attr('width', '100%').attr('viewBox', `0 0 ${wd} ${ht}`).attr('direction', 'ltr');
      svg.append('rect').attr('x', x(5)).attr('y', y(10)).attr('width', x(10) - x(5)).attr('height', y(5) - y(10)).attr('fill', 'rgba(255,77,109,.08)');
      [0, 2, 4, 6, 8, 10].forEach(v => {
        svg.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', y(0)).attr('y2', y(10)).attr('stroke', C.soft);
        svg.append('line').attr('y1', y(v)).attr('y2', y(v)).attr('x1', x(0)).attr('x2', x(10)).attr('stroke', C.soft);
        svg.append('text').attr('x', x(v)).attr('y', ht - m.b + 14).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', C.mut).text(v);
        svg.append('text').attr('x', m.l - 8).attr('y', y(v) + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', C.mut).text(v);
      });
      svg.append('line').attr('x1', x(5)).attr('x2', x(5)).attr('y1', y(0)).attr('y2', y(10)).attr('stroke', C.line).attr('stroke-width', 2);
      svg.append('line').attr('y1', y(5)).attr('y2', y(5)).attr('x1', x(0)).attr('x2', x(10)).attr('stroke', C.line).attr('stroke-width', 2);
      [[2.5, 9.6, 'יקר במימון'], [7.5, 9.6, 'הכי מסוכן'], [2.5, 0.5, 'הכי בטוח'], [7.5, 0.5, 'יקר בתמחור']].forEach(([a, b, t]) =>
        svg.append('text').attr('x', x(a)).attr('y', y(b)).attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', C.mut).text(t));
      const byT = Object.fromEntries(H.data.map(h => [h.ticker, h]));
      const seen = {};
      pts.forEach(d => { const k = d.risk_price + '_' + d.risk_fund; seen[k] = (seen[k] || 0) + 1; d._n = seen[k] - 1; d._j = d._n * 30; });
      const g = svg.selectAll('g.pt').data(pts).join('g').attr('class', 'pt').style('cursor', 'pointer')
        .attr('transform', d => `translate(${x(d.risk_price) + d._j},${y(d.risk_fund)})`);
      g.append('circle').attr('r', d => r(d.weight)).attr('fill', d => riskCol((d.risk_price + d.risk_fund) / 2)).attr('fill-opacity', .9).attr('stroke', '#ffffff').attr('stroke-width', 2).style('filter', 'drop-shadow(0 0 6px rgba(255,255,255,.18))');
      g.append('text').attr('y', d => r(d.weight) >= 14 ? 4 : (d._n % 2 ? r(d.weight) + 12 : -r(d.weight) - 4)).attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', 600)
        .attr('fill', d => r(d.weight) >= 14 ? '#FFFFFF' : C.fg).text(d => d.ticker);
      g.on('click', (e, d) => {
        const h = byT[d.ticker]; detail.innerHTML = '';
        detail.appendChild(el('b', '', `${h.name} · ${pct(d.weight)} מהתיק`));
        detail.appendChild(el('div', '', `תמחור ${h.risk_price} · מימון ${h.risk_fund} · מכפיל עתידי ${num(h.fwd_pe, '.1f')} · מכפיל מכירות ${num(h.ps, '.1f')} · נתון מ-${h.data_date}`));
        detail.appendChild(el('div', 'mut', h.note));
      }).on('mousemove', (e, d) => { tip.textContent = `${d.name}: תמחור ${d.risk_price}, מימון ${d.risk_fund}, משקל ${pct(d.weight)}`; placeTip(box, tip, e); })
        .on('mouseleave', () => { tip.style.display = 'none'; });
    }
    // beta
    const bzt = document.getElementById('bz-ticks'), bleg = document.getElementById('bz-leg');
    bzt.innerHTML = ''; bleg.innerHTML = '';
    if (H.status === 'ok') {
      const PAL = ['#2563EB', '#DC2626', '#16A34A', '#D97706', '#7C3AED', '#0891B2', '#DB2777', '#4B5563'];
      H.data.filter(h => h.beta !== null).sort((a, b) => a.beta - b.beta).forEach((h, i) => {
        const col = PAL[i % PAL.length], pos = Math.max(0, Math.min(100, (Number(h.beta) + 1) / 3 * 100));
        const tk = el('div', 'bz-t'); tk.style.left = pos + '%'; tk.style.background = col; tk.title = `${h.name}: ${d3.format('.2f')(h.beta)}`; bzt.appendChild(tk);
        const lg = el('span', '', h.name); lg.style.color = col; bleg.appendChild(lg);
      });
    }

    // performance carousel
    {
      const per = dash.params().period || 'w', key = { w: 'ret_w', m: 'ret_m', ytd: 'ret_ytd' }[per] || 'ret_w';
      document.querySelectorAll('#perf-card .seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === per ? 'true' : 'false'));
      const car = document.getElementById('car'); car.innerHTML = '';
      if (H.status === 'ok') {
        const num0 = v => v === null || v === undefined || v === '' ? null : Number(v);
        [...H.data].sort((a, b) => (num0(b[key]) ?? -1e9) - (num0(a[key]) ?? -1e9)).forEach(h => {
          const v = num0(h[key]); const sq = el('div', 'sq');
          sq.title = h.ret_date ? `נכון ל-${h.ret_date}` : '';
          const pv = el('span', 'pv ' + (v === null ? 'mut' : v > 0 ? 't-grn' : v < 0 ? 't-red' : ''), v === null ? '—' : d3.format('.1f')(Math.abs(v)) + '%');
          sq.append(el('span', 'tk', h.name), pv);
          const sk = { w: 'spark_w', m: 'spark_m', ytd: 'spark_ytd' }[per];
          const pts = String(h[sk] || '').split(',').map(Number).filter(n => Number.isFinite(n) && n > 0);
          if (pts.length >= 3) {
            const sx = d3.scaleLinear([0, pts.length - 1], [2, 82]), sy = d3.scaleLinear(d3.extent(pts), [22, 2]);
            const col = pts[pts.length - 1] >= pts[0] ? C.grn : C.red;
            const svg = d3.select(sq).append('svg').attr('viewBox', '0 0 84 24').attr('aria-hidden', 'true');
            svg.append('path').attr('d', d3.line().x((d, i) => sx(i)).y(d => sy(d))(pts)).attr('fill', 'none').attr('stroke', col).attr('stroke-width', 1.75).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
          } else d3.select(sq).append('svg').attr('viewBox', '0 0 84 24').attr('aria-hidden', 'true');
          car.appendChild(sq);
        });
        pfMarquee(car);
      }
    }

    // dividend bars
    const db = document.getElementById('divbars'); db.querySelectorAll('.dv:not(.tot)').forEach(x => x.remove());
    document.querySelectorAll('[data-source="dividends"][data-field]').forEach(x => {
      const DV = D('dividends'); if (DV.status !== 'ok') { x.textContent = '—'; return; }
      const v = DV.data[0][x.dataset.field]; x.textContent = x.dataset.field === 'yield_pct' ? pct(v) : ils(v);
    });
    if (H.status === 'ok') {
      const rows = H.data.filter(h => h.dividend && Number(h.dividend) > 0).map(h => ({ n: h.name, y: Number(h.dividend), a: Number(h.value_ils) * Number(h.dividend) / 100 })).sort((p, q) => q.a - p.a);
      rows.forEach(r => {
        const c = el('div', 'dv');
        c.append(el('span', 'n', r.n), el('span', 'a', ils(r.a)), el('span', 'y', d3.format('.1f')(r.y) + '%'));
        db.appendChild(c);
      });
    }

    // stock rows
    const st = document.getElementById('stocks'); st.innerHTML = '';
    if (H.status === 'ok' && W.status === 'ok') {
      const sg = v => v === null || v === undefined ? '—' : d3.format('.1f')(Math.abs(v)) + '%';
      const sc = v => v === null || v === undefined ? 'mut' : v > 0 ? 't-grn' : v < 0 ? 't-red' : '';
      const isTrade = h => h.trade === true || h.trade === 'true' || h.tag === 'טרייד';
      // Financials table. With rev_qs / ni_qs (4 quarters YoY, oldest first) it shows the trend; otherwise the last quarter only.
      const arr = v => Array.isArray(v) ? v : (typeof v === 'string' && v ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : null; } catch (e) { return null; } })() : null);
      const finTable = (h, cls) => {
        const sgi = v => v === null || v === undefined ? '—' : '⁦' + (v < 0 ? '−' : '+') + d3.format('.0f')(Math.abs(v)) + '%⁩';
        const rq = arr(h.rev_qs), nq = arr(h.ni_qs), ql = arr(h.q_list);
        const trend = ql && ql.length > 1 && (rq || nq);
        const tb = el('table', cls + (trend ? ' trend' : '')), th = el('tr');
        const corner = el('th', '', '');
        if (trend) {
          const s = (rq && rq.filter(v => v !== null && v !== undefined).length > 1) ? rq : nq;
          const xs = s.filter(v => v !== null && v !== undefined);
          if (xs.length > 1) {
            const d = xs[xs.length - 1] - xs[xs.length - 2];
            const [t, c] = d >= 3 ? ['מאיץ', 'grn'] : d <= -3 ? ['מאט', 'red'] : ['יציב', 'gry'];
            const pl = el('span', 'pill acc ' + c, t);
            pl.title = `קצב הצמיחה של ${s === rq ? 'ההכנסות' : 'הרווח'} ברבעון האחרון לעומת הרבעון שלפניו (כל רבעון מושווה לאותו רבעון אשתקד)`;
            corner.appendChild(pl);
          }
        }
        th.appendChild(corner);
        const cols = trend ? ql.map((q, i) => [q, i]) : [[`רבעון · ${h.q_period}`, -1]];
        cols.forEach(([q, i]) => { const c = el('th', i === cols.length - 1 && trend ? 'last' : '', q); th.appendChild(c); });
        th.appendChild(el('th', 'yr', trend ? h.y_period : `12 חודשים · ${h.y_period}`));
        const thead = el('thead'); thead.appendChild(th); tb.appendChild(thead);
        const tbd = el('tbody');
        const fmt = trend ? sgi : (v => v === null || v === undefined ? '—' : '⁦' + (v < 0 ? '−' : '+') + sg(v) + '⁩');
        [['הכנסות', rq, h.rev_q, h.rev_y], ['רווח נקי', nq, h.ni_q, h.ni_y]].forEach(([lbl, qs, q, y]) => {
          if (trend && !qs && (y === null || y === undefined)) return;
          const tr = el('tr'); tr.appendChild(el('td', '', lbl));
          if (trend) ql.forEach((_, i) => { const v = qs ? qs[i] : null; tr.appendChild(el('td', 'v2 ' + sc(v) + (i === ql.length - 1 ? ' last' : ''), fmt(v))); });
          else tr.appendChild(el('td', 'v2 ' + sc(q), fmt(q)));
          tr.appendChild(el('td', 'v2 yr ' + sc(y), fmt(y)));
          tbd.appendChild(tr);
        });
        tb.appendChild(tbd);
        if (trend) tb.title = 'כל רבעון מושווה לאותו רבעון בשנה הקודמת (YoY)' + (h.fin_date ? ` · נתון מ-${h.fin_date}` : '');
        return tb;
      };
      const sortedH = [...H.data].sort((a, b) => (isTrade(b) - isTrade(a)) || ((a.pnl_pct ?? 1e9) - (b.pnl_pct ?? 1e9)));
      const half = 0, rowsPart = sortedH;
      sortedH.slice(0, half).forEach(h => {
        const c = el('div', 'stock' + (isTrade(h) ? ' trade' : ''));
        c.title = h.data_date ? `${h.note} תמחור מ-${h.data_date}.` : (h.note || '');
        const hd = el('div', 'sh');
        hd.appendChild(el('div', 'nm', h.name));
        hd.appendChild(el('div', 'cap mut', h.value_usd ? `${ils(h.value_ils)} · $${d3.format(',.0f')(h.value_usd)}` : ils(h.value_ils)));
        hd.appendChild(el('div', 'cap mut sec-line', h.sector));
        const pills = el('div', 'pills'); pills.style.marginTop = '4px';
        if (isTrade(h)) pills.appendChild(el('span', 'pill red', 'טרייד'));
        let repB = null;
        if (h.next_report_date) {
          const rd = new Date(h.next_report_date + 'T00:00:00'), days = Math.ceil((rd - new Date()) / 86400000);
          if (days >= 0 && days <= 30) {
            const est = h.next_report_est === true || h.next_report_est === 'true';
            const b = el('span', 'pill rep', `דוח ${est ? '~' : ''}${rd.getDate()}.${rd.getMonth() + 1}`);
            b.title = est ? 'תאריך משוער לפי השנה הקודמת' : 'תאריך דוח מאושר'; repB = b;
          }
        }
        if (h.pnl_pct !== null && h.pnl_pct <= -8) pills.appendChild(el('span', 'pill red', `${d3.format('.1f')(h.pnl_pct)}% מהקנייה`));
        hd.appendChild(pills); c.appendChild(hd);
        const tiles = el('div', 'tiles');
        // tile 1: profit
        const t1 = el('div', 'tile pnl'); t1.appendChild(el('div', 'lab', 'רווח מהקנייה'));
        const mid = el('div', 'pnl-mid');
        if (h.pnl_pct === null) mid.appendChild(el('div', 'v mut', '—'));
        else {
          mid.appendChild(el('div', 'pnl-pct ' + sc(h.pnl_pct), sg(h.pnl_pct)));
          mid.appendChild(el('div', 'pnl-ils ' + sc(h.pnl_ils), ils(Math.abs(h.pnl_ils))));
        }
        t1.appendChild(mid);
        tiles.appendChild(t1);
        // tile 2: financials
        const t2 = el('div', 'tile fin'); t2.appendChild(el('div', 'lab', isTrade(h) ? 'תוכנית הטרייד' : 'דוחות כספיים'));
        if (isTrade(h)) {
          const tb = el('table'); const tbd = el('tbody');
          const f2 = v => '$' + d3.format(',.2f')(v);
          const distStop = (h.price - h.exit_stop) / h.price * 100, distTgt = (h.exit_target - h.price) / h.price * 100;
          [['קנייה', f2(h.buy_price), ''], ['יציאה ברווח', f2(h.exit_target), `עוד ${d3.format('.1f')(distTgt)}%`, 't-grn'], ['יציאה בהפסד (−8%)', f2(h.exit_stop), `עוד ${d3.format('.1f')(distStop)}%`, distStop < 3 ? 't-red' : '']].forEach(([a, b, cc, cls]) => {
            const tr = el('tr'); tr.append(el('td', '', a), el('td', 'v2', b), el('td', 'v2 ' + (cls || ''), cc)); tbd.appendChild(tr);
          });
          tb.appendChild(tbd); t2.appendChild(tb);
          if (h.entry_reason) t2.appendChild(el('div', 'cap mut', 'למה: ' + h.entry_reason));
        } else if (h.rev_q === null && h.ni_q === null && h.rev_y === null && h.ni_y === null) {
          t2.appendChild(el('div', 'cap mut', 'קרן מדד, אין דוחות'));
        } else {
          t2.appendChild(finTable(h, ''));
        }
        tiles.appendChild(t2);
        // tile 3: pros / cons
        const t3 = el('div', 'tile pc'); t3.appendChild(el('div', 'lab', 'חיובי · שלילי'));
        const pcw = el('div', 'pcw'); const ul = el('ul', 'pcl'), ul2 = el('ul', 'pcl');
        const asList = v => Array.isArray(v) ? v : (typeof v === 'string' && v ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : [v]; } catch (e) { return [v]; } })() : []);
        asList(h.pros).forEach(p => { const li = el('li', 'pro'); li.append(el('i', '', '+'), el('span', '', p)); ul.appendChild(li); });
        asList(h.cons).forEach(p => { const li = el('li', 'con'); li.append(el('i', '', '−'), el('span', '', p)); ul2.appendChild(li); });
        pcw.append(ul, ul2); t3.appendChild(pcw); tiles.appendChild(t3);
        c.appendChild(tiles);
        if (repB) c.appendChild(repB);
        st.appendChild(c);
      });
      // Holdings as clean rows. A row opens to show the yearly numbers and pros / cons.
      if (rowsPart.length) {
        const tot = A.status === 'ok' ? Number(A.data[0].total_ils) : 0;
        const sgn = v => '\u2066' + (v < 0 ? '−' : '+') + sg(v) + '\u2069';
        const box = el('div', 'srows');
        const head = el('div', 'sr sr-h');
        ['מניה', 'שווי', 'רווח מהקנייה', 'הכנסות ברבעון', 'רווח נקי ברבעון', 'דוח הבא'].forEach((t, i) => head.appendChild(el('span', 'c' + i, t)));
        box.appendChild(head);
        const asList = v => Array.isArray(v) ? v : (typeof v === 'string' && v ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : [v]; } catch (e) { return [v]; } })() : []);
        rowsPart.forEach(h => {
          const r = el('details', 'srw');
          r.addEventListener('toggle', () => { if (r.open) box.querySelectorAll('details.srw[open]').forEach(o => { if (o !== r) o.open = false; }); });
          const sm = el('summary', 'sr');
          const nm = el('span', 'c0'); nm.append(el('b', '', h.name), el('small', 'mut', h.sector || ''));
          if (isTrade(h)) nm.appendChild(el('small', 't-red', 'טרייד'));
          if (h.pnl_pct !== null && h.pnl_pct <= -8) { nm.appendChild(el('small', 't-red', 'ירדה 8% מהקנייה')); r.classList.add('warn'); }
          const val = el('span', 'c1'); val.append(el('b', '', ils(h.value_ils)), el('small', 'mut', tot ? d3.format('.1f')(h.value_ils / tot * 100) + '% מהתיק' : ''));
          const pn = el('span', 'c2');
          if (h.pnl_pct === null || h.pnl_pct === undefined) pn.appendChild(el('b', 'mut', '—'));
          else pn.append(el('b', sc(h.pnl_pct), sgn(h.pnl_pct)), el('small', sc(h.pnl_ils), ils(Math.abs(h.pnl_ils))));
          const noRep = h.rev_q === null && h.ni_q === null && h.rev_y === null && h.ni_y === null;
          const q = (v) => { const x = el('span', ''); x.appendChild(el('b', noRep ? 'mut' : sc(v), noRep ? '—' : (v === null || v === undefined ? '—' : sgn(v)))); if (!noRep && h.q_period) x.appendChild(el('small', 'mut', h.q_period)); return x; };
          const rq = q(h.rev_q); rq.className = 'c3'; const nq = q(h.ni_q); nq.className = 'c4';
          const rp = el('span', 'c5');
          if (h.next_report_date) {
            const rd = new Date(h.next_report_date + 'T00:00:00'), days = Math.ceil((rd - new Date()) / 86400000);
            if (days >= 0 && days <= 30) {
              const est = h.next_report_est === true || h.next_report_est === 'true';
              const pl = el('span', 'rp-pill', `${est ? '~' : ''}${rd.getDate()}.${rd.getMonth() + 1}`);
              pl.title = (est ? 'דוח משוער' : 'דוח') + (days === 0 ? ' היום' : ` בעוד ${days} ימים`); rp.appendChild(pl);
            }
          }
          sm.append(nm, val, pn, rq, nq, rp);
          r.appendChild(sm);
          const more = el('div', 'sr-more');
          if (!noRep) more.appendChild(finTable(h, 'sr-fin'));
          const pros = asList(h.pros), cons = asList(h.cons);
          if (pros.length || cons.length) {
            const tb = el('table', 'sr-pc'), th = el('tr');
            th.append(el('th', 't-grn', 'חיובי'), el('th', 't-red', 'שלילי'));
            const thead = el('thead'); thead.appendChild(th); tb.appendChild(thead);
            const tbd = el('tbody');
            for (let i = 0; i < Math.max(pros.length, cons.length); i++) {
              const tr = el('tr'); tr.append(el('td', 'pro', pros[i] || ''), el('td', 'con', cons[i] || '')); tbd.appendChild(tr);
            }
            tb.appendChild(tbd); more.appendChild(tb);
          }
          r.appendChild(more);
          box.appendChild(r);
        });
        const wrapR = el('div', 'srows-wrap');
        wrapR.appendChild(box); st.appendChild(wrapR);
      }
    }
  }
};

/* ---------- plan and decisions ---------- */
const drawThesis = () => {
  const PLN = dash.data('plan'), DC = dash.data('decisions');
  const txt = v => (v === null || v === undefined) ? '' : String(v).trim();
  const pls = document.getElementById('pls'), cnt = document.getElementById('plan-cnt'), each = document.getElementById('pl-each');
  pls.innerHTML = ''; each.textContent = '';
  if (PLN.status === 'ok' && PLN.data.length) {
    const rows = [...PLN.data].sort((a, b) => a.step - b.step);
    const done = rows.filter(r => r.status === 'בוצע').length;
    const nxt = rows.find(r => r.status !== 'בוצע');
    cnt.textContent = `${done}/${rows.length} בוצעו`; cnt.title = nxt ? 'הבאה: ' + nxt.window : '';
    rows.forEach(r => {
      const t = el('div', 'plt' + (r.status === 'בוצע' ? ' done' : ''));
      const st = r.status === 'בוצע' ? ['grn', 'בוצע'] : String(r.status).includes('בוצע') ? ['blu', 'חלקי'] : ['gry', 'מתוכנן'];
      const sumR = (Number(r.eslt) || 0) + (Number(r.tase) || 0) + (Number(r.nxsn) || 0);
      t.title = `${r.window} · ${r.status}\nאלביט ${ils(Number(r.eslt) || 0)} · הבורסה ${ils(Number(r.tase) || 0)} · נקסט ויז'ן ${ils(Number(r.nxsn) || 0)}`;
      t.append(el('span', 'w', String(r.window).replace(/\s*\(.*?\)/g, '').replace(/^עד /, '')), el('span', 'amt', ils(sumR)), el('span', 'pill ' + st[0], st[1]));
      pls.appendChild(t);
    });
    const r0 = rows[0], HS = dash.data('holdings').data || [];
    const nm = tk => { const h = HS.find(x => x.ticker === tk); return h ? h.name : tk; };
    const parts = TOP3.filter(tk => r0[tk.toLowerCase()] !== undefined);
    const sum = parts.reduce((s, tk) => s + Number(r0[tk.toLowerCase()]), 0);
    each.textContent = `כל מנה ${ils(sum)}: ` + parts.map(tk => `${nm(tk)} ${ils(r0[tk.toLowerCase()])}`).join(' · ');
  } else cnt.textContent = '—';
  const dl = document.getElementById('dlog'); dl.innerHTML = '';
  if (DC.status === 'ok') {
    const rows = [...DC.data].sort((a, b) => a.date < b.date ? 1 : -1);
    if (!rows.length) dl.appendChild(el('div', 'mut cap', 'עוד אין החלטות'));
    rows.slice(0, 3).forEach(r => {
      const d = el('div', 'dr'); d.appendChild(el('span', 'd', dmy(r.date)));
      const b = el('div'); b.appendChild(el('div', '', r.action));
      d.title = [txt(r.why) && 'למה: ' + r.why, txt(r.expect) && 'ציפייה: ' + r.expect, txt(r.result) && 'בפועל: ' + r.result].filter(Boolean).join('\n');
      d.appendChild(b); dl.appendChild(d);
    });
  }
};
const _pfDraw0 = window.pfDraw;
window.pfDraw = () => { _pfDraw0(); drawThesis(); };

/* ---------- research page ---------- */
const openLab = (tk, held) => {
  const h = '#' + (held ? 'h-' : 't-') + String(tk || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (window.Roy && Roy.inShell()) Roy.go('lab', tk ? h : ''); else location.href = './#lab';
};
dash.calc('research_view', {
  title: 'סטטוס מחקר לכל אחזקה',
  description: 'לכל אחזקה: משקל מהתיק, ומהמעבדה אחוז הבדיקה, שאלות פתוחות ודגלים.',
  inputs: ['holdings', 'account', 'research'],
  fn: (holdings, account, research) => {
    const T = Number(account[0].total_ils);
    const byT = Object.fromEntries(research.map(r => [String(r.ticker).toUpperCase(), r]));
    return holdings.map(h => {
      const r = byT[String(h.ticker).toUpperCase()];
      const fund = h.rev_q === null && h.ni_q === null && h.rev_y === null && h.ni_y === null;
      return { ticker: h.ticker, name: h.name, weight: Math.round(Number(h.value_ils) / T * 1000) / 10, fund, has: !!r,
        pct: r ? Number(r.pct) : 0, flags: r ? Number(r.flags) : 0, q: r ? Number(r.q) : 0, verdict: r ? r.verdict : '',
        review_date: r ? (r.review_date || '') : '',
        ok: r ? Number(r.ok) || 0 : 0, done: r ? Number(r.done) || 0 : 0, total: r ? Number(r.total) || 7 : 7, type: r ? (r.type || '') : '',
        why: r ? (r.why || '') : '', sell_if: r ? (r.sell_if || '') : '', max_w: r && r.max_w !== null && r.max_w !== '' && r.max_w !== undefined ? Number(r.max_w) : null };
    }).sort((a, b) => b.weight - a.weight);
  }
});
dash.calc('research_kpi', {
  title: 'כמה מהתיק בלי מחקר מלא',
  description: 'סכום המשקלים של האחזקות שפחות מ-80% מהצ׳קליסט שלהן נבדק, וסך הדגלים האדומים.',
  inputs: ['research_view'],
  fn: (research_view) => [{
    weight_missing: Math.round(research_view.filter(r => !r.fund && r.pct < 80).reduce((s, r) => s + r.weight, 0) * 10) / 10,
    flags: research_view.reduce((s, r) => s + r.flags, 0)
  }]
});
const drawResearch = () => {
  const RV = dash.data('research_view'), RK = dash.data('research_kpi'), RS = dash.data('research'), H = dash.data('holdings');
  document.querySelectorAll('[data-source="research_kpi"][data-field]').forEach(x => {
    x.textContent = RK.status === 'ok' ? (x.dataset.field === 'weight_missing' ? pct(RK.data[0].weight_missing) : String(RK.data[0].flags)) : '—';
  });
  const VC = { 'התזה תקפה': 'grn', 'בבדיקה': 'blu', 'לצמצם': 'red', 'התזה נשברה': 'red', 'עוברת': 'grn', 'לא עוברת': 'red', 'נחתכה, מחכה לכניסה': 'red', 'בתיק': 'gry' };
  const N = v => Number(v) || 0;
  // Colourful progress bar: fills with research progress, colour runs red, amber, green.
  const meter = (p, cls) => {
    p = Math.max(0, Math.min(100, Math.round(p)));
    const m = el('span', cls), tr = el('span', 'tr'), fl = el('span', 'fl');
    fl.style.width = p + '%'; if (p) fl.style.backgroundSize = (10000 / p) + '% 100%';
    tr.appendChild(fl); m.append(tr, el('b', '', p + '%')); return m;
  };
  // One row per stock. The row shows only the name and one status bubble; a tap opens the details.
  const row = (box, r, held) => {
    const d = el('details', 'srw rsw');
    d.addEventListener('toggle', () => { if (d.open) box.querySelectorAll('details.rsw[open]').forEach(o => { if (o !== d) o.open = false; }); });
    const sm = el('summary', 'rs-s'), nm = el('span', 'rs-n');
    nm.appendChild(el('b', '', r.name || r.ticker));
    const over = held && r.max_w !== null && r.weight > r.max_w;
    if (held) nm.appendChild(el('small', over ? 't-red' : 'mut', pct(r.weight) + (over ? ' · מעל התקרה' : ' מהתיק')));
    else nm.appendChild(el('small', 'mut', [r.ticker, r.group].filter(Boolean).join(' · ')));
    if (over) d.classList.add('warn');
    if (r.fund) d.classList.add('fund');
    const bub = el('span', 'rs-b');
    if (r.fund) bub.appendChild(el('span', 'pill gry', 'קרן מדד'));
    else if (!r.has) bub.appendChild(el('span', 'pill red', 'אין מחקר'));
    else {
      if (N(r.flags)) bub.appendChild(el('span', 'pill red fg', 'דגל ' + N(r.flags)));
      if (r.verdict && !(held && r.verdict === 'בתיק')) bub.appendChild(el('span', 'pill ' + (VC[r.verdict] || 'gry'), r.verdict));
      bub.appendChild(meter(N(r.pct), 'rs-m'));
    }
    sm.append(nm, bub); d.appendChild(sm);
    const mo = el('div', 'sr-more rs-more');
    if (r.fund) mo.appendChild(el('p', 'rs-t mut', 'קרן מדד. לא צריך מחקר על חברה בודדת.'));
    else if (!r.has) {
      mo.appendChild(el('p', 'rs-t mut', 'עוד לא בדקת את המניה הזו. המחקר עובר על שער הכניסה ושבע שאלות הליבה.'));
      const go = el('button', 'rs-go', 'התחל מחקר'); go.type = 'button'; go.addEventListener('click', () => openLab(r.ticker, held));
      mo.appendChild(go);
    } else {
      // progress
      const pg = el('div', 'rs-pg');
      pg.append(el('span', 'k', 'התקדמות'), meter(N(r.pct), 'rs-m big'));
      mo.appendChild(pg);
      const st = el('div', 'rs-st');
      [['תקין', N(r.ok), 'grn'], ['לבדוק', N(r.q), 'blu'], ['פוסל', N(r.flags), 'red']].forEach(([k, v, c]) => {
        const t = el('div', 'rs-tile'); t.append(el('b', v ? 't-' + c : 'mut', String(v)), el('small', 'mut', k)); st.appendChild(t);
      });
      const old = !r.review_date || (Date.now() - new Date(r.review_date + 'T00:00:00').getTime()) / 864e5 > 90;
      const rv = el('div', 'rs-tile'); rv.append(el('b', old ? 't-red' : '', r.review_date ? dmy(r.review_date) : '—'), el('small', old ? 't-red' : 'mut', old ? 'לבדוק שוב' : 'נבדק'));
      st.appendChild(rv);
      mo.appendChild(st);
      const blk = (k, v) => { const b = el('div', 'rs-q'); b.append(el('div', 'k', k), el('p', 'rs-t' + (v ? '' : ' miss'), v || 'עוד לא נכתב')); mo.appendChild(b); };
      blk('למה אני מחזיק', r.why);
      blk('מוכר אם', r.sell_if);
      if (r.max_w !== null && r.max_w !== undefined && r.max_w !== '') blk('תקרת משקל', r.max_w + '% מהתיק');
      const go = el('button', 'rs-go', 'פתח מחקר'); go.type = 'button'; go.addEventListener('click', () => openLab(r.ticker, held));
      mo.appendChild(go);
    }
    d.appendChild(mo); box.appendChild(d);
  };
  const own = document.getElementById('rs-own'); own.innerHTML = '';
  if (RV.status === 'ok') { const box = el('div', 'srows'); [...RV.data.filter(r => !r.fund), ...RV.data.filter(r => r.fund)].forEach(r => row(box, r, true)); own.appendChild(box); }
  const oth = document.getElementById('rs-other'); oth.innerHTML = '';
  if (RS.status === 'ok' && H.status === 'ok') {
    const heldS = new Set(H.data.map(h => String(h.ticker).toUpperCase()));
    const rows = RS.data.filter(r => !heldS.has(String(r.ticker).toUpperCase()));
    if (!rows.length) oth.appendChild(el('div', 'mut cap', 'אין כרגע'));
    else {
      const box = el('div', 'srows');
      rows.forEach(r => row(box, { ...r, has: true, fund: false, max_w: (r.max_w === null || r.max_w === '' || r.max_w === undefined) ? null : Number(r.max_w) }, false));
      oth.appendChild(box);
    }
  }
};
const _pfDraw1 = window.pfDraw;
window.pfDraw = () => { _pfDraw1(); drawResearch(); };

/* ---------- journal page ---------- */
const J_FEEL = ['רגוע', 'הקלה', 'חשש להחמיץ', 'פחד', 'התלהבות', 'פסימיות', 'לחץ'];
const J_CAP = { ESLT: 11, TASE: 12, NXSN: 8 };
const J_REVIEW0 = '2026-12-07';
let jOpen = null, jEdit = null, jDecAll = false;
const jt = v => (v === null || v === undefined) ? '' : String(v).trim();
const jNum = v => { const n = parseFloat(String(v === null || v === undefined ? '' : v).replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : null; };
const jToday = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const jSync = () => { try { if (window.parent !== window && window.parent.Roy && window.parent.Roy._sync) return window.parent.Roy._sync; } catch (e) {} return window.Roy && Roy._sync; };
const jRows = () => { const TR = dash.data('trades'); return TR.status === 'ok' ? TR.data : null; };
const jSave = rows => {
  const s = jSync(); if (s) s.push([{ k: 'd:datasets.trades', v: JSON.stringify(rows), ts: Date.now() }]);
  window.pfDraw();
};
/* Today's price per share in ₪, from the holding (value ÷ quantity), so agorot and dollars need no special case */
const jNow = tk => { const h = (dash.data('holdings').data || []).find(x => String(x.ticker).toUpperCase() === String(tk || '').toUpperCase()); return h && Number(h.qty) ? Number(h.value_ils) / Number(h.qty) : null; };
const jSince = r => { const now = jNow(r.ticker), was = jNum(r.price); return now && was ? (now / was - 1) * 100 : null; };
const jFeel = r => J_FEEL.filter(f => jt(r.feeling).includes(f) || (f === 'חשש להחמיץ' && /FOMO/i.test(jt(r.feeling))));
const jP = v => '\u2068' + v + '%\u2069';
const jNextReview = () => { const d = new Date(J_REVIEW0 + 'T00:00:00'), t = new Date(); t.setHours(0, 0, 0, 0); while (d < t) d.setMonth(d.getMonth() + 3); return d; };

/* Rule check for the form: works on what's typed, before anything is saved */
const jCheck = f => {
  const out = [], A = (dash.data('account').data || [])[0] || {}, T = Number(A.total_ils) || 0, cash = Number(A.cash_ils) || 0;
  const H = (dash.data('holdings').data || []).find(h => h.ticker === f.ticker), amt = jNum(f.amount_ils) || 0;
  const cap = J_CAP[f.ticker] || MAX_W, buy = f.side === 'קנייה';
  if (!T) return out;
  const w = ((H ? Number(H.value_ils) : 0) + (buy ? amt : -amt)) / T * 100;
  if (f.ticker && amt) out.push([w <= cap + 0.05 ? 'ok' : 'bad', `משקל אחרי העסקה ${jP(w.toFixed(1))} · תקרה ${jP(cap)}`]);
  else if (f.ticker && H) out.push(['inf', `משקל היום ${jP((Number(H.value_ils) / T * 100).toFixed(1))} · תקרה ${jP(cap)}`]);
  if (amt) { const c = (cash + (buy ? -amt : amt)) / T * 100; out.push([c >= 25 ? 'ok' : 'bad', `מזומן אחרי העסקה ${jP(c.toFixed(1))} · מינימום ${jP(25)}`]); }
  if (!buy && H && Number(H.pnl_pct) <= -8) out.push(['ok', `ירידה של ${jP(Math.abs(Number(H.pnl_pct)).toFixed(1))} מהקנייה: יציאה לפי כלל העצירה`]);
  if (buy) out.push(['inf', 'עצירה: יוצאים בירידה של 8% משער הקנייה']);
  if (buy && f.feel.includes('חשש להחמיץ')) out.push(['bad', 'קנייה מתוך חשש להחמיץ. כדאי לחכות יום ולבדוק שוב']);
  if (buy && f.feel.includes('התלהבות')) out.push(['bad', 'התלהבות לפני קנייה: לבדוק שהמחקר במעבדה גמור']);
  return out;
};

const jForm = () => {
  const box = document.getElementById('jf'), rows = jRows() || [], r = jEdit !== null ? rows[jEdit] : null;
  const HS = [...(dash.data('holdings').data || [])].sort((a, b) => Number(b.value_ils) - Number(a.value_ils));
  const f = r ? { ...r, feel: jFeel(r) } : { date: jToday(), side: 'מכירה', ticker: '', name: '', amount_ils: '', price: '', why: '', market: '', expect: '', result: '', by: 'כלל', feel: [] };
  box.innerHTML = '';
  const fld = (lab, node) => { const l = el('label'); l.append(lab, node); return l; };
  const inp = (k, type, ph) => { const i = el('input'); if (type === 'number') { i.type = 'text'; i.inputMode = 'decimal'; } else i.type = type || 'text'; i.value = jt(f[k]); if (ph) i.placeholder = ph; i.oninput = () => { f[k] = i.value; chk(); }; return i; };
  const area = (k, ph) => { const i = el('textarea'); i.value = jt(f[k]); i.placeholder = ph || ''; i.oninput = () => { f[k] = i.value; }; return i; };
  const seg = (k, opts) => {
    const g = el('div', 'seg');
    opts.forEach(o => { const b = el('button', '', o); b.type = 'button'; b.setAttribute('aria-pressed', f[k] === o); b.onclick = () => { f[k] = o; g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); chk(); }; g.appendChild(b); });
    return g;
  };
  box.appendChild(seg('side', ['קנייה', 'מכירה']));
  const sel = el('select');
  [['', 'בחירת מניה'], ...HS.map(h => [h.ticker, h.name]), ['_', 'מניה אחרת']].forEach(([v, t]) => { const o = el('option', '', t); o.value = v; sel.appendChild(o); });
  const other = inp('name', 'text', 'שם המניה'), otherT = inp('ticker', 'text', 'טיקר');
  const og = el('div', 'g2'); og.append(fld('שם', other), fld('טיקר', otherT));
  const known = HS.some(h => h.ticker === f.ticker);
  sel.value = !f.ticker ? '' : known ? f.ticker : '_'; og.hidden = sel.value !== '_';
  sel.onchange = () => {
    og.hidden = sel.value !== '_';
    if (sel.value && sel.value !== '_') { const h = HS.find(x => x.ticker === sel.value); f.ticker = h.ticker; f.name = h.name; const p = jNow(h.ticker); if (p && !jt(f.price)) { f.price = '₪' + p.toFixed(2); pr.value = f.price; } }
    else { f.ticker = ''; f.name = ''; other.value = ''; otherT.value = ''; }
    chk();
  };
  otherT.oninput = () => { f.ticker = otherT.value.trim().toUpperCase(); chk(); };
  const g1 = el('div', 'g2'); g1.append(fld('מניה', sel), fld('תאריך', inp('date', 'date')));
  const pr = inp('price', 'text', '₪0.00');
  const g2 = el('div', 'g2'); g2.append(fld('סכום ב־₪', inp('amount_ils', 'number', '0')), fld('מחיר', pr));
  box.append(g1, og, g2, fld('למה', area('why', 'הסיבה במשפט אחד')));
  const ch = el('div', 'chips');
  J_FEEL.forEach(x => { const b = el('button', '', x); b.type = 'button'; b.setAttribute('aria-pressed', f.feel.includes(x)); b.onclick = () => { f.feel = f.feel.includes(x) ? f.feel.filter(y => y !== x) : [...f.feel, x]; b.setAttribute('aria-pressed', f.feel.includes(x)); chk(); }; ch.appendChild(b); });
  box.appendChild(fld('איך אני מרגיש', ch));
  box.append(fld('לפי', seg('by', ['כלל', 'רגש'])), fld('מה אני מצפה שיקרה', area('expect')), fld('מה קורה בשוק', area('market')));
  if (r) box.appendChild(fld('בפועל', area('result', 'מה קרה בסוף')));
  const ck = el('div', 'jchk');
  const chk = () => {
    ck.innerHTML = ''; const list = jCheck(f);
    ck.hidden = !list.length; ck.appendChild(el('div', 'k', 'בדיקת כללים'));
    list.forEach(([c, t]) => { const d = el('div', c); d.append(el('i', '', c === 'ok' ? '✓' : c === 'bad' ? '!' : '·'), t); ck.appendChild(d); });
  };
  box.appendChild(ck); chk();
  const acts = el('div', 'acts'), sv = el('button', 'save', r ? 'שמירה' : 'הוספה ליומן'), cn = el('button', 'ghost', 'ביטול');
  sv.type = 'submit'; cn.type = 'button';
  cn.onclick = () => { jEdit = null; box.hidden = true; jBtn(); };
  acts.append(sv, cn);
  if (r) { const dl = el('button', 'ghost del', 'מחיקה'); dl.type = 'button'; dl.onclick = () => { if (!confirm('למחוק את העסקה מהיומן?')) return; rows.splice(jEdit, 1); jEdit = null; box.hidden = true; jBtn(); jSave(rows); }; acts.appendChild(dl); }
  box.appendChild(acts);
  box.onsubmit = e => {
    e.preventDefault();
    if (!f.ticker && !jt(f.name)) { sel.focus(); return; }
    const p = jNum(f.price);
    const out = { date: f.date || jToday(), side: f.side, name: jt(f.name) || f.ticker, ticker: f.ticker, amount_ils: jNum(f.amount_ils), price: p === null ? jt(f.price) : '₪' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      why: jt(f.why), market: jt(f.market), feeling: f.feel.join(', '), expect: jt(f.expect), result: jt(f.result), by: f.by };
    if (r) rows[jEdit] = out; else rows.push(out);
    jEdit = null; box.hidden = true; jBtn(); jSave(rows);
  };
  box.hidden = false;
};
const jBtn = () => { const b = document.getElementById('j-add'), open = !document.getElementById('jf').hidden; b.textContent = open ? 'סגירה' : '+ עסקה'; b.classList.toggle('off', open); };
document.getElementById('j-add').addEventListener('click', () => {
  const box = document.getElementById('jf');
  if (!box.hidden) { box.hidden = true; jEdit = null; } else { jEdit = null; jForm(); }
  jBtn();
});

const drawJournal = () => {
  const all = jRows() || [], jl = document.getElementById('jl');
  jl.innerHTML = '';
  const rows = all.map((r, i) => ({ r, i })).sort((a, b) => a.r.date < b.r.date ? 1 : a.r.date > b.r.date ? -1 : b.i - a.i);
  const judged = all.filter(r => r.by === 'כלל' || r.by === 'רגש'), rule = judged.filter(r => r.by === 'כלל').length;
  document.getElementById('j-n').textContent = String(all.length);
  document.getElementById('j-rule').textContent = judged.length ? Math.round(rule / judged.length * 100) + '%' : '—';
  if (!rows.length) jl.appendChild(el('div', 'mut cap', 'עוד אין עסקאות.'));
  rows.forEach(({ r, i }) => {
    const d = el('div', 'jr' + (jOpen === i ? ' open' : '')), hd = el('div', 'jh');
    hd.append(el('span', 'd', dmy(r.date)), el('b', '', r.name || r.ticker || ''));
    if (jt(r.side)) hd.appendChild(el('span', 'pill ' + (r.side === 'קנייה' ? 'blu' : 'gry'), r.side));
    if (jt(r.by)) hd.appendChild(el('span', 'pill ' + (r.by === 'כלל' ? 'grn' : 'red'), 'לפי ' + r.by));
    d.appendChild(hd);
    const amt = [jt(r.amount_ils) ? ils(Number(r.amount_ils)) : '', jt(r.price) ? 'במחיר ' + r.price : ''].filter(Boolean).join(' · ');
    const mv = jSince(r), sn = el('div', 'since');
    if (amt) sn.appendChild(el('span', '', amt));
    if (mv !== null) { sn.appendChild(el('span', '', '·')); sn.append('מאז '); sn.appendChild(el('b', '', (mv >= 0 ? '↑ ' : '↓ ') + Math.abs(mv).toFixed(1) + '%')); }
    d.appendChild(sn);
    const more = el('div', 'more'), tb = el('div', 'jtab');
    [['למה', r.why], ['הרגשה', r.feeling], ['שוק', r.market], ['ציפייה', r.expect], ['בפועל', r.result]].forEach(([k, v]) => {
      if (jt(v)) { const ln = el('div', 'ln'); ln.append(el('i', '', k), el('span', '', String(v))); tb.appendChild(ln); }
    });
    if (tb.childNodes.length) more.appendChild(tb);
    const ed = el('button', 'edit', 'עריכה'); ed.type = 'button';
    ed.onclick = e => { e.stopPropagation(); jEdit = i; jForm(); jBtn(); document.getElementById('jf').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    more.appendChild(ed); d.appendChild(more);
    d.onclick = () => { jOpen = jOpen === i ? null : i; drawJournal(); };
    jl.appendChild(d);
  });

  /* quarterly review, worked out from the journal itself */
  const nx = jNextReview(), from = new Date(nx); from.setMonth(from.getMonth() - 3);
  const fromIso = from.toISOString().slice(0, 10);
  document.getElementById('j-next').textContent = 'הבאה ' + nx.getDate() + '.' + (nx.getMonth() + 1);
  const rv = document.getElementById('jrv'); rv.innerHTML = '';
  const q = all.filter(r => r.date >= fromIso);
  if (!q.length) rv.appendChild(el('div', 'mut cap', 'אין עסקאות ברבעון הזה.'));
  else {
    const buys = q.filter(r => r.side === 'קנייה').length, sells = q.length - buys;
    const qj = q.filter(r => r.by === 'כלל' || r.by === 'רגש'), qr = qj.filter(r => r.by === 'כלל').length;
    const sold = q.filter(r => r.side === 'מכירה').map(r => jSince(r)).filter(v => v !== null);
    const up = sold.filter(v => v > 0).length, avg = sold.length ? sold.reduce((s, v) => s + v, 0) / sold.length : null;
    const g = el('div', 'rv-g');
    [[String(q.length), !buys ? 'מכירות' : !sells ? 'קניות' : `${buys} קניות, ${sells} מכירות`], [qj.length ? Math.round(qr / qj.length * 100) + '%' : '—', 'לפי כלל'], [avg === null ? '—' : (avg >= 0 ? '↑ ' : '↓ ') + Math.abs(avg).toFixed(1) + '%', 'ממוצע מאז מכירה']]
      .forEach(([v, l]) => { const t = el('div', 'rv-t'); t.append(el('b', '', v), el('small', '', l)); g.appendChild(t); });
    rv.appendChild(g);
    const ul = el('ul', 'rv-l'), li = t => ul.appendChild(el('li', '', t));
    if (sold.length) li(`${up} מתוך ${sold.length} מכירות עלו אחר כך. מכירה לפי כלל נמדדת בכלל, לא במחיר.`);
    const cnt = {}; q.forEach(r => jFeel(r).forEach(f => { cnt[f] = (cnt[f] || 0) + 1; }));
    const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    if (top) li(`הרגש שחוזר הכי הרבה: ${top} (${cnt[top]} מתוך ${q.length}).`);
    const fomo = q.filter(r => r.side === 'קנייה' && jFeel(r).includes('חשש להחמיץ')).length;
    if (buys) li(fomo ? `${fomo} קניות נעשו מתוך חשש להחמיץ.` : 'אף קנייה לא נעשתה מתוך חשש להחמיץ.');
    const open = q.filter(r => !jt(r.result) && jt(r.expect)).length;
    if (open) li(`ב־${open} עסקאות חסר "בפועל".`);
    rv.appendChild(ul);
  }

  /* decisions, all of them, newest first */
  const DC = dash.data('decisions'), jd = document.getElementById('jd'); jd.innerHTML = '';
  const dr = DC.status === 'ok' ? [...DC.data].sort((a, b) => a.date < b.date ? 1 : -1) : [];
  document.getElementById('j-dn').textContent = dr.length ? String(dr.length) : '—';
  if (!dr.length) jd.appendChild(el('div', 'mut cap', 'עוד אין החלטות.'));
  (jDecAll ? dr : dr.slice(0, 4)).forEach(r => {
    const has = jt(r.why) || jt(r.expect);
    const d = el(has ? 'details' : 'div', 'dr jdr'), sm = el(has ? 'summary' : 'div', 'jds');
    sm.appendChild(el('span', 'd', dmy(r.date)));
    const b = el('div'); b.appendChild(el('div', 'act', r.action));
    if (jt(r.result)) b.appendChild(el('div', 'res', r.result));
    sm.appendChild(b); d.appendChild(sm);
    if (has) {
      const m = el('div', 'jdm jtab');
      [['למה', r.why], ['ציפייה', r.expect]].forEach(([k, v]) => { if (jt(v)) { const ln = el('div', 'ln'); ln.append(el('i', '', k), el('span', '', String(v))); m.appendChild(ln); } });
      d.appendChild(m);
    }
    jd.appendChild(d);
  });
  if (dr.length > 4) { const m = el('button', 'jd-more', jDecAll ? 'פחות' : `עוד ${dr.length - 4}`); m.type = 'button'; m.onclick = () => { jDecAll = !jDecAll; drawJournal(); }; jd.appendChild(m); }
};
const _pfDraw2 = window.pfDraw;
window.pfDraw = () => { _pfDraw2(); drawJournal(); };

/* ---------- scenarios ---------- */
dash.calc('scenario_status', {
  title: 'תרחישים פעילים',
  description: 'לכל תרחיש: האם הוא קורה עכשיו לפי נתוני התיק.',
  inputs: ['scenarios', 'summary', 'alerts8'],
  fn: (scenarios, summary, alerts8) => {
    const s = summary[0];
    return scenarios.map(r => ({ ...r, active: r.check === 'cash_low' ? s.cash_pct < 25 : r.check === 'loss8' ? alerts8.length > 0 : r.check === 'top3' ? s.conc_pct > CONC_MAX : null }));
  }
});
const drawScen = () => {
  const SS = dash.data('scenario_status'), box = document.getElementById('scen'), cnt = document.getElementById('scen-cnt');
  box.innerHTML = '';
  if (SS.status !== 'ok') { cnt.className = 'pill gry'; cnt.textContent = '—'; return; }
  const rows = [...SS.data].sort((a, b) => ((b.active === true) - (a.active === true)) || (Number(a.order) - Number(b.order)));
  const n = rows.filter(r => r.active === true).length;
  cnt.className = 'pill ' + (n ? 'red' : 'grn');
  cnt.textContent = n ? `${n} קורים עכשיו` : 'אין תרחיש פעיל';
  rows.forEach(r => {
    const d = el('div', 'sc' + (r.active === true ? ' on' : ''));
    d.title = r.monitor ? 'בודקים: ' + r.monitor : '';
    const t = el('div', 't'), dot = el('i');
    dot.style.background = r.active === true ? '#DC2626' : r.active === false ? '#16A34A' : '#9CA3AF';
    t.append(dot, String(r.trigger));
    d.append(t, el('div', 'a', String(r.action)));
    box.appendChild(d);
  });
};
const _pfDraw3 = window.pfDraw;
window.pfDraw = () => { _pfDraw3(); drawScen(); };

if (['thesis', 'research'].includes(startHash)) showTab('research');
else if (startHash === 'journal') showTab('journal');
dash.onData(() => window.pfDraw());
}
