(() => {
  'use strict';

  // =========================================================================
  // RPRIME PRIVATE LAB ACCESS LOCK
  // Synchronously guards simulation pages while keeping all articles public.
  // Stores only a salted SHA-256 digest (zero plaintext password in source).
  // =========================================================================

  const SALT = 'rprime::lab-lock::v1::';
  const EXPECTED_HASH = '5fa1c10577328ff3332a5420dc9372ce94d10fa254e4e20b10f3d1262e0bec64';
  const STORAGE_KEY = 'rprime_lab_unlock_v1';

  // Pure-JS UTF-8 SHA-256 (works identically on https://, localhost, and file://)
  function sha256Hex(str) {
    const utf8 = unescape(encodeURIComponent(str));
    const len = utf8.length;
    const words = [];
    for (let i = 0; i < len; i++) {
      words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
    }
    words[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
    const bitLen = len * 8;
    const totalWords = (((len + 8) >> 6) + 1) * 16;
    words[totalWords - 2] = Math.floor(bitLen / 0x100000000);
    words[totalWords - 1] = bitLen >>> 0;

    const K = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
    let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

    const W = new Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));

    for (let i = 0; i < totalWords; i += 16) {
      for (let t = 0; t < 16; t++) W[t] = words[i + t] | 0;
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }
      let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      H0 = (H0 + a) | 0; H1 = (H1 + b) | 0; H2 = (H2 + c) | 0; H3 = (H3 + d) | 0;
      H4 = (H4 + e) | 0; H5 = (H5 + f) | 0; H6 = (H6 + g) | 0; H7 = (H7 + h) | 0;
    }

    return [H0, H1, H2, H3, H4, H5, H6, H7]
      .map((v) => (v >>> 0).toString(16).padStart(8, '0'))
      .join('');
  }

  function isSessionUnlocked() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === EXPECTED_HASH;
    } catch (_) {
      return false;
    }
  }

  function setSessionUnlocked(unlocked) {
    try {
      if (unlocked) sessionStorage.setItem(STORAGE_KEY, EXPECTED_HASH);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  const CSS = `
    html.rp-sim-locked, html.rp-sim-locked body {
      overflow: hidden !important;
      background: #010102 !important;
      height: 100% !important;
    }
    html.rp-sim-locked body > *:not(#rp-sim-lock-overlay) {
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      user-select: none !important;
    }
    #rp-sim-lock-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background-color: #010102;
      background-image:
        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px),
        radial-gradient(640px 380px at 50% 24%, rgba(200,255,0,0.06), transparent 70%);
      background-size: 28px 28px, 28px 28px, 100% 100%;
      color: #f0ece4;
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
    }
    .rp-lock-card {
      width: 100%;
      max-width: 460px;
      background: linear-gradient(180deg, #13161d 0%, #090b0f 45%, #050608 100%);
      border: 1px solid rgba(255,255,255,0.15);
      border-top: 2px solid #ff4810;
      border-radius: 14px;
      padding: 28px 26px 24px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 32px 80px rgba(0,0,0,0.96);
    }
    .rp-lock-kicker {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      border-radius: 5px;
      background: #040507;
      border: 1px solid rgba(255,72,16,0.35);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #ff6b35;
      margin-bottom: 14px;
    }
    .rp-lock-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ff4810;
      box-shadow: 0 0 8px #ff4810;
    }
    .rp-lock-title {
      font-family: 'Syne', system-ui, sans-serif;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.025em;
      line-height: 1.15;
      color: #fff;
      margin: 0 0 10px;
    }
    .rp-lock-desc {
      font-size: 13.8px;
      line-height: 1.6;
      color: #9e9a91;
      margin: 0 0 20px;
    }
    .rp-lock-desc strong { color: #f0ece4; }
    .rp-lock-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .rp-lock-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    #rp-lock-input {
      width: 100%;
      padding: 13px 44px 13px 14px;
      border-radius: 8px;
      background: #020305;
      border: 1px solid rgba(255,255,255,0.16);
      color: #fff;
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 14px;
      letter-spacing: 0.04em;
      outline: none;
      box-shadow: inset 0 2px 8px rgba(0,0,0,0.9);
      transition: border-color 0.16s ease, box-shadow 0.16s ease;
    }
    #rp-lock-input:focus {
      border-color: #c8ff00;
      box-shadow: inset 0 2px 8px rgba(0,0,0,0.9), 0 0 0 3px rgba(200,255,0,0.15);
    }
    #rp-lock-eye {
      position: absolute;
      right: 10px;
      background: transparent;
      border: none;
      color: #8a867e;
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 11px;
      cursor: pointer;
      padding: 4px 6px;
    }
    #rp-lock-eye:hover { color: #f0ece4; }
    #rp-lock-submit {
      width: 100%;
      padding: 12px 16px;
      border-radius: 8px;
      background: linear-gradient(180deg, #d7ff38 0%, #b3e600 100%);
      color: #050605;
      border: 1px solid #e1ff6b;
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 26px -10px rgba(200,255,0,0.5);
    }
    #rp-lock-submit:hover { filter: brightness(1.05); }
    #rp-lock-err {
      min-height: 18px;
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 11px;
      color: #ff5566;
      margin: 2px 0 0;
    }
    .rp-lock-links {
      margin-top: 16px;
      padding-top: 15px;
      border-top: 1px solid rgba(255,255,255,0.08);
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 10px;
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 11px;
    }
    .rp-lock-links a {
      color: #18dcff;
      text-decoration: none;
    }
    .rp-lock-links a:hover { text-decoration: underline; }
    .rp-lock-shake { animation: rpLockShake 0.28s ease; }
    @keyframes rpLockShake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-6px); }
      75% { transform: translateX(6px); }
    }
    #rp-relock-pill {
      position: fixed;
      left: 14px;
      bottom: 14px;
      z-index: 9980;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 11px;
      border-radius: 999px;
      background: rgba(10,12,16,0.92);
      border: 1px solid rgba(255,72,16,0.45);
      color: #ffb199;
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(0,0,0,0.75);
    }
    #rp-relock-pill:hover {
      border-color: #ff4810;
      color: #fff;
      background: rgba(255,72,16,0.2);
    }
  `;

  function injectStyle() {
    if (document.getElementById('rp-sim-lock-style')) return;
    const style = document.createElement('style');
    style.id = 'rp-sim-lock-style';
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function mountRelockPill() {
    if (!document.body || document.getElementById('rp-relock-pill')) return;
    const btn = document.createElement('button');
    btn.id = 'rp-relock-pill';
    btn.type = 'button';
    btn.title = 'Re-lock simulations immediately';
    btn.textContent = '🔒 Lock Labs';
    btn.addEventListener('click', () => {
      setSessionUnlocked(false);
      window.location.reload();
    });
    document.body.appendChild(btn);
  }

  function blockHotkeysWhileLocked(e) {
    if (!document.documentElement.classList.contains('rp-sim-locked')) return;
    const target = e.target;
    if (target && (target.id === 'rp-lock-input' || target.closest && target.closest('#rp-sim-lock-overlay'))) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function mountLockOverlay() {
    if (!document.body || document.getElementById('rp-sim-lock-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'rp-sim-lock-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Private Lab Access Gate');
    overlay.innerHTML = `
      <div class="rp-lock-card" id="rp-lock-card">
        <div class="rp-lock-kicker"><span class="rp-lock-dot"></span>PRIVATE LAB ACCESS // AUTHOR REVIEW</div>
        <h1 class="rp-lock-title">Simulations Temporarily Locked</h1>
        <p class="rp-lock-desc">Interactive labs on <strong>Neuroscience with RPrime</strong> are password-protected while under private review by Rishik Pannala. All <strong>10 published articles</strong> remain completely open.</p>
        <form class="rp-lock-form" id="rp-lock-form" autocomplete="off">
          <div class="rp-lock-input-wrap">
            <input id="rp-lock-input" type="password" placeholder="Enter access password" autocomplete="off" spellcheck="false" required>
            <button type="button" id="rp-lock-eye" aria-label="Show password">SHOW</button>
          </div>
          <button type="submit" id="rp-lock-submit">Unlock Simulations →</button>
          <div id="rp-lock-err" role="alert"></div>
        </form>
        <div class="rp-lock-links">
          <a href="./index.html#articles">← All Published Articles</a>
          <a href="./article9.html">Read Article 09 ↗</a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const form = overlay.querySelector('#rp-lock-form');
    const input = overlay.querySelector('#rp-lock-input');
    const eye = overlay.querySelector('#rp-lock-eye');
    const err = overlay.querySelector('#rp-lock-err');
    const card = overlay.querySelector('#rp-lock-card');

    setTimeout(() => { try { input.focus(); } catch (_) {} }, 30);

    eye.addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      eye.textContent = showing ? 'SHOW' : 'HIDE';
      input.focus();
    });

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const candidate = (input.value || '').trim();
      const digest = sha256Hex(SALT + candidate);
      if (digest === EXPECTED_HASH) {
        setSessionUnlocked(true);
        document.documentElement.classList.remove('rp-sim-locked');
        overlay.remove();
        window.removeEventListener('keydown', blockHotkeysWhileLocked, true);
        mountRelockPill();
        window.dispatchEvent(new Event('resize'));
        setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
      } else {
        err.textContent = 'Access denied — incorrect password.';
        card.classList.remove('rp-lock-shake');
        void card.offsetWidth;
        card.classList.add('rp-lock-shake');
        input.select();
      }
    });
  }

  injectStyle();

  if (isSessionUnlocked()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mountRelockPill, { once: true });
    } else {
      mountRelockPill();
    }
    return;
  }

  // Immediately hide page before first paint
  document.documentElement.classList.add('rp-sim-locked');
  window.addEventListener('keydown', blockHotkeysWhileLocked, true);

  if (document.body) {
    mountLockOverlay();
  } else {
    document.addEventListener('DOMContentLoaded', mountLockOverlay, { once: true });
  }
})();
