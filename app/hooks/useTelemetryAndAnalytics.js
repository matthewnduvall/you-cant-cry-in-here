'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  EXERCISE_LIBRARY,
  EXERCISE_MAP,
  MUSCLE_GROUP_OPTIONS,
  isSupersetCategory,
  doesExerciseInteractWithMuscleGroup,
  formatDateYMD
} from '../data/exerciseLibrary';
import { getPersonalRecord1RM } from '../utils/workoutEngine';

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
        statusLabel = `${minDays}D AGO (FRESH)`;
      } else if (minDays <= yellowMax) {
        statusColor = '#FFD60A';
        statusLabel = `${minDays}D AGO (READY)`;
      } else if (minDays < 99) {
        statusLabel = `${minDays}D AGO (DUE)`;
      } else {
        statusLabel = 'UNLOGGED';
      }

      result[g] = { daysAgo: minDays, color: statusColor, label: statusLabel };
    });

    return result;
  }, [history, stimulusGreenDays, stimulusYellowDays, stimulusNowMs]);

  const progressionSeriesByLift = useMemo(() => {
    const sorted = [...history].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    const map = {};
    EXERCISE_LIBRARY.forEach(ex => {
      const liftId = ex.id;
      const points = [];
      sorted.forEach(w => {
        let top1RM = 0;
        let totalVol = 0;
        (w.slots || []).forEach(slot => {
          if (isSupersetCategory(slot.category) && Array.isArray(slot.supersetExerciseIds) && slot.supersetExerciseIds.includes(liftId)) {
            const supersetSets = slot.supersetSetsByExercise?.[liftId] || [];
            supersetSets.forEach(s => {
              if (s.completed && s.weight > 0) {
                const wVal = Number(s.weight) || 0;
                const rVal = Math.max(1, Number(s.reps) || 1);
                const est1RM = rVal === 1 ? wVal : Math.round(wVal * (1 + rVal / 30));
                if (est1RM > top1RM) top1RM = est1RM;
                totalVol += wVal * rVal;
              }
            });
          } else if (slot.exerciseId === liftId) {
            (slot.sets || []).forEach(s => {
              if (s.completed && s.weight > 0) {
                const wVal = Number(s.weight) || 0;
                const rVal = Math.max(1, Number(s.reps) || 1);
                const est1RM = rVal === 1 ? wVal : Math.round(wVal * (1 + rVal / 30));
                if (est1RM > top1RM) top1RM = est1RM;
                totalVol += wVal * rVal;
              }
            });
          }
        });
        if (top1RM > 0 || totalVol > 0) {
          points.push({
            dateLabel: formatDateYMD(w.startedAt),
            weight: top1RM,
            volume: totalVol
          });
        }
      });
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

