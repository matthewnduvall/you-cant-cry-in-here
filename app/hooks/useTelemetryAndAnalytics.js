'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  MUSCLE_GROUP_OPTIONS,
  isSupersetCategory,
  doesExerciseInteractWithMuscleGroup,
  formatDateYMD,
  parseYMDToISO
} from '../data/exerciseLibrary';
import { getPersonalRecord1RM, isCalculated1RMSet, estimateSet1RM,
  withEffectiveLoad
} from '../utils/workoutEngine';
import { getSlotEquipmentChoice } from '../data/exerciseLibrary';

// Muscle groups with no logged training: neutral grey, so a new account isn't shown as all "overdue"
export const UNLOGGED_STIMULUS_COLOR = '#3A3A3A';

// Stimulus colour is a smooth blend by time since a muscle was trained: white just after training, pink when it
// has recovered (the end of RECOVERING), red once it is overdue (the end of RECOVERED).
export const STIMULUS_WHITE = '#FFFFFF';
// Recovered: pink, halfway between white and red
export const STIMULUS_PINK = '#FFA59E';
export const STIMULUS_RED = '#FF4A3D';
const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const [ra, ga, ba] = hexToRgb(a);
  const [rb, gb, bb] = hexToRgb(b);
  const ch = (x, y) => Math.round(x + (y - x) * Math.min(1, Math.max(0, t))).toString(16).padStart(2, '0');
  return `#${ch(ra, rb)}${ch(ga, gb)}${ch(ba, bb)}`;
};
/** The colour for `days` (may be fractional) since training, with RECOVERING up to greenMax and RECOVERED up to
 * yellowMax: white at 0 → pink at greenMax + 1 → red at yellowMax + 1. */
export const stimulusColorForDays = (days, greenMax = 2, yellowMax = 4) => {
  const d = Math.max(0, Number(days) || 0);
  const g = Math.max(0.5, Number(greenMax) + 1);
  const y = Math.max(g + 0.5, Number(yellowMax) + 1);
  return d <= g ? mix(STIMULUS_WHITE, STIMULUS_PINK, d / g) : mix(STIMULUS_PINK, STIMULUS_RED, (d - g) / (y - g));
};

/**
 * Calendar days between a workout and now, in local time: trained yesterday = 1, whatever the hour (a 24-hour count
 * called a workout 47 hours ago "1 day" and kept it green a day too long). null for a missing or invalid date.
 */
const calendarDaysAgo = (startedAt, nowMs) => {
  const then = new Date(startedAt);
  if (!startedAt || Number.isNaN(then.getTime())) return null;
  const now = new Date(nowMs);
  const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.max(0, Math.round((dayStart(now) - dayStart(then)) / 86400000));
};

/** Per exercise: one point per day with the best estimated 1RM and total volume (PROGRESS chart; also friends' profiles). */
export function buildProgressionSeriesByLift(history) {
  const normalizedWorkouts = (history || []).map((w, rawIdx) => {
    // A saved workoutDate counts only when it is a full date (older builds could store a half-typed one)
    const wd = /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(String(w?.workoutDate || '').trim()) ? w.workoutDate : null;
    const dateLabel = formatDateYMD(wd || w?.startedAt);
    const iso = parseYMDToISO(dateLabel);
    const parsedMs = new Date(iso).getTime();
    const fallbackMs = new Date(w?.startedAt || 0).getTime();
    const timestampMs = Number.isFinite(parsedMs)
      ? parsedMs
      : Number.isFinite(fallbackMs)
        ? fallbackMs
        : 0;
    return {
      workout: w,
      rawIdx,
      dateLabel,
      timestampMs
    };
  });

  normalizedWorkouts.sort(
    (a, b) => a.timestampMs - b.timestampMs || a.dateLabel.localeCompare(b.dateLabel)
  );

  const map = {};
  EXERCISE_LIBRARY.forEach(ex => {
    const liftId = ex.id;
    const byDateMap = new Map();

    normalizedWorkouts.forEach(({ workout: w, rawIdx, dateLabel, timestampMs }) => {
      let top1RM = 0;
      // the day's best 1RM was worked out from reps (or the 1RM calculator), not lifted for 1 rep
      let topCalculated = false;
      let totalVol = 0;

      const accumulateSetsForExercise = (setsList, option = null) => {
        // Bodyweight-type exercises: their load by the slot's equipment choice
        const arr = withEffectiveLoad(liftId, setsList, option);
        const hasCompleted = arr.some(s => s && s.completed && Number(s.weight) > 0);
        arr.forEach(s => {
          if (!s || Number(s.weight) <= 0) return;
          if (hasCompleted && !s.completed) return;
          const wVal = Number(s.weight) || 0;
          const rVal = Math.max(1, Number(s.reps) || 1);
          // Reps in reserve count as reps the set could have done (estimateSet1RM)
          const est1RM = Math.round(estimateSet1RM(s));
          const calc = isCalculated1RMSet(s);
          if (est1RM > top1RM || (est1RM === top1RM && topCalculated && !calc)) {
            top1RM = est1RM;
            topCalculated = calc;
          }
          totalVol += wVal * rVal;
        });
      };

      (w.slots || []).forEach(slot => {
        if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetSetsByExercise)) {
          const ids =
            slot.supersetExerciseIds || [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
          ids.forEach((id, idx) => {
            if (id === liftId) {
              accumulateSetsForExercise(slot.supersetSetsByExercise[idx], getSlotEquipmentChoice(slot, idx));
            }
          });
        } else if (slot.exerciseId === liftId) {
          accumulateSetsForExercise(slot.sets, getSlotEquipmentChoice(slot, 0));
        }
      });

      if (top1RM > 0 || totalVol > 0) {
        const roundedVol = Math.round(totalVol);
        const existing = byDateMap.get(dateLabel);
        if (!existing) {
          byDateMap.set(dateLabel, {
            workoutId: w.id || `workout_${rawIdx}`,
            dateLabel,
            timestampMs,
            weight: top1RM,
            calculated: top1RM > 0 && topCalculated,
            volume: roundedVol
          });
        } else {
          // The point opens the workout with the day's best set
          if (top1RM > existing.weight || (top1RM === existing.weight && existing.calculated && !topCalculated)) {
            existing.weight = top1RM;
            existing.calculated = top1RM > 0 && topCalculated;
            existing.workoutId = w.id || existing.workoutId;
          }
          existing.volume += roundedVol;
        }
      }
    });

    const points = Array.from(byDateMap.values()).sort(
      (a, b) => a.timestampMs - b.timestampMs || a.dateLabel.localeCompare(b.dateLabel)
    );
    map[liftId] = points;
  });
  return map;
}

export function useTelemetryAndAnalytics({
  history,
  oneRepMaxes,
  userHeightFeet,
  userHeightInches,
  stimulusGreenDays,
  stimulusYellowDays,
  // Bodyweight-type exercises count it in their 1RM: the 1RMs and chart are worked out again when it changes
  bodyweightLbs = 0
}) {
  // Computed Personal Records (Updated from Highest Calculated 1RM in History + Manual Overrides)
  const effectiveOneRepMaxes = useMemo(() => {
    const map = {};
    EXERCISE_LIBRARY.forEach(ex => {
      const best = getPersonalRecord1RM(ex.id, history, oneRepMaxes);
      if (best > 0) map[ex.id] = best;
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, oneRepMaxes, bodyweightLbs]);

  const totalHeightInches = useMemo(() => {
    return (Number(userHeightFeet) || 5) * 12 + (Number(userHeightInches) || 10);
  }, [userHeightFeet, userHeightInches]);

  // "Now" for the stimulus map. Kept current while the app stays open (an iPhone home-screen app can run for days):
  // every minute and whenever the app comes back to the foreground, not only when History changes.
  const [stimulusNowMs, setStimulusNowMs] = useState(null);
  useEffect(() => {
    setStimulusNowMs(Date.now());
  }, [history]);
  useEffect(() => {
    const tick = () => setStimulusNowMs(Date.now());
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    const timer = setInterval(tick, 60000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    };
  }, []);

  const muscleStimulusStatus = useMemo(() => {
    const groups = MUSCLE_GROUP_OPTIONS.filter(g => g !== 'All Muscles');
    const result = {};

    groups.forEach(g => {
      let minDays = 99;
      // The latest time it was trained (for the colour's smooth blend: fractional days)
      let lastMs = 0;
      if (stimulusNowMs !== null) {
        history.forEach(w => {
          const daysAgo = calendarDaysAgo(w.startedAt, stimulusNowMs);
          if (daysAgo === null) return;
          const wMs = typeof w.startedAt === 'number' ? w.startedAt : Date.parse(w.startedAt || '');
          (w.slots || []).forEach(slot => {
            const ids =
              isSupersetCategory(slot.category) && slot.supersetExerciseIds
                ? slot.supersetExerciseIds
                : [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
            ids.forEach(id => {
              const ex = EXERCISE_MAP[id];
              if (ex && doesExerciseInteractWithMuscleGroup(ex, g)) {
                if (daysAgo < minDays) minDays = daysAgo;
                if (Number.isFinite(wMs) && wMs > lastMs) lastMs = wMs;
              }
            });
          });
        });
      }

      const greenMax = Number.isFinite(Number(stimulusGreenDays)) && Number(stimulusGreenDays) >= 0 ? Number(stimulusGreenDays) : 2;
      const yellowMax = Math.max(greenMax + 1, Number(stimulusYellowDays) || 4);
      // Colour: a blend along white → pink → red by fractional days (labels and patterns still step by whole days)
      const fracDays = lastMs > 0 && stimulusNowMs !== null ? Math.max(0, (stimulusNowMs - lastMs) / 86400000) : minDays;
      let statusColor = stimulusColorForDays(Math.max(fracDays, minDays), greenMax, yellowMax);
      let statusLabel = `${yellowMax + 1}+ DAYS`;
      if (minDays <= greenMax) {
        statusLabel = `${minDays}D AGO (RECOVERING)`;
      } else if (minDays <= yellowMax) {
        statusLabel = `${minDays}D AGO (RECOVERED)`;
      } else if (minDays < 99) {
        statusLabel = `${minDays}D AGO (OVERDUE)`;
      } else {
        statusColor = UNLOGGED_STIMULUS_COLOR;
        statusLabel = 'UNLOGGED';
      }

      result[g] = { daysAgo: minDays, color: statusColor, label: statusLabel };
    });

    return result;
  }, [history, stimulusGreenDays, stimulusYellowDays, stimulusNowMs]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const progressionSeriesByLift = useMemo(() => buildProgressionSeriesByLift(history), [history, bodyweightLbs]);

  return {
    effectiveOneRepMaxes,
    totalHeightInches,
    muscleStimulusStatus,
    progressionSeriesByLift
  };
}

