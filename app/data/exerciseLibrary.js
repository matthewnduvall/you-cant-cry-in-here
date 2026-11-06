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
  'Neck',
  'Shoulders',
  'Upper Arms',
  'Forearms',
  'Back',
  'Chest',
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

export const formatDateYMD = dateInput => {
  if (!dateInput) return formatTodayYMD();
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    const match = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (match) {
      return `${match[1]}/${String(match[2]).padStart(2, '0')}/${String(match[3]).padStart(2, '0')}`;
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

export const getDefaultSessionName = () => `${formatTodayYMD()} - Session`;
export const getDefaultAutoSessionName = () => `${formatTodayYMD()} - Auto Session`;

export const formatTodayShortDate = () => formatTodayYMD();

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
  mkEx('barbell_deadlift', 'Barbell Deadlift', 'Barbell', ['Barbell', 'Weight Plates'], 'Compound Lift', 'Back', ['Erector Spinae', 'Gluteus Maximus', 'Hamstrings', 'General Back', 'Trapezius - Upper', 'Forearms'], true, 350, ['landmine_rdl', 'dumbbell_rdl', 'barbell_row']),
  mkEx('chin_ups', 'Chin-Up / Pull-Up', 'Bodyweight / Weighted', ['Pull-Up Bar'], 'Compound Lift', 'Back', ['Latissimus Dorsi', 'Biceps Brachii', 'Brachialis', 'Rhomboids', 'Trapezius - Lower'], true, 220, ['cable_pulldown', 'barbell_row', 'dumbbell_row']),
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
  mkEx('overhead_press', 'Barbell Military Overhead Press', 'Barbell', ['Barbell', 'Weight Plates'], 'Compound Lift', 'Shoulders', ['Deltoid - Anterior', 'Deltoid - Lateral', 'Triceps Brachii', 'Trapezius - Upper', 'Serratus Anterior'], true, 155, ['dumbbell_shoulder_press', 'arnold_press']),
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
  mkEx('barbell_back_squat', 'Barbell Back Squat', 'Barbell', ['Barbell', 'Squat Rack', 'Weight Plates'], 'Compound Lift', 'Thighs', ['Quadriceps', 'Gluteus Maximus', 'Hip Adductors', 'Hamstrings', 'Erector Spinae'], true, 300, ['front_squat', 'split_squat', 'goblet_squat']),
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
  const primary = (ex.muscleGroup || '').trim().toLowerCase();
  const target = String(muscleGroupFilter || '').trim().toLowerCase();

  // Direct match against the 10 ExRx.net Body Part Directory groups:
  // Neck, Shoulders, Upper Arms, Forearms, Back, Chest, Waist, Hips, Thighs, Calves
  if (primary === target) return true;

  // Legacy alias handling
  if ((target === 'upper arms' || target === 'arms') && (primary === 'upper arms' || primary === 'arms')) {
    return true;
  }
  if ((target === 'waist' || target === 'core' || target === 'abs') && (primary === 'waist' || ex.category === 'Abs')) {
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

  if (!muscleGroupFilter || muscleGroupFilter === 'All Muscles' || muscleGroupFilter === 'All') {
    return sortExercisesAlphabetically(catPool);
  }

  const byMuscleInCat = catPool.filter(ex => doesExerciseInteractWithMuscleGroup(ex, muscleGroupFilter));
  if (byMuscleInCat.length > 0) {
    return sortExercisesAlphabetically(byMuscleInCat);
  }

  const byMuscleInGym = gymBase.filter(ex => doesExerciseInteractWithMuscleGroup(ex, muscleGroupFilter));
  if (byMuscleInGym.length > 0) {
    return sortExercisesAlphabetically(byMuscleInGym);
  }

  const byMuscleAll = EXERCISE_LIBRARY.filter(ex => doesExerciseInteractWithMuscleGroup(ex, muscleGroupFilter));
  return sortExercisesAlphabetically(byMuscleAll.length > 0 ? byMuscleAll : catPool);
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

  if (!muscleFilter || muscleFilter === 'All Muscles' || muscleFilter === 'All') {
    return sortExercisesAlphabetically(catPool);
  }

  const byMuscleInCat = catPool.filter(ex => doesExerciseInteractWithMuscleGroup(ex, muscleFilter));
  if (byMuscleInCat.length > 0) {
    return sortExercisesAlphabetically(byMuscleInCat);
  }

  const byMuscleInGym = activePoolBase.filter(ex => doesExerciseInteractWithMuscleGroup(ex, muscleFilter));
  if (byMuscleInGym.length > 0) {
    return sortExercisesAlphabetically(byMuscleInGym);
  }

  const byMuscleAll = EXERCISE_LIBRARY.filter(ex => doesExerciseInteractWithMuscleGroup(ex, muscleFilter));
  return sortExercisesAlphabetically(byMuscleAll.length > 0 ? byMuscleAll : catPool);
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

export const getExRxTargetForLift = (liftId, targetClass, bodyweightLbs = 220, heightInches = 70, customGoals = {}) => {
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

export const DEFAULT_ROUTINES = [
  { key: 'full_body_a', label: 'Generic Full Body A' },
  { key: 'full_body_b', label: 'Generic Full Body B' },
  { key: 'arms_only', label: 'Generic Arms Only' }
];
