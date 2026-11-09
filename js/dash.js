/* A small stand-in for the dashboard runtime the portfolio page was written for:
   datasets come from the decrypted bundle, calcs are worked out on demand. */
(function () {
  var sets = {}, calcs = {}, cache = {}, subs = [], PK = 'roy-pf-params';
  var params = {};
  try { params = JSON.parse(localStorage.getItem(PK) || '{}') || {}; } catch (e) { params = {}; }

  function rows(id) {
    if (Object.prototype.hasOwnProperty.call(sets, id)) return sets[id];
    if (calcs[id]) {
      if (!cache[id]) {
        var c = calcs[id];
        cache[id] = c.fn.apply(null, c.inputs.map(rows));
      }
      return cache[id];
    }
    return null;
  }
  function run() { cache = {}; subs.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }

  var lastW = 0, rt = null;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth; clearTimeout(rt); rt = setTimeout(run, 150);
  });

  window.dash = {
    colors: ['#4C9DFF', '#3DDC97', '#FF6B85', '#F5D46B', '#B18CFF', '#22D3EE', '#FF9F43', '#9CA3AF'],
    _load: function (datasets) { sets = datasets || {}; cache = {}; lastW = window.innerWidth; },
    data: function (id) {
      var r;
      try { r = rows(id); } catch (e) { console.error(e); return { status: 'error', data: [], message: String(e), refreshing: false, meta: [] }; }
      if (r === null) return { status: 'missing', data: [], refreshing: false, meta: [] };
      var cols = Array.isArray(r) && r.length && typeof r[0] === 'object' ? Object.keys(r[0]) : [];
      return { status: 'ok', data: r, rows: r, columns: cols, refreshing: false, meta: [] };
    },
    calc: function (id, def) { calcs[id] = def; },
    loader: function () {},
    onData: function (fn) { subs.push(fn); fn(); },
    params: function () { return params; },
    setParams: function (p) {
      params = Object.assign({}, params, p);
      try { localStorage.setItem(PK, JSON.stringify(params)); } catch (e) {}
      run();
    },
    setLink: function (k) { history.replaceState(null, '', '#' + k); },
    refresh: function () {}
  };
})();
