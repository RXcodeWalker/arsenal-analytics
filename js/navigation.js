/* ===================================================
   ARSENAL ANALYTICS — NAVIGATION & UTILITIES
   =================================================== */

function applyStoredTheme() {
  const stored = localStorage.getItem('theme');
  if (stored === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function updateThemeToggleButton() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  btn.innerHTML = isLight ? '🌙 Dark' : '☀ Light';
  btn.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
  btn.setAttribute('title', isLight ? 'Switch to dark mode' : 'Switch to light mode');
}

function initThemeToggle() {
  const navActions = document.querySelector('.nav-actions');
  if (!navActions || document.getElementById('theme-toggle')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'theme-toggle';
  btn.className = 'theme-toggle';

  btn.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
    updateThemeToggleButton();
    const nav = document.querySelector('.nav');
    if (nav) {
      nav.style.background = window.scrollY > 40 ? 'var(--nav-bg-scrolled)' : 'var(--nav-bg)';
    }
  });

  navActions.prepend(btn);
  updateThemeToggleButton();
}

// Set active nav link based on current page
function setActiveNav() {
  const path = window.location.pathname;
  const links = document.querySelectorAll('.nav-link, .mobile-nav-link');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    const isHomeLink = href === '../index.html' || href === 'index.html' || href === 'home.html' || href === '../html/index.html' || href === '../html/home.html' || href === '/';
    const isHomePath = path.endsWith('index.html') || path.endsWith('home.html') || path === '/' || path.endsWith('/arsenal-site/');
    const isHome = isHomeLink && isHomePath;
    const isPage = href && path.includes(href.replace('../', '').replace('.html', ''));
    if (isHome || isPage) {
      link.classList.add('active');
    }
  });
}

// Mobile nav toggle
function initMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  if (!toggle || !mobileNav) return;

  toggle.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
    // Animate hamburger
    const spans = toggle.querySelectorAll('span');
    if (open) {
      spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    } else {
      spans[0].style.transform = '';
      spans[1].style.opacity = '';
      spans[2].style.transform = '';
    }
  });

  // Close on link click
  mobileNav.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
    });
  });
}

// Scroll-triggered nav background
function initNavScroll() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.style.background = window.scrollY > 40
      ? 'var(--nav-bg-scrolled)'
      : 'var(--nav-bg)';
  }, { passive: true });
}

// Animate elements on scroll
function initScrollAnimations() {
  const elements = document.querySelectorAll('.animate-up, [data-animate]');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'none';
        entry.target.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  elements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    observer.observe(el);
  });
}

// Counter animation for numbers
function animateCounter(el, target, duration = 1200, decimals = 0) {
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * eased;
    el.textContent = decimals > 0
      ? current.toFixed(decimals)
      : Math.round(current).toLocaleString();

    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// Animate all stat counters in view
function initStatCounters() {
  const counters = document.querySelectorAll('[data-count]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseFloat(el.dataset.count);
        const decimals = el.dataset.decimals ? parseInt(el.dataset.decimals) : 0;
        animateCounter(el, target, 1200, decimals);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.3 });

  counters.forEach(el => observer.observe(el));
}

// Progress bar animations
function initProgressBars() {
  const bars = document.querySelectorAll('.progress-fill[data-width]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        setTimeout(() => {
          el.style.width = el.dataset.width + '%';
        }, 200);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.2 });

  bars.forEach(bar => {
    bar.style.width = '0%';
    observer.observe(bar);
  });
}

// Tooltip system
function initTooltips() {
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  tooltip.id = 'global-tooltip';
  document.body.appendChild(tooltip);

  document.addEventListener('mouseover', e => {
    const target = e.target.closest('[data-tooltip]');
    if (target) {
      tooltip.textContent = target.dataset.tooltip;
      tooltip.classList.add('visible');
    }
  });

  document.addEventListener('mousemove', e => {
    tooltip.style.left = (e.clientX + 12) + 'px';
    tooltip.style.top  = (e.clientY - 30) + 'px';
  });

  document.addEventListener('mouseout', e => {
    if (e.target.closest('[data-tooltip]')) {
      tooltip.classList.remove('visible');
    }
  });
}

// Tab switcher
function initTabs(container) {
  if (!container) return;
  const tabs = container.querySelectorAll('.tab');
  const panels = container.querySelectorAll('[data-panel]');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.add('hidden'));
      tab.classList.add('active');
      const panel = container.querySelector(`[data-panel="${target}"]`);
      if (panel) panel.classList.remove('hidden');
    });
  });
}

// Format number helpers
const fmt = {
  num: (n, decimals = 0) => parseFloat(n).toFixed(decimals),
  pct: (n) => `${parseFloat(n).toFixed(1)}%`,
  xG:  (n) => parseFloat(n).toFixed(2),
};

// Fetch local JSON data
async function fetchData(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Data load error:', path, err);
    return null;
  }
}

// Form dots renderer
function renderForm(formArray) {
  return formArray.map(r => {
    const label = r === 1 ? 'W' : r === 0 ? 'D' : 'L';
    const cls = r === 1 ? 'w' : r === 0 ? 'd' : 'l';
    return `<span class="form-dot ${cls}">${label}</span>`;
  }).join('');
}

// Initialize everything
applyStoredTheme();

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  setActiveNav();
  initMobileNav();
  initNavScroll();
  initScrollAnimations();
  initStatCounters();
  initProgressBars();
  initTooltips();

  // Init all tab containers
  document.querySelectorAll('[data-tabs]').forEach(initTabs);
});
