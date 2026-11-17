/* Finance page: the wide analysis block (desktop only). Four views built from the expense journal,
   the ledger and the month-by-month forecast: monthly result, leakage vs plan, yearly habit cost, heavy months. */
function financeAnalysis(f) {
  var root = document.getElementById('analysis');
  if (!root) return;
  var J = f.journal, inputs = (f.inputs || [])[0] || {};
  if (!J || !J.months || !J.months.length) { root.hidden = true; return; }

  var nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  var ils = function (v) { return '₪' + nf.format(Math.abs(Math.round(v))); };
  var sgn = function (v) { return Math.round(v) < 0 ? '<bdi dir="ltr">-' + ils(v) + '</bdi>' : ils(v); };
  var MON = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
  var MONL = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  var monOf = function (ym) { return MON[Number(String(ym).slice(5, 7)) - 1]; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var budget = J.budget || {};
  var planTotal = Object.keys(budget).reduce(function (s, k) { return s + Number(budget[k]); }, 0);

  /* Per journal month: total out, one-offs, by category, salary. */
  var hist = {}; (f.history || []).forEach(function (h) { hist[h.month] = h; });
  var ledSalary = (f.ledger || []).filter(function (r) { return /משכורת/.test(r.name); });
  var months = J.months.map(function (m) {
    var out = 0, one = 0, by = {};
    (m.r || []).forEach(function (r) {
      var a = -Number(r[2]); if (!isFinite(a)) return;
      out += a; if (r[5] === 'o') one += a;
      by[r[4]] = (by[r[4]] || 0) + a;
    });
    var sal = hist[m.m] && hist[m.m].salary_in, est = false;
    if (!sal) { var l = ledSalary.find(function (r) { return String(r.date).slice(0, 7) === m.m; }); sal = l && Number(l.amount); }
    if (!sal) { sal = Number(inputs.salary_normal) || 0; est = true; }
    return { m: m.m, out: out, one: one, by: by, sal: sal, est: est, res: sal - out, plan: Number((m.b && Object.keys(m.b).reduce(function (s, k) { return s + Number(m.b[k]); }, 0)) || planTotal) };
  });
  var n = months.length;
  var avg = function (fn) { return months.reduce(function (s, x) { return s + fn(x); }, 0) / n; };
  var span = monOf(months[0].m) + ' עד ' + monOf(months[n - 1].m);

  /* ---------- 1. monthly result ---------- */
  function bars(vals, opt) {
    var W = 320, H = 150, pad = 18, lo = Math.min(0, Math.min.apply(null, vals)), hi = Math.max(0, Math.max.apply(null, vals));
    if (opt.ref != null) hi = Math.max(hi, opt.ref);
    var rng = (hi - lo) || 1, y = function (v) { return pad + (hi - v) / rng * (H - 2 * pad); };
    var step = W / vals.length, bw = step * 0.56, s = '';
    vals.forEach(function (v, i) {
      var x = i * step + (step - bw) / 2;
      s += opt.bar(v, i, x, bw, y);
    });
    if (opt.zero !== false) s += '<line x1="0" x2="' + W + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="rgba(11,59,46,.25)"/>';
    if (opt.ref != null) s += '<line x1="0" x2="' + W + '" y1="' + y(opt.ref) + '" y2="' + y(opt.ref) + '" stroke="#5E8A7C" stroke-dasharray="4 4"/>';
    return '<svg viewBox="0 0 ' + W + ' ' + (H + 16) + '" width="100%" style="max-height:190px" direction="ltr">' + s +
      vals.map(function (v, i) { return '<text x="' + (i * step + step / 2) + '" y="' + (H + 12) + '" text-anchor="middle" class="an-ax">' + opt.labels[i] + '</text>'; }).join('') + '</svg>';
  }
  /* oldest to newest, left to right, like the forecast chart above */
  var ordered = months, labels = months.map(function (x) { return monOf(x.m); });

  var aRes = avg(function (x) { return x.res; }), aOne = avg(function (x) { return x.one; });
  var bank = (f.ledger && f.ledger.length) ? f.ledger.reduce(function (s, r) { return s + Number(r.amount); }, 0) : Number(inputs.bank_balance);
  var limit = Number(inputs.limit) || -5000;
  var now = new Date(), fc = '';
  var when = function (k) { var d = new Date(now.getFullYear(), now.getMonth() + k, 1); return 'סוף ' + MONL[d.getMonth()]; };
  if (aRes < 0) {
    var k0 = bank > 0 ? Math.ceil(bank / -aRes) : 0, k1 = Math.ceil((bank - limit) / -aRes);
    fc = '<div class="an-fc">בקצב הזה הבנק (' + sgn(bank) + ' היום)' +
      (bank > 0 ? ' יורד מתחת ל־0 ב<b>' + when(k0) + '</b> ו' : ' ') +
      'מתחת למסגרת ב<b class="an-red">' + when(Math.max(1, k1)) + '</b>.</div>' +
      '<div class="an-note">כדי להתאזן צריך לחתוך כ־' + ils(-aRes) + ' בחודש. מזה, חד פעמיים: כ־' + ils(aOne) + ' בחודש.</div>';
  } else {
    fc = '<div class="an-fc">בקצב הזה הבנק עולה בכ־<b class="an-green">' + ils(aRes) + '</b> בחודש.</div>';
  }
  var p1 = '<div class="an-p"><div class="an-h">התוצאה החודשית</div>' +
    '<div class="an-big ' + (aRes < 0 ? 'an-red' : 'an-green') + '">' + sgn(aRes) + '</div><div class="an-sub">ממוצע לחודש, משכורת פחות כל מה שיצא (' + span + ')</div>' +
    '<div class="an-split"><span>שוטף בלבד <b class="' + (aRes + aOne < 0 ? 'an-red' : 'an-green') + '">' + sgn(aRes + aOne) + '</b></span><span>חד פעמיים <b class="an-red">' + sgn(-aOne) + '</b></span></div>' +
    bars(ordered.map(function (x) { return x.res; }), {
      labels: labels,
      bar: function (v, i, x, bw, y) {
        var top = Math.min(y(v), y(0)), h = Math.max(2, Math.abs(y(v) - y(0)));
        return '<rect x="' + x + '" y="' + top + '" width="' + bw + '" height="' + h + '" rx="4" fill="' + (v < 0 ? '#ff4d63' : '#10A37F') + '"' + (ordered[i].est ? ' opacity=".55"' : '') + '/>' +
          '<text x="' + (x + bw / 2) + '" y="' + (v < 0 ? top + h + 11 : top - 4) + '" text-anchor="middle" class="an-val">' + (Math.round(v / 100) === 0 ? '0' : (v < 0 ? '-' : '+') + nf.format(Math.abs(Math.round(v / 100) * 100))) + '</text>';
      }
    }) + fc + (months.some(function (x) { return x.est; }) ? '<div class="an-note">עמודה בהירה: המשכורת באותו חודש לא ידועה, נלקחה הרגילה.</div>' : '') + '</div>';

  /* ---------- 2. leakage ---------- */
  var aLeak = avg(function (x) { return x.out - x.plan; });
  var cats = {};
  months.forEach(function (x) { Object.keys(x.by).forEach(function (c) { cats[c] = (cats[c] || 0) + x.by[c] / n; }); });
  Object.keys(budget).forEach(function (c) { if (!(c in cats)) cats[c] = 0; });
  var leaks = Object.keys(cats).map(function (c) { return { c: c, v: cats[c] - Number(budget[c] || 0), planned: c in budget }; })
    .filter(function (x) { return x.v > 20; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 4);
  var maxLeak = leaks.length ? leaks[0].v : 1;
  var p2 = '<div class="an-p"><div class="an-h">הדליפה</div>' +
    '<div class="an-big an-red">' + ils(aLeak) + '</div><div class="an-sub">בחודש מעל התכנון של ' + ils(planTotal) + '</div>' +
    bars(ordered.map(function (x) { return x.out; }), {
      labels: labels, ref: planTotal, zero: false,
      bar: function (v, i, x, bw, y) {
        var p = Math.min(v, ordered[i].plan), s = '<rect x="' + x + '" y="' + y(p) + '" width="' + bw + '" height="' + (y(0) - y(p)) + '" rx="4" fill="#CFE6DE"/>';
        if (v > p) s += '<rect x="' + x + '" y="' + y(v) + '" width="' + bw + '" height="' + (y(p) - y(v)) + '" rx="4" fill="#ff4d63"/>';
        return s + '<text x="' + (x + bw / 2) + '" y="' + (y(v) - 4) + '" text-anchor="middle" class="an-val">' + nf.format(Math.round(v / 100) * 100) + '</text>';
      }
    }) +
    '<div class="an-mini">איפה זה דולף, ממוצע לחודש</div>' +
    leaks.map(function (x) {
      return '<div class="an-row"><span>' + esc(x.c) + (x.planned ? '' : ' <i>לא בתכנון</i>') + '</span><span class="an-track"><i style="width:' + Math.round(x.v / maxLeak * 100) + '%"></i></span><b>+' + nf.format(Math.round(x.v)) + '</b></div>';
    }).join('') + '</div>';

  /* ---------- 3. yearly cost of habits ---------- */
  var habits = [{ c: 'סיגריות ואלכוהול', t: 'סיגריות ואלכוהול' }, { c: 'אוכל', t: 'אוכל בחוץ ובעבודה' }].map(function (h) {
    var m = avg(function (x) { return x.by[h.c] || 0; });
    return { t: h.t, now: m * 12, goal: Number(budget[h.c] || 0) * 12 };
  });
  var tot = habits.reduce(function (s, h) { return s + h.now; }, 0), save = habits.reduce(function (s, h) { return s + Math.max(0, h.now - h.goal); }, 0);
  var loanPay = 0; (f.expenses || []).forEach(function (e) { if (/הלווא/.test(e.name)) loanPay = Number(e.amount); });
  var cushion = Number(inputs.cushion_target) || 20000;
  var hmax = Math.max.apply(null, habits.map(function (h) { return Math.max(h.now, h.goal); })) || 1;
  var p3 = '<div class="an-p"><div class="an-h">מחיר ההרגלים בשנה</div>' +
    '<div class="an-big">' + ils(tot) + '</div><div class="an-sub">בשנה בקצב של ' + span + '</div>' +
    habits.map(function (h) {
      return '<div class="an-hab"><div class="an-hab-t"><span>' + h.t + '</span><b>' + ils(h.now) + '</b></div>' +
        '<div class="an-hbar"><i style="width:' + Math.round(h.now / hmax * 100) + '%"></i><em style="width:' + Math.round(Math.min(h.now, h.goal) / hmax * 100) + '%"></em><u style="right:' + Math.round(h.goal / hmax * 100) + '%"></u></div>' +
        '<div class="an-hab-s"><span>ביעד: ' + ils(h.goal) + '</span>' + (h.now > h.goal ? '<span class="an-green">חוסך ' + ils(h.now - h.goal) + '</span>' : '<span class="an-green">בתוך היעד</span>') + '</div></div>';
    }).join('') +
    '<div class="an-eq"><div><b>' + (tot / cushion * 100 >= 100 ? 'יותר מכל' : Math.round(tot / cushion * 100) + '%') + '</b><span>' + (tot >= cushion ? 'כרית הביטחון (' + ils(cushion) + ')' : 'מכרית הביטחון') + '</span></div>' +
    (loanPay ? '<div><b>' + (tot / loanPay).toFixed(1) + '</b><span>תשלומי הלוואת רכב</span></div>' : '') +
    '<div><b class="an-green">' + ils(save) + '</b><span>נשאר אצלך אם עומדים ביעדים</span></div></div></div>';

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
    p4 = '<div class="an-p"><div class="an-h">החודשים הכבדים</div>' +
      '<div class="an-big">' + heavy + ' חודשים</div><div class="an-sub">ב־12 החודשים הבאים יוצא בהם יותר מהרגיל. לא להתחייב לפניהם.</div>' +
      '<div class="an-cal">' + tiles.map(function (t) {
        var r = t.total / med, cls = r > 1.25 ? 'h3' : r > 1.12 ? 'h2' : r < 0.85 ? 'lt' : '';
        var mo = Number(t.ym.slice(5, 7)), yr = t.ym.slice(2, 4);
        var uniq = t.notes.filter(function (x, i, a) { return x && a.indexOf(x) === i; }).slice(0, 2);
        return '<div class="an-tile ' + cls + '"><div class="an-tm">' + MON[mo - 1] + ' ' + (mo === 1 || t === tiles[0] ? yr : '') + '</div><div class="an-ta">' + nf.format(Math.round(t.total / 100) * 100) + '</div>' +
          (uniq.length ? '<div class="an-tn">' + uniq.map(esc).join('<br>') + '</div>' : '') + '</div>';
      }).join('') + '</div>' +
      '<div class="an-leg"><span class="h3"></span>כבד מאוד<span class="h2"></span>כבד<span class="lt"></span>קל</div>' +
      '<div class="an-note">לפי רשימת ההוצאות הקבועות והחד פעמיים הידועים. ההוצאה בפועל גבוהה יותר, ראה הדליפה.</div></div>';
  }

  /* ---------- the way out: what each step does to the monthly result ---------- */
  var CAP = 1000, capGain = Math.max(0, aOne - CAP), habGain = save / 12;
  var loanEnd = null;
  (f.expenses || []).forEach(function (e) {
    if (/הלווא/.test(e.name) && e.left_after_current !== null && e.left_after_current !== '' && inputs.first_charge) {
      var fc0 = String(inputs.first_charge), d = new Date(Date.UTC(Number(fc0.slice(0, 4)), Number(fc0.slice(5, 7)) - 1 + Number(e.left_after_current) + 1, 1));
      loanEnd = MONL[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
    }
  });
  var st = [
    { t: 'היום', v: aRes, d: 'ממוצע ' + span },
    { t: 'תקרה לחד פעמיים', v: aRes + capGain, d: 'עד ' + ils(CAP) + ' בחודש' },
    { t: 'הרגלים ביעד', v: aRes + capGain + habGain, d: 'סיגריות, אלכוהול ואוכל' }
  ];
  if (loanPay && loanEnd) st.push({ t: 'ההלוואה נגמרת', v: aRes + capGain + habGain + loanPay, d: 'מ' + loanEnd });
  var way = '<div class="an-way"><div class="an-way-h">הדרך החוצה <small>מה כל צעד עושה לתוצאה החודשית</small></div><div class="an-steps">' +
    st.map(function (x, i) {
      return (i ? '<div class="an-arr">←</div>' : '') + '<div class="an-step ' + (x.v < 0 ? 'neg' : 'pos') + '"><span>' + x.t + '</span><b>' + sgn(x.v) + '</b><small>' + esc(x.d) + '</small></div>';
    }).join('') + '</div></div>';
  root.innerHTML = '<div class="an-head"><span>ניתוחים</span><small>לפי היומן, ' + span + '</small></div><div class="an-grid">' + p1 + p2 + p3 + p4 + '</div>' + way;
  root.hidden = false;
}
