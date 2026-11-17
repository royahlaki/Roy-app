/* Finance page: the wide analysis block (Mac: one wide row; iPhone: stacked). Four small panels:
   heavy months ahead, where the salary went, loan fund vs loan balance, last month's leakage vs plan. */
function financeAnalysis(f) {
  var root = document.getElementById('analysis');
  if (!root) return;
  var J = f.journal, inputs = (f.inputs || [])[0] || {};
  if (!J || !J.months || !J.months.length) { root.hidden = true; return; }

  var nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  var ils = function (v) { return '₪' + nf.format(Math.abs(Math.round(v))); };
  var MON = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
  var MONL = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  var monOf = function (ym) { return MON[Number(String(ym).slice(5, 7)) - 1]; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var budget = J.budget || {};
  var fl = function (r) { return String(r[5] || ''); };
  var leg = function (items) { return '<div class="an-leg">' + items.map(function (x) { return '<i><span style="background:' + x[1] + '"></span>' + x[0] + '</i>'; }).join('') + '</div>'; };

  /* ---------- where the salary went ---------- */
  var hist = {}; (f.history || []).forEach(function (h) { hist[h.month] = h; });
  var ledSalary = (f.ledger || []).filter(function (r) { return /משכורת/.test(r.name); });
  var C = { com: '#0E7C66', day: '#8FD3BE', one: '#F2B84B', left: '#E3F7EF' };
  var sm = J.months.map(function (m) {
    var com = 0, day = 0, one = 0;
    (m.r || []).forEach(function (r) {
      var a = -Number(r[2]); if (!isFinite(a)) return;
      if (fl(r).indexOf('o') > -1) one += a;
      else if (fl(r).indexOf('i') > -1 || r[4] === 'מנויים') com += a;
      else day += a;
    });
    var sal = hist[m.m] && hist[m.m].salary_in;
    if (!sal) { var l = ledSalary.find(function (r) { return String(r.date).slice(0, 7) === m.m; }); sal = l && Number(l.amount); }
    if (!sal) sal = Number(inputs.salary_normal) || 0;
    return { m: m.m, com: com, day: day, one: one, sal: sal };
  });
  var W = 300, H = 150, top = 10, mx = Math.max.apply(null, sm.map(function (x) { return Math.max(x.sal, x.com + x.day + x.one); })) || 1;
  var yv = function (v) { return H - v / mx * (H - top); };
  var step = W / sm.length, bw = step * 0.5, svg = '';
  sm.forEach(function (x, i) {
    var bx = i * step + (step - bw) / 2, acc = 0;
    [['com', x.com], ['day', x.day], ['one', x.one]].forEach(function (p) {
      if (p[1] <= 0) return;
      svg += '<rect x="' + bx + '" y="' + yv(acc + p[1]) + '" width="' + bw + '" height="' + (yv(acc) - yv(acc + p[1])) + '" fill="' + C[p[0]] + '"/>';
      acc += p[1];
    });
    if (x.sal > acc) svg += '<rect x="' + bx + '" y="' + yv(x.sal) + '" width="' + bw + '" height="' + (yv(acc) - yv(x.sal)) + '" fill="' + C.left + '"/>';
    svg += '<line x1="' + (bx - 4) + '" x2="' + (bx + bw + 4) + '" y1="' + yv(x.sal) + '" y2="' + yv(x.sal) + '" stroke="#0B3B2E" stroke-width="1.5"/>';
    svg += '<text x="' + (i * step + step / 2) + '" y="' + (H + 14) + '" text-anchor="middle" class="an-ax">' + monOf(x.m) + '</text>';
  });
  var pSal = '<div class="an-p"><div class="an-h">המשכורת</div>' +
    '<svg viewBox="0 0 ' + W + ' ' + (H + 18) + '" width="100%" direction="ltr">' + svg + '</svg>' +
    leg([['התחייבויות', C.com], ['יומיום', C.day], ['חד פעמי', C.one], ['נשאר', C.left]]) + '</div>';

  /* ---------- loan fund vs loan balance ---------- */
  var pFund = '';
  var loanE = (f.expenses || []).find(function (e) { return /הלווא/.test(e.name); });
  var l0 = Number(inputs.loan_principal) || 0;
  if (loanE && l0 && inputs.first_charge && inputs.loan_fund != null) {
    var left = Number(loanE.left_after_current) + 1, amort = l0 / left;
    var fy0 = Number(String(inputs.first_charge).slice(0, 4)), fm0 = Number(String(inputs.first_charge).slice(5, 7)) - 1;
    var fund = Number(inputs.loan_fund) || 0, mon = Number(inputs.loan_fund_monthly) || 0, from = String(inputs.loan_fund_from || '');
    var pts = [{ ym: null, loan: l0, fund: fund }], meet = -1;
    for (var k = 0; k < left; k++) {
      var d = new Date(Date.UTC(fy0, fm0 + k, 1)), ym = d.toISOString().slice(0, 7);
      if (from && ym >= from) fund += mon;
      if (ym === String(inputs.loan_fund_extra_month || '')) fund += Number(inputs.loan_fund_extra) || 0;
      var lb = Math.max(0, l0 - amort * (k + 1));
      pts.push({ ym: ym, loan: lb, fund: fund });
      if (meet < 0 && fund >= lb) { meet = k + 1; break; }
    }
    var n2 = pts.length - 1 || 1, X = function (i) { return 8 + i / n2 * (W - 16); }, Y = function (v) { return H - v / l0 * (H - top); };
    var line = function (key) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p[key]).toFixed(1); }).join(' '); };
    var s2 = '<path d="' + line('loan') + '" fill="none" stroke="#ff4d63" stroke-width="2.5" stroke-linecap="round"/>' +
      '<path d="' + line('fund') + '" fill="none" stroke="#10A37F" stroke-width="2.5" stroke-linecap="round"/>';
    if (meet > 0) {
      var mp = pts[meet];
      s2 += '<circle cx="' + X(meet) + '" cy="' + Y(mp.fund) + '" r="5" fill="#0B3B2E"/>' +
        '<text x="' + Math.min(W - 30, X(meet)) + '" y="' + (Y(mp.fund) - 10) + '" text-anchor="middle" class="an-val">' + MONL[Number(mp.ym.slice(5, 7)) - 1] + ' ' + mp.ym.slice(2, 4) + '</text>';
    }
    pFund = '<div class="an-p"><div class="an-h">פיקדון מול הלוואה</div>' +
      '<svg viewBox="0 0 ' + W + ' ' + (H + 6) + '" width="100%" direction="ltr">' + s2 + '</svg>' +
      leg([['הלוואה', '#ff4d63'], ['פיקדון', '#10A37F']]) + '</div>';
  }

  /* ---------- last month's leakage ---------- */
  var lm = J.months[J.months.length - 1], by = {};
  (lm.r || []).forEach(function (r) { var a = -Number(r[2]); if (isFinite(a)) by[r[4]] = (by[r[4]] || 0) + a; });
  var lk = Object.keys(by).map(function (c) { return { c: c, v: by[c] - Number(budget[c] || 0) }; })
    .filter(function (x) { return x.v > 20; }).sort(function (a, b) { return b.v - a.v; });
  var lsum = lk.reduce(function (t, x) { return t + x.v; }, 0), lmax = lk.length ? lk[0].v : 1;
  var pLeak = '<div class="an-p"><div class="an-h">הדליפה, ' + MONL[Number(lm.m.slice(5, 7)) - 1] + '</div>' +
    '<div class="an-big an-red">' + ils(lsum) + '</div>' +
    lk.slice(0, 5).map(function (x) {
      return '<div class="an-row"><span>' + esc(x.c) + '</span><span class="an-track"><i style="width:' + Math.round(x.v / lmax * 100) + '%"></i></span><b>' + nf.format(Math.round(x.v)) + '</b></div>';
    }).join('') + '</div>';

  /* ---------- 4. heavy months ---------- */
  var fm = (window.dash && dash.data('months').data) || [];
  fm = fm.slice(0, 12);
  var p4 = '';
  if (fm.length) {
    var exps = f.expenses || [], offs = f.oneoffs || [];
    var first = String(inputs.first_charge || fm[0].month);
    var fy = Number(first.slice(0, 4)), fmo = Number(first.slice(5, 7));
    var tiles = fm.map(function (r, i) {
      var ym = String(r.month).slice(0, 7), total = r.exp_normal - r.extra, notes = [];
      offs.forEach(function (o) { if (String(o.date).slice(0, 7) === ym && o.kind !== 'card_total') notes.push(String(o.name).split(/[:,(]/)[0].trim()); });
      exps.forEach(function (e) {
        if (!e.starts) return;
        var s0 = (Number(String(e.starts).slice(0, 4)) - fy) * 12 + (Number(String(e.starts).slice(5, 7)) - fmo);
        if (s0 === i) notes.push(e.name.replace(' חידוש', ''));
      });
      if (r.ends) r.ends.split(', ').forEach(function (e) { if (/הלווא/.test(e)) notes.push('תשלום אחרון: הלוואה'); });
      return { ym: ym, total: total, notes: notes };
    });
    var sorted = tiles.map(function (t) { return t.total; }).sort(function (a, b) { return a - b; });
    var med = sorted[Math.floor(sorted.length / 2)];
    var heavy = tiles.filter(function (t) { return t.total > med * 1.12; }).length;
    p4 = '<div class="an-p an-months"><div class="an-h">חודשים</div>' +
      '<div class="an-cal">' + tiles.map(function (t) {
        var r = t.total / med, cls = r > 1.25 ? 'h3' : r > 1.12 ? 'h2' : r < 0.85 ? 'lt' : '';
        var mo = Number(t.ym.slice(5, 7)), yr = t.ym.slice(2, 4);
        var uniq = t.notes.filter(function (x, i, a) { return x && a.indexOf(x) === i; }).slice(0, 2);
        return '<div class="an-tile ' + cls + '"><div class="an-tm">' + MON[mo - 1] + ' ' + (mo === 1 || t === tiles[0] ? yr : '') + '</div><div class="an-ta">' + nf.format(Math.round(t.total / 100) * 100) + '</div></div>';
      }).join('') + '</div>' +
      '<div class="an-leg"><i><span class="h3"></span>כבד מאוד</i><i><span class="h2"></span>כבד</i><i><span class="lt"></span>קל</i></div></div>';
  }

  /* ---------- the way out: what each step does to the monthly result ---------- */
  root.innerHTML = '<div class="an-grid">' + p4 + pSal + pFund + pLeak + '</div>';
  root.hidden = false;
}

/* Top of the finance page: card spending so far this cycle vs the usual pace by the same day
   (from the journal). Without a fresh card figure it shows the bank on the next 15th. */
function financeRoom(f) {
  var box = document.getElementById('room');
  if (!box || !window.dash) return;
  f = f || {};
  var nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  var ils = function (v) { return '₪' + nf.format(Math.abs(Math.round(v))); };
  var START = 13, DAY = 864e5;
  var now = new Date(); now.setHours(0, 0, 0, 0);
  var cs = new Date(now.getFullYear(), now.getMonth() - (now.getDate() >= START ? 0 : 1), START);
  var elapsed = Math.round((now - cs) / DAY);
  var J = f.journal || {}, typ = 0, full = 0, n = 0;
  (J.months || []).forEach(function (m) {
    var y = Number(m.m.slice(0, 4)), mo = Number(m.m.slice(5, 7)) - 1;
    var s0 = new Date(y, mo - 1, START), lim = new Date(s0.getTime() + (elapsed + 1) * DAY);
    var so = 0, all = 0;
    (m.r || []).forEach(function (x) {
      if (String(x[3]).indexOf('ויזה') < 0) return;
      var v = -Number(x[2]); all += v;
      var md = String(x[0]).length === 5 ? x[0] : String(x[0]).slice(5);
      var dt = new Date(y, Number(md.slice(0, 2)) - 1, Number(md.slice(3, 5)));
      if (dt > new Date(y, mo + 1, 1)) dt = new Date(y - 1, dt.getMonth(), dt.getDate());
      if (String(x[5] || '').indexOf('i') > -1 || dt < lim) so += v;
    });
    if (all > 0) { typ += so; full += all; n++; }
  });
  if (n) { typ /= n; full /= n; }
  dash.onData(function () {
    var I = (dash.data('inputs').data || [])[0] || {};
    var cn = Number(I.card_now), ca = I.card_now_as_of ? new Date(I.card_now_as_of + 'T00:00:00') : null;
    var fresh = cn > 0 && ca && ca >= cs && n;
    if (fresh) {
      var over = cn > typ * 1.05, max = Math.max(full, cn) || 1;
      box.className = 'km-card km-room ' + (over ? 'bad' : 'ok');
      box.innerHTML =
        '<div class="km-room-top"><span>אשראי עד היום</span><b>' + ils(cn) + '</b></div>' +
        '<div class="km-room-bar"><i style="width:' + Math.round(cn / max * 100) + '%"></i><u style="inset-inline-start:' + Math.round(typ / max * 100) + '%"></u></div>' +
        '<div class="km-room-sub">בדרך כלל עד היום ' + ils(typ) + '</div>';
      box.hidden = false;
      return;
    }
    var M = dash.data('months').data || [];
    if (!M.length) { box.hidden = true; return; }
    var p = dash.params(), T = Number(p.transfer) || 0, X = Number(p.vacation) || 0;
    var r = M[0], d = new Date(String(r.month).slice(0, 10) + 'T00:00:00Z');
    var room = r.bal_normal + T - (X && (!p.extra_month || p.extra_month === r.month) ? X : 0), limit = Number(I.limit) || -5000;
    var span = room - limit;
    box.className = 'km-card km-room ' + (room < 0 ? 'bad' : 'ok');
    box.innerHTML =
      '<div class="km-room-top"><span>בנק ב' + d.getUTCDate() + '.' + (d.getUTCMonth() + 1) + '</span><b>' + (room < 0 ? '-' : '') + ils(room) + '</b></div>' +
      '<div class="km-room-bar"><i style="width:' + (span > 0 ? Math.round(Math.max(0, room) / span * 100) : 0) + '%"></i></div>';
    box.hidden = false;
  });
}
