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
