// tests/fetch-listings.test.js — v3 L4 optimised-fetch helpers.
// Only the PURE pieces are exercised (no network): the learned search-spec is
// threaded into the Rightmove URL, the post-filter drops excluded types and
// stale listings, and learned-favourite outcodes are processed first.
import { buildSearchUrl, filterListingsBySpec, orderOutcodesByFocus } from '../tools/fetch-listings.mjs';

export async function register({ test, assert, assertEqual }) {
  const NOW = new Date('2026-05-31T00:00:00Z');

  test('fetch-listings: buildSearchUrl is plain L1 without a spec', () => {
    const url = buildSearchUrl('OUTCODE^123');
    assert(url.includes('locationIdentifier=OUTCODE%5E123'), 'carries the location id');
    assert(url.includes('maxDaysSinceAdded=3'), 'default 3-day cron overlap');
    assert(!url.includes('minPrice'), 'no learned price floor without a spec');
  });

  test('fetch-listings: a learned spec narrows the Apify query', () => {
    const spec = { recencyDays: 14, priceMin: 250000, priceMax: 450000, minBeds: 3, excludeTypes: [], focusOutcodes: [] };
    const url = buildSearchUrl('OUTCODE^123', spec);
    assert(url.includes('maxDaysSinceAdded=14'), 'recency window from spec');
    assert(url.includes('minPrice=250000'), 'price floor');
    assert(url.includes('maxPrice=450000'), 'price ceiling');
    assert(url.includes('minBedrooms=3'), 'bed minimum');
  });

  test('fetch-listings: post-filter drops excluded types but keeps undated listings', () => {
    const spec = { recencyDays: 14, excludeTypes: ['flat'] };
    const rows = [
      { rightmove_id: 'a', property_type: 'Detached', added_date: '2026-05-25' },  // recent, kept
      { rightmove_id: 'b', property_type: 'Flat', added_date: '2026-05-25' },       // excluded type
      { rightmove_id: 'c', property_type: 'Detached', added_date: '2026-01-01' },   // stale, dropped
      { rightmove_id: 'd', property_type: 'Detached', added_date: null },           // undated, kept
    ];
    const out = filterListingsBySpec(rows, spec, NOW).map((r) => r.rightmove_id);
    assert(out.includes('a'), 'recent in-type kept');
    assert(!out.includes('b'), 'excluded type dropped');
    assert(!out.includes('c'), 'stale dropped');
    assert(out.includes('d'), 'undated kept (cannot prove stale)');
  });

  test('fetch-listings: no spec is a pass-through filter', () => {
    const rows = [{ rightmove_id: 'a' }, { rightmove_id: 'b' }];
    assertEqual(filterListingsBySpec(rows, null, NOW).length, 2);
  });

  test('fetch-listings: focus outcodes are processed first, none dropped', () => {
    const ordered = orderOutcodesByFocus(['GU34', 'GU35', 'SO21', 'SP5'], { focusOutcodes: ['gu35', 'sp5'] });
    assertEqual(ordered.length, 4, 'lossless');
    assertEqual(ordered[0], 'GU35');
    assertEqual(ordered[1], 'SP5');
    assert(ordered.includes('GU34') && ordered.includes('SO21'), 'non-focus retained');
  });
}
