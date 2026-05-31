// tests/meta-observations.test.js — v3 L5 recommendation-loop core.
// Covers the 3-condition conflict trigger (and that it stays off noise), the
// 14-day dismissal, each conflict kind, and the next-best-action computation.
import {
  detectConflicts, dismissUntil, computeNextBestActions,
} from '../assets/js/meta-observations.js';
import { META_OBS } from '../assets/js/intelligence-constants.js';

export async function register({ test, assert, assertEqual }) {
  const DAY = 86_400_000;
  const NOW = new Date('2026-05-31T00:00:00Z');
  const ago = (days) => new Date(NOW.getTime() - days * DAY).toISOString();

  const criteria = {
    budget: { max: 400_000 },
    size: { minBeds: 3 },
    propertyTypePrefs: { excluded: ['Flat / Apartment', 'Park / Mobile Home'] },
  };

  const like = (over = {}, days = 1, id = Math.random().toString(36).slice(2)) => ({
    id, listing_id: id, reaction: 'like', created_at: ago(days),
    listing_snapshot: { price: 350_000, beds: 4, property_type: 'Detached', ...over },
  });
  const many = (n, over = {}, days = 1) =>
    Array.from({ length: n }, (_, i) => like(over, days, `l-${JSON.stringify(over)}-${i}`));

  // ── 3-condition trigger ─────────────────────────────────────────────────
  test('meta-obs: an over-budget pattern fires when all 3 conditions hold', () => {
    // 4 over-budget likes + 1 in-budget → count 4 ≥ 3, share 0.8 ≥ 0.6, recent.
    const reactions = [...many(4, { price: 460_000 }), like({ price: 380_000 })];
    const conflicts = detectConflicts(reactions, criteria, { now: NOW });
    const c = conflicts.find((x) => x.kind === 'over-budget');
    assert(c, 'over-budget conflict raised');
    assertEqual(c.count, 4);
    assert(c.share >= 0.6, `share ${c.share}`);
  });

  test('meta-obs: a single outlier does NOT fire (share + count guards)', () => {
    const reactions = [like({ price: 460_000 }), ...many(6, { price: 360_000 })];
    const conflicts = detectConflicts(reactions, criteria, { now: NOW });
    assert(!conflicts.some((c) => c.kind === 'over-budget'), 'one outlier is noise, not a conflict');
  });

  test('meta-obs: a stale-only pattern does NOT fire (recency condition)', () => {
    const reactions = many(5, { price: 460_000 }, 120); // all 120 days old
    const conflicts = detectConflicts(reactions, criteria, { now: NOW });
    assert(!conflicts.some((c) => c.kind === 'over-budget'), 'stale pattern suppressed');
  });

  test('meta-obs: pass/reject are never counted as a like conflict', () => {
    const reactions = many(5, { price: 460_000 }).map((r) => ({ ...r, reaction: 'pass' }));
    assertEqual(detectConflicts(reactions, criteria, { now: NOW }).length, 0);
  });

  // ── kinds ───────────────────────────────────────────────────────────────
  test('meta-obs: excluded-type conflict fires on repeated liked exclusions', () => {
    const reactions = many(3, { property_type: 'Flat / Apartment' });
    const c = detectConflicts(reactions, criteria, { now: NOW }).find((x) => x.kind === 'excluded-type');
    assert(c, 'excluded-type conflict raised');
    assert(/flat/i.test(c.message), 'names the type');
  });

  test('meta-obs: below-min-beds conflict fires under the bed minimum', () => {
    const reactions = many(3, { beds: 2 });
    const c = detectConflicts(reactions, criteria, { now: NOW }).find((x) => x.kind === 'below-min-beds');
    assert(c, 'below-min-beds conflict raised');
    assert(c.threshold === 3, 'carries the minimum');
  });

  // ── dismissal ───────────────────────────────────────────────────────────
  test('meta-obs: a dismissed conflict stays quiet, then returns after the window', () => {
    const reactions = many(4, { price: 460_000 });
    const dismissals = { 'conflict:over-budget': dismissUntil(NOW, META_OBS.DISMISS_DAYS) };
    const quiet = detectConflicts(reactions, criteria, { now: NOW, dismissals });
    assert(!quiet.some((c) => c.kind === 'over-budget'), 'dismissed within window');
    const later = new Date(NOW.getTime() + (META_OBS.DISMISS_DAYS + 1) * DAY);
    const back = detectConflicts(reactions, criteria, { now: later, dismissals });
    assert(back.some((c) => c.kind === 'over-budget'), 'returns after the dismissal window');
  });

  // ── next-best-action ──────────────────────────────────────────────────────
  test('meta-obs: cold start surfaces the "start training" action first', () => {
    const nba = computeNextBestActions({ reactions: {}, listings: [], statuses: {}, now: NOW });
    assertEqual(nba[0].key, 'nba:start');
  });

  test('meta-obs: NBA counts un-reviewed strong matches and saved-unviewed homes', () => {
    const listings = [
      { rightmove_id: 'a', added_date: '2026-05-28' },
      { rightmove_id: 'b', added_date: '2026-05-28' },
      { rightmove_id: 'c', added_date: '2026-01-01' }, // stale → not counted
    ];
    const scoreOf = (l) => ({ verdict: l.rightmove_id === 'c' ? 'strong' : 'strong', gated: false });
    const nba = computeNextBestActions({
      reactions: { z: { reaction: 'like' } }, // non-empty → not cold start
      listings, statuses: { x: 'saved', y: 'saved', w: 'viewed' }, scoreOf, now: NOW,
    });
    const strong = nba.find((a) => a.key === 'nba:strong');
    const saved = nba.find((a) => a.key === 'nba:saved');
    assert(strong && /2 un-reviewed strong/.test(strong.text), `strong: ${strong && strong.text}`);
    assert(saved && /2 saved/.test(saved.text), `saved: ${saved && saved.text}`);
    assert(nba.length <= META_OBS.NBA_MAX, 'capped at NBA_MAX');
  });
}
