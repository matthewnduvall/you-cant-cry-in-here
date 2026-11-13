// ============================================================================
// A routine as a .csv file (EXPORT .CSV in the routine editor): one row per set.
// Routine,Exercise,Equipment,Set,Type,Weight,Reps,Time,Scheme
// Exercise is the full library name (the History import and search find it by name); a superset's sets carry
// "A" / "B" in the Set column (A1, B1, A2…). Weight is in lb; Time (M:SS) only on timed sets.
// ============================================================================

import { EXERCISE_MAP, getSlotEquipmentChoice, isSupersetCategory } from '../data/exerciseLibrary';
import { getSupersetSchemes, normalizeSetType } from './workoutEngine';

const csvField = value => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const timeOf = st => {
  const secs = Number(st?.durationSeconds) || 0;
  if (typeof st?.timerStr === 'string' && st.timerStr.includes(':')) return st.timerStr;
  return secs > 0 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : '';
};

/** The routine's sets as CSV text. */
export const routineToCsv = routine => {
  const label = routine?.label || routine?.title || 'Routine';
  const rows = [['Routine', 'Exercise', 'Equipment', 'Set', 'Type', 'Weight', 'Reps', 'Time', 'Scheme']];
  (routine?.slots || []).forEach(slot => {
    const isSup = isSupersetCategory(slot?.category) && Array.isArray(slot?.supersetSetsByExercise);
    const halves = isSup
      ? slot.supersetSetsByExercise.map((sets, i) => ({ sets, exId: (slot.supersetExerciseIds || [])[i], tag: i === 0 ? 'A' : 'B', half: i }))
      : [{ sets: slot?.sets, exId: slot?.exerciseId, tag: '', half: 0 }];
    const schemes = isSup ? getSupersetSchemes(slot) : [slot?.scheme];
    halves.forEach(({ sets, exId, tag, half }) => {
      (sets || []).forEach((st, i) => {
        rows.push([
          label,
          EXERCISE_MAP[exId]?.name || exId || '',
          getSlotEquipmentChoice(slot, half) || EXERCISE_MAP[exId]?.equipment || '',
          `${tag}${Number(st?.setNumber) > 0 ? st.setNumber : i + 1}`,
          normalizeSetType(st?.type),
          Number(st?.weight) || 0,
          Number(st?.reps) || '',
          timeOf(st),
          schemes[half] || ''
        ]);
      });
    });
  });
  return rows.map(r => r.map(csvField).join(',')).join('\n');
};

/** Downloads the routine as "<name>.csv". */
export const downloadRoutineCsv = routine => {
  if (typeof document === 'undefined') return;
  const name = String(routine?.label || routine?.title || 'routine').trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_') || 'routine';
  const blob = new Blob([routineToCsv(routine)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${name}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
