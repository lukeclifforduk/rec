// page-home.js — dashboard (anchor: Linear-dense, bento layout).
// Hero progress ring + savings projection chart + shortlist preview + journey step strip.
import { getFinances, getShortlist, getAreas, _internal } from './storage.js';
import { loadJSON } from './data-loader.js';
import * as fin from './finances.js';

const gbp = (n) => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
}).format(n || 0);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const $ = (id) => document.getElementById(id);
const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };

let chartInstance = null;
const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function renderHero(financesData) {
  const saved = financesData.savings?.totalSavings ?? financesData.savings?.current ?? 0;
  const target = financesData.goal?.targetDeposit || 0;
  const monthly = financesData.savings?.monthlyContribution || 0;
  const pct = fin.calcDepositProgress(saved, target);
  const monthsTo = fin.calcMonthsToTarget(saved, target, monthly);

  setText('hero-saved', gbp(saved));
  setText('hero-target', gbp(target));
  setText('hero-monthly', gbp(monthly) + '/mo');
  setText('ring-pct', String(pct));

  const bar = $('ring-bar');
  if (bar) {
    // pathLength="100" — offset directly maps to percentage.
    requestAnimationFrame(() => { bar.style.strokeDashoffset = String(100 - Math.min(pct, 100)); });
  }

  const window = financesData.goal?.movingWindow;
  if (monthsTo === Infinity || target === 0) {
    setText('hero-eta', window ? `Moving window: ${window}` : 'Set a deposit target on the Finances page.');
  } else {
    const eta = new Date();
    eta.setMonth(eta.getMonth() + monthsTo);
    const etaLabel = eta.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    const el = $('hero-eta');
    if (el) el.innerHTML = `Target in <strong class="num">${monthsTo} months</strong> · ${etaLabel}` +
                          (window ? ` · window <strong>${esc(window)}</strong>` : '');
  }
}

function renderSavingsChart(financesData) {
  const canvas = $('home-savings-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const start = financesData.savings?.totalSavings ?? financesData.savings?.current ?? 0;
  const monthly = financesData.savings?.monthlyContribution || 0;
  const target = financesData.goal?.targetDeposit || 0;
  const months = Math.max(12, Math.ceil(fin.calcMonthsToTarget(start, target, monthly) + 2) || 12);

  const projection = fin.projectSavings(start, monthly, months);
  const labels = projection.map((p) => `M+${p.month}`);
  const balances = projection.map((p) => p.balance);
  const targetLine = projection.map(() => target);

  const accent = cssVar('--accent');
  const ink = cssVar('--ink');
  const muted = cssVar('--ink-muted');
  const hairline = cssVar('--hairline');

  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Projected', data: balances,
          borderColor: accent,
          backgroundColor: `color-mix(in oklch, ${accent} 14%, transparent)`,
          borderWidth: 2, tension: 0.3, fill: true, pointRadius: 0, pointHoverRadius: 4,
        },
        {
          label: 'Target', data: targetLine,
          borderColor: muted, borderDash: [4, 6], borderWidth: 1.5, pointRadius: 0, fill: false,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: prefersReducedMotion() ? false : { duration: 450, easing: 'easeOutCubic' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: ink, titleColor: cssVar('--paper'), bodyColor: cssVar('--paper'),
          padding: 8, displayColors: false, callbacks: { label: (ctx) => gbp(ctx.parsed.y) },
        },
      },
      scales: {
        x: { ticks: { color: muted, maxTicksLimit: 6, font: { family: cssVar('--font-data'), size: 11 } }, grid: { display: false }, border: { color: hairline } },
        y: { ticks: { color: muted, callback: (v) => '£' + (v / 1000).toFixed(0) + 'k', font: { family: cssVar('--font-data'), size: 11 } }, grid: { color: hairline, drawTicks: false }, border: { display: false } },
      },
    },
  });

  const monthsTo = fin.calcMonthsToTarget(start, target, monthly);
  const monthsLabel = monthsTo === Infinity ? '—' : `${monthsTo} mo`;
  setText('home-savings-sub', `${gbp(start)} → ${gbp(target)} · +${gbp(monthly)}/mo · ${monthsLabel}`);
}

async function renderShortlist() {
  try {
    const shortlist = getShortlist();
    const areas = await getAreas();
    const items = shortlist.length
      ? areas.filter((a) => shortlist.includes(a.id))
      : areas.slice(0, 5);
    setText('sl-count', shortlist.length ? `${shortlist.length} ${shortlist.length === 1 ? 'area' : 'areas'}` : `${items.length} suggested`);
    const ul = $('home-areas');
    if (!ul) return;
    if (!items.length) {
      ul.innerHTML = '<li class="empty-note">No areas yet — open the Areas tab to browse.</li>';
      return;
    }
    ul.innerHTML = items.slice(0, 5).map((a, i) => `
      <li>
        <span class="sl-index num">${String(i + 1).padStart(2, '0')}</span>
        <span class="sl-name">
          <a href="pages/area-detail.html?id=${encodeURIComponent(a.id)}">${esc(a.name)}</a>
          <small class="sl-place">${esc(a.town || a.subRegion || a.county || '')}</small>
        </span>
        <span class="sl-meta">${esc(a.county || '')}</span>
      </li>
    `).join('');
  } catch (e) { console.error('shortlist tile error', e); }
}

async function renderJourney() {
  try {
    const data = await loadJSON('checklists');
    const state = _internal.readLocal('journey-checks') || { viewing: {}, process: {}, moving: {} };
    const sections = [
      { label: 'Viewing',         key: 'viewing', total: data.viewing?.length || 0 },
      { label: 'Buying process',  key: 'process', total: data.process?.length || 0 },
      { label: 'Moving',          key: 'moving',  total: data.moving?.length  || 0 },
    ];
    const html = sections.map((s, i) => {
      const done = Object.values(state[s.key] || {}).filter(Boolean).length;
      const pct = s.total ? Math.round((done / s.total) * 100) : 0;
      const cls = pct === 100 ? 'is-done' : (pct > 0 ? 'is-active' : '');
      return `
        <div class="step ${cls}">
          <span class="step-num">PHASE ${String(i + 1).padStart(2, '0')}</span>
          <div class="step-head">
            <span class="step-label">${esc(s.label)}</span>
            <span class="step-count num">${done} / ${s.total}</span>
          </div>
          <div class="step-bar"><span style="width:${pct}%"></span></div>
        </div>
      `;
    }).join('');
    $('home-journey').innerHTML = html;
  } catch (e) {
    console.error('journey tile error', e);
    $('home-journey').innerHTML = '<p class="empty-note">Failed to load journey.</p>';
  }
}

async function init() {
  try {
    const financesData = await getFinances();
    renderHero(financesData);
    renderSavingsChart(financesData);
  } catch (e) { console.error('finances error', e); }
  await renderShortlist();
  await renderJourney();
}

function ready(fn) {
  if (document.readyState === 'complete') fn();
  else window.addEventListener('load', fn, { once: true });
}
ready(init);
