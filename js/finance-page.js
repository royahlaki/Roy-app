/* The finance page's own script (same as the "הכספים שלי" artifact), wrapped so it starts once the data is in. */
function financeMain() {
dash.calc('months', {
  inputs: ['inputs', 'expenses', 'oneoffs'],
  title: 'תזרים לפי חודש',
  description: 'לכל חודש: יתרה ב1 לחודש, אחרי המשכורת ואחרי האשראי וההלוואה, בתרחיש רגיל וזהיר. חיוב אשראי ידוע בפועל מחליף את ההערכה, וחד פעמיים נכנסים בחודש שלהם.',
  fn: (inputs, expenses, oneoffs) => {
    const p = inputs[0];
    const [y, m] = String(p.first_charge).split('-').map(Number);
    let bn = Number(p.bank_balance), bc = bn;
    const rows = [];
    for (let i = 0; i < 13; i++) {
      let en = 0, ec = 0, bk = 0; const ends = [];
      for (const e of expenses) {
        const left = e.left_after_current === null || e.left_after_current === '' ? null : Number(e.left_after_current);
        let s0 = 0;
        if (e.starts) { const [sy, sm] = String(e.starts).split('-').map(Number); s0 = (sy - y) * 12 + (sm - m); }
        if (i >= s0 && (left === null || i <= s0 + left)) {
          en += Number(e.amount); ec += Number(e.amount_cautious);
          if (/הלווא|עמלות/.test(e.name)) bk += Number(e.amount);
          if (left !== null && i === s0 + left) ends.push(e.name);
        }
      }
      const iso = new Date(Date.UTC(y, m - 1 + i, 15)).toISOString().slice(0, 10);
      const offs = oneoffs.filter((o) => String(o.date).slice(0, 7) === iso.slice(0, 7));
      const card = offs.find((o) => o.kind === 'card_total');
      if (card) { en = -Number(card.amount) + bk; ec = en; }
      const extra = offs.filter((o) => o.kind !== 'card_total').reduce((s, o) => s + Number(o.amount), 0);
      const sn = Number(p.salary_normal), sc = Number(p.salary_cautious);
      const b0n = bn, b0c = bc;
      bn += sn - en + extra; bc += sc - ec + extra;
      rows.push({
        month: iso,
        start_normal: Math.round(b0n), start_cautious: Math.round(b0c),
        paid_normal: Math.round(b0n + sn), paid_cautious: Math.round(b0c + sc),
        card_normal: Math.round(en - bk), card_cautious: Math.round(ec - bk), bank_debits: Math.round(bk), extra: Math.round(extra),
        exp_normal: Math.round(en), exp_cautious: Math.round(ec),
        free_normal: Math.round(sn - en + extra), free_cautious: Math.round(sc - ec + extra),
        bal_normal: Math.round(bn), bal_cautious: Math.round(bc), ends: ends.join(', ')
      });
    }
    return rows;
  }
});

dash.calc('networth', {
  inputs: ['portfolio', 'inputs'],
  title: 'שווי נקי',
  description: 'תיק, פנסיה ורכב (הערכה זהירה), פחות המינוס בבנק ויתרת הלוואת הרכב.',
  fn: (portfolio, inputs) => {
    const t = Number(portfolio[0].total_ils), pen = Number(inputs[0].pension) || 0, car = Number(inputs[0].car_value) || 0, b = Number(inputs[0].bank_balance), l = Number(inputs[0].loan_principal);
    return [{ portfolio: Math.round(t), pension: Math.round(pen), car: Math.round(car), bank: Math.round(b), loan: Math.round(l), net: Math.round(t + pen + car + Math.min(0, b) - l) }];
  }
});

(() => {
  const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const ils = (v) => '₪' + nf.format(Math.abs(Math.round(v)));
  const bal = (v) => (Math.round(v) < 0 ? '⁦-' + ils(v) + '⁩' : ils(v));
  const dm = (d) => d.getUTCDate() + '.' + (d.getUTCMonth() + 1);
  const dmy = (d) => dm(d) + '.' + String(d.getUTCFullYear()).slice(2);
  const mon = (d) => d.toLocaleDateString('he-IL', { month: 'short', timeZone: 'UTC' }).replace('׳', '');
  const toDate = (s) => new Date(String(s).slice(0, 10) + 'T00:00:00Z');
  const num = (s) => { const v = Number(String(s ?? '').replace(/[^\d.]/g, '')); return isFinite(v) ? v : 0; };
  const $ = (id) => document.getElementById(id);
  const css = (v) => `var(${v})`;

  // what-if inputs
  const inT = $('w-transfer'), inV = $('w-vacation'), inM = $('w-month');
  let timer;
  const push = () => { clearTimeout(timer); timer = setTimeout(() => dash.setParams({ transfer: num(inT.value), vacation: num(inV.value), extra_month: inM.value }), 250); };
  inT.addEventListener('input', push); inV.addEventListener('input', push); inM.addEventListener('change', push);
  const showInputs = () => {
    const p = dash.params();
    if (document.activeElement !== inT) inT.value = p.transfer ? nf.format(p.transfer) : '';
    if (document.activeElement !== inV) inV.value = p.vacation ? nf.format(p.vacation) : '';
  };
  [inT, inV].forEach((el) => el.addEventListener('blur', showInputs));

  const tip = (box) => { let t = box.querySelector('.km-tip'); if (!t) { t = document.createElement('div'); t.className = 'km-tip'; box.appendChild(t); } return t; };
  const placeTip = (box, t, x, y) => {
    t.style.display = 'block';
    const w = t.offsetWidth, bw = box.clientWidth;
    t.style.left = Math.max(0, Math.min(bw - w, x - w / 2)) + 'px';
    t.style.top = Math.max(0, y - t.offsetHeight - 10) + 'px';
  };
  const fillTip = (t, title, lines) => {
    t.replaceChildren();
    const d = document.createElement('div'); d.className = 'd'; d.textContent = title; t.appendChild(d);
    lines.forEach(([k, v, cls]) => { const r = document.createElement('div'); r.textContent = (k ? k + ' ' : '') + v; if (cls) r.className = cls; t.appendChild(r); });
  };

  document.querySelectorAll('.km-seg button').forEach((btn) => btn.addEventListener('click', () => dash.setParams({ scenario: btn.dataset.s })));

  function drawScenario(months, inputs) {
    const p = inputs[0], prm = dash.params(), limit = Number(p.limit);
    const T = Number(prm.transfer) || 0, X = Number(prm.vacation) || 0;
    const sc = prm.scenario === 'c' ? 'cautious' : 'normal';
    const sel = $('w-month');
    const label = (r) => mon(toDate(r.month)) + ' ' + String(toDate(r.month).getUTCFullYear()).slice(2);
    if (sel.options.length !== months.length || sel.options[0].value !== months[0].month) {
      sel.replaceChildren();
      months.forEach((r) => { const o = document.createElement('option'); o.value = r.month; o.textContent = label(r); sel.appendChild(o); });
    }
    const want = months.some((r) => r.month === prm.extra_month) ? prm.extra_month : months[0].month;
    if (document.activeElement !== sel) sel.value = want;
    const xi = months.findIndex((r) => r.month === want);
    const body = $('scenario-table').tBodies[0]; body.replaceChildren();
    const cell = (v, cls) => {
      const td = document.createElement('td'); if (cls) td.className = cls;
      const s = document.createElement('span'); s.textContent = bal(v);
      s.className = v < limit - 0.5 ? 'km-crit' : v < 0 ? 'km-neg' : 'km-pos';
      td.appendChild(s); return td;
    };
    const shown = window.kmAll ? months.length : Math.min(6, months.length);
    months.slice(0, shown).forEach((r, i) => {
      const tr = document.createElement('tr'); if (X && i === xi) tr.className = 'km-x';
      const paid = r['paid_' + sc] + T - (X && i > xi ? X : 0);
      const end = r['bal_' + sc] + T - (X && i >= xi ? X : 0);
      const th = document.createElement('th'); th.scope = 'row'; th.textContent = label(r);
      tr.append(th, cell(paid), cell(end, 'km-end'));
      body.appendChild(tr);
    });
    $('more').textContent = window.kmAll ? 'פחות' : 'עוד חודשים';
  }

  $('more').addEventListener('click', () => { window.kmAll = !window.kmAll; const M = dash.data('months'), I = dash.data('inputs'); if (M.status === 'ok' && I.status === 'ok') drawScenario(M.data, I.data); });

  function drawOneoffs(rows) {
    const box = $('oneoff-list'); box.replaceChildren();
    if (!rows.length) return;
    rows.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((o) => {
      const v = Number(o.amount);
      const r = document.createElement('div'); r.className = 'km-rel';
      const a = document.createElement('b'); a.textContent = dmy(toDate(o.date));
      const b = document.createElement('span'); b.textContent = o.name;
      const c = document.createElement('span'); c.className = v < 0 ? 'km-neg' : 'km-ok'; c.textContent = (v < 0 ? '⁦-' : '+') + ils(v) + (v < 0 ? '⁩' : '');
      r.append(a, b, c); box.appendChild(r);
    });
  }

  function drawFree(months) {
    const box = $('chart-free');
    box.querySelectorAll('svg').forEach((s) => s.remove());
    const W = Math.max(260, box.clientWidth), H = 170, m = { t: 18, r: 4, b: 34, l: 4 };
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('direction', 'ltr');
    const x = d3.scaleBand(months.map((r) => r.month), [m.l, W - m.r]).padding(0.28);
    const y = d3.scaleLinear([0, d3.max(months, (r) => r.exp_normal + Math.max(0, r.free_normal))], [H - m.b, m.t]);
    const bw = Math.min(32, x.bandwidth());
    const g = svg.append('g').selectAll('g').data(months).join('g').attr('transform', (r) => `translate(${x(r.month) + (x.bandwidth() - bw) / 2},0)`);
    g.append('rect').attr('y', (r) => y(r.exp_normal)).attr('height', (r) => y(0) - y(r.exp_normal)).attr('width', bw).attr('rx', 3).attr('fill', css('--cds-chart-muted'));
    g.append('rect').attr('y', (r) => y(r.exp_normal + Math.max(0, r.free_normal))).attr('height', (r) => y(0) - y(Math.max(0, r.free_normal))).attr('width', bw).attr('rx', 3).attr('fill', css('--color-ok'));
    g.filter((r, i) => i === 0 || r.free_normal !== months[i - 1].free_normal)
      .append('text').attr('x', bw / 2).attr('y', (r) => y(r.exp_normal + Math.max(0, r.free_normal)) - 4).attr('text-anchor', 'middle')
      .attr('fill', css('--color-fg')).style('font-size', '10px').text((r) => nf.format(r.free_normal));
    g.filter((r) => r.ends).append('circle').attr('cx', bw / 2).attr('cy', H - m.b + 6).attr('r', 2.5).attr('fill', css('--cds-chart-reference'));
    const every = W < 520 ? 2 : 1;
    g.filter((r, i) => i % every === 0).append('text').attr('x', bw / 2).attr('y', H - 6).attr('text-anchor', 'middle')
      .attr('fill', css('--color-fg-muted')).style('font-size', 'var(--cds-font-size-caption)').text((r) => mon(toDate(r.month)));
    const t = tip(box);
    const hit = svg.append('rect').attr('width', W).attr('height', H).attr('fill', 'transparent');
    hit.on('pointermove pointerdown', (ev) => {
      const [px] = d3.pointer(ev, svg.node());
      const sx = px * (W / svg.node().getBoundingClientRect().width || 1);
      const r = months[d3.leastIndex(months, (q) => Math.abs(x(q.month) + x.bandwidth() / 2 - sx))];
      const lines = [['הוצאות', ils(r.exp_normal)], ['נשאר', ils(r.free_normal), 'km-ok'], ['נשאר זהיר', ils(r.free_cautious)]];
      if (r.ends) lines.push(['אחרון:', r.ends]);
      fillTip(t, 'חיוב ' + dmy(toDate(r.month)), lines);
      const scale = box.clientWidth / W;
      placeTip(box, t, (x(r.month) + x.bandwidth() / 2) * scale, y(r.exp_normal + Math.max(0, r.free_normal)) * scale);
    }).on('pointerleave', () => { t.style.display = 'none'; });
  }

  function addMonths(iso, k) { const d = toDate(iso); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, d.getUTCDate())); }

  function drawReleases(expenses, inputs) {
    const box = $('releases'); box.replaceChildren();
    const first = inputs[0].first_charge;
    expenses.filter((e) => !e.starts && !/הלווא/.test(e.name) && e.left_after_current !== null && e.left_after_current !== '')
      .map((e) => ({ e, d: addMonths(first, Number(e.left_after_current)) }))
      .sort((a, b) => a.d - b.d)
      .forEach(({ e, d }) => {
        const r = document.createElement('div'); r.className = 'km-rel';
        const a = document.createElement('b'); a.textContent = dmy(d);
        const b = document.createElement('span'); b.textContent = e.name + ' אחרון';
        const c = document.createElement('span'); c.className = 'km-ok'; c.textContent = ils(e.amount);
        r.append(a, b, c); box.appendChild(r);
      });
  }

  function drawList(expenses) {
    const box = $('exp-list'); box.replaceChildren();
    const isInst = (e) => e.left_after_current !== null && e.left_after_current !== '';
    const now = expenses.filter((e) => !e.starts);
    const rows = [...now.filter(isInst), ...now.filter((e) => !isInst(e) && Number(e.amount) > 0), ...now.filter((e) => !isInst(e) && Number(e.amount) === 0)];
    rows.forEach((e) => {
      const r = document.createElement('div'); r.className = 'km-item';
      const n = document.createElement('span'); n.className = 'n'; n.textContent = e.name;
      r.appendChild(n);
      if (isInst(e)) {
        const left = Number(e.left_after_current);
        const p = document.createElement('span'); p.className = 'km-pill' + (left === 0 ? ' last' : '');
        p.textContent = left === 0 ? 'אחרון' : 'נשארו ' + left;
        r.appendChild(p);
      }
      const a = document.createElement('span'); a.className = 'a';
      if (Number(e.amount) === 0) { const s = document.createElement('small'); s.textContent = 'זהיר ' + ils(e.amount_cautious); a.appendChild(s); }
      else {
        a.textContent = ils(e.amount);
        if (Number(e.amount_cautious) !== Number(e.amount)) { const s = document.createElement('small'); s.textContent = ' עד ' + nf.format(e.amount_cautious); a.appendChild(s); }
      }
      r.appendChild(a); box.appendChild(r);
    });
  }

  function drawGoals(months, expenses, inputs) {
    const box = $('goal-list'); box.replaceChildren();
    const p = inputs[0];
    const add = (title, when, frac, sub) => {
      const g = document.createElement('div'); g.className = 'km-goal';
      const top = document.createElement('div'); top.className = 'km-goal-top';
      const a = document.createElement('span'); a.textContent = title;
      const b = document.createElement('b'); b.textContent = when;
      top.append(a, b); g.appendChild(top);
      const bar = document.createElement('div'); bar.className = 'km-bar';
      const f = Math.max(0, Math.min(1, frac));
      const fill = document.createElement('i'); fill.style.width = (f * 100).toFixed(1) + '%';
      bar.appendChild(fill); g.appendChild(bar);
      const s2 = document.createElement('div'); s2.className = 'km-goal-sub';
      const l = document.createElement('span'); l.textContent = sub;
      const r = document.createElement('span'); r.textContent = Math.round(f * 100) + '%';
      s2.append(l, r); g.appendChild(s2);
      box.appendChild(g);
    };
    const bank = Number(p.bank_balance);
    const od0 = Number(p.overdraft_start), od = Math.max(0, -bank);
    const outN = months.find((r) => r.bal_normal >= 0);
    add('יציאה מהמינוס', outN ? dmy(toDate(outN.month)) : '—', od0 ? 1 - od / od0 : 1, 'נשאר ' + ils(od) + ' מתוך ' + ils(od0));
    const tgt = Number(p.cushion_target), saved = Number(p.cushion_saved) || 0, have = Math.max(0, bank) + saved;
    const hit = months.find((r) => r.bal_normal + saved >= tgt);
    add('כרית ביטחון', hit ? dmy(toDate(hit.month)) : 'אחרי ' + dmy(toDate(months[months.length - 1].month)), have / tgt, ils(have) + ' מתוך ' + ils(tgt));
    const loan = expenses.find((e) => /הלווא/.test(e.name));
    if (loan) {
      const left = Number(loan.left_after_current) + 1, l0 = Number(p.loan_start), l = Number(p.loan_principal);
      add('סילוק הלוואה', dmy(addMonths(p.first_charge, left - 1)), l0 ? 1 - l / l0 : 0, 'נשאר ' + ils(l) + ' · נשארו ' + left + ' תשלומים');
    }
  }

  const kfmt = (v) => '₪' + Math.round(v / 1000) + 'K';

  function drawHistory(rows) {
    const box = $('chart-hist');
    box.querySelectorAll('svg').forEach((s) => s.remove());
    const toM = (m) => new Date(String(m).slice(0, 7) + '-01T00:00:00Z');
    const data = rows.map((r) => ({ d: toM(r.month), r })).sort((a, b) => a.d - b.d);
    const S = [
      { key: 'net_worth', name: 'שווי נקי', color: css('--color-fg') },
    ].map((s) => ({ ...s, pts: data.filter((p) => p.r[s.key] !== null && p.r[s.key] !== undefined && p.r[s.key] !== '').map((p) => ({ d: p.d, v: Number(p.r[s.key]) })) }))
     .filter((s) => s.pts.length);
    if (!S.length) return;
    const W = Math.max(260, box.clientWidth), H = 150, m = { t: 14, r: 56, b: 22, l: 8 };
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('direction', 'ltr');
    const all = S.flatMap((s) => s.pts.map((p) => p.v));
    const [lo, hi] = d3.extent(all), pad = (hi - lo) * 0.12 || hi * 0.1;
    const y = d3.scaleLinear([lo - pad, hi + pad], [H - m.b, m.t]);
    const dates = S[0].pts.map((p) => p.d);
    const x = dates.length > 1 ? d3.scaleUtc(d3.extent(dates), [m.l + 6, W - m.r]) : () => (W - m.r) / 2;
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', H - m.b).attr('y2', H - m.b).attr('stroke', css('--cds-chart-axis'));
    S.forEach((s) => {
      if (s.pts.length > 1) {
        const x0 = x(s.pts[0].d), x1 = x(s.pts[s.pts.length - 1].d), gid = 'km-nw-grad';
        const grad = svg.append('defs').append('linearGradient').attr('id', gid).attr('gradientUnits', 'userSpaceOnUse')
          .attr('x1', x0).attr('x2', x1).attr('y1', 0).attr('y2', 0);
        const UP = '#1fd65f', DOWN = '#ff2d4a';
        const col = (i) => (s.pts[i].v >= s.pts[i - 1].v ? UP : DOWN);
        const stops = [[0, col(1)]];
        for (let i = 1; i < s.pts.length; i++) stops.push([((x(s.pts[i - 1].d) + x(s.pts[i].d)) / 2 - x0) / (x1 - x0 || 1), col(i)]);
        stops.push([1, col(s.pts.length - 1)]);
        stops.forEach(([o, c], k) => {
          if (k > 0 && stops[k - 1][1] !== c) {
            const [o0, c0] = stops[k - 1], mix = d3.interpolateHsl(c0, c);
            [0.25, 0.5, 0.75].forEach((t) => grad.append('stop').attr('offset', (o0 + (o - o0) * t).toFixed(4)).attr('stop-color', mix(t)));
          }
          grad.append('stop').attr('offset', o.toFixed(4)).attr('stop-color', c);
        });
        svg.append('path').datum(s.pts).attr('d', d3.line().x((p) => x(p.d)).y((p) => y(p.v)).curve(d3.curveMonotoneX))
          .attr('fill', 'none').attr('stroke', `url(#${gid})`).attr('stroke-width', 2.5).attr('stroke-linecap', 'round');
      }
      const last = s.pts[s.pts.length - 1];
      svg.append('circle').attr('cx', x(last.d)).attr('cy', y(last.v)).attr('r', 3.5).attr('fill', s.color);
      s.ly = y(last.v);
    });
    S.forEach((s) => {
      const last = s.pts[s.pts.length - 1];
      const t = svg.append('text').attr('x', W - m.r + 6).attr('y', s.ly - 2).attr('fill', s.color).style('font-size', '10px');
      t.append('tspan').text(s.name);
      t.append('tspan').attr('x', W - m.r + 6).attr('dy', 11).text(kfmt(last.v));
    });
    const every = W < 520 ? 2 : 1;
    svg.append('g').selectAll('text').data(dates.filter((d, i) => i % every === 0)).join('text').attr('x', (d) => x(d)).attr('y', H - 6).attr('text-anchor', 'middle')
      .attr('fill', css('--color-fg-muted')).style('font-size', 'var(--cds-font-size-caption)').text((d) => mon(d));
    const t = tip(box);
    const rule = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).attr('stroke', css('--cds-chart-axis')).style('display', 'none');
    svg.append('rect').attr('width', W).attr('height', H).attr('fill', 'transparent').on('pointermove pointerdown', (ev) => {
      const [px] = d3.pointer(ev, svg.node());
      const sx = px * (W / svg.node().getBoundingClientRect().width || 1);
      const vis = data.filter((q) => q.r.net_worth !== null && q.r.net_worth !== undefined);
      const p = vis[d3.leastIndex(vis, (q) => Math.abs(x(q.d) - sx))];
      rule.attr('x1', x(p.d)).attr('x2', x(p.d)).style('display', null);
      const lines = [];
      if (p.r.net_worth !== null && p.r.net_worth !== undefined) lines.push(['שווי נקי', ils(p.r.net_worth)]);
      if (p.r.portfolio !== null && p.r.portfolio !== undefined) lines.push(['תיק', ils(p.r.portfolio)]);
      if (p.r.bank_end !== null && p.r.bank_end !== undefined) lines.push([p.r.bank_est ? 'עו״ש (משוער)' : 'עו״ש', bal(p.r.bank_end), p.r.bank_end < 0 ? 'km-neg' : '']);
      if (p.r.loan_end !== null && p.r.loan_end !== undefined) lines.push(['הלוואה', ils(p.r.loan_end)]);
      if (Number(p.r.portfolio_flow)) lines.push([Number(p.r.portfolio_flow) < 0 ? 'משיכה מהתיק' : 'הפקדה לתיק', ils(p.r.portfolio_flow), Number(p.r.portfolio_flow) < 0 ? 'km-neg' : '']);
      fillTip(t, mon(p.d) + ' ' + p.d.getUTCFullYear(), lines);
      const scale = box.clientWidth / W;
      placeTip(box, t, x(p.d) * scale, m.t * scale + 20);
    }).on('pointerleave', () => { t.style.display = 'none'; rule.style('display', 'none'); });
    const withRate = data.filter((p) => p.r.salary_in && p.r.saved !== null && p.r.saved !== undefined);
    const rate = $('rate');
    if (withRate.length) {
      const q = withRate[withRate.length - 1], v = Number(q.r.saved) / Number(q.r.salary_in);
      rate.textContent = 'חיסכון ' + mon(q.d) + ': ' + Math.round(v * 100) + '%';
      rate.className = 'km-rate ' + (v < 0 ? 'km-neg' : 'km-ok');
    } else rate.textContent = '';
  }

  dash.onData(() => {
    showInputs();
    const H = dash.data('history');
    if (H.status === 'ok' && Array.isArray(H.data)) { drawHistory(H.data); }
    const I = dash.data('inputs'), E = dash.data('expenses'), M = dash.data('months'), N = dash.data('networth');
    const ok = (d) => d.status === 'ok' && Array.isArray(d.data) && d.data.length;

    document.querySelectorAll('#networth [data-field]').forEach((el) => {
      if (ok(N)) {
        const v = N.data[0][el.dataset.field];
        el.textContent = el.dataset.field === 'bank' ? bal(v) : ils(v);
        el.classList.toggle('km-neg', el.dataset.field === 'bank' && v < 0);
        if (el.dataset.field === 'bank') $('row-bank').classList.toggle('km-alert', v < 0);
      } else el.textContent = '—';
    });

    if (ok(I)) {
      const b = Number(I.data[0].bank_balance);
      const el = $('bank-now'); el.textContent = bal(b); el.className = 'km-big' + (b < 0 ? ' km-neg' : '');
      $('bank-label').textContent = 'בנק · ' + dm(toDate(I.data[0].bank_as_of));
    }

    if (ok(E)) drawList(E.data);
    if (ok(E) && ok(I)) drawReleases(E.data, I.data);
    if (ok(E) && ok(I) && ok(M)) drawGoals(M.data, E.data, I.data);
    if (ok(M)) { $('total').textContent = ils(M.data[0].exp_normal); drawFree(M.data); }

    const O = dash.data('oneoffs');
    if (O.status === 'ok' && Array.isArray(O.data)) drawOneoffs(O.data);
    if (ok(M) && ok(I)) {
      const sc = dash.params().scenario === 'c' ? 'c' : 'n';
      document.querySelectorAll('.km-seg button').forEach((b) => b.classList.toggle('on', b.dataset.s === sc));
      drawScenario(M.data, I.data);
    }
  });
})();
}
