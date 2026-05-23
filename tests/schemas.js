// schemas.js — tiny JSON shape validators. Each returns an array of error strings ([] = valid).
const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

function check(errors, cond, msg) { if (!cond) errors.push(msg); }

export function validateProfile(o) {
  const e = [];
  check(e, typeOf(o) === 'object', 'profile must be an object');
  if (typeOf(o) !== 'object') return e;
  check(e, typeOf(o.priorities) === 'array', 'profile.priorities must be an array');
  check(e, typeOf(o.dealBreakers) === 'array', 'profile.dealBreakers must be an array');
  check(e, 'locationFocus' in o, 'profile.locationFocus missing');
  return e;
}

export function validateCriteria(o) {
  const e = [];
  check(e, typeOf(o) === 'object', 'criteria must be an object');
  if (typeOf(o) !== 'object') return e;
  check(e, typeOf(o.budget) === 'object', 'criteria.budget must be an object');
  check(e, typeOf(o.size) === 'object', 'criteria.size must be an object');
  check(e, typeOf(o.propertyTypes) === 'array', 'criteria.propertyTypes must be an array');
  check(e, typeOf(o.mustHaves) === 'array', 'criteria.mustHaves must be an array');
  check(e, typeOf(o.niceToHaves) === 'array', 'criteria.niceToHaves must be an array');
  return e;
}

export function validateAreas(arr) {
  const e = [];
  check(e, typeOf(arr) === 'array', 'areas must be an array');
  if (typeOf(arr) !== 'array') return e;
  arr.forEach((a, i) => {
    check(e, typeOf(a.id) === 'string', `areas[${i}].id must be a string`);
    check(e, typeOf(a.name) === 'string', `areas[${i}].name must be a string`);
    check(e, typeOf(a.county) === 'string', `areas[${i}].county must be a string`);
    check(e, typeOf(a.town) === 'string', `areas[${i}].town must be a string`);
    check(e, typeOf(a.postcode) === 'string', `areas[${i}].postcode must be a string`);
    const c = a.coords;
    check(e, c === null || (typeOf(c) === 'object' && typeof c.lat === 'number' && typeof c.lng === 'number'),
      `areas[${i}].coords must be null or have numeric lat/lng`);
    check(e, typeOf(a.images) === 'array', `areas[${i}].images must be an array`);
    check(e, typeOf(a.houseTypeIds) === 'array', `areas[${i}].houseTypeIds must be an array`);
  });
  return e;
}

export function validateHouseTypes(arr) {
  const e = [];
  check(e, typeOf(arr) === 'array', 'house-types must be an array');
  if (typeOf(arr) !== 'array') return e;
  arr.forEach((h, i) => {
    check(e, typeOf(h.id) === 'string', `house-types[${i}].id must be a string`);
    check(e, typeOf(h.name) === 'string', `house-types[${i}].name must be a string`);
    check(e, typeOf(h.description) === 'string', `house-types[${i}].description must be a string`);
    check(e, typeOf(h.images) === 'array', `house-types[${i}].images must be an array`);
  });
  return e;
}

export function validateFinances(o) {
  const e = [];
  check(e, typeOf(o) === 'object', 'finances must be an object');
  if (typeOf(o) !== 'object') return e;
  check(e, typeOf(o.income) === 'object', 'finances.income must be an object');
  check(e, typeOf(o.goal) === 'object', 'finances.goal must be an object');
  check(e, typeof o.goal?.targetDeposit === 'number', 'finances.goal.targetDeposit must be a number');
  check(e, typeOf(o.savings) === 'object', 'finances.savings must be an object');
  check(e, typeOf(o.oneTimeCosts) === 'array', 'finances.oneTimeCosts must be an array');
  check(e, typeOf(o.ongoingBills) === 'array', 'finances.ongoingBills must be an array');
  check(e, typeOf(o.expenses) === 'array', 'finances.expenses must be an array');
  check(e, typeOf(o.shoppingList) === 'array', 'finances.shoppingList must be an array');
  check(e, typeOf(o.giftCards) === 'array', 'finances.giftCards must be an array');
  return e;
}

export function validateChecklists(o) {
  const e = [];
  check(e, typeOf(o) === 'object', 'checklists must be an object');
  if (typeOf(o) !== 'object') return e;
  check(e, typeOf(o.viewing) === 'array', 'checklists.viewing must be an array');
  check(e, typeOf(o.process) === 'array', 'checklists.process must be an array');
  check(e, typeOf(o.moving) === 'array', 'checklists.moving must be an array');
  return e;
}
