/* Channel Studio v14 — 3D interaction: pointer tilt + glare and scroll reveal.
   Skipped automatically for reduced motion and for touch screens (which get a press-depth effect in CSS). */
(function () {
  'use strict';
  const reduced = () => (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || (document.body && document.body.dataset.motion === 'reduced');
  const canHover = () => window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  const SELECTOR = '.stat-card, .quick-card, .hero-card, .status-card, .ch-card, .wf-season, .vi-step, .tour-card-3d, .panel.tilt-me';
  const MAX = 7;

  function mark(root) {
    (root || document).querySelectorAll(SELECTOR).forEach(el => { if (!el.hasAttribute('data-tilt')) el.setAttribute('data-tilt', ''); });
  }

  function onMove(e) {
    const el = e.target.closest && e.target.closest('[data-tilt]');
    if (!el || reduced() || !canHover()) return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.classList.add('is-tilting');
    el.style.setProperty('--ry', ((px - .5) * 2 * MAX).toFixed(2) + 'deg');
    el.style.setProperty('--rx', ((.5 - py) * 2 * MAX).toFixed(2) + 'deg');
    el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
  }
  function onLeave(e) {
    const el = e.target.closest && e.target.closest('[data-tilt]');
    if (!el) return;
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    el.classList.remove('is-tilting'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
  }

  function reveal() {
    if (!('IntersectionObserver' in window) || reduced()) return;
    const items = document.querySelectorAll('.page-content > section, .page-content .stat-card, .page-content .quick-card, .page-content .status-card');
    if (!items.length) return;
    document.documentElement.classList.add('js-3d');
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target; io.unobserve(el);
        el.classList.add('in-3d');
        el.addEventListener('animationend', () => { el.classList.remove('reveal-3d', 'in-3d'); }, { once: true });
      });
    }, { threshold: .08 });
    let i = 0;
    items.forEach(el => { el.classList.add('reveal-3d'); el.style.animationDelay = Math.min(i++ * 40, 320) + 'ms'; io.observe(el); });
    // Safety net: never leave content hidden if something goes wrong.
    setTimeout(() => document.querySelectorAll('.reveal-3d').forEach(el => el.classList.remove('reveal-3d')), 2500);
  }

  document.addEventListener('DOMContentLoaded', () => {
    mark(); reveal();
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerout', onLeave, { passive: true });
    new MutationObserver(m => { if (m.some(x => x.addedNodes.length)) mark(); }).observe(document.body, { childList: true, subtree: true });
  });
})();
