(() => {
  'use strict';

  // =========================================================================
  // RPRIME TACTILE PRECISION HARDWARE INTERACTION LAYER
  // - Precision top-edge tachometer scroll bar
  // - 60 FPS anodized chamfer cursor sheen (--cx, --cy)
  // - Live CNC range-slider LED fill tracking (--rp-pct)
  // - Stealth-carbon interactive telemetry reticle on homepage & hub hero
  // - Crisp staggered hardware reveal animations
  // =========================================================================

  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  // 1. Top-edge tachometer scroll needle
  function mountScrollNeedle() {
    if (document.getElementById('rp-scroll-needle')) return;
    const bar = document.createElement('div');
    bar.id = 'rp-scroll-needle';
    document.body.appendChild(bar);

    let raf = 0;
    const update = () => {
      raf = 0;
      const docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const pct = Math.min(100, Math.max(0, (window.scrollY / docH) * 100));
      bar.style.width = pct.toFixed(2) + '%';
    };
    window.addEventListener('scroll', () => {
      if (!raf) raf = requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  // 2. Live illuminated LED track fill on EVERY range slider
  function updateSliderFill(el) {
    const min = parseFloat(el.min || '0');
    const max = parseFloat(el.max || '100');
    const val = parseFloat(el.value || '0');
    const span = max - min;
    const pct = span > 0 ? Math.min(100, Math.max(0, ((val - min) / span) * 100)) : 0;
    el.style.setProperty('--rp-pct', pct.toFixed(1) + '%');
  }

  function wireSliders() {
    const sliders = document.querySelectorAll('input[type="range"]');
    sliders.forEach((s) => {
      updateSliderFill(s);
      s.addEventListener('input', () => updateSliderFill(s), { passive: true });
      s.addEventListener('change', () => updateSliderFill(s), { passive: true });
    });

    // Also keep slider LED fills synced when preset buttons programmatically change slider.value
    document.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;
      setTimeout(() => {
        document.querySelectorAll('input[type="range"]').forEach(updateSliderFill);
      }, 45);
    }, { passive: true });
  }

  // 3. Cursor-tracked anodized metallic sheen across chassis modules
  function wireAnodizedSheen() {
    if (reducedMotion || !finePointer) return;
    const selector = [
      '.panel', '.card', '.rig-panel', '.panel-box', '.viewport-card',
      '.plot-card', '.ctrl-card', '.lab-card', '.article-card',
      '.focus-card', '.reality-card', '.standard-card', '.handoff-card',
      '.bet-card', '.opt-pert-card'
    ].join(',');

    const cards = document.querySelectorAll(selector);
    cards.forEach((card) => {
      card.classList.add('rp-sheen-card');
      let raf = 0;
      let lastX = 0;
      let lastY = 0;
      card.addEventListener('pointermove', (ev) => {
        lastX = ev.clientX;
        lastY = ev.clientY;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = card.getBoundingClientRect();
          card.style.setProperty('--cx', (lastX - r.left).toFixed(1) + 'px');
          card.style.setProperty('--cy', (lastY - r.top).toFixed(1) + 'px');
        });
      }, { passive: true });
    });
  }

  // 4. Stealth-Carbon Telemetry Reticle & Synaptic Constellation on Hero (index.html & neurolab.html)
  function mountHeroReticle() {
    if (reducedMotion) return;
    const path = (window.location.pathname || '').split('/').pop() || 'index.html';
    if (path && path !== 'index.html' && path !== 'neurolab.html') return;

    const hero = document.querySelector('.hero');
    if (!hero || document.getElementById('rp-hero-reticle')) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'rp-hero-reticle';
    hero.insertBefore(canvas, hero.firstChild);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0, dpr = 1;
    let mx = -999, my = -999;
    const N = 42;
    const nodes = [];

    function resize() {
      const r = hero.getBoundingClientRect();
      w = Math.max(320, r.width);
      h = Math.max(260, r.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!nodes.length) {
        for (let i = 0; i < N; i++) {
          nodes.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.24,
            vy: (Math.random() - 0.5) * 0.22,
            phase: Math.random() * Math.PI * 2,
            hot: i % 6 === 0
          });
        }
      }
    }

    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { mx = -999; my = -999; }, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    resize();

    let t = 0;
    function frame() {
      t += 0.014;
      ctx.clearRect(0, 0, w, h);

      // Subtle precision Porsche-cockpit coordinate ticks
      ctx.strokeStyle = 'rgba(255,255,255,0.032)';
      ctx.lineWidth = 1;
      const step = 72;
      for (let gx = step; gx < w; gx += step) {
        for (let gy = step; gy < h; gy += step) {
          ctx.beginPath();
          ctx.moveTo(gx - 3, gy); ctx.lineTo(gx + 3, gy);
          ctx.moveTo(gx, gy - 3); ctx.lineTo(gx, gy + 3);
          ctx.stroke();
        }
      }

      // Faint horizon telemetry arc
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(200,255,0,0.045)';
      ctx.arc(w * 0.5, h * 1.42, Math.min(w * 0.68, h * 1.18), Math.PI * 1.18, Math.PI * 1.82);
      ctx.stroke();

      // Update nodes & draw ultra-fine synaptic filaments
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        a.x += a.vx;
        a.y += a.vy;
        if (a.x < 0 || a.x > w) a.vx *= -1;
        if (a.y < 0 || a.y > h) a.vy *= -1;

        // Gentle magnetic pull near cursor
        if (mx > 0) {
          const dx = mx - a.x, dy = my - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 150 && dist > 1) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(200,255,0,${((1 - dist / 150) * 0.18).toFixed(3)})`;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mx, my);
            ctx.stroke();
          }
        }

        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 135) {
            const alpha = (1 - d / 135) * 0.085;
            ctx.beginPath();
            ctx.strokeStyle = (a.hot || b.hot)
              ? `rgba(200,255,0,${(alpha * 1.15).toFixed(3)})`
              : `rgba(255,255,255,${alpha.toFixed(3)})`;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }

        const pulse = 0.45 + 0.55 * Math.sin(t * 2.1 + a.phase);
        ctx.beginPath();
        ctx.fillStyle = a.hot
          ? `rgba(200,255,0,${(0.28 + 0.35 * pulse).toFixed(3)})`
          : `rgba(235,232,224,${(0.14 + 0.14 * pulse).toFixed(3)})`;
        ctx.arc(a.x, a.y, a.hot ? 1.8 : 1.25, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // 5. Staggered crisp hardware reveal on homepage & hub cards
  function wireReveal() {
    if (reducedMotion || !('IntersectionObserver' in window)) return;
    const path = (window.location.pathname || '').split('/').pop() || 'index.html';
    if (path && path !== 'index.html' && path !== 'neurolab.html') return;

    const els = document.querySelectorAll('.article-card, .lab-card, .focus-card, .standard-card, .reality-card');
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('rp-in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -24px 0px' });

    els.forEach((el, idx) => {
      el.classList.add('rp-reveal');
      el.style.transitionDelay = Math.min(220, (idx % 4) * 55) + 'ms';
      io.observe(el);
    });

    // Safety fallback so nothing ever stays invisible
    setTimeout(() => {
      els.forEach((el) => el.classList.add('rp-in'));
    }, 1100);
  }

  function boot() {
    mountScrollNeedle();
    wireSliders();
    wireAnodizedSheen();
    mountHeroReticle();
    wireReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
