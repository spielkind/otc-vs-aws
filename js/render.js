// ===================================================
// render.js — DOM rendering, UI building, bottom sheet
// ===================================================

// CLI commands to highlight with <code> tags
const CLI_COMMANDS = /\b(rclone|pg_dump|pg_restore|mysqldump|mongoimport|mongoexport|kubectl|nerdctl|crictl|kompose|rabbitmqadmin)\b/gi;

/** Highlight CLI commands in text */
function highlightCode(text) {
  return text.replace(CLI_COMMANDS, '<code>$1</code>');
}

/** Format migration text into structured HTML */
function fmtMig(raw) {
  if (!raw) return '';

  const re = /\*\*(.+?)\*\*\.?\s*/g;
  let m, sections = [], last = 0;

  // Parse **Title** sections via matchAll
  while ((m = re.exec(raw))) {
    if (m.index > last) {
      const pre = raw.slice(last, m.index).trim();
      if (pre) {
        if (sections.length) sections[sections.length - 1].text = pre;
        else sections.push({ heading: '', text: pre });
      }
    }
    sections.push({ heading: m[1].replace(/\.$/, ''), text: '' });
    last = re.lastIndex;
  }

  // Capture remaining text after last title
  if (last < raw.length) {
    const rest = raw.slice(last).trim();
    if (rest) {
      if (sections.length) sections[sections.length - 1].text = rest;
      else sections.push({ heading: '', text: rest });
    }
  }

  if (!sections.length) sections.push({ heading: '', text: raw });

  // Build HTML
  let html = '<div class="mig-wrap">';
  sections.forEach(sec => {
    html += '<div class="mig-section">';
    if (sec.heading) html += '<div class="mig-title">' + sec.heading + '</div>';
    if (sec.text) {
      if (sec.text.includes('\n- ')) {
        const parts = sec.text.split(/\n- /);
        if (parts[0].trim()) html += '<div class="mig-text">' + highlightCode(parts[0].trim()) + '</div>';
        html += '<ul class="mig-ul">';
        for (let i = 1; i < parts.length; i++) {
          if (parts[i].trim()) html += '<li>' + highlightCode(parts[i].trim()) + '</li>';
        }
        html += '</ul>';
      } else {
        html += '<div class="mig-text">' + highlightCode(sec.text) + '</div>';
      }
    }
    html += '</div>';
  });
  return html + '</div>';
}

/** Localized field getter — supports nested {de, en} format */
function loc(s, field) {
  const val = s[field];
  if (!val) return null;
  if (typeof val === 'object') return val[state.lang] || val.de;
  return val; // backwards compat for plain strings
}

// ===================================================
// Header & Toolbar UI
// ===================================================

/** Update header links and labels for current language */
function updateHeaderLinks() {
  const t = T[state.lang];

  // External links
  const links = [
    { id: 'linkRoadmap', url: 'roadmapUrl', label: 'roadmapLabel', emoji: '🗺️' },
    { id: 'linkRelease', url: 'releaseUrl', label: 'releaseLabel', emoji: '📰' },
    { id: 'linkLeistung', url: 'leistungUrl', label: 'leistungLabel', emoji: '📋' }
  ];

  links.forEach(({ id, url, label, emoji }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.href = t[url];
    const span = el.querySelector('.h-btn-label');
    if (span) span.textContent = t[label].replace(new RegExp('^' + emoji + '\\s*'), '');
    else el.textContent = t[label];
  });

  // AI hint
  const ah = document.getElementById('aiHint');
  if (ah) ah.textContent = t.aiHint;
}

/** Build toolbar UI (pills, labels, counts) */
function buildUI() {
  const t = T[state.lang];
  const f = state.filters;

  // Subtitle
  document.getElementById('subtitle').textContent = t.sub.replace('{n}', state.services.length);

  // Effort labels
  document.getElementById('elbl').textContent = t.easy;
  document.getElementById('mlbl').textContent = t.med;
  document.getElementById('hlbl').textContent = t.hard;

  // Search placeholder
  document.getElementById('searchBox').placeholder = t.search;
  document.getElementById('sortLabel').textContent = t.sort;

  // Toggle button
  const bt = document.getElementById('btnToggle');
  const btl = bt ? bt.querySelector('.h-btn-label') : null;
  const toggleText = (state.allOpen ? t.closeAll : t.openAll).replace(/^[⊞⊟]\s*/, '');
  if (btl) btl.textContent = toggleText;
  else if (bt) bt.textContent = state.allOpen ? t.closeAll : t.openAll;

  // Category pills
  const cp = document.getElementById('catPills');
  const resetBtn = hasActiveFilters()
    ? `<button class="pill pill-reset" onclick="resetFilters();buildUI();render()">${t.reset}</button>`
    : '';
  cp.innerHTML = resetBtn + state.categories.map(c =>
    `<button class="pill${f.categories.includes(c) ? ' active' : ''}" data-cat="${c}">${c}</button>`
  ).join('');
  cp.querySelectorAll('.pill:not(.pill-reset)').forEach(b => {
    b.addEventListener('click', () => {
      b.blur();
      toggleArrayItem(f.categories, b.dataset.cat);
      buildUI(); render();
    });
  });

  // Equiv pills
  const ep = document.getElementById('equivPills');
  ep.innerHTML = [
    { k: 'full', cls: 'eq-full' }, { k: 'partial', cls: 'eq-partial' }, { k: 'none', cls: 'eq-none' }
  ].map(e =>
    `<button class="pill pill-eq ${e.cls}${f.equivs.includes(e.k) ? ' active' : ''}" data-eq="${e.k}">${t['eq' + e.k[0].toUpperCase() + e.k.slice(1)]}</button>`
  ).join('');
  ep.querySelectorAll('.pill-eq').forEach(b => {
    b.addEventListener('click', () => { toggleArrayItem(f.equivs, b.dataset.eq); buildUI(); render(); });
  });

  // TF pills
  const tp = document.getElementById('tfPills');
  tp.innerHTML = [
    { k: 'full', cls: 'tag-full' }, { k: 'partial', cls: 'tag-partial' }, { k: 'none', cls: 'tag-none' }
  ].map(e =>
    `<button class="pill pill-tf ${e.cls}${f.tfStatus.includes(e.k) ? ' active' : ''}" data-tf="${e.k}">${t['tf' + e.k[0].toUpperCase() + e.k.slice(1)]}</button>`
  ).join('');
  tp.querySelectorAll('.pill-tf').forEach(b => {
    b.addEventListener('click', () => { toggleArrayItem(f.tfStatus, b.dataset.tf); buildUI(); render(); });
  });

  // Effort pill active states (these are static in HTML, just toggle class)
  document.querySelectorAll('.toolbar .pill-eff').forEach(sp => {
    if (sp.classList.contains('eff-easy')) sp.classList.toggle('active', f.efforts.includes('easy'));
    if (sp.classList.contains('eff-med')) sp.classList.toggle('active', f.efforts.includes('medium'));
    if (sp.classList.contains('eff-hard')) sp.classList.toggle('active', f.efforts.includes('hard'));
  });

  // Scope pills
  const scopeP = document.getElementById('scopePills');
  scopeP.innerHTML = ['', 'K1', 'K2'].map(k =>
    `<button class="pill pill-scope${f.scope === k ? ' active' : ''}" data-scope="${k}">${k || 'Alle'}</button>`
  ).join('');
  scopeP.querySelectorAll('.pill-scope').forEach(b => {
    b.addEventListener('click', () => { f.scope = b.dataset.scope; buildUI(); render(); });
  });
}

// ===================================================
// Grid rendering
// ===================================================

/** Render the service grid */
function render() {
  const t = T[state.lang];
  const f = state.filters;
  const filtered = getSorted(getFiltered());
  const grid = document.getElementById('grid');

  pushFilterState();

  // Update filter badge
  const fb = document.getElementById('filterBadge');
  if (fb) fb.textContent = filterCount() || '';

  // Effort counts (based on all filters except effort)
  const base = getBaseFiltered();
  const ec = base.filter(s => s.effort === 'easy').length;
  const mc = base.filter(s => s.effort === 'medium').length;
  const hc = base.filter(s => s.effort === 'hard').length;
  document.getElementById('ecnt').textContent = ec;
  document.getElementById('mcnt').textContent = mc;
  document.getElementById('hcnt').textContent = hc;

  // Filter info text
  const fi = document.getElementById('filterInfo');
  fi.innerHTML = hasActiveFilters()
    ? `<b>${filtered.length}</b> ${state.lang === 'en' ? 'of' : 'von'} <b>${state.services.length}</b> Services`
    : '';

  // Render cards
  let lastCat = '';
  grid.innerHTML = filtered.map(s => {
    // Category header (when sorted by category)
    let catH = '';
    if (state.sortBy === 'category' && s.category !== lastCat) {
      const cc = filtered.filter(x => x.category === s.category).length;
      catH = `<div class="cat-header">${s.category} <span class="cat-count">(${cc})</span></div>`;
      lastCat = s.category;
    }

    // Localized fields
    const d = loc(s, 'desc') || '';
    const od = loc(s, 'otcDesc') || '';
    const alt = loc(s, 'alt');
    const mig = loc(s, 'migration');
    const eqNote = loc(s, 'equivNote') || '';
    const tfNote = loc(s, 'tfNote') || '';

    // Tags
    const isNoEquiv = s.equiv === 'none';
    const eTag = s.effort === 'easy' ? `<span class="tag tag-easy">${t.easy}</span>`
      : s.effort === 'medium' ? `<span class="tag tag-med">${t.med}</span>`
      : `<span class="tag tag-hard">${t.hard}</span>`;
    const otcTag = isNoEquiv ? '' : `<span class="tag tag-otc">→ ${s.otc}</span>`;
    const eqTag = s.equiv === 'full' ? `<span class="tag tag-eq-full">${t.eqFull}</span>`
      : s.equiv === 'partial' ? `<span class="tag tag-eq-partial"${eqNote ? ' title="' + eqNote.replace(/"/g, '&quot;') + '"' : ''}>${t.eqPartial}</span>`
      : `<span class="tag tag-eq-none">${t.eqNone}</span>`;
    const tsTag = s.tfStatus === 'full' ? '<span class="tag tag-full">TF ✓</span>'
      : s.tfStatus === 'partial' ? '<span class="tag tag-partial">TF ~</span>'
      : '<span class="tag tag-none">TF ✗</span>';

    // Links
    let links = '';
    if (s.docsAws) links += `<a href="${s.docsAws}" target="_blank" class="link-chip l-aws">AWS</a>`;
    if (s.docsOtc) links += `<a href="${s.docsOtc}" target="_blank" class="link-chip l-otc">OTC</a>`;
    if (s.tfDocsAws) links += `<a href="${s.tfDocsAws}" target="_blank" class="link-chip l-tf">TF:AWS</a>`;
    if (s.tfDocsOtc) links += `<a href="${s.tfDocsOtc}" target="_blank" class="link-chip l-tf">TF:OTC</a>`;

    // IDs
    const svcAnchor = s.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
    const migId = 'mig-' + svcAnchor;

    // Labels
    const tfLabel = state.lang === 'en' ? 'Terraform Resources' : 'Terraform Ressourcen';
    const migLabel = 'Details';
    const tsLabel = s.tfStatus === 'full' ? (state.lang === 'en' ? 'Fully supported' : 'Voll unterstützt')
      : s.tfStatus === 'partial' ? (state.lang === 'en' ? 'Partial' : 'Teilweise')
      : (state.lang === 'en' ? 'Not available' : 'Nicht verfügbar');

    return catH + `<div class="card ${s.effort}${isNoEquiv ? ' no-equiv' : ''}${state.allOpen ? ' expanded' : ''}" id="${svcAnchor}">` +
      `<div class="card-head" onclick="toggleCard(this)">` +
        `<div>` +
          `<div class="card-title"><span class="card-name">${s.name}</span></div>` +
          `<div class="card-meta">${[`<span class="tag tag-cat">${s.category}</span>`, otcTag, eqTag, eTag, tsTag].filter(Boolean).join('')}</div>` +
        `</div>` +
        `<span class="card-arrow">▼</span>` +
      `</div>` +
      `<div class="card-body"><div class="card-inner">` +
        `<div class="row"><span class="row-label">${t.desc}</span><span class="row-val">${d}</span></div>` +
        (isNoEquiv
          ? `<div class="row"><span class="row-label">${t.otcE}</span><span class="row-val"><b>${t.noEquiv}</b> — ${od}</span></div>`
          : `<div class="row"><span class="row-label">${t.otcE}</span><span class="row-val"><b>${s.otc}</b> — ${od}</span></div>`) +
        (eqNote ? `<div class="row row-eq-note"><span class="row-label">${t.eqPartial}</span><span class="row-val eq-note-text">⚠️ ${eqNote}</span></div>` : '') +
        (alt ? `<div class="row"><span class="row-label">${t.alt}</span><span class="row-val">${alt}</span></div>` : '') +
        `<div class="row"><span class="row-label">${tfLabel}</span><span class="row-val">` +
          `<div class="tf-row"><span class="tf-code">AWS: ${s.tfAws}</span><span class="tf-code">OTC: ${s.tfOtc || '—'}</span>` +
          `<span class="tag ${s.tfStatus === 'full' ? 'tag-full' : s.tfStatus === 'partial' ? 'tag-partial' : 'tag-none'}">${tsLabel}</span></div>` +
        `</span></div>` +
        (tfNote ? `<div class="row row-tf-note"><span class="row-label"></span><span class="row-val tf-note-text">⚠️ ${tfNote}</span></div>` : '') +
        `<div>` +
          `<button class="mig-toggle" onclick="toggleMigration(event, '${migId}')"><span class="mig-arrow">▼</span> ${migLabel}</button>` +
          `<div class="mig-content" id="${migId}"><div class="mig-box">${fmtMig(mig)}</div></div>` +
        `</div>` +
        `<div class="links-row">${links}</div>` +
        `<button class="svc-link" data-share="${svcAnchor}" title="${state.lang === 'en' ? 'Copy link' : 'Link kopieren'}">🔗</button>` +
      `</div></div>` +
    `</div>`;
  }).join('');
}

// ===================================================
// Bottom sheet (mobile filters)
// ===================================================

/** Toggle bottom sheet visibility */
function toggleSheet() {
  const sheet = document.getElementById('bottomSheet');
  const overlay = document.getElementById('sheetOverlay');
  const fab = document.getElementById('filterFab');
  const opening = !sheet.classList.contains('open');

  sheet.classList.toggle('open');
  overlay.classList.toggle('open');
  document.body.style.overflow = opening ? 'hidden' : '';

  if (fab) {
    fab.innerHTML = opening ? '✕' : '🔍 <span id="filterBadge"></span>';
    if (!opening) {
      const badge = document.getElementById('filterBadge');
      if (badge) badge.textContent = filterCount() || '';
    }
  }
}

/** Build bottom sheet filter pills */
function buildSheet() {
  const t = T[state.lang];
  const f = state.filters;
  const cats = state.categories;

  // Badge
  const badge = document.getElementById('filterBadge');
  if (badge) badge.textContent = filterCount() || '';

  // Scope
  const sp = document.getElementById('sheetScope');
  if (sp) sp.innerHTML = ['', 'K1', 'K2'].map(k =>
    `<button class="pill pill-scope${f.scope === k ? ' active' : ''}" onclick="state.filters.scope='${k}';buildUI();buildSheet();render()">${k || 'Alle'}</button>`
  ).join('');

  // Categories
  const sc = document.getElementById('sheetCats');
  if (sc) sc.innerHTML = cats.map(c =>
    `<button class="pill${f.categories.includes(c) ? ' active' : ''}" onclick="toggleArrayItem(state.filters.categories,'${c}');buildUI();buildSheet();render()">${c}</button>`
  ).join('');

  // Equiv
  const se = document.getElementById('sheetEquiv');
  if (se) se.innerHTML = [
    { k: 'full', l: t.eqFull, c: 'eq-full' },
    { k: 'partial', l: t.eqPartial, c: 'eq-partial' },
    { k: 'none', l: t.eqNone, c: 'eq-none' }
  ].map(e =>
    `<button class="pill pill-eq ${e.c}${f.equivs.includes(e.k) ? ' active' : ''}" onclick="toggleArrayItem(state.filters.equivs,'${e.k}');buildUI();buildSheet();render()">${e.l}</button>`
  ).join('');

  // TF
  const st = document.getElementById('sheetTf');
  if (st) st.innerHTML = [
    { k: 'full', l: t.tfFull, c: 'tag-full' },
    { k: 'partial', l: t.tfPartial, c: 'tag-partial' },
    { k: 'none', l: t.tfNone, c: 'tag-none' }
  ].map(e =>
    `<button class="pill pill-tf ${e.c}${f.tfStatus.includes(e.k) ? ' active' : ''}" onclick="toggleArrayItem(state.filters.tfStatus,'${e.k}');buildUI();buildSheet();render()">${e.l}</button>`
  ).join('');

  // Effort
  const sef = document.getElementById('sheetEffort');
  if (sef) sef.innerHTML = [
    { k: 'easy', l: t.easy, c: 'eff-easy' },
    { k: 'medium', l: t.med, c: 'eff-med' },
    { k: 'hard', l: t.hard, c: 'eff-hard' }
  ].map(e =>
    `<button class="pill pill-eff ${e.c}${f.efforts.includes(e.k) ? ' active' : ''}" onclick="toggleArrayItem(state.filters.efforts,'${e.k}');buildUI();buildSheet();render()">${e.l}</button>`
  ).join('');

  // Sort
  const ss = document.getElementById('sheetSort');
  if (ss) ss.innerHTML = [
    { k: 'name', l: 'A-Z' },
    { k: 'category', l: t.sortDef === 'Standard' ? 'Kategorie' : 'Category' },
    { k: 'effort', l: t.sortEff || 'Aufwand' }
  ].map(e =>
    `<button class="sort-btn${state.sortBy === e.k ? ' active' : ''}" onclick="state.sortBy='${e.k}';document.querySelectorAll('.sort-btn').forEach(x=>x.classList.remove('active'));this.classList.add('active');buildSheet();render()">${e.l}</button>`
  ).join('');

  // Labels
  const cl = document.getElementById('sheetCatLabel');
  if (cl) cl.textContent = state.lang === 'en' ? 'Category' : 'Kategorie';
  const el = document.getElementById('sheetEffLabel');
  if (el) el.textContent = state.lang === 'en' ? 'Effort' : 'Aufwand';
  const sl = document.getElementById('sheetSortLabel');
  if (sl) sl.textContent = state.lang === 'en' ? 'Sort' : 'Sortierung';
}
