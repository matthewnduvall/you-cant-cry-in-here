'use client';

import React, { useState } from 'react';
import { UI } from '../../styles/kineticTokens';
import { IOSListSection, IOSListRow } from '../Primitives';
import {
  EXERCISE_LIBRARY,
  BIG_FOUR_IDS,
  EXRX_CLASSES,
  DEFAULT_GYM_EQUIPMENT_PRESETS,
  getExRxTargetForLift
} from '../../data/exerciseLibrary';
import {
  registerUserAccount,
  signInUserAccount,
  requestPasswordRecoveryEmail,
  completePasswordRecoveryWithToken,
  resetPasswordWithBetaCode
} from '../../utils/supabaseAuth';

// ============================================================================
// VIEWS: SETTINGS, INFO & AUTH (SIGN IN / SIGN UP)
// ============================================================================

export function SettingsView({
  colors,
  userBodyweightLbs,
  setUserBodyweightLbs,
  userHeightFeet,
  setUserHeightFeet,
  userHeightInches,
  setUserHeightInches,
  stimulusGreenDays,
  setStimulusGreenDays,
  stimulusYellowDays,
  setStimulusYellowDays,
  routinePreferences,
  setRoutinePreferences,
  shareStatsWithFriends,
  setShareStatsWithFriends,
  shareRoutinesWithFriends,
  setShareRoutinesWithFriends,
  importBackupInputRef,
  handleExportBackupJSON,
  handleImportBackupJSON,
  handleResetToDemoDefaults
}) {
  return (
    <div style={UI.pagePad}>
      <IOSListSection header="BODY METRICS" colors={colors}>
        <IOSListRow colors={colors}>
          <span style={UI.rowTitle}>BODYWEIGHT (LBS)</span>
          <input
            type="number"
            value={userBodyweightLbs}
            onChange={e => setUserBodyweightLbs(Number(e.target.value) || 0)}
            style={UI.numInput('90px', 'var(--dp-color-accent)')}
          />
        </IOSListRow>
        <IOSListRow isLast={true} colors={colors}>
          <span style={UI.rowTitle}>HEIGHT (FT / IN)</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="number"
              value={userHeightFeet}
              onChange={e => setUserHeightFeet(Number(e.target.value) || 0)}
              style={UI.numInput('54px')}
            />
            <span style={{ fontSize: '12px', fontWeight: 800 }}>FT</span>
            <input
              type="number"
              value={userHeightInches}
              onChange={e => setUserHeightInches(Number(e.target.value) || 0)}
              style={UI.numInput('54px')}
            />
            <span style={{ fontSize: '12px', fontWeight: 800 }}>IN</span>
          </div>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection header="STIMULUS" footer="Red threshold is automatically set to Yellow + 1 day." colors={colors}>
        <IOSListRow colors={colors}>
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#30D158' }}>GREEN (RECOVERING)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="number"
              min="1"
              value={stimulusGreenDays}
              onChange={e => setStimulusGreenDays(Math.max(1, Number(e.target.value) || 1))}
              style={UI.numInput('58px')}
            />
            <span style={{ fontSize: '11px', fontWeight: 800 }}>DAYS</span>
          </div>
        </IOSListRow>

        <IOSListRow colors={colors}>
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#FFD60A' }}>YELLOW (READY)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="number"
              min={Number(stimulusGreenDays) + 1}
              value={stimulusYellowDays}
              onChange={e =>
                setStimulusYellowDays(Math.max(Number(stimulusGreenDays) + 1, Number(e.target.value) || 4))
              }
              style={UI.numInput('58px')}
            />
            <span style={{ fontSize: '11px', fontWeight: 800 }}>DAYS</span>
          </div>
        </IOSListRow>

        <IOSListRow isLast={true} colors={colors} style={{ opacity: 0.5 }}>
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#FF3B30' }}>RED (HIGH PRIORITY)</span>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#A0A0A0' }}>
            {Number(stimulusYellowDays) + 1}+ DAYS (AUTO)
          </span>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection header="GYMS/EQUIPMENT" colors={colors}>
        <IOSListRow isLast={true} colors={colors} style={{ opacity: 0.45 }}>
          <div>
            <div style={UI.rowTitle}>SMART LOCATIONS</div>
            <div style={UI.rowSub}>COMING SOON</div>
          </div>
          <span style={UI.badge(false)}>LOCKED</span>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection
        header="ROUTINE PREFERENCES"
        footer="Controls the default structure generated when you tap AUTO."
        colors={colors}
      >
        {routinePreferences.map((comp, idx) => (
          <IOSListRow key={`${comp}_${idx}`} colors={colors}>
            <span style={UI.rowTitle}>0{idx + 1} / {comp}</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                disabled={idx === 0}
                onClick={() =>
                  setRoutinePreferences(prev => {
                    const copy = [...prev];
                    const tmp = copy[idx - 1];
                    copy[idx - 1] = copy[idx];
                    copy[idx] = tmp;
                    return copy;
                  })
                }
                style={UI.pillBtn(false)}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={idx === routinePreferences.length - 1}
                onClick={() =>
                  setRoutinePreferences(prev => {
                    const copy = [...prev];
                    const tmp = copy[idx + 1];
                    copy[idx + 1] = copy[idx];
                    copy[idx] = tmp;
                    return copy;
                  })
                }
                style={UI.pillBtn(false)}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => setRoutinePreferences(prev => prev.filter((_, i) => i !== idx))}
                style={{ ...UI.pillBtn(false), color: '#FF3B30' }}
              >
                ✕
              </button>
            </div>
          </IOSListRow>
        ))}

        <IOSListRow isLast={true} colors={colors}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', width: '100%' }}>
            {['Compound Lift', 'Accessory', 'Superset', 'Abs'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setRoutinePreferences(prev => [...prev, type])}
                style={{ ...UI.pillBtn(false), color: 'var(--dp-color-accent)' }}
              >
                + {type}
              </button>
            ))}
          </div>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection header="SOCIAL" colors={colors}>
        <IOSListRow colors={colors} onClick={() => setShareStatsWithFriends(p => !p)}>
          <span style={UI.rowTitle}>SHARE STATS WITH FRIENDS</span>
          <span style={UI.badge(shareStatsWithFriends)}>{shareStatsWithFriends ? 'ON' : 'OFF'}</span>
        </IOSListRow>

        <IOSListRow isLast={true} colors={colors} onClick={() => setShareRoutinesWithFriends(p => !p)}>
          <span style={UI.rowTitle}>SHARE ROUTINES WITH FRIENDS</span>
          <span style={UI.badge(shareRoutinesWithFriends)}>{shareRoutinesWithFriends ? 'ON' : 'OFF'}</span>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection
        header="DATA & BACKUP (SCHEMA V3)"
        footer="Your workout history, PRs, routines, gyms, and settings are automatically saved to versioned local storage and retained across app updates."
        colors={colors}
      >
        <IOSListRow colors={colors} onClick={handleExportBackupJSON}>
          <span style={UI.rowTitle}>EXPORT DATA BACKUP (.JSON)</span>
          <span style={UI.badge(true)}>DOWNLOAD ↓</span>
        </IOSListRow>

        <IOSListRow colors={colors} onClick={() => importBackupInputRef.current?.click()}>
          <span style={UI.rowTitle}>IMPORT DATA BACKUP (.JSON)</span>
          <span style={{ ...UI.badge(false), color: 'var(--dp-color-accent)' }}>UPLOAD ↑</span>
          <input
            ref={importBackupInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportBackupJSON}
            style={{ display: 'none' }}
          />
        </IOSListRow>

        <IOSListRow isLast={true} colors={colors} onClick={handleResetToDemoDefaults}>
          <span style={{ ...UI.rowTitle, color: '#FF3B30' }}>CLEAR & RESET ALL LOCAL DATA</span>
          <span style={{ ...UI.badge(false), color: '#FF3B30' }}>RESET ↺</span>
        </IOSListRow>
      </IOSListSection>
    </div>
  );
}

export function InfoView({
  colors,
  setCurrentView,
  userBodyweightLbs = 220,
  setUserBodyweightLbs,
  userHeightFeet = 5,
  setUserHeightFeet,
  userHeightInches = 10,
  setUserHeightInches,
  totalHeightInches = 70,
  goalType = 'Strength',
  setGoalType,
  goalIncrement = 1.25,
  setGoalIncrement,
  goalUnit = 'lb',
  setGoalUnit,
  targetStandardClass = 'Intermediate',
  setTargetStandardClass,
  oneRepMaxes = {},
  customGoalWeights = {},
  openPlateCalculatorForPR,
  hasActiveSession = false,
  selectedGymId = '',
  setSelectedGymId,
  gyms = [],
  routinePreferences = [],
  setRoutinePreferences,
  handleOpenNewSession,
  handleOpenNewAutoSession,
  user = null,
  shareStatsWithFriends = true,
  setShareStatsWithFriends,
  shareRoutinesWithFriends = true,
  setShareRoutinesWithFriends,
  importBackupInputRef,
  handleExportBackupJSON,
  handleImportBackupJSON,
  handleResetToDemoDefaults
}) {
  const stepBoxStyle = {
    marginTop: '8px',
    marginBottom: '14px',
    padding: '10px 12px',
    backgroundColor: '#101010',
    border: '2px solid var(--dp-color-rule)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  };

  return (
    <div style={UI.pagePad}>
      <IOSListSection header="01 // SETUP: METRICS, GOALS & PRS" colors={colors}>
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%', lineHeight: 1.5, fontSize: '14px', color: '#E0E0E0' }}>
            {/* STEP 1.1: BODY METRICS */}
            <div>
              <p style={{ marginBottom: '4px' }}>
                <strong style={{ color: 'var(--dp-color-accent)' }}>1.1 BODY METRICS:</strong> Enter your current bodyweight and height below (or in{' '}
                <strong>MENU → SETTINGS</strong>).
              </p>
              <div style={stepBoxStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>
                    BODYWEIGHT (LBS)
                  </span>
                  <input
                    type="number"
                    value={userBodyweightLbs}
                    onChange={e => setUserBodyweightLbs?.(Number(e.target.value) || 0)}
                    style={UI.numInput('90px', 'var(--dp-color-accent)')}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>
                    HEIGHT (FT / IN)
                  </span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="number"
                      value={userHeightFeet}
                      onChange={e => setUserHeightFeet?.(Number(e.target.value) || 0)}
                      style={UI.numInput('54px')}
                    />
                    <span style={{ fontSize: '11px', fontWeight: 800 }}>FT</span>
                    <input
                      type="number"
                      value={userHeightInches}
                      onChange={e => setUserHeightInches?.(Number(e.target.value) || 0)}
                      style={UI.numInput('54px')}
                    />
                    <span style={{ fontSize: '11px', fontWeight: 800 }}>IN</span>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 1.2: GOALS & STANDARDS */}
            <div>
              <p style={{ marginBottom: '4px' }}>
                <strong style={{ color: 'var(--dp-color-accent)' }}>1.2 GOALS & STANDARDS:</strong> Select your primary training focus, progression increment, and target ExRx.net strength class below (or in{' '}
                <strong>MENU → GOALS</strong>).
              </p>
              <div style={stepBoxStyle}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#A0A0A0', textTransform: 'uppercase', marginBottom: '6px' }}>
                    TRAINING FOCUS
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {['Strength', 'Hypertrophy', 'Maintain'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setGoalType?.(opt)}
                        className="kinetic-btn"
                        style={{
                          padding: '8px 4px',
                          backgroundColor: goalType === opt ? 'var(--dp-color-accent)' : '#161616',
                          color: goalType === opt ? '#101010' : '#FFFFFF',
                          border: '2px solid var(--dp-color-rule)',
                          fontSize: '11px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          cursor: 'pointer'
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {(goalType === 'Strength' || goalType === 'Hypertrophy') && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#A0A0A0', textTransform: 'uppercase' }}>
                        PROGRESSION INCREMENT
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {['lb', 'kg'].map(u => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setGoalUnit?.(u)}
                            style={{
                              padding: '3px 8px',
                              backgroundColor: goalUnit === u ? 'var(--dp-color-accent)' : '#161616',
                              color: goalUnit === u ? '#101010' : '#FFFFFF',
                              border: '2px solid var(--dp-color-rule)',
                              fontSize: '10px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              cursor: 'pointer'
                            }}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {[1.25, 2.5, 5, 10].map(inc => (
                        <button
                          key={inc}
                          type="button"
                          onClick={() => setGoalIncrement?.(inc)}
                          style={{
                            padding: '7px 4px',
                            backgroundColor: goalIncrement === inc ? 'var(--dp-color-accent)' : '#161616',
                            color: goalIncrement === inc ? '#101010' : '#FFFFFF',
                            border: '2px solid var(--dp-color-rule)',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          +{inc} {goalUnit}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>
                    TARGET STRENGTH CLASS
                  </span>
                  <select
                    value={targetStandardClass}
                    onChange={e => setTargetStandardClass?.(e.target.value)}
                    style={{
                      backgroundColor: '#161616',
                      color: 'var(--dp-color-accent)',
                      border: '2px solid var(--dp-color-rule)',
                      padding: '6px 10px',
                      fontSize: '12px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      cursor: 'pointer'
                    }}
                  >
                    {EXRX_CLASSES.map(c => (
                      <option key={c} value={c}>
                        {c.toUpperCase()}
                      </option>
                    ))}
                    <option value="Custom">CUSTOM</option>
                  </select>
                </div>
              </div>
            </div>

            {/* STEP 1.3: PERSONAL RECORDS */}
            <div>
              <p style={{ marginBottom: '4px' }}>
                <strong style={{ color: 'var(--dp-color-accent)' }}>1.3 PERSONAL RECORDS:</strong> Tap any lift below (or in{' '}
                <strong>HISTORY → PERSONAL RECORDS</strong>) to enter or calculate your current 1RM (defaults to <strong>TBD</strong> until you log a workout or override it).
              </p>
              <div style={{ ...stepBoxStyle, marginBottom: 0, gap: '6px' }}>
                {EXERCISE_LIBRARY.filter(e => e.isPriority).map(ex => {
                  const currentMax = Number(oneRepMaxes?.[ex.id]) || 0;
                  const isTBD = currentMax <= 0;
                  const isBigFour = BIG_FOUR_IDS.includes(ex.id);
                  const targetVal = isBigFour
                    ? getExRxTargetForLift(ex.id, targetStandardClass, userBodyweightLbs, totalHeightInches, customGoalWeights)
                    : null;
                  return (
                    <div
                      key={ex.id}
                      onClick={() => openPlateCalculatorForPR?.(ex.id, ex.name, isTBD ? ex.default1RM : currentMax)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        backgroundColor: '#161616',
                        border: '2px solid var(--dp-color-rule)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ minWidth: 0, paddingRight: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#FFFFFF' }}>
                          {ex.name}
                        </div>
                        {targetVal !== null && (
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#A0A0A0', textTransform: 'uppercase' }}>
                            TARGET ({targetStandardClass}): {targetVal} LB
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#101010',
                          border: '2px solid var(--dp-color-rule)',
                          color: 'var(--dp-color-accent)',
                          fontSize: '12px',
                          fontWeight: 800,
                          flexShrink: 0
                        }}
                      >
                        {isTBD ? 'TBD ✎' : `${currentMax} LB ✎`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection header="02 // LOGGING & AUTO-BUILDING SESSIONS" colors={colors}>
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%', lineHeight: 1.5, fontSize: '14px', color: '#E0E0E0' }}>
            {/* STEP 2.1: AUTO SESSION & EQUIPMENT SETUP */}
            <div>
              <p style={{ marginBottom: '4px' }}>
                <strong style={{ color: 'var(--dp-color-accent)' }}>2.1 AUTO SESSION & EQUIPMENT SETUP:</strong> Choose your active Gyms/Equipment filter and default Auto Session structure below, or tap{' '}
                <strong>AUTO SESSION</strong> on the Home screen to immediately start an automatically generated workout.
              </p>
              <div style={stepBoxStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>
                    ACTIVE GYMS/EQUIPMENT
                  </span>
                  <select
                    value={selectedGymId || ''}
                    onChange={e => setSelectedGymId?.(e.target.value)}
                    style={{
                      backgroundColor: '#161616',
                      color: 'var(--dp-color-accent)',
                      border: '2px solid var(--dp-color-rule)',
                      padding: '6px 8px',
                      fontSize: '11px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      maxWidth: '200px'
                    }}
                  >
                    {DEFAULT_GYM_EQUIPMENT_PRESETS.map(p => (
                      <option key={p.id || 'full_gym'} value={p.id}>
                        {p.name.toUpperCase()}
                      </option>
                    ))}
                    {(gyms || []).map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#A0A0A0', textTransform: 'uppercase', marginBottom: '6px' }}>
                    AUTO ROUTINE STRUCTURE ({routinePreferences.length} SLOTS)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                    {routinePreferences.map((comp, idx) => (
                      <div
                        key={`${comp}_${idx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          backgroundColor: '#161616',
                          border: '2px solid var(--dp-color-rule)'
                        }}
                      >
                        <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                          0{idx + 1} / {comp}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() =>
                              setRoutinePreferences?.(prev => {
                                const copy = [...prev];
                                const tmp = copy[idx - 1];
                                copy[idx - 1] = copy[idx];
                                copy[idx] = tmp;
                                return copy;
                              })
                            }
                            style={{ ...UI.pillBtn(false), padding: '3px 7px', fontSize: '10px' }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={idx === routinePreferences.length - 1}
                            onClick={() =>
                              setRoutinePreferences?.(prev => {
                                const copy = [...prev];
                                const tmp = copy[idx + 1];
                                copy[idx + 1] = copy[idx];
                                copy[idx] = tmp;
                                return copy;
                              })
                            }
                            style={{ ...UI.pillBtn(false), padding: '3px 7px', fontSize: '10px' }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => setRoutinePreferences?.(prev => prev.filter((_, i) => i !== idx))}
                            style={{ ...UI.pillBtn(false), padding: '3px 7px', fontSize: '10px', color: '#FF3B30' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {['Compound Lift', 'Accessory', 'Superset', 'Abs'].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setRoutinePreferences?.(prev => [...prev, type])}
                        style={{ ...UI.pillBtn(false), padding: '5px 8px', fontSize: '10px', color: 'var(--dp-color-accent)' }}
                      >
                        + {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenNewSession?.()}
                    className="kinetic-btn"
                    style={{ ...UI.secondaryBtnCenter, padding: '10px 8px', fontSize: '11px' }}
                  >
                    {hasActiveSession ? 'CURRENT SESSION →' : 'NEW SESSION →'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenNewAutoSession?.()}
                    className="kinetic-btn"
                    style={{ ...UI.primaryBtnCenter, padding: '10px 8px', fontSize: '11px' }}
                  >
                    AUTO SESSION →
                  </button>
                </div>
              </div>
            </div>

            {/* STEP 2.2: MANUAL OVERRIDES */}
            <div>
              <p style={{ marginBottom: '4px' }}>
                <strong style={{ color: 'var(--dp-color-accent)' }}>2.2 MANUAL OVERRIDES:</strong> Tap any exercise's category, muscle group, scheme, or lift dropdown to customize it, drag the grippy number badges to rearrange exercises or sets, use <strong>RECALCULATE</strong> to scale weights to your set count or build warmups to a 1 Rep Max, or tap <strong>✕</strong> to delete a set or exercise.
              </p>
              <div style={{ ...stepBoxStyle, marginBottom: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setCurrentView('routines')}
                    className="kinetic-btn"
                    style={{ ...UI.secondaryBtnCenter, padding: '10px 8px', fontSize: '11px' }}
                  >
                    OPEN ROUTINES →
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView('gyms')}
                    className="kinetic-btn"
                    style={{ ...UI.secondaryBtnCenter, padding: '10px 8px', fontSize: '11px' }}
                  >
                    OPEN GYMS/EQUIPMENT →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </IOSListRow>
      </IOSListSection>

      <IOSListSection header="03 // DATA POLICIES" colors={colors}>
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%', lineHeight: 1.5, fontSize: '14px', color: '#E0E0E0' }}>
            {/* STEP 3.1: CROSS-DEVICE CLOUD SYNC */}
            <div>
              <p style={{ marginBottom: '4px' }}>
                <strong style={{ color: 'var(--dp-color-accent)' }}>3.1 CROSS-DEVICE CLOUD SYNC:</strong> When signed in to your account, your workout history, personal records (1RMs), custom routines, gym equipment presets, active sessions, and settings automatically synchronize with Supabase Cloud so your training data seamlessly follows you across your phone, tablet, and computer.
              </p>
              <div style={stepBoxStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: user ? '#30D158' : '#A0A0A0' }}>
                    {user ? `SIGNED IN AS @${user.username}` : 'STATUS: OFFLINE / NOT SIGNED IN'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentView(user ? 'profile' : 'auth')}
                    className="kinetic-btn"
                    style={{ ...UI.pillBtn(Boolean(user)), padding: '6px 10px', fontSize: '11px' }}
                  >
                    {user ? 'PROFILE →' : 'SIGN IN / SYNC →'}
                  </button>
                </div>
              </div>
            </div>

            {/* STEP 3.2: ON-DEVICE RETENTION */}
            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--dp-color-accent)' }}>3.2 ON-DEVICE RETENTION:</strong> All training records and preferences are also cached locally on your device in versioned storage (Schema V3) so the app loads instantaneously and retains your progress across app updates even during offline gym sessions.
            </p>

            {/* STEP 3.3: CLOUD AUTH & PRIVACY */}
            <div>
              <p style={{ marginBottom: '4px' }}>
                <strong style={{ color: 'var(--dp-color-accent)' }}>3.3 CLOUD AUTH & PRIVACY:</strong> Registered accounts are protected by Supabase Cloud authentication and Row-Level Security (RLS) policies ensuring only you can access or modify your private records, while social stats and routines are only shared with friends if enabled below.
              </p>
              <div style={stepBoxStyle}>
                <div
                  onClick={() => setShareStatsWithFriends?.(p => !p)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>
                    SHARE STATS WITH FRIENDS
                  </span>
                  <span style={UI.badge(shareStatsWithFriends)}>{shareStatsWithFriends ? 'ON' : 'OFF'}</span>
                </div>
                <div
                  onClick={() => setShareRoutinesWithFriends?.(p => !p)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>
                    SHARE ROUTINES WITH FRIENDS
                  </span>
                  <span style={UI.badge(shareRoutinesWithFriends)}>{shareRoutinesWithFriends ? 'ON' : 'OFF'}</span>
                </div>
              </div>
            </div>

            {/* STEP 3.4: PORTABLE BACKUPS & DELETION */}
            <div>
              <p style={{ marginBottom: '4px' }}>
                <strong style={{ color: 'var(--dp-color-accent)' }}>3.4 PORTABLE BACKUPS & DELETION:</strong> You maintain full ownership of your data—use the controls below (or in <strong>MENU → SETTINGS</strong>) at any time to export a complete <strong>.JSON</strong> backup file, restore from a backup, or permanently clear and reset local data.
              </p>
              <div style={{ ...stepBoxStyle, marginBottom: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleExportBackupJSON}
                    className="kinetic-btn"
                    style={{ ...UI.secondaryBtnCenter, padding: '10px 8px', fontSize: '11px', color: 'var(--dp-color-accent)' }}
                  >
                    EXPORT .JSON ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => importBackupInputRef?.current?.click()}
                    className="kinetic-btn"
                    style={{ ...UI.secondaryBtnCenter, padding: '10px 8px', fontSize: '11px' }}
                  >
                    IMPORT .JSON ↑
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleResetToDemoDefaults}
                  className="kinetic-btn"
                  style={{ ...UI.secondaryBtnCenter, padding: '8px', fontSize: '11px', color: '#FF3B30' }}
                >
                  CLEAR & RESET ALL LOCAL DATA ↺
                </button>
              </div>
            </div>
          </div>
        </IOSListRow>
      </IOSListSection>

      <div style={UI.gutterWrap}>
        <button
          type="button"
          onClick={() => setCurrentView('home')}
          className="kinetic-btn"
          style={UI.primaryBtnCenter}
        >
          ENTER WORKSPACE →
        </button>
      </div>
    </div>
  );
}

export function AuthView({
  colors,
  authUsername,
  setAuthUsername,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  signupUsername,
  setSignupUsername,
  signupEmail,
  setSignupEmail,
  signupPassword,
  setSignupPassword,
  signupBetaCode,
  setSignupBetaCode,
  recoveryAccessToken,
  setRecoveryAccessToken,
  setUser,
  setCurrentView
}) {
  const [loginError, setLoginError] = useState('');
  const [signupError, setSignupError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(null);

  // Password visibility toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);

  // Account recovery state
  const [showRecoveryPanel, setShowRecoveryPanel] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryBetaCode, setRecoveryBetaCode] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');

  const showHideBtnStyle = isShown => ({
    padding: '5px 10px',
    backgroundColor: isShown ? 'var(--dp-color-accent)' : '#101010',
    color: isShown ? '#101010' : '#FFFFFF',
    border: '2px solid var(--dp-color-rule)',
    fontSize: '10px',
    fontWeight: 800,
    textTransform: 'uppercase',
    cursor: 'pointer',
    flexShrink: 0
  });

  const handleSignInSubmit = async () => {
    if (authSubmitting) return;
    setLoginError('');
    setSignupError('');
    setAuthSubmitting('login');
    try {
      const result = await signInUserAccount({
        identifier: authEmail || authUsername,
        username: authUsername,
        email: authEmail,
        password: authPassword
      });
      setUser(result.user);
      setAuthUsername(result.user.username);
      setAuthEmail(result.user.email);
      setAuthPassword('');
      setCurrentView('home');
    } catch (err) {
      setLoginError(err?.message || 'SIGN IN FAILED. CHECK YOUR USERNAME/EMAIL AND PASSWORD.');
    } finally {
      setAuthSubmitting(null);
    }
  };

  const handleSignUpSubmit = async () => {
    if (authSubmitting) return;
    setSignupError('');
    setLoginError('');
    setAuthSubmitting('signup');
    try {
      const result = await registerUserAccount({
        username: signupUsername,
        email: signupEmail,
        password: signupPassword,
        betaCode: signupBetaCode
      });
      setUser(result.user);
      setAuthUsername(result.user.username);
      setAuthEmail(result.user.email);
      setSignupPassword('');
      setSignupBetaCode('');
      setCurrentView('info');
    } catch (err) {
      setSignupError(err?.message || 'ACCOUNT CREATION FAILED. VERIFY ALL FIELDS AND BETA CODE.');
    } finally {
      setAuthSubmitting(null);
    }
  };

  const handleSendRecoveryEmail = async () => {
    if (authSubmitting) return;
    setRecoveryError('');
    setRecoverySuccess('');
    setAuthSubmitting('recover_email');
    try {
      const targetEmail = (recoveryEmail || authEmail).trim();
      const res = await requestPasswordRecoveryEmail({ email: targetEmail });
      setRecoverySuccess(res.message);
    } catch (err) {
      setRecoveryError(err?.message || 'FAILED TO SEND RECOVERY EMAIL.');
    } finally {
      setAuthSubmitting(null);
    }
  };

  const handleResetWithBetaCode = async () => {
    if (authSubmitting) return;
    setRecoveryError('');
    setRecoverySuccess('');
    setAuthSubmitting('recover_beta');
    try {
      const result = await resetPasswordWithBetaCode({
        email: recoveryEmail || authEmail,
        username: recoveryUsername || authUsername,
        betaCode: recoveryBetaCode,
        newPassword: recoveryNewPassword
      });
      setUser(result.user);
      setAuthUsername(result.user.username);
      setAuthEmail(result.user.email);
      setRecoveryNewPassword('');
      setRecoveryBetaCode('');
      setShowRecoveryPanel(false);
      setCurrentView('home');
    } catch (err) {
      setRecoveryError(err?.message || 'PASSWORD RESET FAILED.');
    } finally {
      setAuthSubmitting(null);
    }
  };

  const handleCompleteTokenReset = async () => {
    if (authSubmitting) return;
    setRecoveryError('');
    setRecoverySuccess('');
    setAuthSubmitting('recover_token');
    try {
      const result = await completePasswordRecoveryWithToken({
        accessToken: recoveryAccessToken,
        newPassword: recoveryNewPassword
      });
      if (setRecoveryAccessToken) setRecoveryAccessToken(null);
      setUser(result.user);
      setAuthUsername(result.user.username);
      setAuthEmail(result.user.email);
      setRecoveryNewPassword('');
      setCurrentView('home');
    } catch (err) {
      setRecoveryError(err?.message || 'FAILED TO UPDATE PASSWORD.');
    } finally {
      setAuthSubmitting(null);
    }
  };

  return (
    <div style={UI.pagePad}>
      {/* EMAIL LINK RECOVERY COMPLETION BANNER (SHOWN WHEN USER ARRIVES FROM EMAIL RESET LINK) */}
      {recoveryAccessToken && (
        <div style={{ marginBottom: '20px' }}>
          <IOSListSection
            header="PASSWORD RECOVERY // SET NEW PASSWORD"
            footer="Your email recovery link is verified. Enter your new password below to restore access."
            colors={colors}
          >
            <IOSListRow isLast={true} colors={colors}>
              <div style={{ width: '100%' }}>
                <div style={UI.fieldLabel}>NEW PASSWORD</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type={showRecoveryPassword ? 'text' : 'password'}
                    placeholder="MIN 6 CHARACTERS"
                    value={recoveryNewPassword}
                    onChange={e => {
                      setRecoveryNewPassword(e.target.value);
                      if (recoveryError) setRecoveryError('');
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleCompleteTokenReset();
                    }}
                    style={{ ...UI.textInputBare, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRecoveryPassword(prev => !prev)}
                    style={showHideBtnStyle(showRecoveryPassword)}
                  >
                    {showRecoveryPassword ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>
            </IOSListRow>
          </IOSListSection>

          <div style={{ padding: '0 var(--dp-spacing-gutter)' }}>
            {recoveryError && (
              <div
                style={{
                  marginBottom: '10px',
                  padding: '10px 12px',
                  backgroundColor: '#1A0A0A',
                  border: '2px solid #FF3B30',
                  color: '#FF3B30',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  lineHeight: 1.4
                }}
              >
                ⚠ {recoveryError}
              </div>
            )}
            <button
              type="button"
              disabled={authSubmitting === 'recover_token'}
              onClick={handleCompleteTokenReset}
              className="kinetic-btn"
              style={UI.primaryBtnCenter}
            >
              {authSubmitting === 'recover_token' ? 'SAVING NEW PASSWORD...' : 'SAVE NEW PASSWORD & SIGN IN →'}
            </button>
          </div>
        </div>
      )}

      <IOSListSection header="SIGN IN // EXISTING ACCOUNT" colors={colors}>
        <IOSListRow colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>USERNAME OR EMAIL</div>
            <input
              type="text"
              placeholder="USERNAME OR YOU@DOMAIN.COM"
              value={authEmail}
              onChange={e => {
                setAuthEmail(e.target.value);
                setAuthUsername(e.target.value);
                if (loginError) setLoginError('');
              }}
              style={UI.textInputBare}
            />
          </div>
        </IOSListRow>
        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>PASSWORD</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type={showLoginPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={authPassword}
                onChange={e => {
                  setAuthPassword(e.target.value);
                  if (loginError) setLoginError('');
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSignInSubmit();
                }}
                style={{ ...UI.textInputBare, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword(prev => !prev)}
                style={showHideBtnStyle(showLoginPassword)}
              >
                {showLoginPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>
        </IOSListRow>
      </IOSListSection>

      <div style={{ padding: '0 var(--dp-spacing-gutter) 20px' }}>
        {loginError && (
          <div
            style={{
              marginBottom: '10px',
              padding: '10px 12px',
              backgroundColor: '#1A0A0A',
              border: '2px solid #FF3B30',
              color: '#FF3B30',
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              lineHeight: 1.4
            }}
          >
            ⚠ {loginError}
          </div>
        )}
        <button
          type="button"
          disabled={authSubmitting === 'login'}
          onClick={handleSignInSubmit}
          className="kinetic-btn"
          style={{
            ...UI.secondaryBtnCenter,
            opacity: authSubmitting === 'login' ? 0.6 : 1
          }}
        >
          {authSubmitting === 'login' ? 'VERIFYING CREDENTIALS...' : 'SIGN IN →'}
        </button>

        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => {
              setShowRecoveryPanel(prev => !prev);
              setRecoveryError('');
              setRecoverySuccess('');
              if (!recoveryEmail && authEmail) setRecoveryEmail(authEmail);
              if (!recoveryUsername && authUsername) setRecoveryUsername(authUsername);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: showRecoveryPanel ? 'var(--dp-color-accent)' : '#A0A0A0',
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              cursor: 'pointer',
              padding: '4px 0',
              textDecoration: 'underline'
            }}
          >
            {showRecoveryPanel ? 'HIDE ACCOUNT RECOVERY ▲' : 'FORGOT PASSWORD? RECOVER ACCOUNT ▼'}
          </button>
        </div>
      </div>

      {/* EXPANDABLE ACCOUNT RECOVERY // FORGOT PASSWORD PANEL */}
      {showRecoveryPanel && (
        <div style={{ marginBottom: '24px' }}>
          <IOSListSection
            header="ACCOUNT RECOVERY // FORGOT PASSWORD"
            footer="Recover via an email reset link (cross-device) OR reset immediately on this device using your Username and Beta Tester Code."
            colors={colors}
          >
            <IOSListRow colors={colors}>
              <div style={{ width: '100%' }}>
                <div style={UI.fieldLabel}>REGISTERED EMAIL ADDRESS</div>
                <input
                  type="email"
                  placeholder="YOU@DOMAIN.COM"
                  value={recoveryEmail}
                  onChange={e => {
                    setRecoveryEmail(e.target.value);
                    if (recoveryError) setRecoveryError('');
                  }}
                  style={UI.textInputBare}
                />
              </div>
            </IOSListRow>

            <IOSListRow colors={colors}>
              <div style={{ width: '100%' }}>
                <div style={UI.fieldLabel}>OPTION 1: EMAIL RECOVERY LINK</div>
                <button
                  type="button"
                  disabled={authSubmitting === 'recover_email'}
                  onClick={handleSendRecoveryEmail}
                  className="kinetic-btn"
                  style={{
                    ...UI.secondaryBtnCenter,
                    padding: '10px',
                    fontSize: '12px',
                    opacity: authSubmitting === 'recover_email' ? 0.6 : 1
                  }}
                >
                  {authSubmitting === 'recover_email' ? 'SENDING RECOVERY LINK...' : 'SEND RECOVERY EMAIL LINK ↗'}
                </button>
              </div>
            </IOSListRow>

            <IOSListRow colors={colors}>
              <div style={{ width: '100%' }}>
                <div style={UI.fieldLabel}>OPTION 2: INSTANT RESET — ACCOUNT USERNAME</div>
                <input
                  type="text"
                  placeholder="YOUR REGISTERED USERNAME"
                  value={recoveryUsername}
                  onChange={e => {
                    setRecoveryUsername(e.target.value);
                    if (recoveryError) setRecoveryError('');
                  }}
                  style={UI.textInputBare}
                />
              </div>
            </IOSListRow>

            <IOSListRow colors={colors}>
              <div style={{ width: '100%' }}>
                <div style={UI.fieldLabel}>BETA TESTER CODE (REQUIRED FOR INSTANT RESET)</div>
                <input
                  type="text"
                  placeholder="ENTER BETA CODE"
                  value={recoveryBetaCode}
                  onChange={e => {
                    setRecoveryBetaCode(e.target.value);
                    if (recoveryError) setRecoveryError('');
                  }}
                  style={UI.textInputBare}
                />
              </div>
            </IOSListRow>

            <IOSListRow isLast={true} colors={colors}>
              <div style={{ width: '100%' }}>
                <div style={UI.fieldLabel}>NEW PASSWORD</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type={showRecoveryPassword ? 'text' : 'password'}
                    placeholder="MIN 6 CHARACTERS"
                    value={recoveryNewPassword}
                    onChange={e => {
                      setRecoveryNewPassword(e.target.value);
                      if (recoveryError) setRecoveryError('');
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleResetWithBetaCode();
                    }}
                    style={{ ...UI.textInputBare, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRecoveryPassword(prev => !prev)}
                    style={showHideBtnStyle(showRecoveryPassword)}
                  >
                    {showRecoveryPassword ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>
            </IOSListRow>
          </IOSListSection>

          <div style={{ padding: '0 var(--dp-spacing-gutter)' }}>
            {recoveryError && (
              <div
                style={{
                  marginBottom: '10px',
                  padding: '10px 12px',
                  backgroundColor: '#1A0A0A',
                  border: '2px solid #FF3B30',
                  color: '#FF3B30',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  lineHeight: 1.4
                }}
              >
                ⚠ {recoveryError}
              </div>
            )}
            {recoverySuccess && (
              <div
                style={{
                  marginBottom: '10px',
                  padding: '10px 12px',
                  backgroundColor: '#0A1A0E',
                  border: '2px solid #30D158',
                  color: '#30D158',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  lineHeight: 1.4
                }}
              >
                ✓ {recoverySuccess}
              </div>
            )}
            <button
              type="button"
              disabled={authSubmitting === 'recover_beta'}
              onClick={handleResetWithBetaCode}
              className="kinetic-btn"
              style={{
                ...UI.primaryBtnCenter,
                opacity: authSubmitting === 'recover_beta' ? 0.6 : 1
              }}
            >
              {authSubmitting === 'recover_beta' ? 'RESETTING PASSWORD...' : 'RESET PASSWORD NOW →'}
            </button>
          </div>
        </div>
      )}

      <IOSListSection
        header="SIGN UP // CREATE ACCOUNT"
        footer="Beta tester access code is required to register a new account."
        colors={colors}
      >
        <IOSListRow colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>CHOOSE USERNAME</div>
            <input
              type="text"
              placeholder="E.G. IRON_LIFTER"
              value={signupUsername}
              onChange={e => {
                setSignupUsername(e.target.value);
                if (signupError) setSignupError('');
              }}
              style={UI.textInputBare}
            />
          </div>
        </IOSListRow>

        <IOSListRow colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>EMAIL ADDRESS</div>
            <input
              type="email"
              placeholder="YOU@DOMAIN.COM"
              value={signupEmail}
              onChange={e => {
                setSignupEmail(e.target.value);
                if (signupError) setSignupError('');
              }}
              style={UI.textInputBare}
            />
          </div>
        </IOSListRow>

        <IOSListRow colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>CREATE PASSWORD</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type={showSignupPassword ? 'text' : 'password'}
                placeholder="MIN 6 CHARACTERS"
                value={signupPassword}
                onChange={e => {
                  setSignupPassword(e.target.value);
                  if (signupError) setSignupError('');
                }}
                style={{ ...UI.textInputBare, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowSignupPassword(prev => !prev)}
                style={showHideBtnStyle(showSignupPassword)}
              >
                {showSignupPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>
        </IOSListRow>

        <IOSListRow isLast={true} colors={colors}>
          <div style={{ width: '100%' }}>
            <div style={UI.fieldLabel}>BETA TESTER CODE (REQUIRED)</div>
            <input
              type="text"
              placeholder="ENTER BETA CODE"
              value={signupBetaCode}
              onChange={e => {
                setSignupBetaCode(e.target.value);
                if (signupError) setSignupError('');
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSignUpSubmit();
              }}
              style={UI.textInputBare}
            />
          </div>
        </IOSListRow>
      </IOSListSection>

      <div style={UI.gutterWrap}>
        {signupError && (
          <div
            style={{
              marginBottom: '10px',
              padding: '10px 12px',
              backgroundColor: '#1A0A0A',
              border: '2px solid #FF3B30',
              color: '#FF3B30',
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              lineHeight: 1.4
            }}
          >
            ⚠ {signupError}
          </div>
        )}
        <button
          type="button"
          disabled={authSubmitting === 'signup'}
          onClick={handleSignUpSubmit}
          className="kinetic-btn"
          style={{
            ...UI.primaryBtnCenter,
            opacity: authSubmitting === 'signup' ? 0.6 : 1
          }}
        >
          {authSubmitting === 'signup' ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT →'}
        </button>
      </div>
    </div>
  );
}

