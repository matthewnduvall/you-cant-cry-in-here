// How a weight is physically loaded, and what weights real plates can make.
//
// Standard plates go down to 1.25 lb. On anything loaded on both sides (barbell, trap bar, Smith bar, EZ bar,
// plate-loaded machines) the smallest change is therefore 2.5 lb (a 1.25 on each side): every weight there is the bar
// + a multiple of 2.5 lb. Weights the plates can't make (113.75 on a barbell would need 0.625 lb a side) are never
// suggested or kept: they are snapped to the nearest loadable weight (snapToLoadableWeight, snapSlotToPlates).

import { EXERCISE_MAP, getExerciseEquipmentOptions } from '../data/exerciseLibrary';

export const BARBELL_WEIGHT_LBS = 45;
export const EZ_BAR_WEIGHT_LBS = 17;
export const AVAILABLE_LB_PLATES = [45, 35, 25, 10, 5, 2.5, 1.25];
export const SMALLEST_PLATE_LBS = 1.25;

/**
 * How a weight is loaded for the exercise's equipment:
 * - barbell / Smith / trap bar: 45 lb bar + plates on both sides; EZ bar: 17 lb bar + plates on both sides
 * - plate-loaded machines (Lever / Sled "plate loaded"): plates on both sides, no bar
 * - everything else (dumbbells, kettlebells, cable and selectorized stacks, machines, landmine, plates, weighted
 *   bodyweight): the picked weights ARE the total (no bar, not doubled)
 * `equipment` is the athlete's equipment choice for an exercise that allows several ("Barbell / EZ Bar");
 * without one, the exercise's first equipment option is used.
 */
export const getLoadSetup = (exerciseId, equipment) => {
  const eq = String(equipment || getExerciseEquipmentOptions(EXERCISE_MAP[exerciseId])[0] || '').toLowerCase();
  if (eq.includes('dumbbell')) return { singleLoad: true, barWeight: 0, barLabel: 'Dumbbell' };
  if (eq.includes('kettlebell')) return { singleLoad: true, barWeight: 0, barLabel: 'Kettlebell' };
  if (/\bez\b|ez[- ]?bar/.test(eq)) return { singleLoad: false, barWeight: EZ_BAR_WEIGHT_LBS, barLabel: 'EZ bar' };
  if (eq.includes('barbell') || eq.includes('trap bar')) {
    return { singleLoad: false, barWeight: BARBELL_WEIGHT_LBS, barLabel: 'Barbell' };
  }
  if (eq.includes('smith')) return { singleLoad: false, barWeight: BARBELL_WEIGHT_LBS, barLabel: 'Smith bar' };
  if (eq.includes('plate loaded')) return { singleLoad: false, barWeight: 0, barLabel: 'Plate-loaded machine' };
  if (eq.includes('landmine')) return { singleLoad: true, barWeight: 0, barLabel: 'Landmine' };
  if (/cable|lever|machine|selectorized|sled/.test(eq)) return { singleLoad: true, barWeight: 0, barLabel: 'Machine stack' };
  return { singleLoad: true, barWeight: 0, barLabel: 'Weight' };
};

// ---------------------------------------------------------------------------------------------------------------
// The athlete's plates (Configuration → EQUIPMENT → PLATES; settings.plateInventory): { [size]: plates owned } in
// total (a pair = one on each side), or false = turned off (standard plates, as many as needed). Not set yet
// (null / undefined) = ON with a standard 300 lb set's plates (DEFAULT_PLATE_INVENTORY). Both-sided loads use
// only these: per side, half of each size (rounded down). Single loads (dumbbells, stacks…) are unaffected. Set once
// per render by page.js (setPlateInventory), like the engine's bodyweight.
// ---------------------------------------------------------------------------------------------------------------
export const PLATE_SIZES = [55, 45, 35, 25, 15, 10, 5, 2.5, 1.25];
/**
 * The default: the plates in a standard 300 lb Olympic set (with its 45 lb bar): 2 × 45, 2 × 35, 2 × 25, 2 × 10,
 * 4 × 5 and 2 × 2.5 (255 lb of plates), no 1.25s.
 */
export const DEFAULT_PLATE_INVENTORY = { 55: 0, 45: 2, 35: 2, 25: 2, 15: 0, 10: 2, 5: 4, 2.5: 2, 1.25: 0 };

/**
 * A saved setting cleaned up: false = off (kept as false); an object = known sizes, whole non-negative counts;
 * anything else (not set yet) = the default 300 lb set.
 */
export const normalizePlateInventory = value => {
  if (value === false) return false;
  if (!value || typeof value !== 'object') return { ...DEFAULT_PLATE_INVENTORY };
  const out = {};
  PLATE_SIZES.forEach(size => {
    const n = Math.floor(Number(value[size]));
    out[size] = Number.isFinite(n) && n > 0 ? Math.min(n, 99) : 0;
  });
  return out;
};

let PLATE_INVENTORY = null;
export const setPlateInventory = inventory => {
  const v = normalizePlateInventory(inventory);
  PLATE_INVENTORY = v === false ? null : v;
};
export const getPlateInventory = () => PLATE_INVENTORY;

/** Plates available per side for a load: [{ size, perSide }] largest first (null = unlimited standard plates). */
export const plateLimitsFor = setup => {
  if (!setup || setup.singleLoad || !PLATE_INVENTORY) return null;
  return PLATE_SIZES.map(size => ({ size, perSide: Math.floor((PLATE_INVENTORY[size] || 0) / 2) })).filter(p => p.perSide > 0);
};

// Every per-side sum the counted plates can make (in 0.25 lb units), with one plate that reaches it, worked out once
// per inventory: lets a target snap to the nearest sum the plates really make.
const UNIT = 0.25;
let reachCache = { key: null, via: null, max: 0 };
const reachableSums = limits => {
  const key = JSON.stringify(limits);
  if (reachCache.key === key) return reachCache;
  const max = limits.reduce((n, p) => n + Math.round(p.size / UNIT) * p.perSide, 0);
  const via = new Array(max + 1).fill(-1); // plate size (units) last added to reach this sum; 0 for the empty side
  via[0] = 0;
  limits.forEach(p => {
    const u = Math.round(p.size / UNIT);
    for (let k = 0; k < p.perSide; k += 1) {
      for (let s = max; s >= u; s -= 1) if (via[s] === -1 && via[s - u] !== -1) via[s] = u;
    }
  });
  reachCache = { key, via, max };
  return reachCache;
};

/** One side's plates (largest first) for a per-side target, within the limits; the nearest sum they can make. */
const limitedPlatesPerSide = (target, limits) => {
  const { via, max } = reachableSums(limits);
  const t = Math.max(0, Math.min(max, Math.round(target / UNIT)));
  let best = -1;
  for (let d = 0; d <= max && best < 0; d += 1) {
    if (t + d <= max && via[t + d] !== -1) best = t + d;
    else if (t - d >= 0 && via[t - d] !== -1) best = t - d;
  }
  if (best <= 0) return [];
  // Largest plates first within the limits (fewest plates); the table's path if that can't hit the sum exactly
  let remaining = best;
  const greedy = [];
  limits.forEach(p => {
    const u = Math.round(p.size / UNIT);
    for (let k = 0; k < p.perSide && remaining >= u; k += 1) {
      greedy.push(p.size);
      remaining -= u;
    }
  });
  if (remaining === 0) return greedy;
  const path = [];
  for (let s = best; s > 0; s -= via[s]) path.push(via[s] * UNIT);
  return path.sort((a, b) => b - a);
};

/**
 * The plates for one side (both-sided loads) or the picked weights (single loads) that make `weight`, largest
 * first, after snapping it to what plates can make (only the athlete's counted plates on both-sided loads, when
 * they count them; past what they own, the most they can load). Never leaves a remainder.
 */
export const platesForLoad = (weight, setup) => {
  const mult = setup.singleLoad ? 1 : 2;
  const limits = plateLimitsFor(setup);
  if (limits) return limitedPlatesPerSide(Math.max(0, (Number(weight) || 0) - setup.barWeight) / mult, limits);
  const perSide = Math.round(Math.max(0, (Number(weight) || 0) - setup.barWeight) / mult / SMALLEST_PLATE_LBS) * SMALLEST_PLATE_LBS;
  let remaining = perSide;
  const plates = [];
  AVAILABLE_LB_PLATES.forEach(plate => {
    while (remaining >= plate - 0.001) {
      plates.push(plate);
      remaining = Math.round((remaining - plate) * 1000) / 1000;
    }
  });
  return plates;
};

/** The nearest weight real plates can make for this load (0 stays 0; below the bar = the empty bar). */
export const snapToLoadableWeight = (weight, setup) => {
  const w = Number(weight) || 0;
  if (w <= 0) return w;
  const mult = setup.singleLoad ? 1 : 2;
  const perSide = platesForLoad(w, setup).reduce((a, p) => a + p, 0);
  return Math.round((setup.barWeight + perSide * mult) * 100) / 100;
};

/** True when the weight is loaded on both sides (bar or plate-loaded machine): those snap to 2.5 lb steps. */
export const isTwoSidedLoad = setup => Boolean(setup) && !setup.singleLoad;
