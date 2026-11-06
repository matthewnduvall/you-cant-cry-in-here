'use client';

import React, { useState, useEffect } from 'react';
import { RoutineEditorView } from './RoutineEditorView';
import {
  BIG_FOUR_IDS,
  CORE_PR_EXERCISE_IDS,
  EXERCISE_MAP,
  DEFAULT_GYM_EQUIPMENT_PRESETS,
  filterAddSlotExercises,
  getAvailableMuscleGroupsForCategory,
  getDefaultSessionName,
  getExRxTargetForLift,
  roundTo5
} from '../../data/exerciseLibrary';
import {
  SCHEME_OPTIONS,
  SET_TYPES_LIST
} from '../../utils/workoutEngine';

const SHARED_CELL_BORDER = {
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: '1px solid var(--dp-color-rule)',
  borderBottom: '1px solid var(--dp-color-rule)'
};

const SHARED_GROUP_OUTER = {
  borderTop: '1px solid var(--dp-color-rule)',
  borderLeft: '1px solid var(--dp-color-rule)'
};

const SET_TYPE_MULTIPLIER_MAP = {
  Warmup: 0.74,
  Working: 0.98,
  'Top Out': 1.04,
  'Burn Out': 0.84,
  '1 Rep Max': 1.0
};

const SCHEME_DEFAULT_CONFIG = {
  '5x5': { sets: 5, reps: 5, setType: 'Working' },
  '5x8': { sets: 5, reps: 8, setType: 'Working' },
  '8x8': { sets: 8, reps: 8, setType: 'Working' },
  Pyramid: { sets: 5, reps: 4, setType: 'Top Out' },
  'Pyramid 1RM': { sets: 5, reps: 1, setType: '1 Rep Max' },
  'Reverse Pyramid': { sets: 5, reps: 6, setType: 'Working' }
};

export function HistoryView({
  colors,
  history,
  expandedHistoryWorkoutId,
  setExpandedHistoryWorkoutId,
  oneRepMaxes,
  setOneRepMaxes,
  customPrExerciseIds: externalCustomPrIds,
  setCustomPrExerciseIds: setExternalCustomPrIds,
  selectedGymId = '',
  gyms = [],
  targetStandardClass,
  userBodyweightLbs,
  totalHeightInches,
  customGoalWeights,
  setHistoricalDraft,
  setCurrentView,
  openPlateCalculatorForPR,
  setDeleteConfirmTarget,
  buildHistoryWorkoutEditorProps
}) {
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);

  // --- Shared / Local Custom PR Exercise List & Add Exercise Filter State ---
  const [localCustomPrIds, setLocalCustomPrIds] = useState([]);
  const customPrExerciseIds = externalCustomPrIds || localCustomPrIds;
  const setCustomPrExerciseIds = setExternalCustomPrIds || setLocalCustomPrIds;
  const [showAddPrExercisePanel, setShowAddPrExercisePanel] = useState(false);
  const [addPrGymFilter, setAddPrGymFilter] = useState(selectedGymId || '');
  const [addPrCategory, setAddPrCategory] = useState('Compound Lift');
  const [addPrMuscleGroup, setAddPrMuscleGroup] = useState('All Muscles');
  const [addPrSelectedExId, setAddPrSelectedExId] = useState('barbell_row');

  // --- 1RM Converter Popup State ---
  const [calcPopupExerciseId, setCalcPopupExerciseId] = useState(null);
  const [calcScheme, setCalcScheme] = useState('5x5');
  const [calcSetType, setCalcSetType] = useState('Working');
  const [calcSets, setCalcSets] = useState(5);
  const [calcReps, setCalcReps] = useState(5);
  const [calcWeight, setCalcWeight] = useState(135);

  const PAGE_SIZE = 100;
  const INITIAL_LIMIT = 10;
  const totalSessions = (history || []).length;
  const totalPages = Math.max(1, Math.ceil(totalSessions / PAGE_SIZE));

  // If a linked workout is beyond the initial 10, automatically switch to See All and its 100-item page
  useEffect(() => {
    if (!expandedHistoryWorkoutId) return;
    const idx = (history || []).findIndex(w => w?.id === expandedHistoryWorkoutId);
    if (idx >= INITIAL_LIMIT) {
      setShowAllHistory(true);
      setHistoryPage(Math.floor(idx / PAGE_SIZE));
    }
  }, [expandedHistoryWorkoutId, history]);

  const visibleHistory = showAllHistory
    ? (history || []).slice(historyPage * PAGE_SIZE, (historyPage + 1) * PAGE_SIZE)
    : (history || []).slice(0, INITIAL_LIMIT);

  const displayedPrExerciseIds = Array.from(
    new Set([
      ...CORE_PR_EXERCISE_IDS,
      ...customPrExerciseIds,
      ...Object.keys(oneRepMaxes || {}).filter(id => Number(oneRepMaxes?.[id]) > 0)
    ])
  );
  const displayedPrExercises = displayedPrExerciseIds
    .map(id => EXERCISE_MAP[id])
    .filter(Boolean);

  const availAddPrMuscleGroups = getAvailableMuscleGroupsForCategory(
    addPrCategory,
    addPrGymFilter,
    gyms
  );
  const activeAddPrMuscle = availAddPrMuscleGroups.includes(addPrMuscleGroup)
    ? addPrMuscleGroup
    : 'All Muscles';
  const filteredAddPrExercises = filterAddSlotExercises(
    addPrGymFilter,
    addPrCategory,
    gyms,
    activeAddPrMuscle
  );
  const resolvedAddPrExId = filteredAddPrExercises.some(e => e.id === addPrSelectedExId)
    ? addPrSelectedExId
    : filteredAddPrExercises[0]?.id || 'incline_bench_press';

  const allGymOptions = [
    ...DEFAULT_GYM_EQUIPMENT_PRESETS,
    ...(gyms || []).map(g => ({ id: g.id, name: g.name }))
  ];

  const open1RMConverterModal = exerciseId => {
    const exId = exerciseId || BIG_FOUR_IDS[0] || 'barbell_bench_press';
    const existingPR = Number(oneRepMaxes?.[exId] || 0);
    setCalcPopupExerciseId(exId);
    setCalcScheme('5x5');
    setCalcSetType('Working');
    setCalcSets(5);
    setCalcReps(5);
    setCalcWeight(existingPR > 0 ? roundTo5(existingPR * 0.75) : 135);
  };

  const handleSelectConverterScheme = schemeKey => {
    setCalcScheme(schemeKey);
    const defaults = SCHEME_DEFAULT_CONFIG[schemeKey];
    if (defaults) {
      setCalcSets(defaults.sets);
      setCalcReps(defaults.reps);
      setCalcSetType(defaults.setType);
    }
  };

  const convertedOneRepMax = (() => {
    const w = Math.max(0, Number(calcWeight) || 0);
    if (w <= 0) return 0;
    const r = Math.max(1, Number(calcReps) || 1);
    const s = Math.max(1, Number(calcSets) || 1);

    if (calcSetType === '1 Rep Max' || (r === 1 && s === 1)) {
      return roundTo5(w);
    }

    const repPct = 1 / (1 + Math.max(0, r - 1) / 30);
    const typeMultiplier = SET_TYPE_MULTIPLIER_MAP[calcSetType] || 0.98;
    const setStressFactor = 1 / (1 + Math.max(0, s - 1) * 0.035);
    const factor = Math.min(1, repPct * typeMultiplier * setStressFactor);

    if (factor <= 0) return roundTo5(w);
    return Math.max(w, roundTo5(w / factor));
  })();

  const handleSaveConvertedPR = () => {
    if (!calcPopupExerciseId || convertedOneRepMax <= 0) return;
    setOneRepMaxes?.(prev => ({
      ...prev,
      [calcPopupExerciseId]: convertedOneRepMax
    }));
    setCalcPopupExerciseId(null);
  };

  const stdActionBtnStyle = {
    width: '96px',
    height: '44px',
    boxSizing: 'border-box',
    padding: '0 6px',
    fontSize: '12px',
    fontWeight: 800,
    textTransform: 'uppercase',
    ...SHARED_CELL_BORDER,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0
  };

  return (
    <div style={{ paddingTop: '12px', paddingBottom: '36px' }}>
      {/* =================================================================== */}
      {/* 1. PERSONAL RECORDS SECTION (STANDARDIZED WITH ONBOARDING PAGE 3) */}
      {/* =================================================================== */}
      <section style={{ marginBottom: '20px', padding: '0 var(--dp-spacing-gutter)' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 800,
            color: colors?.secondaryLabel || '#A0A0A0',
            marginBottom: '6px',
            textTransform: 'uppercase'
          }}
        >
          PERSONAL RECORDS
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            ...SHARED_GROUP_OUTER
          }}
        >
          {displayedPrExercises.map(ex => {
            const rawVal = Number(oneRepMaxes?.[ex.id]) || 0;
            const isTBD = rawVal <= 0;
            const current1RM = isTBD ? 0 : rawVal;
            const goal1RM = getExRxTargetForLift(
              ex.id,
              targetStandardClass,
              userBodyweightLbs,
              totalHeightInches,
              customGoalWeights
            );
            const diffFromGoal = !isTBD && goal1RM ? goal1RM - current1RM : null;

            return (
              <div
                key={ex.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 96px 96px',
                  gap: 0,
                  alignItems: 'stretch',
                  backgroundColor: '#141416'
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    ...SHARED_CELL_BORDER
                  }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {ex.name}
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: colors?.secondaryLabel || '#A0A0A0',
                      marginTop: '1px'
                    }}
                  >
                    {isTBD
                      ? `${targetStandardClass.toUpperCase()} GOAL: ${goal1RM} LB`
                      : diffFromGoal > 0
                        ? `${targetStandardClass.toUpperCase()} GOAL: ${goal1RM} LB (${diffFromGoal} LB TO GOAL)`
                        : `${targetStandardClass.toUpperCase()} GOAL: ${goal1RM} LB (ACHIEVED +${Math.abs(diffFromGoal)} LB)`}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => open1RMConverterModal(ex.id)}
                  style={{
                    ...stdActionBtnStyle,
                    height: '100%',
                    minHeight: '48px',
                    backgroundColor: '#1C1C20',
                    color: '#FFFFFF'
                  }}
                >
                  CALCULATE
                </button>

                <button
                  type="button"
                  onClick={() => openPlateCalculatorForPR(ex.id, ex.name, current1RM)}
                  style={{
                    ...stdActionBtnStyle,
                    height: '100%',
                    minHeight: '48px',
                    backgroundColor: isTBD
                      ? '#FF3B30'
                      : 'var(--dp-color-accent)',
                    color: isTBD ? '#FFFFFF' : '#000000'
                  }}
                >
                  {isTBD ? 'TBD ✎' : `${current1RM} LB ✎`}
                </button>
              </div>
            );
          })}

          {/* ADD USER-SELECTED EXERCISE WITH FILTERS (SHARED BORDERS) */}
          {!showAddPrExercisePanel ? (
            <button
              type="button"
              onClick={() => setShowAddPrExercisePanel(true)}
              style={{
                width: '100%',
                height: '46px',
                padding: '0 12px',
                backgroundColor: '#18181B',
                color: 'var(--dp-color-accent)',
                ...SHARED_CELL_BORDER,
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
            >
              + ADD WORKOUT / EXERCISE TO PERSONAL RECORDS
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Header row of Add Exercise Panel */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 40px',
                  gap: 0,
                  height: '38px'
                }}
              >
                <div
                  style={{
                    backgroundColor: '#18181B',
                    padding: '0 12px',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '11px',
                    fontWeight: 800,
                    color: 'var(--dp-color-accent)',
                    textTransform: 'uppercase',
                    ...SHARED_CELL_BORDER
                  }}
                >
                  ADD EXERCISE TO PERSONAL RECORDS
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddPrExercisePanel(false)}
                  style={{
                    backgroundColor: '#FF3B30',
                    color: '#101010',
                    ...SHARED_CELL_BORDER,
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Row 1 Filters: Gym/Equipment, Workout Type, Muscle Group */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 0,
                  height: '40px'
                }}
              >
                <select
                  aria-label="Filter by Gyms/Equipment"
                  value={addPrGymFilter}
                  onChange={e => setAddPrGymFilter(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    backgroundColor: '#141416',
                    color: '#FFFFFF',
                    ...SHARED_CELL_BORDER,
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '0 8px'
                  }}
                >
                  {allGymOptions.map(g => (
                    <option key={g.id || 'full_gym'} value={g.id}>
                      {g.name.toUpperCase()}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by Workout Type"
                  value={addPrCategory}
                  onChange={e => setAddPrCategory(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    backgroundColor: '#141416',
                    color: '#FFFFFF',
                    ...SHARED_CELL_BORDER,
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '0 8px'
                  }}
                >
                  {['Compound Lift', 'Accessory'].map(cat => (
                    <option key={cat} value={cat}>
                      {cat.toUpperCase()}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by Muscle Group"
                  value={activeAddPrMuscle}
                  onChange={e => setAddPrMuscleGroup(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    backgroundColor: '#141416',
                    color: '#FFFFFF',
                    ...SHARED_CELL_BORDER,
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '0 8px'
                  }}
                >
                  {availAddPrMuscleGroups.map(mg => (
                    <option key={mg} value={mg}>
                      {mg.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 2: Exercise Selector + Add Button */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 96px',
                  gap: 0,
                  height: '42px'
                }}
              >
                <select
                  aria-label="Select Exercise"
                  value={resolvedAddPrExId}
                  onChange={e => setAddPrSelectedExId(e.target.value)}
                  style={{
                    width: '100%',
                    height: '42px',
                    backgroundColor: '#141416',
                    color: '#FFFFFF',
                    ...SHARED_CELL_BORDER,
                    fontSize: '13px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '0 8px'
                  }}
                >
                  {filteredAddPrExercises.map(ex => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name.toUpperCase()} ({ex.equipment.toUpperCase()})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    if (resolvedAddPrExId) {
                      setCustomPrExerciseIds(prev =>
                        prev.includes(resolvedAddPrExId)
                          ? prev
                          : [...prev, resolvedAddPrExId]
                      );
                      setShowAddPrExercisePanel(false);
                    }
                  }}
                  style={{
                    height: '42px',
                    padding: '0 12px',
                    backgroundColor: 'var(--dp-color-accent)',
                    color: '#000000',
                    ...SHARED_CELL_BORDER,
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  + ADD
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =================================================================== */}
      {/* 2. HISTORY SECTION (STANDARDIZED SIZE, FONT & SHARED BORDERS) */}
      {/* =================================================================== */}
      <section style={{ marginBottom: '20px', padding: '0 var(--dp-spacing-gutter)' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 800,
            color: colors?.secondaryLabel || '#A0A0A0',
            marginBottom: '6px',
            textTransform: 'uppercase'
          }}
        >
          HISTORY ({totalSessions})
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            ...SHARED_GROUP_OUTER
          }}
        >
          {/* + LOG PAST WORKOUT BUTTON */}
          <button
            type="button"
            onClick={() => {
              const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
              setHistoricalDraft({
                id: `hist_${Date.now()}`,
                title: getDefaultSessionName(),
                loadedRoutineTitle: 'MANUAL',
                workoutDate: yesterday,
                defaultRestSeconds: 90,
                slots: []
              });
              setCurrentView('historical_entry');
            }}
            className="kinetic-btn"
            style={{
              width: '100%',
              height: '46px',
              padding: '0 12px',
              backgroundColor: 'var(--dp-color-accent)',
              color: '#101010',
              ...SHARED_CELL_BORDER,
              fontSize: '12px',
              fontWeight: 800,
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              boxSizing: 'border-box'
            }}
          >
            <span>+ LOG PAST WORKOUT</span>
            <span>→</span>
          </button>

          {totalSessions === 0 ? (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#141416',
                ...SHARED_CELL_BORDER,
                fontSize: '12px',
                color: '#888888',
                fontWeight: 700,
                textTransform: 'uppercase'
              }}
            >
              NO SESSIONS LOGGED YET.
            </div>
          ) : (
            <>
              {visibleHistory.map(w => {
                const isExp = expandedHistoryWorkoutId === w.id;
                const editorProps =
                  isExp && buildHistoryWorkoutEditorProps
                    ? buildHistoryWorkoutEditorProps(w)
                    : null;

                return (
                  <div id={`history-entry-${w.id}`} key={w.id}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) 48px 48px',
                        gap: 0,
                        alignItems: 'stretch',
                        backgroundColor: isExp ? '#1C1C20' : '#141416'
                      }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedHistoryWorkoutId(isExp ? null : w.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setExpandedHistoryWorkoutId(isExp ? null : w.id);
                          }
                        }}
                        style={{
                          padding: '8px 12px',
                          minWidth: 0,
                          minHeight: '48px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          ...SHARED_CELL_BORDER
                        }}
                      >
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 800,
                            color: '#FFFFFF',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {w.title}
                        </div>
                        <div
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: colors?.secondaryLabel || '#A0A0A0',
                            marginTop: '1px'
                          }}
                        >
                          {new Date(w.startedAt).toLocaleDateString()} • {(w.slots || []).length} EXERCISES
                        </div>
                      </div>

                      <button
                        type="button"
                        aria-label={isExp ? `Collapse ${w.title}` : `Expand ${w.title}`}
                        onClick={() => setExpandedHistoryWorkoutId(isExp ? null : w.id)}
                        style={{
                          width: '48px',
                          minHeight: '48px',
                          boxSizing: 'border-box',
                          backgroundColor: '#1C1C20',
                          color: isExp ? 'var(--dp-color-accent)' : '#FFFFFF',
                          ...SHARED_CELL_BORDER,
                          fontSize: '16px',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        {isExp ? '−' : '+'}
                      </button>

                      <button
                        type="button"
                        aria-label={`Delete ${w.title}`}
                        onClick={e => {
                          e.stopPropagation();
                          setDeleteConfirmTarget?.({
                            type: 'history_workout',
                            workoutId: w.id,
                            label: w.title
                          });
                        }}
                        style={{
                          width: '48px',
                          minHeight: '48px',
                          boxSizing: 'border-box',
                          backgroundColor: '#FF3B30',
                          color: '#101010',
                          ...SHARED_CELL_BORDER,
                          fontSize: '13px',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    {isExp && editorProps && (
                      <div
                        style={{
                          paddingBottom: '12px',
                          backgroundColor: '#101010',
                          ...SHARED_CELL_BORDER
                        }}
                      >
                        <RoutineEditorView {...editorProps} />
                      </div>
                    )}
                  </div>
                );
              })}

              {!showAllHistory && totalSessions > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAllHistory(true);
                    setHistoryPage(0);
                  }}
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 12px',
                    backgroundColor: '#18181B',
                    color: 'var(--dp-color-accent)',
                    ...SHARED_CELL_BORDER,
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  SEE ALL ({totalSessions})
                </button>
              )}

              {showAllHistory && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '96px minmax(0, 1fr) 96px',
                    gap: 0,
                    height: '44px',
                    backgroundColor: '#141416'
                  }}
                >
                  <button
                    type="button"
                    disabled={historyPage <= 0}
                    onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                    style={{
                      ...stdActionBtnStyle,
                      height: '44px',
                      backgroundColor: '#18181B',
                      color: '#FFFFFF',
                      opacity: historyPage <= 0 ? 0.4 : 1,
                      cursor: historyPage <= 0 ? 'default' : 'pointer'
                    }}
                  >
                    ← PREV 100
                  </button>
                  <div
                    style={{
                      ...SHARED_CELL_BORDER,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 6px',
                      fontSize: '10px',
                      fontWeight: 800,
                      color: '#A0A0A0',
                      textTransform: 'uppercase',
                      textAlign: 'center'
                    }}
                  >
                    PAGE {historyPage + 1} OF {totalPages} ({historyPage * PAGE_SIZE + 1}–
                    {Math.min(totalSessions, (historyPage + 1) * PAGE_SIZE)} OF {totalSessions})
                  </div>
                  <button
                    type="button"
                    disabled={historyPage >= totalPages - 1}
                    onClick={() => setHistoryPage(p => Math.min(totalPages - 1, p + 1))}
                    style={{
                      ...stdActionBtnStyle,
                      height: '44px',
                      backgroundColor: '#18181B',
                      color: '#FFFFFF',
                      opacity: historyPage >= totalPages - 1 ? 0.4 : 1,
                      cursor: historyPage >= totalPages - 1 ? 'default' : 'pointer'
                    }}
                  >
                    NEXT 100 →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* =================================================================== */}
      {/* 1RM CONVERTER POPUP MODAL (SHARED BORDERS, ZERO GAPS) */}
      {/* =================================================================== */}
      {calcPopupExerciseId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setCalcPopupExerciseId(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: '#121214',
              ...SHARED_GROUP_OUTER
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 44px',
                gap: 0,
                backgroundColor: '#18181B'
              }}
            >
              <div style={{ padding: '10px 14px', ...SHARED_CELL_BORDER }}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    color: 'var(--dp-color-accent)',
                    textTransform: 'uppercase'
                  }}
                >
                  SCHEME / SETS / REPS → 1RM CONVERTER
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    textTransform: 'uppercase'
                  }}
                >
                  {EXERCISE_MAP[calcPopupExerciseId]?.name || 'CONVERT TO 1RM'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCalcPopupExerciseId(null)}
                style={{
                  backgroundColor: '#FF3B30',
                  color: '#000000',
                  ...SHARED_CELL_BORDER,
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {/* Exercise Selector */}
            <select
              value={calcPopupExerciseId}
              onChange={e => setCalcPopupExerciseId(e.target.value)}
              style={{
                width: '100%',
                height: '42px',
                padding: '0 12px',
                fontSize: '13px',
                fontWeight: 800,
                backgroundColor: '#141416',
                color: '#FFFFFF',
                ...SHARED_CELL_BORDER,
                textTransform: 'uppercase'
              }}
            >
              {displayedPrExercises.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>

            {/* Scheme Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
              {SCHEME_OPTIONS.map(sch => (
                <button
                  key={sch}
                  type="button"
                  onClick={() => handleSelectConverterScheme(sch)}
                  style={{
                    height: '38px',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    backgroundColor:
                      calcScheme === sch ? 'var(--dp-color-accent)' : '#141416',
                    color: calcScheme === sch ? '#000000' : '#FFFFFF',
                    ...SHARED_CELL_BORDER,
                    cursor: 'pointer'
                  }}
                >
                  {sch}
                </button>
              ))}
            </div>

            {/* Set Type Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0 }}>
              {SET_TYPES_LIST.map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setCalcSetType(st)}
                  style={{
                    height: '36px',
                    padding: '0 2px',
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    backgroundColor: calcSetType === st ? '#FFFFFF' : '#141416',
                    color: calcSetType === st ? '#000000' : '#FFFFFF',
                    ...SHARED_CELL_BORDER,
                    cursor: 'pointer'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Sets, Reps, Weight Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
              <div style={{ padding: '8px 12px', backgroundColor: '#141416', ...SHARED_CELL_BORDER }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#9A9A9A' }}>SETS</div>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={calcSets}
                  onChange={e => setCalcSets(Math.max(1, Number(e.target.value) || 1))}
                  style={{
                    width: '100%',
                    padding: '4px 0',
                    fontSize: '18px',
                    fontWeight: 800,
                    backgroundColor: 'transparent',
                    color: '#FFFFFF',
                    border: 'none',
                    outline: 'none'
                  }}
                />
              </div>
              <div style={{ padding: '8px 12px', backgroundColor: '#141416', ...SHARED_CELL_BORDER }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#9A9A9A' }}>REPS</div>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={calcReps}
                  onChange={e => setCalcReps(Math.max(1, Number(e.target.value) || 1))}
                  style={{
                    width: '100%',
                    padding: '4px 0',
                    fontSize: '18px',
                    fontWeight: 800,
                    backgroundColor: 'transparent',
                    color: '#FFFFFF',
                    border: 'none',
                    outline: 'none'
                  }}
                />
              </div>
              <div style={{ padding: '8px 12px', backgroundColor: '#141416', ...SHARED_CELL_BORDER }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#9A9A9A' }}>WEIGHT (LB)</div>
                <input
                  type="number"
                  min={5}
                  max={1500}
                  step={5}
                  value={calcWeight}
                  onChange={e => setCalcWeight(Math.max(0, Number(e.target.value) || 0))}
                  style={{
                    width: '100%',
                    padding: '4px 0',
                    fontSize: '18px',
                    fontWeight: 800,
                    backgroundColor: 'transparent',
                    color: '#FFFFFF',
                    border: 'none',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Converted Result Banner */}
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#18181B',
                ...SHARED_CELL_BORDER,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#9A9A9A' }}>
                ESTIMATED 1 REP MAX (1RM)
              </span>
              <span
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  color: 'var(--dp-color-accent)'
                }}
              >
                {convertedOneRepMax} LB
              </span>
            </div>

            {/* Save / Cancel */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 0 }}>
              <button
                type="button"
                onClick={() => setCalcPopupExerciseId(null)}
                style={{
                  height: '44px',
                  fontSize: '12px',
                  fontWeight: 800,
                  backgroundColor: '#141416',
                  color: '#FFFFFF',
                  ...SHARED_CELL_BORDER,
                  cursor: 'pointer'
                }}
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleSaveConvertedPR}
                style={{
                  height: '44px',
                  fontSize: '12px',
                  fontWeight: 800,
                  backgroundColor: 'var(--dp-color-accent)',
                  color: '#000000',
                  ...SHARED_CELL_BORDER,
                  cursor: 'pointer'
                }}
              >
                SAVE {convertedOneRepMax} LB PR ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default HistoryView;
