(() => {
  'use strict';

  // Precision top tachometer scroll bar (skip on index.html which already mounts #scrollNeedle)
  if (!document.getElementById('scrollNeedle') && !document.getElementById('rp-hw-scroll')) {
    const bar = document.createElement('div');
    bar.id = 'rp-hw-scroll';
    document.body.appendChild(bar);
    let raf = 0;
    const upd = () => {
      raf = 0;
      const h = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      bar.style.width = Math.min(100, Math.max(0, (window.scrollY / h) * 100)).toFixed(2) + '%';
    };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
    upd();
  }

  // Live fader track illumination (--rp-pct) on every range slider across Sims 01-08
  function syncSlider(el) {
    const min = parseFloat(el.min || '0');
    const max = parseFloat(el.max || '100');
    const val = parseFloat(el.value || '0');
    const pct = max > min ? Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100)) : 0;
    el.style.setProperty('--rp-pct', pct.toFixed(1) + '%');
  }

  function initHardware() {
    document.querySelectorAll('input[type="range"]:not(.te-fader)').forEach((s) => {
      syncSlider(s);
      s.addEventListener('input', () => syncSlider(s), { passive: true });
      s.addEventListener('change', () => syncSlider(s), { passive: true });
    });

    document.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('button')) {
        setTimeout(() => {
          document.querySelectorAll('input[type="range"]:not(.te-fader)').forEach(syncSlider);
        }, 45);
      }
    }, { passive: true });

    // Anodized specular mouse-tracked sheen across all chassis modules
    const fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    if (fine) {
      const sel = '.panel,.card,.rig-panel,.panel-box,.viewport-card,.plot-card,.ctrl-card,.lab-card,.standard-card,.bet-card,.opt-pert-card';
      document.querySelectorAll(sel).forEach((card) => {
        card.classList.add('rp-hw-sheen');
        card.addEventListener('pointermove', (ev) => {
          const r = card.getBoundingClientRect();
          card.style.setProperty('--mx', (ev.clientX - r.left).toFixed(1) + 'px');
          card.style.setProperty('--my', (ev.clientY - r.top).toFixed(1) + 'px');
        }, { passive: true });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHardware);
  } else {
    initHardware();
  }
})();
