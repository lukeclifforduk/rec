// page-profile.js — render the buyer profile, with an edit/save flow
// that overlays user edits into localStorage via storage.js.
import { getProfile, saveProfile, getCriteria, getFinances, _internal } from './storage.js';
import { loadJSON } from './data-loader.js';

const gbp = (n) => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
}).format(n || 0);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const $ = (id) => document.getElementById(id);

// --- state ---
let current = null;     // currently-rendered profile object
let baseline = null;    // last-saved snapshot (for Cancel)
let editing = false;

// --- helpers ---
function listView(arr) {
  if (!arr?.length) return '<p class="muted mb-0">None added.</p>';
  return `<ul class="mini-list">${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
}

function listEdit(arr, fieldId) {
  const items = (arr || []).map((x, i) => `
    <li class="edit-row">
      <span>${esc(x)}</span>
      <button type="button" class="outline secondary chip-x" data-remove="${fieldId}" data-index="${i}" aria-label="Remove">×</button>
    </li>
  `).join('');
  return `
    <ul class="edit-list" id="list-${fieldId}">${items}</ul>
    <div class="row add-row">
      <input type="text" id="add-${fieldId}" placeholder="Add…" />
      <button type="button" data-add="${fieldId}">Add</button>
    </div>
  `;
}

function fieldView(label, value) {
  return `<div class="field-view"><dt>${esc(label)}</dt><dd>${value ? esc(value) : '<span class="muted">—</span>'}</dd></div>`;
}

function fieldEdit(label, name, value, type = 'text') {
  const id = `f-${name}`;
  const input = type === 'textarea'
    ? `<textarea id="${id}" name="${name}" rows="4">${esc(value)}</textarea>`
    : `<input type="text" id="${id}" name="${name}" value="${esc(value)}" />`;
  return `<div class="field-edit"><label for="${id}">${esc(label)}</label>${input}</div>`;
}

// --- rendering ---
function renderTiles(criteria, finances) {
  const max = criteria?.budget?.max || 0;
  const dep = criteria?.budget?.targetDeposit || 0;
  const saved = finances?.savings?.totalSavings ?? finances?.savings?.current ?? 0;
  $('tile-budget').textContent = gbp(max);
  $('tile-deposit').textContent = gbp(dep);
  $('tile-saved').textContent = gbp(saved);
  $('tile-window').textContent = current?.movingTimeline || '—';
}

function renderHeadline() {
  const el = $('card-headline');
  if (editing) {
    el.innerHTML = `
      <h2>Headline</h2>
      ${fieldEdit('One-line summary of what you\'re looking for', 'headline', current.headline, 'textarea')}
    `;
  } else {
    el.innerHTML = `
      <h2>Headline</h2>
      <p class="lead">${esc(current.headline) || '<span class="muted">—</span>'}</p>
    `;
  }
}

function renderBuyer() {
  const el = $('card-buyer');
  const items = [
    ['Buyers', 'buyers', current.buyers],
    ['Household', 'household', current.household],
    ['Employment', 'employment', current.employment],
    ['Credit profile', 'creditProfile', current.creditProfile],
  ];
  if (editing) {
    el.innerHTML = `<h2>Who's buying</h2>${items.map(([l, n, v]) => fieldEdit(l, n, v)).join('')}`;
  } else {
    el.innerHTML = `<h2>Who's buying</h2><dl class="field-list">${items.map(([l, , v]) => fieldView(l, v)).join('')}</dl>`;
  }
}

function renderLifestyle() {
  const el = $('card-lifestyle');
  const items = [
    ['Lifestyle', 'lifestyle', current.lifestyle],
    ['Location focus', 'locationFocus', current.locationFocus],
    ['Moving timeline', 'movingTimeline', current.movingTimeline],
  ];
  if (editing) {
    el.innerHTML = `<h2>How we want to live</h2>${items.map(([l, n, v]) => fieldEdit(l, n, v)).join('')}`;
  } else {
    el.innerHTML = `<h2>How we want to live</h2><dl class="field-list">${items.map(([l, , v]) => fieldView(l, v)).join('')}</dl>`;
  }
}

function renderArrayCard(cardId, title, fieldKey) {
  const el = $(cardId);
  const arr = current[fieldKey] || [];
  if (editing) {
    el.innerHTML = `<h2>${esc(title)}</h2>${listEdit(arr, fieldKey)}`;
  } else {
    el.innerHTML = `<h2>${esc(title)}</h2>${listView(arr)}`;
  }
}

function renderNotes() {
  const el = $('card-notes');
  if (editing) {
    el.innerHTML = `<h2>Notes</h2>${fieldEdit('Free-form notes', 'notes', current.notes, 'textarea')}`;
  } else {
    el.innerHTML = `<h2>Notes</h2><p class="mb-0">${esc(current.notes) || '<span class="muted">—</span>'}</p>`;
  }
}

function renderAll() {
  renderHeadline();
  renderBuyer();
  renderLifestyle();
  renderArrayCard('card-priorities', 'Priorities', 'priorities');
  renderArrayCard('card-dealbreakers', 'Deal-breakers', 'dealBreakers');
  renderNotes();
  refreshActionButtons();
  refreshOverlayBadge();
  if (editing) attachEditHandlers();
}

function refreshActionButtons() {
  $('btn-edit').hidden = editing;
  $('btn-save').hidden = !editing;
  $('btn-cancel').hidden = !editing;
}

function refreshOverlayBadge() {
  const overlay = _internal.readLocal('profile');
  const badge = $('overlay-badge');
  const reset = $('btn-reset');
  const has = !!overlay;
  badge.hidden = !has;
  reset.hidden = !has || editing;
}

// --- edit handlers ---
function attachEditHandlers() {
  // Text/textarea fields are read on Save (collectForm), no per-keystroke handler.

  // Array field × buttons:
  document.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.remove;
      const i = Number(btn.dataset.index);
      current[field].splice(i, 1);
      renderArrayCard(cardIdFor(field), titleFor(field), field);
      attachEditHandlers();
    });
  });

  // Array field Add inputs/buttons:
  document.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.add;
      const input = $(`add-${field}`);
      const v = input.value.trim();
      if (!v) return;
      current[field] = current[field] || [];
      current[field].push(v);
      input.value = '';
      renderArrayCard(cardIdFor(field), titleFor(field), field);
      attachEditHandlers();
    });
  });

  // Enter on Add input fires Add.
  document.querySelectorAll('input[id^="add-"]').forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const field = input.id.replace(/^add-/, '');
        document.querySelector(`[data-add="${field}"]`)?.click();
      }
    });
  });
}

function cardIdFor(field) {
  return field === 'priorities' ? 'card-priorities' : 'card-dealbreakers';
}
function titleFor(field) {
  return field === 'priorities' ? 'Priorities' : 'Deal-breakers';
}

function collectForm() {
  const next = { ...current };
  ['headline', 'buyers', 'household', 'employment', 'creditProfile',
   'lifestyle', 'locationFocus', 'movingTimeline', 'notes'].forEach((name) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (el) next[name] = el.value.trim();
  });
  next.priorities = current.priorities ? [...current.priorities] : [];
  next.dealBreakers = current.dealBreakers ? [...current.dealBreakers] : [];
  return next;
}

// --- mode transitions ---
function enterEdit() {
  baseline = JSON.parse(JSON.stringify(current));
  editing = true;
  renderAll();
  setStatus('Editing — Save to persist locally.');
}

function cancelEdit() {
  current = JSON.parse(JSON.stringify(baseline));
  editing = false;
  renderAll();
  setStatus('Edit cancelled.');
}

function saveEdit() {
  const next = collectForm();
  current = next;
  saveProfile(current);
  editing = false;
  renderAll();
  setStatus('Saved locally.', 'ok');
}

async function resetToDefaults() {
  if (!confirm('Reset profile to the repo defaults? Your local edits will be cleared.')) return;
  localStorage.removeItem('rec:profile');
  current = await loadJSON('profile');
  renderAll();
  const fin = await getFinances();
  const crit = await getCriteria();
  renderTiles(crit, fin);
  setStatus('Reset to repo defaults.', 'ok');
}

function setStatus(msg, kind = '') {
  const el = $('status');
  el.textContent = msg;
  el.dataset.kind = kind;
}

// --- init ---
async function init() {
  try {
    current = await getProfile();
    const fin = await getFinances();
    const crit = await getCriteria();
    renderTiles(crit, fin);
    renderAll();
  } catch (e) {
    console.error('profile init error', e);
    setStatus('Failed to load profile data.', 'err');
    return;
  }

  $('btn-edit').addEventListener('click', enterEdit);
  $('btn-cancel').addEventListener('click', cancelEdit);
  $('btn-save').addEventListener('click', saveEdit);
  $('btn-reset').addEventListener('click', resetToDefaults);
}

init();
