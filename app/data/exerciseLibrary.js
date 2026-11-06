// ============================================================================
// EXERCISE LIBRARY, GYM EQUIPMENT & EXRX.NET DIRECTORY STANDARDS
// Standardized with https://exrx.net/Lists/Directory
// ============================================================================

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

export const DEFAULT_GYM_EQUIPMENT_PRESETS = [
  { id: '', name: 'Full Gym (All)' },
  { id: 'preset_barbells_only', name: 'Barbells Only' },
  { id: 'preset_dumbbells_only', name: 'Dumbells Only' },
  { id: 'preset_bodyweight_only', name: 'Bodyweight Only' }
];

export const SLOT_CATEGORIES = ['Compound Lift', 'Accessory', 'Superset', 'Abs'];

export const normalizeSlotCategory = rawCat => {
  if (!rawCat) return 'Compound Lift';
  const c = String(rawCat).trim();
  if (c === 'Compound Lift' || c === 'Compound Lifts' || c === 'Compounds') return 'Compound Lift';
  if (c === 'Accessory' || c === 'Accessories') return 'Accessory';
  if (c === 'Superset' || c === 'Supersets') return 'Superset';
  if (c === 'Abs' || c === 'Waist') return 'Abs';
  return 'Compound Lift';
};

export const isSupersetCategory = cat => normalizeSlotCategory(cat) === 'Superset';
export const isAccessoryCategory = cat => normalizeSlotCategory(cat) === 'Accessory';

// Standardized with https://exrx.net/Lists/Directory Body Part Directory
export const MUSCLE_GROUP_OPTIONS = [
  'All Muscles',
  'Legs',
  'Neck',
  'Shoulders',
  'Chest',
  'Back',
  'Upper Arms',
  'Forearms',
  'Waist',
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

const mkEx = (
  id,
  name,
  equipment,
  requiredEquipment,
  category,
  muscleGroup,
  specificMuscles,
  isPriority,
  default1RM,
  alternatives = []
) => ({
  id,
  name,
  equipment,
  requiredEquipment,
  category: normalizeSlotCategory(category),
  muscleGroup,
  specificMuscles,
  isPriority,
  default1RM,
  alternatives
});

// Comprehensive Exercise Library standardized with ExRx.net Directory
// Body parts: Neck, Shoulders, Chest, Back, Upper Arms, Forearms, Waist, Hips, Thighs, Calves
export const EXERCISE_LIBRARY = [
  // --- CHEST (Pectoralis Major - Sternal / Clavicular, Pectoralis Minor, Serratus Anterior) ---
  mkEx('barbell_bench_press', 'Barbell Bench Press', 'Barbell', ['Barbell', 'Flat / Incline Bench', 'Weight Plates'], 'Compound Lift', 'Chest', ['Pectoralis Major - Sternal', 'Deltoid - Anterior', 'Triceps Brachii'], true, 225, ['dumbbell_press', 'incline_bench_press', 'dumbbell_incline_press']),
  mkEx('incline_bench_press', 'Barbell Incline Bench Press', 'Barbell', ['Barbell', 'Flat / Incline Bench', 'Weight Plates'], 'Compound Lift', 'Chest', ['Pectoralis Major - Clavicular', 'Deltoid - Anterior', 'Triceps Brachii'], true, 195, ['dumbbell_incline_press', 'dumbbell_press', 'barbell_bench_press']),
  mkEx('decline_bench_press', 'Barbell Decline Bench Press', 'Barbell', ['Barbell', 'Flat / Incline Bench', 'Weight Plates'], 'Compound Lift', 'Chest', ['Pectoralis Major - Sternal', 'Triceps Brachii', 'Deltoid - Anterior'], false, 235, ['barbell_bench_press', 'chest_dip']),
  mkEx('dumbbell_press', 'Dumbbell Bench Press', 'Dumbbell', ['Dumbbell', 'Flat / Incline Bench'], 'Compound Lift', 'Chest', ['Pectoralis Major - Sternal', 'Deltoid - Anterior', 'Triceps Brachii'], false, 180, ['barbell_bench_press', 'incline_bench_press', 'dumbbell_incline_press']),
  mkEx('dumbbell_incline_press', 'Dumbbell Incline Bench Press', 'Dumbbell', ['Dumbbell', 'Flat / Incline Bench'], 'Compound Lift', 'Chest', ['Pectoralis Major - Clavicular', 'Deltoid - Anterior', 'Triceps Brachii'], false, 160, ['incline_bench_press', 'dumbbell_press', 'barbell_bench_press']),
  mkEx('chest_dip', 'Chest Dip', 'Bodyweight / Weighted', [], 'Compound Lift', 'Chest', ['Pectoralis Major - Sternal', 'Pectoralis Minor', 'Triceps Brachii', 'Deltoid - Anterior'], false, 215, ['barbell_bench_press', 'push_up']),
  mkEx('push_up', 'Push-Up', 'Bodyweight', [], 'Compound Lift', 'Chest', ['Pectoralis Major - Sternal', 'Serratus Anterior', 'Triceps Brachii', 'Deltoid - Anterior'], false, 165, ['dumbbell_press', 'chest_dip']),
  mkEx('front_flies', 'Dumbbell Fly', 'Dumbbell', ['Dumbbell', 'Flat / Incline Bench'], 'Accessory', 'Chest', ['Pectoralis Major - Sternal', 'Pectoralis Major - Clavicular', 'Deltoid - Anterior'], false, 65, ['cable_standing_fly', 'dumbbell_press']),
  mkEx('incline_dumbbell_fly', 'Dumbbell Incline Fly', 'Dumbbell', ['Dumbbell', 'Flat / Incline Bench'], 'Accessory', 'Chest', ['Pectoralis Major - Clavicular', 'Deltoid - Anterior'], false, 60, ['front_flies', 'cable_standing_fly']),
  mkEx('cable_standing_fly', 'Cable Standing Fly', 'Cable', ['Cable Machine'], 'Accessory', 'Chest', ['Pectoralis Major - Sternal', 'Pectoralis Major - Clavicular'], false, 70, ['front_flies', 'incline_dumbbell_fly']),
  mkEx('dumbbell_pullover', 'Dumbbell Pullover', 'Dumbbell', ['Dumbbell', 'Flat / Incline Bench'], 'Accessory', 'Chest', ['Pectoralis Major - Sternal', 'Latissimus Dorsi', 'Serratus Anterior'], false, 75, ['front_flies', 'band_pulldown']),

  // --- BACK (General Back, Latissimus Dorsi, Trapezius, Rhomboids, Infraspinatus & Teres Minor) ---
  mkEx('barbell_deadlift', 'Barbell Deadlift', 'Barbell', ['Barbell', 'Weight Plates'], 'Compound Lift', 'Back', ['Erector Spinae', 'Gluteus Maximus', 'Hamstrings', 'General Back', 'Trapezius - Upper', 'Forearms'], true, 335, ['landmine_rdl', 'dumbbell_rdl', 'barbell_row']),
  mkEx('chin_ups', 'Chin-Up / Pull-Up', 'Bodyweight / Weighted', ['Pull-Up Bar'], 'Compound Lift', 'Back', ['Latissimus Dorsi', 'Biceps Brachii', 'Brachialis', 'Rhomboids', 'Trapezius - Lower'], true, 210, ['cable_pulldown', 'barbell_row', 'dumbbell_row']),
  mkEx('barbell_row', 'Barbell Bent-Over Row', 'Barbell', ['Barbell', 'Weight Plates'], 'Compound Lift', 'Back', ['General Back', 'Latissimus Dorsi', 'Rhomboids', 'Trapezius - Middle', 'Deltoid - Posterior', 'Biceps Brachii'], false, 195, ['meadows_row', 'dumbbell_row', 'chin_ups']),
  mkEx('pendlay_row', 'Barbell Pendlay Row', 'Barbell', ['Barbell', 'Weight Plates'], 'Compound Lift', 'Back', ['General Back', 'Latissimus Dorsi', 'Rhomboids', 'Trapezius - Middle'], false, 185, ['barbell_row', 'dumbbell_row']),
  mkEx('meadows_row', "Landmine Meadow's Row", 'Landmine / Barbell', ['Landmine', 'Barbell', 'Weight Plates'], 'Compound Lift', 'Back', ['Latissimus Dorsi', 'Rhomboids', 'Trapezius - Middle', 'Deltoid - Posterior', 'Biceps Brachii'], false, 165, ['barbell_row', 'dumbbell_row', 'chin_ups']),
  mkEx('t_bar_row', 'Landmine T-Bar Row', 'Landmine / Barbell', ['Landmine', 'Barbell', 'Weight Plates'], 'Compound Lift', 'Back', ['General Back', 'Latissimus Dorsi', 'Rhomboids', 'Biceps Brachii'], false, 190, ['barbell_row', 'meadows_row']),
  mkEx('dumbbell_row', 'Dumbbell Bent-Over Row', 'Dumbbell', ['Dumbbell'], 'Compound Lift', 'Back', ['Latissimus Dorsi', 'General Back', 'Rhomboids', 'Deltoid - Posterior', 'Biceps Brachii'], false, 110, ['meadows_row', 'barbell_row', 'chin_ups']),
  mkEx('cable_pulldown', 'Cable Front Pulldown', 'Cable', ['Cable Machine'], 'Compound Lift', 'Back', ['Latissimus Dorsi', 'Biceps Brachii', 'Rhomboids'], false, 165, ['chin_ups', 'band_pulldown']),
  mkEx('cable_seated_row', 'Cable Seated Row', 'Cable', ['Cable Machine'], 'Compound Lift', 'Back', ['General Back', 'Latissimus Dorsi', 'Rhomboids', 'Trapezius - Middle'], false, 160, ['barbell_row', 'dumbbell_row']),
  mkEx('inverted_row', 'Bodyweight Inverted Row', 'Bodyweight', [], 'Compound Lift', 'Back', ['General Back', 'Rhomboids', 'Trapezius - Middle', 'Latissimus Dorsi', 'Biceps Brachii'], false, 150, ['chin_ups', 'dumbbell_row']),
  mkEx('band_pulldown', 'Band Lat Pulldown', 'Band', ['Resistance Bands'], 'Accessory', 'Back', ['Latissimus Dorsi', 'Rhomboids', 'Triceps Brachii'], false, 90, ['chin_ups', 'cable_pulldown']),
  mkEx('barbell_shrug', 'Barbell Shrug', 'Barbell', ['Barbell', 'Weight Plates'], 'Accessory', 'Back', ['Trapezius - Upper', 'Rhomboids', 'Forearms'], false, 245, ['dumbbell_shrug', 'barbell_deadlift']),
  mkEx('dumbbell_shrug', 'Dumbbell Shrug', 'Dumbbell', ['Dumbbell'], 'Accessory', 'Back', ['Trapezius - Upper', 'Rhomboids', 'Forearms'], false, 180, ['barbell_shrug']),
  mkEx('cable_face_pull', 'Cable Face Pull', 'Cable', ['Cable Machine'], 'Accessory', 'Back', ['Infraspinatus & Teres Minor', 'Deltoid - Posterior', 'Trapezius - Middle', 'Rhomboids'], false, 65, ['reverse_flies']),

  // --- SHOULDERS (Deltoid - Anterior, Deltoid - Lateral, Deltoid - Posterior, Supraspinatus) ---
  mkEx('overhead_press', 'Barbell Military Overhead Press', 'Barbell', ['Barbell', 'Weight Plates'], 'Compound Lift', 'Shoulders', ['Deltoid - Anterior', 'Deltoid - Lateral', 'Triceps Brachii', 'Trapezius - Upper', 'Serratus Anterior'], true, 145, ['dumbbell_shoulder_press', 'arnold_press']),
  mkEx('push_press', 'Barbell Push Press', 'Barbell', ['Barbell', 'Weight Plates'], 'Compound Lift', 'Shoulders', ['Deltoid - Anterior', 'Deltoid - Lateral', 'Triceps Brachii', 'Quadriceps', 'Gluteus Maximus'], false, 165, ['overhead_press', 'dumbbell_shoulder_press']),
  mkEx('dumbbell_shoulder_press', 'Dumbbell Shoulder Press', 'Dumbbell', ['Dumbbell'], 'Compound Lift', 'Shoulders', ['Deltoid - Anterior', 'Deltoid - Lateral', 'Triceps Brachii'], false, 125, ['overhead_press', 'arnold_press']),
  mkEx('arnold_press', 'Dumbbell Arnold Press', 'Dumbbell', ['Dumbbell'], 'Compound Lift', 'Shoulders', ['Deltoid - Anterior', 'Deltoid - Lateral', 'Triceps Brachii'], false, 110, ['dumbbell_shoulder_press', 'overhead_press']),
  mkEx('landmine_shoulder_press', 'Landmine Single-Arm Press', 'Landmine / Barbell', ['Landmine', 'Barbell', 'Weight Plates'], 'Compound Lift', 'Shoulders', ['Deltoid - Anterior', 'Pectoralis Major - Clavicular', 'Triceps Brachii', 'Serratus Anterior'], false, 115, ['overhead_press', 'dumbbell_shoulder_press']),
  mkEx('barbell_upright_row', 'Barbell Upright Row', 'Barbell', ['Barbell', 'Weight Plates'], 'Accessory', 'Shoulders', ['Deltoid - Lateral', 'Trapezius - Upper', 'Supraspinatus', 'Biceps Brachii'], false, 105, ['side_raise_dumbbell', 'front_raise_ez_bar']),
  mkEx('side_raise_dumbbell', 'Dumbbell Lateral Raise', 'Dumbbell', ['Dumbbell'], 'Accessory', 'Shoulders', ['Deltoid - Lateral', 'Supraspinatus'], false, 45, ['cable_lateral_raise', 'front_raise_ez_bar']),
  mkEx('cable_lateral_raise', 'Cable Single-Arm Lateral Raise', 'Cable', ['Cable Machine'], 'Accessory', 'Shoulders', ['Deltoid - Lateral', 'Supraspinatus'], false, 35, ['side_raise_dumbbell']),
  mkEx('front_raise_ez_bar', 'EZ-Bar Front Raise', 'EZ Bar / Barbell', ['EZ Bar'], 'Accessory', 'Shoulders', ['Deltoid - Anterior', 'Pectoralis Major - Clavicular'], false, 65, ['dumbbell_front_raise', 'side_raise_dumbbell']),
  mkEx('dumbbell_front_raise', 'Dumbbell Front Raise', 'Dumbbell', ['Dumbbell'], 'Accessory', 'Shoulders', ['Deltoid - Anterior', 'Pectoralis Major - Clavicular'], false, 50, ['front_raise_ez_bar', 'side_raise_dumbbell']),
  mkEx('reverse_flies', 'Dumbbell Rear Delt Raise', 'Dumbbell', ['Dumbbell'], 'Accessory', 'Shoulders', ['Deltoid - Posterior', 'Infraspinatus & Teres Minor', 'Rhomboids', 'Trapezius - Middle'], false, 55, ['cable_face_pull', 'side_raise_dumbbell']),

  // --- THIGHS (Quadriceps, Hamstrings, Hip Adductors) ---
  mkEx('barbell_back_squat', 'Barbell Back Squat', 'Barbell', ['Barbell', 'Squat Rack', 'Weight Plates'], 'Compound Lift', 'Thighs', ['Quadriceps', 'Gluteus Maximus', 'Hip Adductors', 'Hamstrings', 'Erector Spinae'], true, 285, ['front_squat', 'split_squat', 'goblet_squat']),
  mkEx('front_squat', 'Barbell Front Squat', 'Barbell', ['Barbell', 'Squat Rack', 'Weight Plates'], 'Compound Lift', 'Thighs', ['Quadriceps', 'Gluteus Maximus', 'Rectus Abdominis', 'Erector Spinae'], false, 225, ['barbell_back_squat', 'goblet_squat']),
  mkEx('zercher_squat', 'Barbell Zercher Squat', 'Barbell', ['Barbell', 'Squat Rack', 'Weight Plates'], 'Compound Lift', 'Thighs', ['Quadriceps', 'Gluteus Maximus', 'Erector Spinae', 'Biceps Brachii'], false, 215, ['front_squat', 'barbell_back_squat']),
  mkEx('split_squat', 'Dumbbell Bulgarian Split Squat', 'Dumbbell / Barbell', ['Dumbbell'], 'Compound Lift', 'Thighs', ['Quadriceps', 'Gluteus Maximus', 'Hamstrings'], false, 155, ['reverse_lunge', 'barbell_back_squat']),
  mkEx('goblet_squat', 'Dumbbell Goblet Squat', 'Dumbbell', ['Dumbbell'], 'Compound Lift', 'Thighs', ['Quadriceps', 'Gluteus Maximus'], false, 120, ['front_squat', 'split_squat']),
  mkEx('kettlebell_goblet_squat', 'Kettlebell Goblet Squat', 'Kettlebell', ['Kettlebells'], 'Compound Lift', 'Thighs', ['Quadriceps', 'Gluteus Maximus'], false, 105, ['goblet_squat']),
  mkEx('barbell_rdl', 'Barbell Romanian Deadlift', 'Barbell', ['Barbell', 'Weight Plates'], 'Compound Lift', 'Thighs', ['Hamstrings', 'Gluteus Maximus', 'Erector Spinae'], false, 245, ['landmine_rdl', 'dumbbell_rdl', 'barbell_deadlift']),
  mkEx('landmine_rdl', 'Landmine Romanian Deadlift', 'Landmine / Barbell', ['Landmine', 'Barbell', 'Weight Plates'], 'Compound Lift', 'Thighs', ['Hamstrings', 'Gluteus Maximus', 'Erector Spinae'], false, 215, ['barbell_rdl', 'dumbbell_rdl']),
  mkEx('dumbbell_rdl', 'Dumbbell Romanian Deadlift', 'Dumbbell', ['Dumbbell'], 'Compound Lift', 'Thighs', ['Hamstrings', 'Gluteus Maximus', 'Erector Spinae'], false, 175, ['landmine_rdl', 'barbell_rdl']),
  mkEx('barbell_good_morning', 'Barbell Good Morning', 'Barbell', ['Barbell', 'Weight Plates'], 'Compound Lift', 'Thighs', ['Hamstrings', 'Gluteus Maximus', 'Erector Spinae'], false, 155, ['barbell_rdl']),
  mkEx('reverse_lunge', 'Dumbbell Reverse Lunge', 'Dumbbell / Barbell', ['Dumbbell'], 'Accessory', 'Thighs', ['Quadriceps', 'Gluteus Maximus', 'Hamstrings'], false, 135, ['split_squat', 'pistol_squats']),
  mkEx('pistol_squats', 'Bodyweight Pistol Squat', 'Bodyweight / Dumbbell', [], 'Accessory', 'Thighs', ['Quadriceps', 'Gluteus Maximus', 'Calves'], false, 95, ['reverse_lunge', 'split_squat']),
  mkEx('leg_extension', 'Lever Leg Extension', 'Lever / Machine', ['Lever / Machine'], 'Accessory', 'Thighs', ['Quadriceps'], false, 150, ['goblet_squat', 'pistol_squats']),
  mkEx('lying_leg_curl', 'Lever Lying Leg Curl', 'Lever / Machine', ['Lever / Machine'], 'Accessory', 'Thighs', ['Hamstrings', 'Gastrocnemius'], false, 125, ['dumbbell_rdl', 'nordic_hamstring_curl']),
  mkEx('nordic_hamstring_curl', 'Bodyweight Nordic Hamstring Curl', 'Bodyweight', [], 'Accessory', 'Thighs', ['Hamstrings'], false, 110, ['lying_leg_curl', 'dumbbell_rdl']),

  // --- HIPS (Gluteus Maximus, Hip Abductors, Hip Flexors) ---
  mkEx('barbell_hip_thrust', 'Barbell Hip Thrust', 'Barbell', ['Barbell', 'Flat / Incline Bench', 'Weight Plates'], 'Compound Lift', 'Hips', ['Gluteus Maximus', 'Hamstrings'], false, 275, ['glute_bridge', 'barbell_deadlift']),
  mkEx('kettlebell_swing', 'Kettlebell Two-Arm Swing', 'Kettlebell', ['Kettlebells'], 'Compound Lift', 'Hips', ['Gluteus Maximus', 'Hamstrings', 'Erector Spinae', 'Deltoid - Anterior'], false, 115, ['barbell_hip_thrust', 'dumbbell_rdl']),
  mkEx('glute_bridge', 'Barbell Glute Bridge', 'Barbell / Bodyweight', [], 'Accessory', 'Hips', ['Gluteus Maximus', 'Hamstrings'], false, 225, ['barbell_hip_thrust']),
  mkEx('dumbbell_step_up', 'Dumbbell Step-Up', 'Dumbbell', ['Dumbbell', 'Flat / Incline Bench'], 'Accessory', 'Hips', ['Gluteus Maximus', 'Quadriceps', 'Hamstrings'], false, 125, ['reverse_lunge', 'split_squat']),
  mkEx('band_hip_abduction', 'Band Standing Hip Abduction', 'Band', ['Resistance Bands'], 'Accessory', 'Hips', ['Hip Abductors', 'Gluteus Maximus'], false, 60, ['glute_bridge']),

  // --- UPPER ARMS (Biceps Brachii, Brachialis, Triceps Brachii) ---
  mkEx('close_grip_bench_press', 'Barbell Close-Grip Bench Press', 'Barbell', ['Barbell', 'Flat / Incline Bench', 'Weight Plates'], 'Compound Lift', 'Upper Arms', ['Triceps Brachii', 'Pectoralis Major - Sternal', 'Deltoid - Anterior'], false, 195, ['tricep_dip', 'barbell_bench_press']),
  mkEx('tricep_dip', 'Triceps Dip', 'Bodyweight / Weighted', [], 'Compound Lift', 'Upper Arms', ['Triceps Brachii', 'Pectoralis Major - Sternal', 'Deltoid - Anterior'], false, 205, ['close_grip_bench_press', 'tricep_skullcrusher']),
  mkEx('barbell_bicep_curl', 'Barbell Curl', 'Barbell', ['Barbell'], 'Accessory', 'Upper Arms', ['Biceps Brachii', 'Brachialis', 'Brachioradialis'], false, 95, ['ez_bar_curl', 'dumbbell_bicep_curl', 'dumbbell_hammer_curl']),
  mkEx('ez_bar_curl', 'EZ-Bar Curl', 'EZ Bar', ['EZ Bar'], 'Accessory', 'Upper Arms', ['Biceps Brachii', 'Brachialis', 'Brachioradialis'], false, 95, ['barbell_bicep_curl', 'dumbbell_bicep_curl']),
  mkEx('dumbbell_bicep_curl', 'Dumbbell Standing Biceps Curl', 'Dumbbell', ['Dumbbell'], 'Accessory', 'Upper Arms', ['Biceps Brachii', 'Brachialis'], false, 80, ['barbell_bicep_curl', 'dumbbell_incline_curl']),
  mkEx('dumbbell_incline_curl', 'Dumbbell Incline Biceps Curl', 'Dumbbell', ['Dumbbell', 'Flat / Incline Bench'], 'Accessory', 'Upper Arms', ['Biceps Brachii'], false, 70, ['dumbbell_bicep_curl', 'barbell_bicep_curl']),
  mkEx('dumbbell_hammer_curl', 'Dumbbell Hammer Curl', 'Dumbbell', ['Dumbbell'], 'Accessory', 'Upper Arms', ['Brachialis', 'Brachioradialis', 'Biceps Brachii'], false, 80, ['barbell_bicep_curl', 'reverse_barbell_curl']),
  mkEx('dumbbell_concentration_curl', 'Dumbbell Concentration Curl', 'Dumbbell', ['Dumbbell'], 'Accessory', 'Upper Arms', ['Biceps Brachii', 'Brachialis'], false, 65, ['dumbbell_bicep_curl']),
  mkEx('tricep_skullcrusher', 'EZ-Bar Lying Triceps Extension (Skullcrusher)', 'Barbell / EZ Bar', ['EZ Bar'], 'Accessory', 'Upper Arms', ['Triceps Brachii'], false, 95, ['dumbbell_overhead_extension', 'cable_tricep_pushdown']),
  mkEx('dumbbell_overhead_extension', 'Dumbbell Overhead Triceps Extension', 'Dumbbell', ['Dumbbell'], 'Accessory', 'Upper Arms', ['Triceps Brachii'], false, 75, ['tricep_skullcrusher', 'cable_tricep_pushdown']),
  mkEx('dumbbell_kickback', 'Dumbbell Triceps Kickback', 'Dumbbell', ['Dumbbell'], 'Accessory', 'Upper Arms', ['Triceps Brachii'], false, 55, ['dumbbell_overhead_extension']),
  mkEx('cable_tricep_pushdown', 'Cable Triceps Pushdown', 'Cable', ['Cable Machine'], 'Accessory', 'Upper Arms', ['Triceps Brachii'], false, 85, ['tricep_skullcrusher', 'dumbbell_overhead_extension']),

  // --- FOREARMS (Brachioradialis, Wrist Flexors, Wrist Extensors, Pronators, Supinators) ---
  mkEx('reverse_barbell_curl', 'Barbell Reverse Curl', 'Barbell / EZ Bar', ['Barbell'], 'Accessory', 'Forearms', ['Brachioradialis', 'Wrist Extensors', 'Brachialis', 'Biceps Brachii'], false, 75, ['dumbbell_hammer_curl', 'barbell_wrist_curl']),
  mkEx('barbell_wrist_curl', 'Barbell Wrist Curl', 'Barbell', ['Barbell'], 'Accessory', 'Forearms', ['Wrist Flexors'], false, 85, ['dumbbell_wrist_curl']),
  mkEx('dumbbell_wrist_curl', 'Dumbbell Wrist Curl', 'Dumbbell', ['Dumbbell'], 'Accessory', 'Forearms', ['Wrist Flexors'], false, 60, ['barbell_wrist_curl']),
  mkEx('reverse_wrist_curl', 'Barbell Reverse Wrist Curl', 'Barbell / Dumbbell', ['Barbell'], 'Accessory', 'Forearms', ['Wrist Extensors'], false, 50, ['reverse_barbell_curl']),
  mkEx('farmers_walk', 'Dumbbell Farmers Walk', 'Dumbbell / Kettlebell', ['Dumbbell'], 'Accessory', 'Forearms', ['Wrist Flexors', 'Trapezius - Upper', 'Gluteus Maximus', 'Calves'], false, 185, ['barbell_shrug']),

  // --- CALVES (Gastrocnemius, Soleus, Tibialis Anterior) ---
  mkEx('standing_calf_raise', 'Barbell Standing Calf Raise', 'Barbell / Dumbbell', ['Barbell'], 'Accessory', 'Calves', ['Gastrocnemius', 'Soleus'], false, 225, ['dumbbell_calf_raise', 'seated_calf_raise']),
  mkEx('dumbbell_calf_raise', 'Dumbbell Single-Leg Calf Raise', 'Dumbbell / Bodyweight', ['Dumbbell'], 'Accessory', 'Calves', ['Gastrocnemius', 'Soleus'], false, 115, ['standing_calf_raise']),
  mkEx('seated_calf_raise', 'Barbell Seated Calf Raise', 'Barbell / Dumbbell', ['Barbell', 'Flat / Incline Bench'], 'Accessory', 'Calves', ['Soleus', 'Gastrocnemius'], false, 175, ['standing_calf_raise']),
  mkEx('tibialis_raise', 'Bodyweight Tibialis Anterior Raise', 'Bodyweight', [], 'Accessory', 'Calves', ['Tibialis Anterior'], false, 65, ['standing_calf_raise']),

  // --- NECK (Sternocleidomastoid, Splenius) ---
  mkEx('neck_flexion', 'Weighted Lying Neck Flexion', 'Weight Plates / Bodyweight', [], 'Accessory', 'Neck', ['Sternocleidomastoid'], false, 45, ['neck_extension']),
  mkEx('neck_extension', 'Weighted Lying Neck Extension', 'Weight Plates / Bodyweight', [], 'Accessory', 'Neck', ['Splenius', 'Trapezius - Upper'], false, 55, ['neck_flexion']),

  // --- WAIST / ABS (Rectus Abdominis, Obliques, Transverse Abdominis, Erector Spinae) ---
  mkEx('hollow_holds', 'Hollow Body Hold (45s)', 'Bodyweight', [], 'Abs', 'Waist', ['Rectus Abdominis', 'Transverse Abdominis', 'Obliques'], false, 45, ['hanging_leg_raises', 'weighted_plank']),
  mkEx('hanging_leg_raises', 'Hanging Leg-Hip Raise', 'Bodyweight', ['Pull-Up Bar'], 'Abs', 'Waist', ['Rectus Abdominis', 'Obliques', 'Hip Flexors'], false, 50, ['hollow_holds', 'weighted_plank']),
  mkEx('weighted_plank', 'Weighted Front Plank (60s)', 'Plate / Bodyweight', [], 'Abs', 'Waist', ['Rectus Abdominis', 'Transverse Abdominis', 'Obliques', 'Erector Spinae'], false, 60, ['hollow_holds', 'side_plank']),
  mkEx('side_plank', 'Side Plank (45s)', 'Bodyweight', [], 'Abs', 'Waist', ['Obliques', 'Transverse Abdominis', 'Quadratus Lumborum'], false, 45, ['weighted_plank', 'russian_twist']),
  mkEx('ab_crunch', 'Weighted Crunch', 'Bodyweight / Plate', [], 'Abs', 'Waist', ['Rectus Abdominis', 'Obliques'], false, 45, ['hollow_holds', 'bicycle_crunch']),
  mkEx('bicycle_crunch', 'Lying Twist Bicycle Crunch', 'Bodyweight', [], 'Abs', 'Waist', ['Obliques', 'Rectus Abdominis'], false, 45, ['ab_crunch', 'russian_twist']),
  mkEx('russian_twist', 'Seated Russian Twist', 'Bodyweight / Dumbbell', [], 'Abs', 'Waist', ['Obliques', 'Rectus Abdominis'], false, 45, ['bicycle_crunch', 'side_plank']),
  mkEx('cable_kneeling_crunch', 'Cable Kneeling Crunch', 'Cable', ['Cable Machine'], 'Abs', 'Waist', ['Rectus Abdominis', 'Obliques'], false, 60, ['ab_crunch', 'hanging_leg_raises']),
  mkEx('barbell_rollout', 'Barbell Ab Rollout', 'Barbell / Bodyweight', ['Barbell'], 'Abs', 'Waist', ['Rectus Abdominis', 'Transverse Abdominis', 'Latissimus Dorsi'], false, 45, ['weighted_plank', 'hollow_holds']),
  mkEx('back_extension', '45° Back Extension (Hyperextension)', 'Bodyweight / Plate', [], 'Abs', 'Waist', ['Erector Spinae', 'Gluteus Maximus', 'Hamstrings'], false, 60, ['barbell_good_morning'])
];

export const EXERCISE_MAP = Object.fromEntries(EXERCISE_LIBRARY.map(ex => [ex.id, ex]));

export const sortExercisesAlphabetically = list =>
  [...(list || [])].sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));

export const doesExerciseInteractWithMuscleGroup = (ex, muscleGroupFilter) => {
  if (!ex) return false;
  if (!muscleGroupFilter || muscleGroupFilter === 'All Muscles' || muscleGroupFilter === 'All') {
    return true;
  }
  const primary = (ex.muscleGroup || '').toLowerCase();
  const specs = (ex.specificMuscles || []).map(s => s.toLowerCase());
  const target = muscleGroupFilter.toLowerCase();

  if (primary === target) return true;

  if (target === 'neck') {
    return primary === 'neck' || specs.some(s => s.includes('sternocleidomastoid') || s.includes('splenius'));
  }
  if (target === 'shoulders') {
    return primary === 'shoulders' || specs.some(s => s.includes('deltoid') || s.includes('supraspinatus'));
  }
  if (target === 'chest') {
    return primary === 'chest' || specs.some(s => s.includes('pectoral') || s.includes('serratus'));
  }
  if (target === 'back') {
    return (
      primary === 'back' ||
      specs.some(
        s =>
          s.includes('latissimus') ||
          s.includes('lats') ||
          s.includes('trapezius') ||
          s.includes('rhomboid') ||
          s.includes('infraspinatus') ||
          s.includes('teres') ||
          s.includes('general back')
      )
    );
  }
  if (target === 'upper arms' || target === 'arms') {
    return (
      primary === 'upper arms' ||
      primary === 'arms' ||
      specs.some(s => s.includes('bicep') || s.includes('tricep') || s.includes('brachialis'))
    );
  }
  if (target === 'forearms') {
    return (
      primary === 'forearms' ||
      specs.some(s => s.includes('brachioradialis') || s.includes('wrist') || s.includes('forearm'))
    );
  }
  if (target === 'waist' || target === 'core' || target === 'abs') {
    return (
      primary === 'waist' ||
      primary === 'core' ||
      ex.category === 'Abs' ||
      specs.some(
        s =>
          s.includes('abdominis') ||
          s.includes('oblique') ||
          s.includes('erector spinae') ||
          s.includes('quadratus') ||
          s.includes('abs') ||
          s.includes('core')
      )
    );
  }
  if (target === 'hips') {
    return (
      primary === 'hips' ||
      specs.some(s => s.includes('glute') || s.includes('abductor') || s.includes('hip flexor'))
    );
  }
  if (target === 'legs') {
    return (
      primary === 'legs' ||
      primary === 'thighs' ||
      primary === 'hips' ||
      primary === 'calves' ||
      specs.some(
        s =>
          s.includes('quadriceps') ||
          s.includes('hamstrings') ||
          s.includes('adductor') ||
          s.includes('glute') ||
          s.includes('abductor') ||
          s.includes('calf') ||
          s.includes('calves') ||
          s.includes('gastrocnemius') ||
          s.includes('soleus') ||
          s.includes('tibialis')
      )
    );
  }
  if (target === 'thighs') {
    return (
      primary === 'thighs' ||
      specs.some(s => s.includes('quadriceps') || s.includes('hamstrings') || s.includes('adductor'))
    );
  }
  if (target === 'calves') {
    return (
      primary === 'calves' ||
      specs.some(s => s.includes('gastrocnemius') || s.includes('soleus') || s.includes('tibialis') || s.includes('calves'))
    );
  }
  return false;
};

export const getAvailableMuscleGroupsForCategory = (category, selectedGymId = '', customGyms = []) => {
  const normCat = normalizeSlotCategory(category);
  const byGym = EXERCISE_LIBRARY.filter(ex =>
    isExerciseCompatibleWithGymSelection(ex, selectedGymId, customGyms)
  );
  const gymBase = byGym.length > 0 ? byGym : EXERCISE_LIBRARY;

  let catPool;
  if (normCat === 'Abs') {
    const m = gymBase.filter(e => e.category === 'Abs');
    catPool = m.length > 0 ? m : EXERCISE_LIBRARY.filter(e => e.category === 'Abs');
  } else if (normCat === 'Compound Lift') {
    const m = gymBase.filter(e => e.category === 'Compound Lift');
    catPool = m.length > 0 ? m : EXERCISE_LIBRARY.filter(e => e.category === 'Compound Lift');
  } else if (normCat === 'Accessory') {
    const m = gymBase.filter(e => e.category === 'Accessory');
    catPool = m.length > 0 ? m : EXERCISE_LIBRARY.filter(e => e.category === 'Accessory');
  } else {
    catPool = gymBase;
  }

  return MUSCLE_GROUP_OPTIONS.filter(
    mg => mg === 'All Muscles' || catPool.some(ex => doesExerciseInteractWithMuscleGroup(ex, mg))
  );
};

export const filterAddSlotExercises = (gymFilterId, category, customGyms = [], muscleGroupFilter = 'All Muscles') => {
  const normCat = normalizeSlotCategory(category);
  const byGym = EXERCISE_LIBRARY.filter(ex =>
    isExerciseCompatibleWithGymSelection(ex, gymFilterId, customGyms)
  );
  const gymBase = byGym.length > 0 ? byGym : EXERCISE_LIBRARY;

  let catPool;
  if (!category || normCat === 'Superset') {
    const nonAbs = gymBase.filter(ex => ex.category === 'Accessory' || ex.category === 'Compound Lift');
    catPool = nonAbs.length > 0 ? nonAbs : gymBase;
  } else {
    const byCatAndGym = byGym.filter(ex => ex.category === normCat);
    if (byCatAndGym.length > 0) {
      catPool = byCatAndGym;
    } else {
      const byCatOnly = EXERCISE_LIBRARY.filter(ex => ex.category === normCat);
      catPool = byCatOnly.length > 0 ? byCatOnly : gymBase;
    }
  }

  const byMuscle = catPool.filter(ex => doesExerciseInteractWithMuscleGroup(ex, muscleGroupFilter));
  return sortExercisesAlphabetically(byMuscle.length > 0 ? byMuscle : catPool);
};

export const getFilteredExercisesForSlotInline = (slot, selectedGymId, customGyms = []) => {
  const normCat = normalizeSlotCategory(slot?.category);
  const equipmentFilteredLibrary = EXERCISE_LIBRARY.filter(ex =>
    isExerciseCompatibleWithGymSelection(ex, selectedGymId, customGyms)
  );
  const activePoolBase = equipmentFilteredLibrary.length > 0 ? equipmentFilteredLibrary : EXERCISE_LIBRARY;
  const muscleFilter = slot?.muscleGroupFilter || 'All Muscles';

  let catPool;
  if (normCat === 'Abs') {
    const absMatches = activePoolBase.filter(e => e.category === 'Abs');
    catPool = absMatches.length > 0 ? absMatches : EXERCISE_LIBRARY.filter(e => e.category === 'Abs');
  } else if (normCat === 'Compound Lift') {
    const compMatches = activePoolBase.filter(e => e.category === 'Compound Lift');
    catPool = compMatches.length > 0 ? compMatches : EXERCISE_LIBRARY.filter(e => e.category === 'Compound Lift');
  } else if (normCat === 'Accessory') {
    const accMatches = activePoolBase.filter(e => e.category === 'Accessory');
    catPool = accMatches.length > 0 ? accMatches : EXERCISE_LIBRARY.filter(e => e.category === 'Accessory');
  } else {
    catPool = activePoolBase;
  }

  const byMuscle = catPool.filter(ex => doesExerciseInteractWithMuscleGroup(ex, muscleFilter));
  return sortExercisesAlphabetically(byMuscle.length > 0 ? byMuscle : catPool);
};

export const BIG_FOUR_IDS = ['barbell_bench_press', 'barbell_back_squat', 'barbell_deadlift', 'overhead_press'];
export const CORE_PR_EXERCISE_IDS = [
  'barbell_bench_press',
  'barbell_back_squat',
  'barbell_deadlift',
  'overhead_press',
  'chin_ups'
];
export const EXRX_CLASSES = ['Untrained', 'Novice', 'Intermediate', 'Advanced', 'Elite'];

export const EXRX_RATIOS = {
  barbell_bench_press: { Untrained: 0.61, Novice: 0.79, Intermediate: 0.98, Advanced: 1.34, Elite: 1.66 },
  barbell_back_squat: { Untrained: 0.57, Novice: 1.05, Intermediate: 1.29, Advanced: 1.75, Elite: 2.27 },
  barbell_deadlift: { Untrained: 0.71, Novice: 1.31, Intermediate: 1.50, Advanced: 2.11, Elite: 2.61 },
  overhead_press: { Untrained: 0.40, Novice: 0.55, Intermediate: 0.69, Advanced: 0.87, Elite: 1.16 },
  incline_bench_press: { Untrained: 0.50, Novice: 0.67, Intermediate: 0.83, Advanced: 1.13, Elite: 1.41 },
  chin_ups: { Untrained: 0.55, Novice: 0.75, Intermediate: 0.95, Advanced: 1.25, Elite: 1.53 }
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
