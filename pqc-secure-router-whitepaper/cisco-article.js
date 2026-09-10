(() => {
  'use strict';

  const root = document.documentElement;
  const progress = document.querySelector('.reading-progress > span');
  const backToTop = document.querySelector('.back-to-top');
  const menuToggle = document.querySelector('.menu-toggle');
  const tocList = document.querySelector('.toc-list');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (menuToggle && tocList) {
    menuToggle.addEventListener('click', () => {
      const open = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!open));
      tocList.classList.toggle('is-open', !open);
    });
    tocList.addEventListener('click', event => {
      if (!event.target.closest('a')) return;
      menuToggle.setAttribute('aria-expanded', 'false');
      tocList.classList.remove('is-open');
    });
  }

  function updateReadingState() {
    const scrollable = root.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0;
    if (progress) progress.style.transform = `scaleX(${ratio})`;
    if (backToTop) backToTop.classList.toggle('is-visible', window.scrollY > 640);
  }

  updateReadingState();
  window.addEventListener('scroll', updateReadingState, { passive: true });
  window.addEventListener('resize', updateReadingState, { passive: true });

  const tocLinks = [...document.querySelectorAll('.toc a[href^="#"]')];
  const sections = tocLinks
    .map(link => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    const sectionObserver = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      tocLinks.forEach(link => {
        const active = link.getAttribute('href') === `#${visible.target.id}`;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-20% 0px -65% 0px', threshold: [0.05, 0.25, 0.6] });
    sections.forEach(section => sectionObserver.observe(section));
  }

  const revealItems = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach(item => item.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealItems.forEach(item => revealObserver.observe(item));
  }
})();
