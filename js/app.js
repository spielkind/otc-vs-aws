// ===================================================
// app.js — Init, event handlers, glue code
// ===================================================

// Card expand/collapse handler
function toggleCard(headEl) {
  const card = headEl.closest('.card');
  card.classList.toggle('expanded');
  if (card.classList.contains('expanded')) {
    history.replaceState(null, '', location.pathname + location.search + '#' + card.id);
  } else if (decodeURIComponent(location.hash.slice(1)) === card.id) {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

// Migration details toggle handler
function toggleMigration(event, migId) {
  event.stopPropagation();
  const content = document.getElementById(migId);
  content.classList.toggle('open');
  const arrow = event.currentTarget.querySelector('.mig-arrow');
  arrow.textContent = content.classList.contains('open') ? '▲' : '▼';
}

// Language switcher
function setLang(l) {
  state.lang = l;
  localStorage.setItem('otc-lang', l);
  document.querySelectorAll('.lang-btn').forEach(b =>
    b.classList.toggle('active', b.textContent === l.toUpperCase())
  );
  document.documentElement.lang = l;
  updateHeaderLinks();
  buildUI();
  buildSheet();
  render();
}

// Expand/collapse all cards
function toggleAll() {
  state.allOpen = !state.allOpen;
  const t = T[state.lang];
  const bt = document.getElementById('btnToggle');
  const btl = bt ? bt.querySelector('.h-btn-label') : null;
  const text = (state.allOpen ? t.closeAll : t.openAll).replace(/^[⊞⊟]\s*/, '');
  if (btl) btl.textContent = text;
  else if (bt) bt.textContent = state.allOpen ? t.closeAll : t.openAll;
  document.querySelectorAll('.card').forEach(c => {
    state.allOpen ? c.classList.add('expanded') : c.classList.remove('expanded');
  });
}

// Dark mode
const storedDark = localStorage.getItem('otc-dark');
let isDark = storedDark !== null
  ? storedDark === '1'
  : window.matchMedia('(prefers-color-scheme: dark)').matches;
if (isDark) document.body.classList.add('dark');

function toggleDark() {
  isDark = !isDark;
  document.body.classList.toggle('dark', isDark);
  localStorage.setItem('otc-dark', isDark ? '1' : '0');
  document.getElementById('btnDark').textContent = isDark ? '☀️' : '🌙';
}

if (isDark) document.getElementById('btnDark').textContent = '☀️';

// System theme change listener (only if no manual override)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (localStorage.getItem('otc-dark') === null) {
    isDark = e.matches;
    document.body.classList.toggle('dark', isDark);
    document.getElementById('btnDark').textContent = isDark ? '☀️' : '🌙';
  }
});

// ===================================================
// Event listeners
// ===================================================

// Search input
document.getElementById('searchBox').addEventListener('input', render);

// Sort buttons (desktop toolbar)
document.querySelectorAll('.sort-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.sort-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    state.sortBy = b.dataset.sort;
    render();
  });
});

// Effort pills (desktop toolbar)
document.querySelectorAll('.toolbar .pill-eff').forEach(p => {
  p.addEventListener('click', () => {
    let eff = null;
    if (p.classList.contains('eff-easy')) eff = 'easy';
    else if (p.classList.contains('eff-med')) eff = 'medium';
    else if (p.classList.contains('eff-hard')) eff = 'hard';
    if (eff) {
      toggleArrayItem(state.filters.efforts, eff);
      document.querySelectorAll('.toolbar .pill-eff').forEach(sp => {
        if (sp.classList.contains('eff-easy')) sp.classList.toggle('active', state.filters.efforts.includes('easy'));
        if (sp.classList.contains('eff-med')) sp.classList.toggle('active', state.filters.efforts.includes('medium'));
        if (sp.classList.contains('eff-hard')) sp.classList.toggle('active', state.filters.efforts.includes('hard'));
      });
      buildUI(); render();
    }
  });
});

// Date display
document.getElementById('genDate').textContent = new Date().toLocaleDateString();

// Back to top
window.addEventListener('scroll', () => {
  document.getElementById('backTop').classList.toggle('show', window.scrollY > 400);
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  // "/" to focus search
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    document.getElementById('searchBox').focus();
  }
  // Escape to close sheet or clear search
  if (e.key === 'Escape') {
    const bs = document.getElementById('bottomSheet');
    if (bs && bs.classList.contains('open')) { toggleSheet(); return; }
    document.getElementById('searchBox').value = '';
    document.getElementById('searchBox').blur();
    render();
  }
});

// Share button delegation
document.addEventListener('click', e => {
  const btn = e.target.closest('.svc-link');
  if (!btn) return;
  e.stopPropagation();
  const anchor = btn.dataset.share;
  if (!anchor) return;
  const url = location.origin + location.pathname + location.search + '#' + anchor;
  navigator.clipboard.writeText(url).then(() => {
    const toast = document.createElement('div');
    toast.className = 'share-toast';
    toast.textContent = state.lang === 'en' ? 'Link copied!' : 'Link kopiert!';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }).catch(() => {
    prompt(state.lang === 'en' ? 'Copy this link:' : 'Link kopieren:', url);
  });
});

// Sheet search sync
const sheetSearchEl = document.getElementById('sheetSearch');
if (sheetSearchEl) {
  sheetSearchEl.addEventListener('input', e => {
    document.getElementById('searchBox').value = e.target.value;
    render();
  });
}

// Sheet swipe-down to close
(function () {
  const sheet = document.getElementById('bottomSheet');
  if (!sheet) return;
  let startY = 0, currentY = 0, dragging = false;

  sheet.addEventListener('touchstart', function (e) {
    const handle = e.target.closest('.sheet-handle');
    if (!handle && sheet.scrollTop > 0) return;
    startY = e.touches[0].clientY;
    currentY = startY;
    dragging = true;
  }, { passive: true });

  sheet.addEventListener('touchmove', function (e) {
    if (!dragging) return;
    currentY = e.touches[0].clientY;
    const dy = currentY - startY;
    if (dy > 0) {
      sheet.style.transform = 'translateY(' + dy + 'px)';
      sheet.style.transition = 'none';
      e.preventDefault();
    }
  }, { passive: false });

  sheet.addEventListener('touchend', function () {
    if (!dragging) return;
    dragging = false;
    const dy = currentY - startY;
    sheet.style.transition = 'transform .3s ease';
    if (dy > 60) {
      toggleSheet();
      sheet.style.transform = '';
    } else {
      sheet.style.transform = '';
    }
  }, { passive: true });
})();

// Toolbar position fix
function fixToolbar() {
  const header = document.querySelector('.header');
  const toolbar = document.querySelector('.toolbar');
  if (header && toolbar) toolbar.style.top = header.offsetHeight + 'px';
}
fixToolbar();
window.addEventListener('resize', fixToolbar);

// ===================================================
// Load services and init
// ===================================================
(async () => {
  const grid = document.getElementById('grid');
  grid.innerHTML = '<div style="text-align:center;padding:2rem;color:#999"><div style="font-size:2rem;margin-bottom:.5rem">⏳</div>Lade Services...</div>';

  try {
    const cb = '?v=' + Date.now();
    const idx = await fetch('services/index.json' + cb).then(r => r.json());
    const all = await Promise.all(idx.map(f => fetch('services/' + f + cb).then(r => r.json())));
    state.services = all.flat();
  } catch (e) {
    console.error('Failed to load services:', e);
    grid.innerHTML = '<div style="text-align:center;padding:2rem;color:#dc3545">❌ Fehler beim Laden der Services</div>';
    return;
  }

  // Auto-generate categories
  state.categories = [...new Set(state.services.map(s => s.category))].sort();

  // Init UI
  setLang(state.lang);
  buildSheet();

  // Scroll to anchor if present
  if (location.hash) {
    const id = decodeURIComponent(location.hash.slice(1));
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('expanded');
        const hdr = document.querySelector('.header');
        const tb = document.querySelector('.toolbar');
        const offset = (hdr ? hdr.offsetHeight : 0) + (tb ? tb.offsetHeight : 0) + 12;
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }, 300);
  }
})();
