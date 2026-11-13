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
import { getPersonalRecord1RM, isCalculated1RMSet, estimateSet1RM } from '../utils/workoutEngine';

// Muscle groups with no logged training: neutral grey, so a new account isn't shown as all "overdue"
export const UNLOGGED_STIMULUS_COLOR = '#3A3A3A';

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

      const accumulateSetsForExercise = setsList => {
        const arr = Array.isArray(setsList) ? setsList : [];
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
              accumulateSetsForExercise(slot.supersetSetsByExercise[idx]);
            }
          });
        } else if (slot.exerciseId === liftId) {
          accumulateSetsForExercise(slot.sets);
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
  stimulusYellowDays
}) {
  // Computed Personal Records (Updated from Highest Calculated 1RM in History + Manual Overrides)
  const effectiveOneRepMaxes = useMemo(() => {
    const map = {};
    EXERCISE_LIBRARY.forEach(ex => {
      const best = getPersonalRecord1RM(ex.id, history, oneRepMaxes);
      if (best > 0) map[ex.id] = best;
    });
    return map;
  }, [history, oneRepMaxes]);

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
      if (stimulusNowMs !== null) {
        history.forEach(w => {
          const daysAgo = calendarDaysAgo(w.startedAt, stimulusNowMs);
          if (daysAgo === null) return;
          (w.slots || []).forEach(slot => {
            const ids =
              isSupersetCategory(slot.category) && slot.supersetExerciseIds
                ? slot.supersetExerciseIds
                : [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
            ids.forEach(id => {
              const ex = EXERCISE_MAP[id];
              if (ex && doesExerciseInteractWithMuscleGroup(ex, g) && daysAgo < minDays) {
                minDays = daysAgo;
              }
            });
          });
        });
      }

      const greenMax = Number.isFinite(Number(stimulusGreenDays)) && Number(stimulusGreenDays) >= 0 ? Number(stimulusGreenDays) : 2;
      const yellowMax = Math.max(greenMax + 1, Number(stimulusYellowDays) || 4);
      let statusColor = '#FF4A3D';
      let statusLabel = `${yellowMax + 1}+ DAYS`;
      if (minDays <= greenMax) {
        statusColor = '#FFFFFF';
        statusLabel = `${minDays}D AGO (RECOVERING)`;
      } else if (minDays <= yellowMax) {
        statusColor = '#8A8A8A';
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

  const progressionSeriesByLift = useMemo(() => buildProgressionSeriesByLift(history), [history]);

  return {
    effectiveOneRepMaxes,
    totalHeightInches,
    muscleStimulusStatus,
    progressionSeriesByLift
  };
}

