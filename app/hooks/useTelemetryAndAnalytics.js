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
import { getPersonalRecord1RM } from '../utils/workoutEngine';

// Muscle groups with no logged training: neutral grey, so a new account isn't shown as all "overdue"
export const UNLOGGED_STIMULUS_COLOR = '#4A4A50';

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

  const [stimulusNowMs, setStimulusNowMs] = useState(null);
  useEffect(() => {
    setStimulusNowMs(Date.now());
  }, [history]);

  const muscleStimulusStatus = useMemo(() => {
    const groups = MUSCLE_GROUP_OPTIONS.filter(g => g !== 'All Muscles');
    const result = {};

    groups.forEach(g => {
      let minDays = 99;
      if (stimulusNowMs !== null) {
        history.forEach(w => {
          const daysAgo = Math.max(0, Math.floor((stimulusNowMs - new Date(w.startedAt).getTime()) / 86400000));
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

      const greenMax = Number(stimulusGreenDays) || 2;
      const yellowMax = Number(stimulusYellowDays) || 4;
      let statusColor = '#FF3B30';
      let statusLabel = `${yellowMax + 1}+ DAYS`;
      if (minDays <= greenMax) {
        statusColor = '#30D158';
        statusLabel = `${minDays}D AGO (RECOVERING)`;
      } else if (minDays <= yellowMax) {
        statusColor = '#FFD60A';
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

  const progressionSeriesByLift = useMemo(() => {
    const normalizedWorkouts = (history || []).map((w, rawIdx) => {
      const dateLabel = formatDateYMD(w?.workoutDate || w?.startedAt);
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
        let totalVol = 0;

        const accumulateSetsForExercise = setsList => {
          const arr = Array.isArray(setsList) ? setsList : [];
          const hasCompleted = arr.some(s => s && s.completed && Number(s.weight) > 0);
          arr.forEach(s => {
            if (!s || Number(s.weight) <= 0) return;
            if (hasCompleted && !s.completed) return;
            const wVal = Number(s.weight) || 0;
            const rVal = Math.max(1, Number(s.reps) || 1);
            const est1RM = rVal === 1 ? wVal : Math.round(wVal * (1 + rVal / 30));
            if (est1RM > top1RM) top1RM = est1RM;
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
              volume: roundedVol
            });
          } else {
            if (top1RM > existing.weight) existing.weight = top1RM;
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
  }, [history]);

  return {
    effectiveOneRepMaxes,
    totalHeightInches,
    muscleStimulusStatus,
    progressionSeriesByLift
  };
}

