// ===================================================
// state.js — Central application state
// ===================================================

const state = {
  services: [],       // All loaded services
  categories: [],     // Auto-generated from service data
  lang: localStorage.getItem('otc-lang') || (navigator.language && navigator.language.startsWith('de') ? 'de' : 'en'),
  sortBy: 'name',
  allOpen: false,
  filters: {
    categories: [],   // Active category filters (empty = show all)
    efforts: [],      // Active effort filters
    equivs: [],       // Active equivalence filters
    tfStatus: [],     // Active TF status filters
    scope: ''         // '' = all, 'K1', 'K2'
  }
};

// ===================================================
// URL <-> filter state sync
// ===================================================

/** Push current filter state to URL query params */
function pushFilterState() {
  const p = new URLSearchParams();
  const f = state.filters;

  if (f.categories.length) p.set('cat', f.categories.join(','));
  if (f.efforts.length) p.set('eff', f.efforts.join(','));
  if (f.equivs.length) p.set('eq', f.equivs.join(','));
  if (f.tfStatus.length) p.set('tf', f.tfStatus.join(','));
  if (f.scope) p.set('scope', f.scope);

  const q = document.getElementById('searchBox');
  if (q && q.value) p.set('q', q.value);
  if (state.sortBy !== 'name') p.set('sort', state.sortBy);
  if (state.lang !== 'de') p.set('lang', state.lang);

  const s = p.toString();
  const url = s ? location.pathname + '?' + s : location.pathname;
  history.replaceState(null, '', url + (location.hash || ''));
}

/** Load filter state from URL query params on page load */
function loadFilterState() {
  const p = new URLSearchParams(location.search);
  const f = state.filters;

  if (p.has('cat')) f.categories = p.get('cat').split(',').filter(Boolean);
  if (p.has('eff')) f.efforts = p.get('eff').split(',').filter(Boolean);
  if (p.has('eq')) f.equivs = p.get('eq').split(',').filter(Boolean);
  if (p.has('tf')) f.tfStatus = p.get('tf').split(',').filter(Boolean);
  if (p.has('scope')) f.scope = p.get('scope');
  if (p.has('q')) setTimeout(() => {
    const q = document.getElementById('searchBox');
    if (q) q.value = p.get('q');
  }, 0);
  if (p.has('sort')) state.sortBy = p.get('sort');
  if (p.has('lang')) state.lang = p.get('lang');
}

loadFilterState();
