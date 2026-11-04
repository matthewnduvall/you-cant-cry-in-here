// ============================================================================
// EXERCISE LIBRARY, GYM EQUIPMENT & EXRX STANDARDS
// ============================================================================

export const GYM_EQUIPMENT_OPTIONS = [
  'Barbell', 'Dumbbell', 'EZ Bar', 'Landmine', 'Pull-Up Bar',
  'Resistance Bands', 'Weight Plates', 'Flat / Incline Bench',
  'Squat Rack', 'Cable Machine', 'Kettlebells'
];

export const DEFAULT_GYM_EQUIPMENT_PRESETS = [
  { id: '', name: 'Full Gym (All)' },
  { id: 'preset_barbells_only', name: 'Barbells Only' },
  { id: 'preset_dumbbells_only', name: 'Dumbells Only' },
  { id: 'preset_bodyweight_only', name: 'Bodyweight Only' }
];

export const formatTodayYMD = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
};

export const getDefaultSessionName = () => `${formatTodayYMD()} - Session`;
export const getDefaultAutoSessionName = () => `${formatTodayYMD()} - Auto Session`;

export const formatTodayShortDate = () =>
  new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const formatTitleWithDate = baseTitle => {
  if (!baseTitle || baseTitle.trim() === 'SESSION' || baseTitle.trim() === 'Custom Kinetic Routine') {
    return getDefaultSessionName();
  }
  const ymd = formatTodayYMD();
  const dateStr = formatTodayShortDate();
  const clean = baseTitle.trim();
  if (clean.includes(ymd) || clean.toUpperCase().includes(dateStr.toUpperCase())) return clean;
  return `${ymd} - ${clean}`;
};

export const isExerciseCompatibleWithGymSelection = (ex, gymSelectionId, customGyms = []) => {
  if (!ex) return false;
  if (!gymSelectionId) return true;
  const eqText = (ex.equipment || '').toLowerCase();
  const reqEq = ex.requiredEquipment || [];

  if (gymSelectionId === 'preset_barbells_only') {
    return eqText.includes('barbell') || reqEq.includes('Barbell');
  }
  if (gymSelectionId === 'preset_dumbbells_only') {
    return eqText.includes('dumbbell') || reqEq.includes('Dumbbell');
  }
  if (gymSelectionId === 'preset_bodyweight_only') {
    return eqText.includes('bodyweight') || reqEq.length === 0;
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
  return custom ? custom.name : 'Full Gym (All)';
};

const mkEx = (id, name, equipment, requiredEquipment, category, muscleGroup, specificMuscles, isPriority, default1RM, alternatives) => ({
  id, name, equipment, requiredEquipment, category, muscleGroup, specificMuscles, isPriority, default1RM, alternatives
});

export const EXERCISE_LIBRARY = [
  mkEx('barbell_bench_press', 'Barbell Bench Press', 'Barbell', ['Barbell', 'Flat / Incline Bench', 'Weight Plates'], 'Compound Lift', 'Chest', ['Mid Pectorals', 'Anterior Deltoid', 'Triceps'], true, 225, ['dumbbell_press', 'incline_bench_press', 'dumbbell_incline_press']),
  mkEx('barbell_back_squat', 'Barbell Back Squat', 'Barbell', ['Barbell', 'Squat Rack', 'Weight Plates'], 'Compound Lift', 'Legs', ['Quadriceps', 'Glutes', 'Hamstrings'], true, 285, ['front_squat', 'split_squat', 'goblet_squat']),
  mkEx('barbell_deadlift', 'Barbell Deadlift', 'Barbell', ['Barbell', 'Weight Plates'], 'Compound Lift', 'Back', ['Hamstrings', 'Glutes', 'Lats', 'Upper Back / Rhomboids'], true, 335, ['landmine_rdl', 'dumbbell_rdl', 'barbell_row']),
  mkEx('overhead_press', 'Barbell Overhead Press', 'Barbell', ['Barbell', 'Weight Plates'], 'Compound Lift', 'Shoulders', ['Anterior Deltoid', 'Lateral Deltoid', 'Triceps'], true, 145, ['dumbbell_shoulder_press', 'incline_bench_press']),
  mkEx('incline_bench_press', 'Incline Bench Press', 'Barbell', ['Barbell', 'Flat / Incline Bench', 'Weight Plates'], 'Compound Lift', 'Chest', ['Upper Pectorals', 'Anterior Deltoid', 'Triceps'], true, 195, ['dumbbell_incline_press', 'dumbbell_press', 'barbell_bench_press']),
  mkEx('chin_ups', 'Chin-Ups / Pull-Ups', 'Bodyweight / Weighted', ['Pull-Up Bar'], 'Compound Lift', 'Back', ['Lats', 'Biceps', 'Upper Back / Rhomboids'], true, 210, ['meadows_row', 'barbell_row', 'dumbbell_row']),
  mkEx('dumbbell_press', 'Dumbbell Press', 'Dumbbell', ['Dumbbell', 'Flat / Incline Bench'], 'Compound Lift', 'Chest', ['Mid Pectorals', 'Anterior Deltoid', 'Triceps'], false, 180, ['barbell_bench_press', 'incline_bench_press', 'dumbbell_incline_press']),
  mkEx('dumbbell_incline_press', 'Dumbbell Incline Press', 'Dumbbell', ['Dumbbell', 'Flat / Incline Bench'], 'Compound Lift', 'Chest', ['Upper Pectorals', 'Anterior Deltoid', 'Triceps'], false, 160, ['incline_bench_press', 'dumbbell_press', 'barbell_bench_press']),
  mkEx('meadows_row', "Meadow's Row", 'Landmine / Barbell', ['Landmine', 'Barbell', 'Weight Plates'], 'Compound Lift', 'Back', ['Lats', 'Upper Back / Rhomboids', 'Posterior Deltoid', 'Biceps'], false, 165, ['barbell_row', 'dumbbell_row', 'chin_ups']),
  mkEx('barbell_row', 'Barbell Bent-Over Row', 'Barbell', ['Barbell', 'Weight Plates'], 'Compound Lift', 'Back', ['Upper Back / Rhomboids', 'Lats', 'Biceps'], false, 195, ['meadows_row', 'dumbbell_row', 'chin_ups']),
  mkEx('dumbbell_row', 'Single-Arm Dumbbell Row', 'Dumbbell', ['Dumbbell'], 'Compound Lift', 'Back', ['Lats', 'Upper Back / Rhomboids', 'Biceps'], false, 110, ['meadows_row', 'barbell_row', 'chin_ups']),
  mkEx('front_squat', 'Front Squat', 'Barbell', ['Barbell', 'Squat Rack', 'Weight Plates'], 'Compound Lift', 'Legs', ['Quadriceps', 'Glutes', 'Abs / Core'], false, 225, ['barbell_back_squat', 'split_squat', 'goblet_squat']),
  mkEx('landmine_rdl', 'Landmine RDL', 'Landmine / Barbell', ['Landmine', 'Barbell', 'Weight Plates'], 'Compound Lift', 'Legs', ['Hamstrings', 'Glutes', 'Lats'], false, 215, ['barbell_deadlift', 'dumbbell_rdl']),
  mkEx('dumbbell_rdl', 'Dumbbell RDL', 'Dumbbell', ['Dumbbell'], 'Compound Lift', 'Legs', ['Hamstrings', 'Glutes'], false, 175, ['landmine_rdl', 'barbell_deadlift']),
  mkEx('split_squat', 'Split Squat', 'Dumbbell / Barbell', ['Dumbbell'], 'Compound Lift', 'Legs', ['Quadriceps', 'Glutes', 'Hamstrings'], false, 155, ['front_squat', 'reverse_lunge', 'barbell_back_squat']),
  mkEx('dumbbell_shoulder_press', 'Dumbbell Shoulder Press', 'Dumbbell', ['Dumbbell'], 'Compound Lift', 'Shoulders', ['Anterior Deltoid', 'Lateral Deltoid', 'Triceps'], false, 125, ['overhead_press', 'incline_bench_press']),
  mkEx('goblet_squat', 'Dumbbell Goblet Squat', 'Dumbbell', ['Dumbbell'], 'Compound Lift', 'Legs', ['Quadriceps', 'Glutes'], false, 120, ['front_squat', 'split_squat']),
  mkEx('reverse_lunge', 'Reverse Lunge', 'Dumbbell / Barbell', ['Dumbbell'], 'Accessories', 'Legs', ['Quadriceps', 'Glutes', 'Hamstrings'], false, 135, ['split_squat', 'pistol_squats']),
  mkEx('front_flies', 'Front Flies', 'Dumbbell', ['Dumbbell'], 'Accessories', 'Chest', ['Mid Pectorals', 'Upper Pectorals', 'Anterior Deltoid'], false, 65, ['reverse_flies', 'dumbbell_press']),
  mkEx('pistol_squats', 'Pistol Squats', 'Bodyweight / Dumbbell', [], 'Accessories', 'Legs', ['Quadriceps', 'Glutes'], false, 95, ['reverse_lunge', 'split_squat']),
  mkEx('reverse_flies', 'Reverse Flies', 'Dumbbell', ['Dumbbell'], 'Accessories', 'Shoulders', ['Posterior Deltoid', 'Upper Back / Rhomboids'], false, 55, ['band_pulldown', 'side_raise_dumbbell']),
  mkEx('band_pulldown', 'Band Pulldown', 'Band', ['Resistance Bands'], 'Accessories', 'Back', ['Lats', 'Upper Back / Rhomboids', 'Triceps'], false, 90, ['chin_ups', 'reverse_flies']),
  mkEx('front_raise_ez_bar', 'Front Raise EZ Bar', 'EZ Bar / Barbell', ['EZ Bar'], 'Accessories', 'Shoulders', ['Anterior Deltoid', 'Upper Pectorals'], false, 65, ['side_raise_dumbbell', 'dumbbell_shoulder_press']),
  mkEx('side_raise_dumbbell', 'Side Raise Dumbbell', 'Dumbbell', ['Dumbbell'], 'Accessories', 'Shoulders', ['Lateral Deltoid'], false, 45, ['front_raise_ez_bar', 'reverse_flies']),
  mkEx('barbell_bicep_curl', 'Barbell Bicep Curl', 'Barbell', ['Barbell'], 'Accessories', 'Arms', ['Biceps', 'Forearms'], false, 95, ['dumbbell_hammer_curl', 'tricep_skullcrusher']),
  mkEx('dumbbell_hammer_curl', 'Dumbbell Hammer Curl', 'Dumbbell', ['Dumbbell'], 'Accessories', 'Arms', ['Biceps', 'Forearms'], false, 80, ['barbell_bicep_curl', 'tricep_skullcrusher']),
  mkEx('tricep_skullcrusher', 'EZ-Bar Skullcrusher', 'Barbell / EZ Bar', ['EZ Bar'], 'Accessories', 'Arms', ['Triceps'], false, 95, ['dumbbell_overhead_extension', 'barbell_bicep_curl']),
  mkEx('dumbbell_overhead_extension', 'Dumbbell Tricep Extension', 'Dumbbell', ['Dumbbell'], 'Accessories', 'Arms', ['Triceps'], false, 75, ['tricep_skullcrusher', 'dumbbell_hammer_curl']),
  mkEx('hollow_holds', 'Hollow Holds (45s)', 'Bodyweight', [], 'Abs', 'Core', ['Abs / Core'], false, 45, ['hanging_leg_raises', 'weighted_plank']),
  mkEx('hanging_leg_raises', 'Hanging Leg Raises', 'Bodyweight', ['Pull-Up Bar'], 'Abs', 'Core', ['Abs / Core'], false, 50, ['hollow_holds', 'weighted_plank']),
  mkEx('weighted_plank', 'Weighted Plank (60s)', 'Plate / Bodyweight', [], 'Abs', 'Core', ['Abs / Core'], false, 60, ['hollow_holds', 'hanging_leg_raises'])
];

export const EXERCISE_MAP = Object.fromEntries(EXERCISE_LIBRARY.map(ex => [ex.id, ex]));

export const filterAddSlotExercises = (gymFilterId, category, customGyms = []) => {
  const byGym = EXERCISE_LIBRARY.filter(ex =>
    isExerciseCompatibleWithGymSelection(ex, gymFilterId, customGyms)
  );
  const gymBase = byGym.length > 0 ? byGym : EXERCISE_LIBRARY;
  if (!category || category === 'Supersets') {
    const nonCompound = gymBase.filter(ex => ex.category === 'Accessories' || ex.category === 'Compound Lift');
    return nonCompound.length > 0 ? nonCompound : gymBase;
  }
  const byCatAndGym = byGym.filter(ex => ex.category === category);
  if (byCatAndGym.length > 0) return byCatAndGym;
  const byCatOnly = EXERCISE_LIBRARY.filter(ex => ex.category === category);
  return byCatOnly.length > 0 ? byCatOnly : gymBase;
};

export const getFilteredExercisesForSlotInline = (slot, selectedGymId, customGyms = []) => {
  const currentEx = EXERCISE_MAP[slot.exerciseId] || EXERCISE_LIBRARY[0];
  const targetFamily = slot.familyMuscleGroup || currentEx.muscleGroup || 'Chest';
  const equipmentFilteredLibrary = EXERCISE_LIBRARY.filter(ex =>
    isExerciseCompatibleWithGymSelection(ex, selectedGymId, customGyms)
  );
  const activePoolBase = equipmentFilteredLibrary.length > 0 ? equipmentFilteredLibrary : EXERCISE_LIBRARY;

  if (slot.category === 'Abs') {
    const absMatches = activePoolBase.filter(e => e.category === 'Abs');
    return absMatches.length > 0 ? absMatches : EXERCISE_LIBRARY.filter(e => e.category === 'Abs');
  }
  if (slot.category === 'Compound Lift') {
    const sameFamily = activePoolBase.filter(e => e.category === 'Compound Lift' && e.muscleGroup === targetFamily);
    const others = activePoolBase.filter(e => e.category === 'Compound Lift' && e.muscleGroup !== targetFamily);
    const combined = [...sameFamily, ...others];
    return combined.length > 0 ? combined : activePoolBase;
  }
  if (slot.category === 'Accessories') {
    const sameFamily = activePoolBase.filter(e => e.category === 'Accessories' && e.muscleGroup === targetFamily);
    const sameFamilyAll = activePoolBase.filter(e => e.muscleGroup === targetFamily);
    if (sameFamily.length > 0) return sameFamily;
    if (sameFamilyAll.length > 0) return sameFamilyAll;
    return activePoolBase;
  }
  const sameFamily = activePoolBase.filter(e => e.muscleGroup === targetFamily);
  const others = activePoolBase.filter(e => e.muscleGroup !== targetFamily);
  return [...sameFamily, ...others];
};

export const BIG_FOUR_IDS = ['barbell_bench_press', 'barbell_back_squat', 'barbell_deadlift', 'overhead_press'];
export const EXRX_CLASSES = ['Untrained', 'Novice', 'Intermediate', 'Advanced', 'Elite'];

export const EXRX_RATIOS = {
  barbell_bench_press: { Untrained: 0.61, Novice: 0.79, Intermediate: 0.98, Advanced: 1.34, Elite: 1.66 },
  barbell_back_squat: { Untrained: 0.57, Novice: 1.05, Intermediate: 1.29, Advanced: 1.75, Elite: 2.27 },
  barbell_deadlift: { Untrained: 0.71, Novice: 1.31, Intermediate: 1.50, Advanced: 2.11, Elite: 2.61 },
  overhead_press: { Untrained: 0.40, Novice: 0.55, Intermediate: 0.69, Advanced: 0.87, Elite: 1.16 }
};

export const roundTo5 = val => Math.max(5, Math.round(val / 5) * 5);
export const roundToIncrement = val => Math.max(0, Math.round((Number(val) || 0) * 4) / 4);

export const getExRxTargetForLift = (liftId, targetClass, bodyweightLbs = 220, heightInches = 70, customGoals = {}) => {
  if (targetClass === 'Custom' && customGoals && customGoals[liftId]) {
    return Number(customGoals[liftId]);
  }
  const ratios = EXRX_RATIOS[liftId] || EXRX_RATIOS.barbell_bench_press;
  const ratio = ratios[targetClass] || ratios.Intermediate;
  const heightAdj = 1 + (70 - (heightInches || 70)) * 0.003;
  return roundTo5((bodyweightLbs || 220) * ratio * heightAdj);
};

export const getExRxCurrentClass = (liftId, current1RM, bodyweightLbs = 220, heightInches = 70) => {
  let matched = 'Below Untrained';
  for (const cls of EXRX_CLASSES) {
    const threshold = getExRxTargetForLift(liftId, cls, bodyweightLbs, heightInches);
    if (current1RM >= threshold) matched = cls;
  }
  return matched;
};

export const DEFAULT_ROUTINES = [
  { key: 'full_body_a', label: 'Generic Full Body A' },
  { key: 'full_body_b', label: 'Generic Full Body B' },
  { key: 'arms_only', label: 'Generic Arms Only' }
];

