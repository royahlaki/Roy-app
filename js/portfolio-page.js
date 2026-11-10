/* The portfolio page's own script, as it runs in the dashboard, wrapped so it starts once the data is in. */
function pfMain() {
const ils = v => (v < 0 ? '−' : '') + '₪' + d3.format(',.0f')(Math.abs(v));
const pct = v => d3.format('.1f')(v) + '%';
const num = (v, f) => (v === null || v === undefined || v === '') ? '—' : d3.format(f)(v);
const dmy = s => { const [y, m, d] = s.split('-'); return `${+d}/${+m}`; };
const CFG = window.PF_CFG || {}; const TOP3 = CFG.top3 || []; const DEF = CFG.defense || []; const ISR = CFG.israel || [];
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
      top3_pct, defense_pct: r1(def / T * 100), israel_pct: r1(isr / T * 100),
      cash_pct: r1(Cs / T * 100), cash_gap_ils: Math.round(Cs - 0.25 * T), top3_excess_ils: excess,
      ai_pct: r1(ai / T * 100),
      portfolio_beta: Math.round(holdings.filter(h => h.beta !== null).reduce((s, h) => s + Number(h.value_ils) * Number(h.beta), 0) / T * 100) / 100,
      sentence: `כדי לחזור לתקרת 30% צריך להוריד כ-${Math.round(excess / 1000)} אלף ₪ מ-3 הגדולות.`
    }];
  }
});

dash.calc('timeline', {
  title: 'הוצאות ופנוי לפי חודש',
  description: 'לכל חיוב מ-15/11/2026: סכום האשראי, ההלוואה, והפנוי מהמשכורת.',
  inputs: ['expenses', 'finance_base'],
  fn: (expenses, finance_base) => {
    const f = finance_base[0], out = [];
    for (let i = 0; i < 12; i++) {
      const m0 = 10 + i, y = 2026 + Math.floor(m0 / 12), mo = (m0 % 12) + 1;
      const month = `${y}-${String(mo).padStart(2, '0')}`;
      const card = expenses.filter(e => e.payments_left === null || e.payments_left === '' || i < Number(e.payments_left) + 1).reduce((s, e) => s + Number(e.monthly), 0);
      const loan = i < f.loan_left ? Number(f.loan_payment) : 0;
      const total_normal = Math.round(card + f.food_normal + loan), total_careful = Math.round(card + f.food_careful + loan);
      out.push({ month, card_no_food: Math.round(card), loan: Math.round(loan), total_normal, total_careful,
        free_normal: f.salary_normal - total_normal, free_careful: f.salary_careful - total_careful });
    }
    return out;
  }
});

dash.calc('projection', {
  title: 'יתרת בנק צפויה',
  description: 'מתחיל מהמינוס ב-22/10/2026: משכורת ב-9 לחודש, ניכוי אשראי והלוואה ב-15, בשני התרחישים.',
  inputs: ['timeline', 'finance_base'],
  fn: (timeline, finance_base) => {
    const f = finance_base[0];
    let n = Number(f.overdraft), c = Number(f.overdraft);
    const rows = [{ date: f.overdraft_date, kind: 'היום', bal_normal: n, bal_careful: c }];
    timeline.forEach(t => {
      n += f.salary_normal; c += f.salary_careful;
      rows.push({ date: `${t.month}-${String(f.salary_day).padStart(2, '0')}`, kind: 'משכורת', bal_normal: Math.round(n), bal_careful: Math.round(c) });
      n -= t.total_normal; c -= t.total_careful;
      rows.push({ date: `${t.month}-${String(f.charge_day).padStart(2, '0')}`, kind: 'חיוב אשראי והלוואה', bal_normal: Math.round(n), bal_careful: Math.round(c) });
    });
    return rows;
  }
});

dash.calc('networth', {
  title: 'שווי נקי',
  description: 'שווי התיק פחות המינוס ויתרת הלוואת הרכב.',
  inputs: ['account', 'finance_base'],
  fn: (account, finance_base) => {
    const p = Number(account[0].total_ils), o = Number(finance_base[0].overdraft), l = Number(finance_base[0].loan_principal);
    return [{ portfolio: Math.round(p), overdraft: Math.round(o), loan: -Math.round(l), net: Math.round(p + o - l) }];
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
      { goal: 'ריכוזיות', now: r1(top), target: 30, progress: Math.round(clamp((53.8 - top) / (53.8 - 30) * 100)) }
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

/* ---------- draw ---------- */
window.pfDraw = () => {
  const D = id => dash.data(id);
  const H = D('holdings'), A = D('account'), W = D('weights'), S = D('summary'), F = D('finance_base');
  const TL = D('timeline'), P = D('projection'), NW = D('networth');

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
  document.querySelectorAll('[data-source="finance_base"][data-field]').forEach(x => {
    if (F.status !== 'ok') { x.textContent = '—'; return; }
    const f = x.dataset.field, v = F.data[0][f];
    x.textContent = ['salary_day', 'charge_day', 'loan_left'].includes(f) ? String(v) : ['salary_normal', 'salary_careful', 'food_normal', 'food_careful'].includes(f) ? d3.format(',')(v) : f === 'loan_principal' ? '₪' + d3.format(',.2f')(v) : f === 'loan_payment' ? '₪' + d3.format(',.2f')(v) : ils(v);
  });
  document.querySelectorAll('[data-source="networth"][data-field]').forEach(x => {
    x.textContent = NW.status === 'ok' ? ils(Math.abs(NW.data[0][x.dataset.field])) : '—';
  });

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
    const tr0 = Number(dash.params().transfer) || 0, va0 = Number(dash.params().vacation) || 0;
    const lowEl = document.getElementById('ct-low'), lowD = document.getElementById('ct-low-d'), ex = document.getElementById('ct-exp');
    if (P.status === 'ok' && P.data.length) {
      const adj = P.data.map(d => ({ date: d.date, n: d.bal_normal + tr0 - (d.date >= '2026-11-15' ? va0 : 0) }));
      const mn = adj.reduce((a, b) => b.n < a.n ? b : a);
      lowEl.textContent = ils(Math.abs(mn.n)); lowEl.className = 'a ' + (mn.n < 0 ? 't-red' : 't-grn'); lowD.textContent = dmy(mn.date);
    } else { lowEl.textContent = '—'; lowD.textContent = '—'; }
    ex.textContent = TL.status === 'ok' ? ils(TL.data[0].total_normal) : '—';
  }

  if (window.pfTab === 'portfolio') {
    // weights: one stacked bar
    const wbar = document.getElementById('wst-bar'), wleg = document.getElementById('wst-leg');
    wbar.innerHTML = ''; wleg.innerHTML = '';
    if (W.status === 'ok' && S.status === 'ok') {
      const REDS = ['#FF4D6D', '#FF7A90', '#FFADBB'], GRAYS = ['#A8B4D8', '#8794BC', '#6B77A0', '#535E84', '#3F4868'];
      const top = W.data.filter(d => TOP3.includes(d.ticker)), rest = W.data.filter(d => !TOP3.includes(d.ticker));
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
      [...H.data].sort((a, b) => (isTrade(b) - isTrade(a)) || ((a.pnl_pct ?? 1e9) - (b.pnl_pct ?? 1e9))).forEach(h => {
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
          const tb = el('table'); const th = el('tr');
          th.append(el('th', '', ''), el('th', '', `רבעון · ${h.q_period}`), el('th', '', `12 חודשים · ${h.y_period}`));
          const thead = el('thead'); thead.appendChild(th); tb.appendChild(thead);
          const tbd = el('tbody');
          [['הכנסות', h.rev_q, h.rev_y], ['רווח נקי', h.ni_q, h.ni_y]].forEach(([lbl, q, y]) => {
            const tr = el('tr'); tr.append(el('td', '', lbl), el('td', 'v2 ' + sc(q), sg(q)), el('td', 'v2 ' + sc(y), sg(y))); tbd.appendChild(tr);
          });
          tb.appendChild(tbd); t2.appendChild(tb);
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
const LAB = 'https://claude.ai/artifact/UYAXtgDzYJbvNJLVkYaQsG';
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
  const link = (tk, txt, held) => { const a = el('a', '', txt); a.href = LAB + (held ? '#h-' : '#t-') + String(tk).toUpperCase().replace(/[^A-Z0-9-]/g, ''); return a; };
  const status = (has, p, f, q, fund) => {
    const b = el('div', 'rsb');
    if (fund) { b.appendChild(el('span', 'pill gry', 'קרן מדד, לא נדרש')); return b; }
    if (!has) { b.appendChild(el('span', 'pill red', 'אין מחקר')); return b; }
    const tr = el('div', 'tr'), fl = el('div', 'fl'); fl.style.width = Math.max(0, Math.min(100, p)) + '%'; fl.style.background = p >= 80 ? C.grn : C.blu; tr.appendChild(fl);
    b.append(tr, el('span', '', Math.round(p) + '%'));
    if (f) b.appendChild(el('span', 't-red', 'דגלים ' + f));
    if (q) b.appendChild(el('span', '', 'שאלות ' + q));
    return b;
  };
  const own = document.getElementById('rs-own'); own.innerHTML = '';
  if (RV.status === 'ok') RV.data.forEach(r => {
    const row = el('div', 'rsr'), nm = el('div');
    const over = r.max_w !== null && r.weight > r.max_w;
    const wl = el('div', 'w' + (over ? ' t-red' : ''), pct(r.weight) + ' מהתיק' + (r.max_w !== null ? ` · תקרה ${r.max_w}%` : ''));
    nm.append(el('div', '', r.name), wl);
    if (!r.fund && r.has) {
      const VC = { 'התזה תקפה': 'grn', 'בבדיקה': 'blu', 'לצמצם': 'red', 'התזה נשברה': 'red' };
      const ps = el('div', 'rsp');
      if (r.verdict) ps.appendChild(el('span', 'pill ' + (VC[r.verdict] || 'gry'), r.verdict));
      const old = !r.review_date || (Date.now() - new Date(r.review_date + 'T00:00:00').getTime()) / 864e5 > 90;
      ps.appendChild(el('span', 'cap ' + (old ? 't-red' : 'mut'), r.review_date ? 'נבדק ' + dmy(r.review_date) + (old ? ' · לבדוק שוב' : '') : 'לא נבדק · לבדוק'));
      nm.appendChild(ps);
    }
    row.append(nm, status(r.has, r.pct, r.flags, r.q, r.fund), r.fund ? el('span') : link(r.ticker, r.has ? 'פתח מחקר' : 'התחל מחקר', true));
    if (!r.fund) {
      const th = el('div', 'rsth');
      [['למה', r.why], ['מוכר אם', r.sell_if]].forEach(([k, v]) => { const ln = el('div', 'ln' + (v ? '' : ' miss')); ln.append(el('i', '', k), v || 'חסר'); th.appendChild(ln); });
      row.appendChild(th);
    }
    own.appendChild(row);
  });
  const oth = document.getElementById('rs-other'); oth.innerHTML = '';
  if (RS.status === 'ok' && H.status === 'ok') {
    const held = new Set(H.data.map(h => String(h.ticker).toUpperCase()));
    const rows = RS.data.filter(r => !held.has(String(r.ticker).toUpperCase()));
    if (!rows.length) oth.appendChild(el('div', 'mut cap', 'אין כרגע'));
    rows.forEach(r => {
      const row = el('div', 'rsr'), nm = el('div');
      nm.append(el('div', '', r.name || r.ticker), el('div', 'w', r.ticker + (r.group ? ' · ' + r.group : '') + (r.verdict ? ' · ' + r.verdict : '')));
      row.append(nm, status(true, Number(r.pct), Number(r.flags), Number(r.q), false), link(r.ticker, 'פתח מחקר'));
      if (r.why) { const th = el('div', 'rsth'); const ln = el('div', 'ln'); ln.append(el('i', '', 'למה'), r.why); th.appendChild(ln); row.appendChild(th); }
      oth.appendChild(row);
    });
  }
};
const _pfDraw1 = window.pfDraw;
window.pfDraw = () => { _pfDraw1(); drawResearch(); };

/* ---------- journal page ---------- */
const drawJournal = () => {
  const TR = dash.data('trades'), jl = document.getElementById('jl');
  const t = v => (v === null || v === undefined) ? '' : String(v).trim();
  jl.innerHTML = '';
  const rows = TR.status === 'ok' ? [...TR.data].sort((a, b) => a.date < b.date ? 1 : -1) : [];
  const judged = rows.filter(r => r.by === 'כלל' || r.by === 'רגש'), rule = judged.filter(r => r.by === 'כלל').length;
  document.getElementById('j-n').textContent = String(rows.length);
  document.getElementById('j-rule').textContent = judged.length ? Math.round(rule / judged.length * 100) + '%' : '—';
  if (!rows.length) { jl.appendChild(el('div', 'mut cap', 'עוד אין עסקאות.')); return; }
  rows.forEach(r => {
    const d = el('div', 'jr'), hd = el('div', 'jh');
    hd.append(el('span', 'd', dmy(r.date)), el('b', '', r.name || r.ticker || ''));
    if (t(r.side)) hd.appendChild(el('span', 'pill ' + (r.side === 'קנייה' ? 'blu' : 'gry'), r.side));
    const amt = [t(r.amount_ils) ? ils(Number(r.amount_ils)) : '', t(r.price) ? 'במחיר ' + r.price : ''].filter(Boolean).join(' · ');
    if (amt) hd.appendChild(el('span', 'cap mut', amt));
    if (t(r.feeling)) hd.appendChild(el('span', 'pill gry', r.feeling));
    if (t(r.by)) hd.appendChild(el('span', 'pill ' + (r.by === 'כלל' ? 'grn' : 'red'), 'לפי ' + r.by));
    d.appendChild(hd);
    [['למה', r.why], ['שוק', r.market], ['ציפייה', r.expect], ['בפועל', r.result]].forEach(([k, v]) => {
      if (t(v)) { const ln = el('div', 'ln'); ln.append(el('i', '', k), String(v)); d.appendChild(ln); }
    });
    jl.appendChild(d);
  });
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
    return scenarios.map(r => ({ ...r, active: r.check === 'cash_low' ? s.cash_pct < 23 : r.check === 'loss8' ? alerts8.length > 0 : r.check === 'top3' ? s.top3_pct > 30 : null }));
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
