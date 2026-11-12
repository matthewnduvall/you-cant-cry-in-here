// ============================================================================
// EXERCISE LIBRARY, GYM EQUIPMENT & EXRX.NET DIRECTORY STANDARDS
// Standardized with https://exrx.net/Lists/Directory
// Editable CSV source of truth: app/data/exercises.csv
// ============================================================================

import exercisesCsvText from './exercises.csv';

export const GYM_EQUIPMENT_OPTIONS = [
  'Barbell',
  'Dumbbell',
  'EZ Bar',
  'Landmine',
  'Pull-Up Bar',
  'Resistance Bands',
  'Weight Plates',
  'Flat / Incline Bench',
  'Squat Rack',
  'Cable Machine',
  'Lever / Machine',
  'Kettlebells'
];

// the Equipment page list starting lists for the old single-choice gym presets (used once to migrate)
const PRESET_EQUIPMENT_LISTS = {
  preset_barbells_only: ['Barbell', 'Weight Plates', 'EZ Bar', 'Landmine', 'Flat / Incline Bench', 'Squat Rack'],
  preset_dumbbells_only: ['Dumbbell', 'Flat / Incline Bench'],
  preset_kettlebells_only: ['Kettlebells'],
  preset_bodyweight_only: ['Pull-Up Bar']
};

/** The equipment a gym selection stands for (All Equipment = everything). */
export const getEquipmentListForGymSelection = (gymSelectionId, customGyms = []) => {
  if (!gymSelectionId) return [...GYM_EQUIPMENT_OPTIONS];
  if (PRESET_EQUIPMENT_LISTS[gymSelectionId]) return [...PRESET_EQUIPMENT_LISTS[gymSelectionId]];
  const gym = (customGyms || []).find(g => g.id === gymSelectionId);
  return Array.isArray(gym?.equipment) ? [...gym.equipment] : [...GYM_EQUIPMENT_OPTIONS];
};

/**
 * the Equipment page list: does the athlete have everything this exercise needs? Exercises that need no equipment
 * (bodyweight) always fit; a missing list (not set yet) means everything is available.
 */
export const isExerciseAvailableWithEquipment = (ex, availableEquipment) => {
  if (!ex) return false;
  if (!Array.isArray(availableEquipment)) return true;
  const have = new Set(availableEquipment);
  return (ex.requiredEquipment || []).filter(req => req && req !== 'Bodyweight').every(req => have.has(req));
};

export const DEFAULT_GYM_EQUIPMENT_PRESETS = [
  { id: '', name: 'All Equipment' },
  { id: 'preset_barbells_only', name: 'Barbells Only' },
  { id: 'preset_dumbbells_only', name: 'Dumbbells Only' },
  { id: 'preset_kettlebells_only', name: 'Kettlebells Only' },
  { id: 'preset_bodyweight_only', name: 'Bodyweight Only' }
];

export const SLOT_CATEGORIES = ['Compound', 'Accessory', 'Superset'];

export const normalizeSlotCategory = rawCat => {
  if (!rawCat) return 'Compound';
  const c = String(rawCat).trim();
  if (
    c === 'Compound' ||
    c === 'Compound Lift' ||
    c === 'Compound Lifts' ||
    c === 'Compounds' ||
    c === 'Primary Compound'
  ) {
    return 'Compound';
  }
  if (c === 'Accessory' || c === 'Accessories' || c === 'Abs' || c === 'Waist') {
    return 'Accessory';
  }
  if (c === 'Superset' || c === 'Supersets') return 'Superset';
  return 'Compound';
};

export const isSupersetCategory = cat => normalizeSlotCategory(cat) === 'Superset';
export const isAccessoryCategory = cat => normalizeSlotCategory(cat) === 'Accessory';

// The app's name for a muscle group (older data said Waist; it is Core now)
export const normalizeMuscleGroupName = raw => {
  const name = String(raw || '').trim();
  return name.toLowerCase() === 'waist' ? 'Core' : name;
};

// Standardized with https://exrx.net/Lists/Directory Body Part Directory (its "Waist" is called Core here)
export const MUSCLE_GROUP_OPTIONS = [
  'All Muscles',
  'Neck',
  'Shoulders',
  'Upper Arms',
  'Forearms',
  'Back',
  'Chest',
  'Core',
  'Hips',
  'Thighs',
  'Calves'
];

export const formatTodayYMD = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
};

export const formatDateYMD = dateInput => {
  if (!dateInput) return formatTodayYMD();
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // Date-only strings are taken as written. Full timestamps (e.g. "2026-11-08T03:00:00.000Z") fall
    // through to Date parsing so they show the local date, not the UTC one.
    const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (ymdMatch) {
      return `${ymdMatch[1]}/${String(ymdMatch[2]).padStart(2, '0')}/${String(ymdMatch[3]).padStart(2, '0')}`;
    }
    const mdyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (mdyMatch) {
      return `${mdyMatch[3]}/${String(mdyMatch[1]).padStart(2, '0')}/${String(mdyMatch[2]).padStart(2, '0')}`;
    }
  }
  const dt = new Date(dateInput);
  if (Number.isNaN(dt.getTime())) return formatTodayYMD();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
};

export const parseYMDToISO = ymdInput => {
  const ymd = formatDateYMD(ymdInput);
  const isoDatePart = ymd.replace(/\//g, '-');
  const dt = new Date(`${isoDatePart}T12:00:00`);
  return Number.isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
};

// Session names don't carry the date: the date is the session's startedAt, shown in its own DATE box
export const getDefaultSessionName = () => 'Session';
export const getDefaultAutoSessionName = () => 'Auto Session';

export const formatTodayShortDate = () => formatTodayYMD();

// Names never carry the date (it lives in the DATE box): drops a leading "YYYY/MM/DD - " (or YYYY-MM-DD) that
// older saves, imports and PR entries put there
export const stripDateFromTitle = title =>
  String(title || '')
    .trim()
    .replace(/^\d{4}[/-]\d{1,2}[/-]\d{1,2}\s*-\s*/, '')
    .trim();

// A loaded routine's session name: the routine's name (a leading "YYYY/MM/DD - " from older saves is dropped)
export const formatTitleWithDate = baseTitle => {
  const clean = stripDateFromTitle(baseTitle);
  if (!clean || clean === 'SESSION' || clean === 'Custom Kinetic Routine') return getDefaultSessionName();
  return clean;
};

export const isExerciseCompatibleWithGymSelection = (ex, gymSelectionId, customGyms = []) => {
  if (!ex) return false;
  if (!gymSelectionId) return true;
  const eqText = (ex.equipment || '').toLowerCase();
  const reqEq = ex.requiredEquipment || [];

  if (gymSelectionId === 'preset_barbells_only' || gymSelectionId === 'barbell') {
    return eqText.includes('barbell') || reqEq.includes('Barbell');
  }
  if (gymSelectionId === 'preset_dumbbells_only' || gymSelectionId === 'dumbbell') {
    return eqText.includes('dumbbell') || reqEq.includes('Dumbbell');
  }
  if (gymSelectionId === 'preset_kettlebells_only' || gymSelectionId === 'kettlebell') {
    return eqText.includes('kettlebell') || reqEq.includes('Kettlebells') || reqEq.includes('Kettlebell');
  }
  if (gymSelectionId === 'preset_bodyweight_only' || gymSelectionId === 'bodyweight') {
    return (
      eqText.includes('bodyweight') ||
      eqText.includes('body weight') ||
      eqText.includes('isometric') ||
      eqText.includes('stretch') ||
      eqText.includes('plyometric') ||
      eqText.includes('self-assisted') ||
      reqEq.length === 0
    );
  }

  const foundGym = (customGyms || []).find(g => g.id === gymSelectionId);
  if (!foundGym) return true;
  const availEq = new Set(foundGym.equipment || GYM_EQUIPMENT_OPTIONS);
  if (reqEq.length === 0) return true;
  return reqEq.every(req => availEq.has(req));
};

export const getGymSelectionLabel = (gymSelectionId, customGyms = []) => {
  const preset = DEFAULT_GYM_EQUIPMENT_PRESETS.find(p => p.id === (gymSelectionId || ''));
  if (preset) return preset.name;
  const custom = (customGyms || []).find(g => g.id === gymSelectionId);
  return custom ? custom.name : 'All Equipment';
};

// Fast RFC-4180 CSV line parser supporting quoted fields and pipe-delimited array columns
// Exercises that train a second body part as much as their main one (a thruster = front squat + overhead press)
// Other names an exercise goes by: exercise search and the History .csv import both match them
export const EXERCISE_NAME_ALIASES = {
  barbell_rdl: ['RDL', 'RDLs', 'Romanian Deadlift'],
  sit_up: ['Situp', 'Situps', 'Sit-Up', 'Sit-Ups'],
  tricep_dip: ['Dip', 'Dips'],
  dumbbell_shoulder_press: ['Dumbbell Overhead Press', 'DB Overhead Press', 'DB Press', 'DB Shoulder Press', 'Dumbbell OHP', 'DB OHP'],
  barbell_shrug: ['Shrug', 'Shrugs', 'Barbell Shrugs'],
  barbell_upright_row: ['Standing Row', 'Standing Rows', 'Barbell Upright Rows'],
  barbell_deadlift: ['Deadlift', 'Deadlifts'],
  barbell_bench_press: ['Bench', 'Bench Press'],
  barbell_back_squat: ['Squat', 'Squats', 'Back Squat'],
  // Its name until 2026/11 (older CSVs and exports use it)
  overhead_press: ['Barbell Military Overhead Press', 'Military Overhead Press'],
  front_squat: ['Front Squat', 'Front Squats'],
  chin_ups: ['Pull-Up', 'Pull-Ups', 'Pullup', 'Pullups'],
  dumbbell_single_leg_rdl: ['One Legged RDL', 'One Legged RDLs', 'One-Leg RDL', 'Single Leg RDL', 'Single-Leg RDLs', 'SL RDL', 'Single Leg Deadlift', 'Kettlebell Single-Leg RDL'],
  barbell_single_leg_rdl: ['Barbell Single Leg RDL', 'Barbell One Legged RDL', 'Barbell SL RDL', 'BB Single Leg RDL'],
  dumbbell_lu_raise: ['Lu Raise', 'Lu Raises', 'Overhead Lateral Raise', 'Plate Lu Raise'],
  bodyweight_standing_hip_abduction: ['Hip Abductions Standing', 'Standing Hip Abduction', 'Standing Hip Abductions'],
  dumbbell_standing_hip_abduction: ['Dumbbell Hip Abduction', 'Dumbbell Hip Abductions Standing', 'DB Standing Hip Abduction', 'DB Hip Abduction'],
  bear_plank_shoulder_tap: ['Bear Plank Shoulder Taps', 'Bear Shoulder Tap', 'Bear Plank Shoulder Tap']
};

const SECONDARY_MUSCLE_GROUPS = {
  barbell_thruster: ['Shoulders'],
  dumbbell_thruster: ['Shoulders']
};

const parseCsvLine = line => {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
};

export const parseExercisesCsv = rawCsv => {
  if (!rawCsv || typeof rawCsv !== 'string') return [];
  const lines = rawCsv.split(/\r?\n/);
  const result = [];
  const seenIds = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const cols = parseCsvLine(line);
    const id = (cols[0] || '').trim();
    const name = (cols[1] || '').trim();
    if (!id || !name || seenIds.has(id)) continue;
    seenIds.add(id);

    // ExRx's "Waist" body part is called Core in the app
    const muscleGroup = normalizeMuscleGroupName(cols[2] || 'Chest');
    const category = normalizeSlotCategory(cols[3] || 'Accessory');
    const equipment = (cols[4] || 'Bodyweight').trim();
    const requiredEquipment = (cols[5] || '')
      .split('|')
      .map(s => s.trim())
      .filter(Boolean);
    const specificMuscles = (cols[6] || '')
      .split('|')
      .map(s => s.trim())
      .filter(Boolean);
    const isPriority = String(cols[7] || '').trim().toLowerCase() === 'true';
    const default1RM = Math.max(5, Number(cols[8]) || 95);
    const alternatives = (cols[9] || '')
      .split('|')
      .map(s => s.trim())
      .filter(Boolean);

    const entry = {
      id,
      name,
      equipment,
      requiredEquipment,
      category,
      muscleGroup,
      // Other body parts it trains as much (muscle filters and the stimulus map count them too)
      secondaryMuscleGroups: SECONDARY_MUSCLE_GROUPS[id] || [],
      // Other names it goes by (search + .csv import)
      aliases: EXERCISE_NAME_ALIASES[id] || [],
      specificMuscles,
      isPriority,
      default1RM,
      alternatives
    };
    entry.isBodyweight = computeIsBodyweight(entry);
    result.push(entry);
  }

  return result;
};

// Comprehensive Exercise Library parsed directly from app/data/exercises.csv
export const EXERCISE_LIBRARY = parseExercisesCsv(exercisesCsvText);

export const EXERCISE_MAP = Object.fromEntries(EXERCISE_LIBRARY.map(ex => [ex.id, ex]));

export const sortExercisesAlphabetically = list =>
  [...(list || [])].sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));

export const doesExerciseInteractWithMuscleGroup = (ex, muscleGroupFilter) => {
  if (
    ex &&
    Array.isArray(ex.secondaryMuscleGroups) &&
    ex.secondaryMuscleGroups.some(g => doesExerciseInteractWithMuscleGroup({ muscleGroup: g }, muscleGroupFilter))
  ) {
    return true;
  }
  if (!ex) return false;
  if (!muscleGroupFilter || muscleGroupFilter === 'All Muscles' || muscleGroupFilter === 'All') {
    return true;
  }
  const primary = (ex.muscleGroup || '').trim().toLowerCase();
  const target = String(muscleGroupFilter || '').trim().toLowerCase();

  // Direct match against the 10 ExRx.net Body Part Directory groups:
  // Neck, Shoulders, Upper Arms, Forearms, Back, Chest, Core (ExRx "Waist"), Hips, Thighs, Calves
  if (primary === target) return true;

  // Legacy alias handling
  if ((target === 'upper arms' || target === 'arms') && (primary === 'upper arms' || primary === 'arms')) {
    return true;
  }
  if ((target === 'waist' || target === 'core' || target === 'abs') && (primary === 'core' || primary === 'waist')) {
    return true;
  }
  if (target === 'legs' && (primary === 'thighs' || primary === 'hips' || primary === 'calves')) {
    return true;
  }

  return false;
};

export const getAvailableMuscleGroupsForCategory = () => {
  return MUSCLE_GROUP_OPTIONS;
};

export const filterAddSlotExercises = (gymFilterId, category, customGyms = [], muscleGroupFilter = 'All Muscles') => {
  const normCat = normalizeSlotCategory(category);
  const byGym = EXERCISE_LIBRARY.filter(ex =>
    isExerciseCompatibleWithGymSelection(ex, gymFilterId, customGyms)
  );
  const gymBase = byGym.length > 0 ? byGym : EXERCISE_LIBRARY;

  let catPool;
  if (!category || normCat === 'Superset') {
    catPool = gymBase;
  } else {
    const byCatAndGym = gymBase.filter(ex => ex.category === normCat);
    if (byCatAndGym.length > 0) {
      catPool = byCatAndGym;
    } else {
      const byCatOnly = EXERCISE_LIBRARY.filter(ex => ex.category === normCat);
      catPool = byCatOnly.length > 0 ? byCatOnly : gymBase;
    }
  }

  if (!muscleGroupFilter || muscleGroupFilter === 'All Muscles' || muscleGroupFilter === 'All') {
    return sortExercisesAlphabetically(catPool);
  }

  // Strictly filter to the chosen muscle group, prioritizing gym + category, then gym, then library
  const byMuscleInGymAndCat = gymBase.filter(
    ex =>
      (normCat === 'Superset' || ex.category === normCat) &&
      doesExerciseInteractWithMuscleGroup(ex, muscleGroupFilter)
  );
  if (byMuscleInGymAndCat.length > 0) {
    return sortExercisesAlphabetically(byMuscleInGymAndCat);
  }

  const byMuscleInGym = gymBase.filter(ex => doesExerciseInteractWithMuscleGroup(ex, muscleGroupFilter));
  if (byMuscleInGym.length > 0) {
    return sortExercisesAlphabetically(byMuscleInGym);
  }

  const byMuscleAll = EXERCISE_LIBRARY.filter(ex => doesExerciseInteractWithMuscleGroup(ex, muscleGroupFilter));
  return sortExercisesAlphabetically(byMuscleAll);
};

export const getFilteredExercisesForSlotInline = (slot, selectedGymId, customGyms = []) => {
  const normCat = normalizeSlotCategory(slot?.category);
  const equipmentFilteredLibrary = EXERCISE_LIBRARY.filter(ex =>
    isExerciseCompatibleWithGymSelection(ex, selectedGymId, customGyms)
  );
  const activePoolBase = equipmentFilteredLibrary.length > 0 ? equipmentFilteredLibrary : EXERCISE_LIBRARY;
  const muscleFilter = slot?.muscleGroupFilter || 'All Muscles';

  let catPool;
  if (normCat === 'Compound') {
    const compMatches = activePoolBase.filter(e => e.category === 'Compound');
    catPool = compMatches.length > 0 ? compMatches : EXERCISE_LIBRARY.filter(e => e.category === 'Compound');
  } else if (normCat === 'Accessory') {
    const accMatches = activePoolBase.filter(e => e.category === 'Accessory');
    catPool = accMatches.length > 0 ? accMatches : EXERCISE_LIBRARY.filter(e => e.category === 'Accessory');
  } else {
    catPool = activePoolBase;
  }

  if (!muscleFilter || muscleFilter === 'All Muscles' || muscleFilter === 'All') {
    return sortExercisesAlphabetically(catPool);
  }

  const byMuscleInGymAndCat = activePoolBase.filter(
    ex =>
      (normCat === 'Superset' || ex.category === normCat) &&
      doesExerciseInteractWithMuscleGroup(ex, muscleFilter)
  );
  if (byMuscleInGymAndCat.length > 0) {
    return sortExercisesAlphabetically(byMuscleInGymAndCat);
  }

  const byMuscleInGym = activePoolBase.filter(ex => doesExerciseInteractWithMuscleGroup(ex, muscleFilter));
  if (byMuscleInGym.length > 0) {
    return sortExercisesAlphabetically(byMuscleInGym);
  }

  const byMuscleAll = EXERCISE_LIBRARY.filter(ex => doesExerciseInteractWithMuscleGroup(ex, muscleFilter));
  return sortExercisesAlphabetically(byMuscleAll);
};

export const BIG_FOUR_IDS = ['barbell_bench_press', 'barbell_back_squat', 'barbell_deadlift', 'overhead_press'];
export const CORE_PR_EXERCISE_IDS = [
  'barbell_bench_press',
  'barbell_back_squat',
  'barbell_deadlift',
  'overhead_press'
];
export const EXRX_CLASSES = ['Untrained', 'Novice', 'Intermediate', 'Advanced', 'Elite'];

// Official ExRx.net Male Weightlifting Strength Standards Tables (in lbs)
// Reference: https://exrx.net/Testing/WeightLifting/StrengthStandards
export const EXRX_BODYWEIGHT_BRACKETS = [114, 123, 132, 148, 165, 181, 198, 220, 242, 275, 319];

export const EXRX_STANDARDS_TABLES = {
  // https://exrx.net/Testing/WeightLifting/BenchPressStandards
  barbell_bench_press: {
    114: { Untrained: 85, Novice: 105, Intermediate: 130, Advanced: 175, Elite: 220 },
    123: { Untrained: 90, Novice: 115, Intermediate: 140, Advanced: 190, Elite: 240 },
    132: { Untrained: 100, Novice: 125, Intermediate: 155, Advanced: 205, Elite: 260 },
    148: { Untrained: 110, Novice: 140, Intermediate: 170, Advanced: 230, Elite: 290 },
    165: { Untrained: 120, Novice: 155, Intermediate: 185, Advanced: 255, Elite: 320 },
    181: { Untrained: 130, Novice: 165, Intermediate: 200, Advanced: 275, Elite: 345 },
    198: { Untrained: 135, Novice: 175, Intermediate: 215, Advanced: 290, Elite: 365 },
    220: { Untrained: 140, Novice: 185, Intermediate: 225, Advanced: 305, Elite: 385 },
    242: { Untrained: 145, Novice: 190, Intermediate: 235, Advanced: 320, Elite: 400 },
    275: { Untrained: 150, Novice: 195, Intermediate: 240, Advanced: 330, Elite: 415 },
    319: { Untrained: 155, Novice: 200, Intermediate: 245, Advanced: 340, Elite: 425 }
  },
  // https://exrx.net/Testing/WeightLifting/SquatStandards
  barbell_back_squat: {
    114: { Untrained: 80, Novice: 145, Intermediate: 175, Advanced: 240, Elite: 320 },
    123: { Untrained: 85, Novice: 155, Intermediate: 190, Advanced: 260, Elite: 345 },
    132: { Untrained: 95, Novice: 170, Intermediate: 205, Advanced: 285, Elite: 370 },
    148: { Untrained: 105, Novice: 190, Intermediate: 230, Advanced: 315, Elite: 410 },
    165: { Untrained: 115, Novice: 205, Intermediate: 250, Advanced: 340, Elite: 445 },
    181: { Untrained: 120, Novice: 220, Intermediate: 270, Advanced: 370, Elite: 480 },
    198: { Untrained: 130, Novice: 235, Intermediate: 285, Advanced: 390, Elite: 505 },
    220: { Untrained: 135, Novice: 245, Intermediate: 300, Advanced: 410, Elite: 530 },
    242: { Untrained: 140, Novice: 255, Intermediate: 310, Advanced: 425, Elite: 550 },
    275: { Untrained: 145, Novice: 265, Intermediate: 320, Advanced: 440, Elite: 570 },
    319: { Untrained: 150, Novice: 270, Intermediate: 330, Advanced: 455, Elite: 585 }
  },
  // https://exrx.net/Testing/WeightLifting/DeadliftStandards
  barbell_deadlift: {
    114: { Untrained: 95, Novice: 180, Intermediate: 205, Advanced: 295, Elite: 385 },
    123: { Untrained: 105, Novice: 195, Intermediate: 220, Advanced: 315, Elite: 410 },
    132: { Untrained: 115, Novice: 210, Intermediate: 240, Advanced: 340, Elite: 435 },
    148: { Untrained: 130, Novice: 235, Intermediate: 270, Advanced: 380, Elite: 480 },
    165: { Untrained: 140, Novice: 255, Intermediate: 295, Advanced: 410, Elite: 520 },
    181: { Untrained: 150, Novice: 275, Intermediate: 315, Advanced: 440, Elite: 550 },
    198: { Untrained: 160, Novice: 290, Intermediate: 335, Advanced: 465, Elite: 575 },
    220: { Untrained: 165, Novice: 305, Intermediate: 350, Advanced: 485, Elite: 595 },
    242: { Untrained: 175, Novice: 320, Intermediate: 365, Advanced: 500, Elite: 610 },
    275: { Untrained: 180, Novice: 330, Intermediate: 375, Advanced: 515, Elite: 620 },
    319: { Untrained: 185, Novice: 340, Intermediate: 385, Advanced: 525, Elite: 630 }
  },
  // https://exrx.net/Testing/WeightLifting/PressStandards
  overhead_press: {
    114: { Untrained: 55, Novice: 75, Intermediate: 90, Advanced: 110, Elite: 150 },
    123: { Untrained: 60, Novice: 80, Intermediate: 100, Advanced: 120, Elite: 160 },
    132: { Untrained: 65, Novice: 85, Intermediate: 105, Advanced: 130, Elite: 175 },
    148: { Untrained: 70, Novice: 95, Intermediate: 115, Advanced: 145, Elite: 195 },
    165: { Untrained: 75, Novice: 105, Intermediate: 125, Advanced: 155, Elite: 210 },
    181: { Untrained: 80, Novice: 110, Intermediate: 135, Advanced: 170, Elite: 225 },
    198: { Untrained: 85, Novice: 120, Intermediate: 145, Advanced: 180, Elite: 240 },
    220: { Untrained: 90, Novice: 125, Intermediate: 155, Advanced: 190, Elite: 255 },
    242: { Untrained: 95, Novice: 130, Intermediate: 160, Advanced: 195, Elite: 265 },
    275: { Untrained: 95, Novice: 135, Intermediate: 165, Advanced: 205, Elite: 275 },
    319: { Untrained: 100, Novice: 140, Intermediate: 170, Advanced: 210, Elite: 280 }
  },
  chin_ups: {
    114: { Untrained: 80, Novice: 105, Intermediate: 125, Advanced: 165, Elite: 210 },
    123: { Untrained: 85, Novice: 115, Intermediate: 135, Advanced: 180, Elite: 225 },
    132: { Untrained: 95, Novice: 120, Intermediate: 150, Advanced: 195, Elite: 245 },
    148: { Untrained: 105, Novice: 135, Intermediate: 165, Advanced: 220, Elite: 275 },
    165: { Untrained: 115, Novice: 150, Intermediate: 180, Advanced: 245, Elite: 305 },
    181: { Untrained: 125, Novice: 160, Intermediate: 195, Advanced: 265, Elite: 330 },
    198: { Untrained: 130, Novice: 170, Intermediate: 210, Advanced: 280, Elite: 350 },
    220: { Untrained: 135, Novice: 180, Intermediate: 220, Advanced: 295, Elite: 370 },
    242: { Untrained: 140, Novice: 185, Intermediate: 230, Advanced: 310, Elite: 385 },
    275: { Untrained: 145, Novice: 190, Intermediate: 235, Advanced: 320, Elite: 400 },
    319: { Untrained: 150, Novice: 195, Intermediate: 240, Advanced: 330, Elite: 410 }
  }
};

export const EXRX_RATIOS = {
  barbell_bench_press: { Untrained: 0.64, Novice: 0.84, Intermediate: 1.02, Advanced: 1.39, Elite: 1.75 },
  barbell_back_squat: { Untrained: 0.61, Novice: 1.11, Intermediate: 1.36, Advanced: 1.86, Elite: 2.41 },
  barbell_deadlift: { Untrained: 0.75, Novice: 1.39, Intermediate: 1.59, Advanced: 2.20, Elite: 2.70 },
  overhead_press: { Untrained: 0.41, Novice: 0.57, Intermediate: 0.70, Advanced: 0.86, Elite: 1.16 },
  incline_bench_press: { Untrained: 0.52, Novice: 0.68, Intermediate: 0.86, Advanced: 1.16, Elite: 1.45 },
  chin_ups: { Untrained: 0.61, Novice: 0.82, Intermediate: 1.00, Advanced: 1.34, Elite: 1.68 }
};

export const roundTo5 = val => Math.max(5, Math.round(val / 5) * 5);
export const roundToIncrement = val => Math.max(0, Math.round((Number(val) || 0) * 4) / 4);

const interpolateExRxTable = (table, targetClass, bw) => {
  const cls = EXRX_CLASSES.includes(targetClass) ? targetClass : 'Intermediate';
  const brackets = EXRX_BODYWEIGHT_BRACKETS;
  const safeBw = Math.max(90, Number(bw) || 220);

  if (safeBw <= brackets[0]) {
    const scale = safeBw / brackets[0];
    return roundTo5((table[brackets[0]][cls] || 135) * scale);
  }
  const lastB = brackets[brackets.length - 1];
  if (safeBw >= lastB) {
    return roundTo5(table[lastB][cls] || 225);
  }

  for (let i = 0; i < brackets.length - 1; i++) {
    const bLow = brackets[i];
    const bHigh = brackets[i + 1];
    if (safeBw === bLow) {
      return table[bLow][cls];
    }
    if (safeBw === bHigh) {
      return table[bHigh][cls];
    }
    if (safeBw > bLow && safeBw < bHigh) {
      const t = (safeBw - bLow) / (bHigh - bLow);
      const valLow = table[bLow][cls];
      const valHigh = table[bHigh][cls];
      return roundTo5(valLow + t * (valHigh - valLow));
    }
  }
  return table[220][cls];
};

// ---------------------------------------------------------------------------
// 1000 LB CLUB: a strength class goal of a 1000 lb Big 3 total (bench + squat + deadlift 1RMs). The lb still
// missing from 1000 is split evenly across the three lifts on top of each current 1RM (whole pounds; the
// leftover 1–2 lb go to bench, then squat), so the three goals always add up to exactly 1000. Once the
// total reaches 1000, each goal is the current 1RM (reached).
// ---------------------------------------------------------------------------
export const THOUSAND_LB_CLUB = '1000 LB Club';
export const THOUSAND_LB_CLUB_TOTAL = 1000;
export const THOUSAND_LB_CLUB_LIFT_IDS = ['barbell_bench_press', 'barbell_back_squat', 'barbell_deadlift'];
// Strength class goals offered in Goals (plus CUSTOM)
export const STRENGTH_GOAL_CLASSES = [...EXRX_CLASSES, THOUSAND_LB_CLUB];

/** { total, remaining, goals: { [liftId]: goal } } for the 1000 lb club from current 1RMs (unlogged = 0). */
export const getThousandLbClubGoals = (current1RMs = {}) => {
  const currents = THOUSAND_LB_CLUB_LIFT_IDS.map(id => Math.max(0, Math.round(Number(current1RMs?.[id]) || 0)));
  const total = currents.reduce((sum, v) => sum + v, 0);
  const remaining = Math.max(0, THOUSAND_LB_CLUB_TOTAL - total);
  const share = Math.floor(remaining / THOUSAND_LB_CLUB_LIFT_IDS.length);
  const leftover = remaining - share * THOUSAND_LB_CLUB_LIFT_IDS.length;
  const goals = {};
  THOUSAND_LB_CLUB_LIFT_IDS.forEach((id, i) => {
    goals[id] = currents[i] + share + (i < leftover ? 1 : 0);
  });
  return { total, remaining, goals };
};

/**
 * Goal 1RM for a lift under a strength class goal. `current1RMs` is only needed for the 1000 LB Club,
 * whose Big 3 goals depend on what has been lifted; its other lifts use a custom goal if set, else Intermediate.
 */
export const getExRxTargetForLift = (
  liftId,
  targetClass,
  bodyweightLbs = 220,
  heightInches = 70,
  customGoals = {},
  current1RMs = {}
) => {
  if (targetClass === THOUSAND_LB_CLUB) {
    if (THOUSAND_LB_CLUB_LIFT_IDS.includes(liftId)) return getThousandLbClubGoals(current1RMs).goals[liftId];
    if (customGoals && customGoals[liftId]) return Number(customGoals[liftId]);
  }
  if (targetClass === 'Custom' && customGoals && customGoals[liftId]) {
    return Number(customGoals[liftId]);
  }
  const cls = EXRX_CLASSES.includes(targetClass) ? targetClass : 'Intermediate';
  const table = EXRX_STANDARDS_TABLES[liftId];
  if (table) {
    return interpolateExRxTable(table, cls, bodyweightLbs);
  }

  // For additional exercises not in the core 5 tables, scale along the ExRx Bench Press curve
  // anchored to the exercise's 220 lb Intermediate default1RM
  const exObj = EXERCISE_MAP[liftId];
  const base220Intermediate = exObj?.default1RM || 225;
  const benchTargetAtBw = interpolateExRxTable(EXRX_STANDARDS_TABLES.barbell_bench_press, cls, bodyweightLbs);
  return roundTo5(benchTargetAtBw * (base220Intermediate / 225));
};

export const getExRxCurrentClass = (liftId, current1RM, bodyweightLbs = 220, heightInches = 70) => {
  let matched = 'Below Untrained';
  for (const cls of EXRX_CLASSES) {
    const threshold = getExRxTargetForLift(liftId, cls, bodyweightLbs, heightInches);
    if (current1RM >= threshold) matched = cls;
  }
  return matched;
};

// Hoisted so parseExercisesCsv can tag `isBodyweight` while the library is being built.
function computeIsBodyweight(ex) {
  if (!ex) return false;
  const eq = (ex.equipment || '').toLowerCase();
  if (
    eq.includes('bodyweight') ||
    eq.includes('body weight') ||
    eq.includes('isometric') ||
    eq.includes('self-assisted') ||
    eq.includes('suspended') ||
    eq.includes('plyometric') ||
    eq.includes('stretch')
  ) {
    return true;
  }
  // Chin-ups / pull-ups move the athlete's own body (incl. partner/band assistance);
  // cable, machine, and plate-weighted variants keep their external-load programming.
  const isChinOrPullUp = /\b(chin|pull)[\s-]?ups?\b/i.test(ex.name || '');
  return isChinOrPullUp && !/cable|lever|machine|weighted/.test(eq);
}

export const isBodyweightExercise = exOrId => {
  const ex = typeof exOrId === 'string' ? EXERCISE_MAP[exOrId] : exOrId;
  return computeIsBodyweight(ex);
};

// ---------------------------------------------------------------------------
// Equipment-swap helpers: find the closest equivalent exercise for a new equipment selection
// selection, and convert a 1RM between equipment types.
// ---------------------------------------------------------------------------

const EQUIPMENT_NAME_WORDS =
  /\b(barbell|dumbbells?|kettlebells?|cable|lever|smith|machine|ez|bar|bodyweight|weighted|plate|loaded|selectorized|landmine|sled|suspended|band|assisted|alternating|single|one|arm|isolateral)\b/g;

const MOVEMENT_SYNONYMS = { military: 'shoulder', overhead: 'shoulder', rdl: 'romanian', curls: 'curl' };

const movementTokens = name =>
  new Set(
    String(name || '')
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^a-z\s-]/g, ' ')
      .replace(/-/g, ' ')
      .replace(EQUIPMENT_NAME_WORDS, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1)
      .map(t => MOVEMENT_SYNONYMS[t] || t)
  );

const overlapScore = (a, b) => {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  a.forEach(t => {
    if (b.has(t)) shared += 1;
  });
  return shared / new Set([...a, ...b]).size;
};

/**
 * Returns the id of the exercise most similar to `exerciseId` that fits the gym selection,
 * the original id if it already fits, or null when nothing compatible targets the same muscles.
 */
export const findEquivalentExerciseForGym = (exerciseId, gymSelectionId, customGyms = [], excludeIds = []) =>
  findEquivalentExerciseWhere(
    exerciseId,
    ex => isExerciseCompatibleWithGymSelection(ex, gymSelectionId, customGyms),
    excludeIds
  );

/** Like findEquivalentExerciseForGym, for the the Equipment page list list (e.g. Bench Press → Dumbbell Bench Press). */
export const findEquivalentExerciseForEquipment = (exerciseId, availableEquipment, excludeIds = []) =>
  findEquivalentExerciseWhere(exerciseId, ex => isExerciseAvailableWithEquipment(ex, availableEquipment), excludeIds);

const findEquivalentExerciseWhere = (exerciseId, isAllowed, excludeIds = []) => {
  const source = EXERCISE_MAP[exerciseId];
  if (!source) return null;
  if (isAllowed(source)) return source.id;

  const sourceTokens = movementTokens(source.name);
  const sourceMuscles = new Set(source.specificMuscles || []);
  let best = null;
  let bestScore = 0;

  EXERCISE_LIBRARY.forEach(cand => {
    if (cand.id === source.id || excludeIds.includes(cand.id)) return;
    if (!isAllowed(cand)) return;
    const nameScore = overlapScore(sourceTokens, movementTokens(cand.name));
    const sameGroup = cand.muscleGroup === source.muscleGroup;
    // Cross-muscle-group matches must share a movement word (e.g. Deadlift → Romanian Deadlift).
    if (!sameGroup && nameScore === 0) return;
    let score = nameScore * 3 + (sameGroup ? 1 : 0);
    score += overlapScore(sourceMuscles, new Set(cand.specificMuscles || []));
    if (cand.category === source.category) score += 0.5;
    if ((source.alternatives || []).includes(cand.id) || (cand.alternatives || []).includes(source.id)) {
      score += 1;
    }
    if (cand.isPriority) score += 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  });

  return best ? best.id : null;
};

// Equipment words the pickers show through the equipment filter instead of in the exercise name
const NAME_EQUIPMENT_WORD = '(?:barbell|dumbbells?|ez[- ]?bar|landmine)';
const NAME_EQUIPMENT_WITH_SLASH_AFTER = new RegExp(`\\b${NAME_EQUIPMENT_WORD}\\b\\s*\\/\\s*`, 'gi');
const NAME_EQUIPMENT_WITH_SLASH_BEFORE = new RegExp(`\\s*\\/\\s*\\b${NAME_EQUIPMENT_WORD}\\b`, 'gi');
const NAME_EQUIPMENT_ALONE = new RegExp(`\\b${NAME_EQUIPMENT_WORD}\\b`, 'gi');

/**
 * Exercise name for pickers that already show the equipment: drops Barbell, Dumbbell(s), EZ-Bar and Landmine,
 * including the slash that offered them as an option ("Barbell / EZ-Bar Preacher Curl" → "Preacher Curl").
 */
export const stripEquipmentFromExerciseName = name => {
  const stripped = String(name || '')
    .replace(NAME_EQUIPMENT_WITH_SLASH_AFTER, ' ')
    .replace(NAME_EQUIPMENT_WITH_SLASH_BEFORE, ' ')
    .replace(NAME_EQUIPMENT_ALONE, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s/-]+|[\s/-]+$/g, '')
    .trim();
  return stripped || String(name || '');
};

const equipmentKey = word => String(word || '').toLowerCase().replace(/[^a-z]/g, '').replace(/s$/, '');

/**
 * Short picker label that stays unique within a list: the stripped name, plus the equipment words it dropped
 * (other than the list's own equipment) when another exercise in the list strips to the same name —
 * e.g. under Barbell, "Landmine Romanian Deadlift" → "Romanian Deadlift (Landmine)".
 */
export const getUniqueShortExerciseNames = (exercises = [], currentEquipment = '') => {
  const shortName = ex => stripEquipmentFromExerciseName(ex.name);
  const count = labels => {
    const counts = {};
    labels.forEach(label => {
      counts[label.toLowerCase()] = (counts[label.toLowerCase()] || 0) + 1;
    });
    return counts;
  };
  const shortCounts = count(exercises.map(shortName));
  const labels = exercises.map(ex => {
    const short = shortName(ex);
    if (shortCounts[short.toLowerCase()] < 2) return short;
    const dropped = (String(ex.name).match(NAME_EQUIPMENT_ALONE) || []).filter(
      word => equipmentKey(word) !== equipmentKey(currentEquipment)
    );
    return dropped.length > 0 ? `${short} (${dropped.join(' / ')})` : short;
  });
  // Still identical (true duplicates in the library): fall back to the full names
  const labelCounts = count(labels);
  const byId = {};
  exercises.forEach((ex, i) => {
    byId[ex.id] = labelCounts[labels[i].toLowerCase()] > 1 ? ex.name : labels[i];
  });
  return byId;
};

// "A / B" equipment means either works, so the exercise is listed under both A and B in the equipment filter.
// "Lever / Machine" names a single kind of machine, so it stays one option.
const EQUIPMENT_KEPT_WHOLE = new Set(['lever / machine']);
const EQUIPMENT_OPTION_ALIASES = { 'weight plates': 'Plate' };

// Band exercises are loaded by band colour instead of weight. 'Red + Purple' = both bands together (the heaviest).
// Tapping the band cell cycles Red → Purple → Red + Purple. The hexes are the physical bands' colours.
export const BAND_COLORS = ['Red', 'Purple', 'Red + Purple'];
export const BAND_COLOR_HEX = { Red: '#FF3B30', Purple: '#BF5AF2' };
export const isBandEquipment = equipment => /band/i.test(String(equipment || ''));
export const getSetBandColor = set => (BAND_COLORS.includes(set?.bandColor) ? set.bandColor : BAND_COLORS[0]);
/** The single bands in a band choice: 'Red + Purple' → ['Red', 'Purple']. */
export const getBandParts = color => String(color || '').split('+').map(p => p.trim()).filter(Boolean);
/** The load line for a band set: "RED BAND", "RED + PURPLE BANDS". */
export const getBandLoadLabel = color =>
  `${String(color || BAND_COLORS[0]).toUpperCase()} ${getBandParts(color).length > 1 ? 'BANDS' : 'BAND'}`;

/**
 * The equipment option a slot's exercise (half 0 = A / single, 1 = B) is set to: the athlete's choice when
 * the exercise allows it, otherwise the exercise's first option.
 */
export const getSlotEquipmentChoice = (slot, half = 0) => {
  const isSuperset = isSupersetCategory(slot?.category);
  const exId = isSuperset
    ? half === 1
      ? slot?.supersetExerciseIds?.[1] || slot?.secondaryExerciseId
      : slot?.supersetExerciseIds?.[0] || slot?.exerciseId
    : slot?.exerciseId;
  const options = getExerciseEquipmentOptions(EXERCISE_MAP[exId]);
  const saved = isSuperset ? slot?.supersetEquipmentFilters?.[half] : slot?.equipmentFilter;
  return options.includes(saved) ? saved : options[0];
};

let allEquipmentFilterOptions = null;
/** Every equipment option in the library, for the per-exercise equipment filter (always all of them). */
export const getAllEquipmentFilterOptions = () => {
  if (!allEquipmentFilterOptions) {
    allEquipmentFilterOptions = [...new Set(EXERCISE_LIBRARY.flatMap(getExerciseEquipmentOptions))].sort((a, b) =>
      a.localeCompare(b)
    );
  }
  return allEquipmentFilterOptions;
};

/** Equipment filter options an exercise belongs to, e.g. "Landmine / Barbell" → ["Landmine", "Barbell"]. */
export const getExerciseEquipmentOptions = ex => {
  const raw = String(ex?.equipment || 'Bodyweight').trim();
  if (EQUIPMENT_KEPT_WHOLE.has(raw.toLowerCase())) return [raw];
  const options = raw
    .split('/')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => EQUIPMENT_OPTION_ALIASES[part.toLowerCase()] || part);
  return options.length > 0 ? [...new Set(options)] : ['Bodyweight'];
};

/** The exercise in `pool` most similar to `exerciseId` (same movement, then same muscles), or pool[0]. */
export const findClosestExerciseInPool = (exerciseId, pool = []) => {
  const source = EXERCISE_MAP[exerciseId];
  if (!source || pool.length === 0) return pool[0]?.id || null;
  const sourceTokens = movementTokens(source.name);
  const sourceMuscles = new Set(source.specificMuscles || []);
  let best = pool[0];
  let bestScore = -1;
  pool.forEach(cand => {
    let score = overlapScore(sourceTokens, movementTokens(cand.name)) * 3;
    if (cand.muscleGroup === source.muscleGroup) score += 1;
    score += overlapScore(sourceMuscles, new Set(cand.specificMuscles || []));
    if (cand.category === source.category) score += 0.5;
    if ((source.alternatives || []).includes(cand.id) || (cand.alternatives || []).includes(source.id)) score += 1;
    if (cand.isPriority) score += 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  });
  return best.id;
};

// Relative loading vs. a barbell for the same movement (dumbbells ≈ 35% lower total load).
const EQUIPMENT_LOAD_FACTORS = [
  ['smith', 0.9],
  ['barbell', 1],
  ['dumbbell', 0.65],
  ['kettlebell', 0.65],
  ['cable', 0.75],
  ['lever', 0.9],
  ['machine', 0.9]
];

const getEquipmentLoadFactor = ex => {
  const eq = (ex?.equipment || '').toLowerCase();
  const match = EQUIPMENT_LOAD_FACTORS.find(([key]) => eq.includes(key));
  return match ? match[1] : 1;
};

/** Converts a 1RM on one exercise to an estimated 1RM on an equivalent exercise. */
export const convertEquivalent1RM = (fromExerciseId, toExerciseId, from1RM) => {
  const fromEx = EXERCISE_MAP[fromExerciseId];
  const toEx = EXERCISE_MAP[toExerciseId];
  const base = Number(from1RM) || 0;
  if (!fromEx || !toEx || base <= 0) return 0;
  return roundTo5((base * getEquipmentLoadFactor(toEx)) / getEquipmentLoadFactor(fromEx));
};

export const ROUTINE_GYM_CATEGORIES =['all', 'barbell', 'dumbbell', 'kettlebell', 'bodyweight'];

export const classifySingleExerciseGymCategory = exOrId => {
  const ex = typeof exOrId === 'string' ? EXERCISE_MAP[exOrId] : exOrId;
  if (!ex) return 'all';
  if (isBodyweightExercise(ex)) return 'bodyweight';
  const eq = (ex.equipment || '').toLowerCase();
  const req = ex.requiredEquipment || [];
  if (eq.includes('barbell') || req.includes('Barbell')) return 'barbell';
  if (eq.includes('dumbbell') || req.includes('Dumbbell')) return 'dumbbell';
  if (eq.includes('kettlebell') || req.includes('Kettlebells') || req.includes('Kettlebell')) return 'kettlebell';
  return 'all';
};

export const inferRoutineGymCategory = slots => {
  if (!Array.isArray(slots) || slots.length === 0) return 'all';
  const exIds = [];
  for (const slot of slots) {
    if (!slot) continue;
    if (isSupersetCategory(slot.category)) {
      const supIds =
        Array.isArray(slot.supersetExerciseIds) && slot.supersetExerciseIds.length > 0
          ? slot.supersetExerciseIds
          : [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
      exIds.push(...supIds);
    } else if (slot.exerciseId) {
      exIds.push(slot.exerciseId);
    }
  }
  if (exIds.length === 0) return 'all';

  const categories = exIds.map(id => classifySingleExerciseGymCategory(id));
  if (categories.every(c => c === 'bodyweight')) return 'bodyweight';

  const nonBodyweight = categories.filter(c => c !== 'bodyweight');
  if (nonBodyweight.length > 0) {
    if (nonBodyweight.every(c => c === 'barbell')) return 'barbell';
    if (nonBodyweight.every(c => c === 'dumbbell')) return 'dumbbell';
    if (nonBodyweight.every(c => c === 'kettlebell')) return 'kettlebell';
  }
  return 'all';
};

export const mapGymSelectionToRoutineCategory = (gymSelectionId, customGyms = []) => {
  if (!gymSelectionId || gymSelectionId === 'all') return 'all';
  if (gymSelectionId === 'preset_barbells_only' || gymSelectionId === 'barbell') return 'barbell';
  if (gymSelectionId === 'preset_dumbbells_only' || gymSelectionId === 'dumbbell') return 'dumbbell';
  if (gymSelectionId === 'preset_kettlebells_only' || gymSelectionId === 'kettlebell') return 'kettlebell';
  if (gymSelectionId === 'preset_bodyweight_only' || gymSelectionId === 'bodyweight') return 'bodyweight';

  const foundGym = (customGyms || []).find(g => g.id === gymSelectionId);
  if (!foundGym) return 'all';
  const eq = foundGym.equipment || [];
  const hasBarbell = eq.includes('Barbell');
  const hasDumbbell = eq.includes('Dumbbell');
  const hasKettlebell = eq.includes('Kettlebells') || eq.includes('Kettlebell');
  const hasMachines = eq.includes('Cable Machine') || eq.includes('Lever / Machine');

  if (!hasBarbell && !hasDumbbell && !hasKettlebell && !hasMachines) return 'bodyweight';
  if (hasBarbell && !hasDumbbell && !hasKettlebell && !hasMachines) return 'barbell';
  if (hasDumbbell && !hasBarbell && !hasKettlebell && !hasMachines) return 'dumbbell';
  if (hasKettlebell && !hasBarbell && !hasDumbbell && !hasMachines) return 'kettlebell';
  return 'all';
};

export const getRoutineGymCategory = routine => {
  const stored = String(routine?.gymType || routine?.equipment || '').trim().toLowerCase();
  if (ROUTINE_GYM_CATEGORIES.includes(stored)) return stored;
  if (Array.isArray(routine?.slots) && routine.slots.length > 0) {
    return inferRoutineGymCategory(routine.slots);
  }
  return 'all';
};

export const doesRoutineMatchGymFilter = (routine, gymSelectionId, customGyms = []) => {
  const filterCat = mapGymSelectionToRoutineCategory(gymSelectionId, customGyms);
  const routineCat = getRoutineGymCategory(routine);
  if (!gymSelectionId || filterCat === 'all') {
    return true;
  }
  return routineCat === filterCat;
};

export const DEFAULT_ROUTINES = [
  { key: 'full_body_a', label: 'Generic Full Body A', gymType: 'all' },
  { key: 'full_body_b', label: 'Generic Full Body B', gymType: 'all' },
  { key: 'arms_only', label: 'Generic Arms Only', gymType: 'all' }
];
