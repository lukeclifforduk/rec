// page-home.js — populate the dashboard tiles + lists from the storage layer.
import { getFinances, getShortlist, getAreas } from './storage.js';

const gbp = (n) => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
}).format(n || 0);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const sum = (arr, f) => (arr || []).reduce((a, x) => a + (f(x) || 0), 0);
const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

async function init() {
  try {
    const fin = await getFinances();
    const saved = sum(fin.contributions, (c) => c.amount) + (fin.lisa?.bonusYTD || 0);
    const target = fin.goal?.targetDeposit || 0;
    const pct = target ? Math.min(100, Math.round((saved / target) * 100)) : 0;
    setText('tile-saved', gbp(saved));
    setText('tile-target', gbp(target));
    setText('tile-progress', `${pct}%`);
    setText('tile-target-sub', fin.goal?.targetDate ? `target ${fin.goal.targetDate}` : '');
    const bar = document.getElementById('progress-bar');
    if (bar) bar.style.width = `${pct}%`;
  } catch (e) { console.error('finances tile error', e); }

  try {
    const shortlist = getShortlist();
    setText('tile-shortlist', String(shortlist.length));
    const areas = await getAreas();
    const ul = document.getElementById('home-areas');
    if (ul) {
      const items = shortlist.length
        ? areas.filter((a) => shortlist.includes(a.id))
        : areas.slice(0, 5);
      ul.innerHTML = items.length
        ? items.map((a) => `<li><strong>${esc(a.name)}</strong> <span class="muted">· ${esc(a.county)}</span></li>`).join('')
        : '<li class="muted">No areas yet — open the Areas tab to start.</li>';
    }
  } catch (e) { console.error('areas tile error', e); }
}

init();
