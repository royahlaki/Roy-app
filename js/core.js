/* Shared helpers for the app shell and its pages.
   Data lives encrypted in data/bundle.enc; the key is derived from Roy's passphrase
   and kept on this device only (localStorage). */
(function () {
  var KEY = 'roy-key';
  var b64 = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
  var toB64 = function (buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); };

  function fetchBundle() {
    return fetch('data/bundle.enc?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('bundle ' + r.status);
      return r.json();
    });
  }
  function decrypt(key, box) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(box.iv) }, key, b64(box.ct)).then(function (pt) {
      return JSON.parse(new TextDecoder().decode(pt));
    });
  }
  function storedKey() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) {}
    if (!raw) return Promise.resolve(null);
    return crypto.subtle.importKey('raw', b64(raw), 'AES-GCM', false, ['decrypt']);
  }

  var Roy = window.Roy = {
    hasKey: function () { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } },
    forget: function () { try { localStorage.removeItem(KEY); } catch (e) {} },
    /* Derive the key from the passphrase, check it against the bundle, keep it. */
    unlock: function (pass) {
      return fetchBundle().then(function (box) {
        return crypto.subtle.importKey('raw', new TextEncoder().encode(pass.trim()), 'PBKDF2', false, ['deriveKey'])
          .then(function (base) {
            return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(box.salt), iterations: 200000, hash: 'SHA-256' },
              base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
          })
          .then(function (key) {
            return decrypt(key, box).then(function (data) {
              return crypto.subtle.exportKey('raw', key).then(function (raw) {
                try { localStorage.setItem(KEY, toB64(raw)); } catch (e) {}
                return data;
              });
            });
          });
      });
    },
    /* Load and decrypt with the stored key. Rejects if there is no key or it no longer fits. */
    load: function () {
      return storedKey().then(function (key) {
        if (!key) throw new Error('locked');
        return fetchBundle().then(function (box) { return decrypt(key, box); });
      });
    }
  };

  /* Pages run inside the shell's frames. Opened on their own, they go to the shell. */
  Roy.inShell = function () { try { return window.parent !== window && !!window.parent.roy; } catch (e) { return false; } };
  Roy.data = function () {
    if (Roy.inShell()) return window.parent.roy.data();
    location.replace('./#' + (document.body && document.body.dataset.tab || 'home'));
    return new Promise(function () {});
  };
  Roy.go = function (tab, hash) {
    if (Roy.inShell()) window.parent.roy.go(tab, hash || '');
    else location.href = './#' + tab;
  };

  /* Links: Roy's own artifacts open inside the app, everything else in Safari. */
  var INTERNAL = { 'WsmNu2GFyLHWb6BBd25Say': 'portfolio', 'UYAXtgDzYJbvNJLVkYaQsG': 'lab', 'YRXM4eesemUpAKwaWQXgcj': 'home', 'P3RAHWhxDbk2EDNaK2VshQ': 'sectors', 'WxeRRWehPX8TT22HB3TWHW': 'finance' };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    e.preventDefault();
    for (var id in INTERNAL) {
      if (href.indexOf(id) !== -1) { var h = href.indexOf('#'); Roy.go(INTERNAL[id], h === -1 ? '' : href.slice(h)); return; }
    }
    window.open(href, '_blank', 'noopener');
  }, true);
})();

/* Centered page header: title (or greeting on home) with today's date small underneath. */
(function () {
  function greet() {
    var h = new Date().getHours();
    return h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב';
  }
  function today() {
    try { return new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }); }
    catch (e) { return new Date().toLocaleDateString(); }
  }
  window.Roy = window.Roy || {};
  Roy.greet = greet; Roy.today = today;
  Roy.fillHeader = function (root) {
    (root || document).querySelectorAll('[data-greet]').forEach(function (el) { el.textContent = greet() + ' רוי'; });
    (root || document).querySelectorAll('[data-today]').forEach(function (el) { el.textContent = today(); });
  };
  if (document.readyState !== 'loading') Roy.fillHeader(); else document.addEventListener('DOMContentLoaded', function () { Roy.fillHeader(); });
})();

/* Sync with the Google Sheet "מרכז נתונים השקעות" (through its Apps Script web app).
   - Data written to the sheet's _data tab replaces the same part of the bundle (key "d:<path>").
   - Lists kept on the device (tasks, shopping, habits, lab, watchlist) are mirrored to the sheet
     (key "l:<localStorage key>"), so the iPhone and the Mac see the same lists. Newest wins.
   - Live prices from the sheet's מחירים tab update holdings and the account total.
   The sheet address and token live inside the encrypted bundle (config.sync). */
(function () {
  var SYNC_KEYS = ['roy-tasks', 'roy-shop', 'roy-habits', 'srl-data-v1', 'themeWatch'];
  var TS = 'roy-ts:';
  var DATA_PATHS = ['datasets.account', 'datasets.holdings', 'datasets.decisions', 'datasets.plan', 'datasets.research',
    'datasets.scenarios', 'datasets.theses', 'datasets.trades', 'finance.expenses', 'finance.history', 'finance.inputs',
    'finance.oneoffs', 'finance.ledger', 'lab'];
  var cfg = null, queue = {}, timer = null;
  var ls = window.localStorage, rawSet = Storage.prototype.setItem;

  function get(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function put(o, p, v) { var ks = p.split('.'), last = ks.pop(); ks.forEach(function (k) { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }); o[last] = v; }
  function shell() { try { return window.parent !== window && window.parent.Roy && window.parent.Roy._sync ? window.parent.Roy : null; } catch (e) { return null; } }

  /* Any page that saves a synced list: stamp it and hand it to the shell to send. */
  Storage.prototype.setItem = function (k, v) {
    rawSet.call(this, k, v);
    if (this === ls && SYNC_KEYS.indexOf(k) > -1) {
      var ts = Date.now(); rawSet.call(ls, TS + k, String(ts));
      var s = shell() || (Roy._sync ? Roy : null);
      if (s) s._sync.push([{ k: 'l:' + k, v: String(v), ts: ts }]);
    }
  };

  function send(items) {
    if (!cfg || !items.length) return Promise.resolve();
    return fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ t: cfg.token, items: items }) })
      .catch(function () { /* offline: the device copy stays and goes up next time */ });
  }
  function push(items) {
    items.forEach(function (it) { queue[it.k] = it; });
    clearTimeout(timer);
    timer = setTimeout(function () { var q = Object.keys(queue).map(function (k) { return queue[k]; }); queue = {}; send(q); }, 1200);
  }

  function applyPrices(data, prices) {
    var hs = get(data, 'datasets.holdings'), acc = (get(data, 'datasets.account') || [])[0];
    if (!Array.isArray(hs) || !prices) return;
    var usd = prices.USDILS && prices.USDILS.price, before = 0, after = 0, day = 0, any = false;
    hs.forEach(function (h) {
      var p = prices[h.ticker], qty = Number(h.qty);
      before += Number(h.value_ils) || 0;
      if (p && qty) {
        var rate = p.cur === 'ILA' ? 0.01 : p.cur === 'USD' ? usd : p.cur === 'ILS' ? 1 : null;
        if (rate) {
          any = true;
          h.price = p.price; h.price_date = 'חי';
          h.value_ils = Math.round(qty * p.price * rate * 100) / 100;
          if (p.cur === 'USD') h.value_usd = Math.round(qty * p.price * 100) / 100;
          var cost = Number(h.cost_ils);
          if (cost) { h.pnl_ils = Math.round((h.value_ils - cost) * 100) / 100; h.pnl_pct = Math.round((h.value_ils / cost - 1) * 10000) / 100; }
          if (p.change != null) { day += qty * p.change * rate; h.price_move = (p.change >= 0 ? '+' : '') + (p.change / (p.price - p.change) * 100).toFixed(2) + '% יומי'; }
        }
      }
      after += Number(h.value_ils) || 0;
    });
    if (any && acc) {
      acc.total_ils = Math.round((after + Number(acc.cash_ils || 0)) * 100) / 100;
      acc.pnl_total = Math.round((Number(acc.pnl_total || 0) + after - before) * 100) / 100;
      acc.daily_change = Math.round(day * 100) / 100;
      if (usd) acc.usd_rate = usd;
      var d = new Date(), p2 = function (n) { return String(n).padStart(2, '0'); };
      acc.as_of = p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ' (מחירים חיים מ-Google)'; data.updated = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
  }

  /* Shell only: pull from the sheet, merge into the bundle data, seed what the sheet lacks. */
  function sync(data) {
    cfg = data && data.config && data.config.sync;
    if (!cfg || !cfg.url) return Promise.resolve(data);
    var ctl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
    return fetch(cfg.url + '?t=' + encodeURIComponent(cfg.token), ctl ? { signal: ctl.signal } : {})
      .then(function (r) { return r.json(); })
      .then(function (res) {
        clearTimeout(to);
        if (!res || !res.data) return data;
        var sheet = res.data, seed = [];
        DATA_PATHS.forEach(function (p) {
          var row = sheet['d:' + p];
          if (row) { try { put(data, p, JSON.parse(row.v)); } catch (e) {} }
          else if (get(data, p) !== undefined) seed.push({ k: 'd:' + p, v: JSON.stringify(get(data, p)), ts: 1 });
        });
        if (cfg) data.config.sync = cfg;
        SYNC_KEYS.forEach(function (k) {
          var row = sheet['l:' + k], localTs = Number(ls.getItem(TS + k)) || 0, local = ls.getItem(k);
          if (row && row.ts > localTs) { rawSet.call(ls, k, row.v); rawSet.call(ls, TS + k, String(row.ts)); }
          else if (local != null && (!row || localTs > row.ts)) seed.push({ k: 'l:' + k, v: local, ts: localTs || Date.now() });
        });
        applyPrices(data, res.prices);
        if (seed.length) send(seed);
        data._synced = res.at;
        return data;
      })
      .catch(function () { clearTimeout(to); return data; });
  }

  Roy._sync = { push: push, sync: sync };
})();
