"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';

// ============================================================================
// 0. PRODUCTION SUPABASE CLOUD SYNC & AUTH ADAPTER (ZERO-DEPENDENCY REST/AUTH)
// ============================================================================
// Automatically reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
// when deployed on Next.js / Vercel. Gracefully falls back to localStorage
// in preview environments or when used as a Guest.

const getEnv = (key) => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch {}
  return '';
};

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const IS_SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const supabaseCloud = {
  isConfigured: IS_SUPABASE_CONFIGURED,

  getHeaders(accessToken = null) {
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    };
  },

  async signUp(email, password, displayName) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        email,
        password,
        data: { display_name: displayName }
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || data.error_description || data.message || 'Sign up failed');
    return data;
  },

  async signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || data.message || 'Invalid login credentials');
    return data;
  },

  async signOut(accessToken) {
    if (!accessToken) return;
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: this.getHeaders(accessToken)
    }).catch(() => {});
  },

  async fetchUserData(userId, accessToken) {
    const headers = this.getHeaders(accessToken);
    const [profRes, histRes, custRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}&select=*`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/workout_history?user_id=eq.${userId}&order=started_at.desc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/custom_workouts?user_id=eq.${userId}&order=created_at.desc`, { headers })
    ]);

    const profiles = profRes.ok ? await profRes.json() : [];
    const historyRows = histRes.ok ? await histRes.json() : [];
    const customRows = custRes.ok ? await custRes.json() : [];

    return {
      oneRepMaxes: profiles[0]?.one_rep_maxes || null,
      history: historyRows.map(r => ({
        id: r.id,
        title: r.title,
        presetUsed: r.preset_used,
        startedAt: r.started_at,
        updatedAt: r.updated_at,
        defaultRestSeconds: r.default_rest_seconds,
        isComplete: r.is_complete,
        verifiedByUser: r.verified_by_user,
        slots: r.slots || []
      })),
      customPresets: customRows.map(r => ({
        key: r.key,
        label: r.label,
        createdAt: r.created_at,
        slots: r.slots || []
      }))
    };
  },

  async upsertProfile(user, oneRepMaxes) {
    if (!user?.accessToken || !this.isConfigured) return;
    await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(user.accessToken),
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        display_name: user.name || user.email.split('@')[0],
        one_rep_maxes: oneRepMaxes,
        updated_at: new Date().toISOString()
      })
    }).catch(() => {});
  },

  async upsertWorkoutHistory(user, workout) {
    if (!user?.accessToken || !this.isConfigured) return;
    await fetch(`${SUPABASE_URL}/rest/v1/workout_history`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(user.accessToken),
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: workout.id,
        user_id: user.id,
        title: workout.title,
        preset_used: workout.presetUsed,
        started_at: workout.startedAt,
        updated_at: workout.updatedAt || new Date().toISOString(),
        default_rest_seconds: workout.defaultRestSeconds || 90,
        is_complete: Boolean(workout.isComplete),
        verified_by_user: Boolean(workout.verifiedByUser),
        slots: workout.slots || []
      })
    }).catch(() => {});
  },

  async deleteWorkoutHistory(user, workoutId) {
    if (!user?.accessToken || !this.isConfigured) return;
    await fetch(`${SUPABASE_URL}/rest/v1/workout_history?id=eq.${workoutId}&user_id=eq.${user.id}`, {
      method: 'DELETE',
      headers: this.getHeaders(user.accessToken)
    }).catch(() => {});
  },

  async upsertCustomPreset(user, preset) {
    if (!user?.accessToken || !this.isConfigured) return;
    await fetch(`${SUPABASE_URL}/rest/v1/custom_workouts`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(user.accessToken),
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        key: preset.key,
        user_id: user.id,
        label: preset.label,
        created_at: preset.createdAt || new Date().toISOString(),
        slots: preset.slots || []
      })
    }).catch(() => {});
  }
};

// ============================================================================
// 1. NATIVE iOS 17/18 HIG DESIGN SYSTEM (TYPOGRAPHY, DYNAMIC COLORS & SF SYMBOLS)
// ============================================================================

/**
 * iOS Semantic Text Styles (Apple HIG Typography Scale - San Francisco / -apple-system)
 * Mapped strictly to point sizes, line heights, weights, and tracking.
 */
const IOS_TEXT = {
  largeTitle: {
    fontSize: '34px',
    lineHeight: '41px',
    fontWeight: 700,
    letterSpacing: '0.37px'
  },
  title1: {
    fontSize: '28px',
    lineHeight: '34px',
    fontWeight: 700,
    letterSpacing: '0.36px'
  },
  title2: {
    fontSize: '22px',
    lineHeight: '28px',
    fontWeight: 700,
    letterSpacing: '0.35px'
  },
  title3: {
    fontSize: '20px',
    lineHeight: '25px',
    fontWeight: 600,
    letterSpacing: '0.38px'
  },
  headline: {
    fontSize: '17px',
    lineHeight: '22px',
    fontWeight: 600,
    letterSpacing: '-0.41px'
  },
  body: {
    fontSize: '17px',
    lineHeight: '22px',
    fontWeight: 400,
    letterSpacing: '-0.41px'
  },
  callout: {
    fontSize: '16px',
    lineHeight: '21px',
    fontWeight: 400,
    letterSpacing: '-0.32px'
  },
  subheadline: {
    fontSize: '15px',
    lineHeight: '20px',
    fontWeight: 400,
    letterSpacing: '-0.24px'
  },
  footnote: {
    fontSize: '13px',
    lineHeight: '18px',
    fontWeight: 400,
    letterSpacing: '-0.08px'
  },
  caption1: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 400,
    letterSpacing: '0px'
  },
  caption2: {
    fontSize: '11px',
    lineHeight: '13px',
    fontWeight: 400,
    letterSpacing: '0.07px'
  }
};

/**
 * Official iOS Dynamic System Colors (Light & Dark Mode Semantic Tokens)
 * Uses exact UIKit / SwiftUI dynamic color definitions.
 */
const getSystemColors = (isDark) => ({
  // Backgrounds
  systemBackground: isDark ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)',
  secondarySystemBackground: isDark ? 'rgb(28, 28, 30)' : 'rgb(242, 242, 247)',
  tertiarySystemBackground: isDark ? 'rgb(44, 44, 46)' : 'rgb(255, 255, 255)',
  systemGroupedBackground: isDark ? 'rgb(0, 0, 0)' : 'rgb(242, 242, 247)',
  secondarySystemGroupedBackground: isDark ? 'rgb(28, 28, 30)' : 'rgb(255, 255, 255)',
  tertiarySystemGroupedBackground: isDark ? 'rgb(44, 44, 46)' : 'rgb(242, 242, 247)',

  // Labels
  label: isDark ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)',
  secondaryLabel: isDark ? 'rgba(235, 235, 245, 0.6)' : 'rgba(60, 60, 67, 0.6)',
  tertiaryLabel: isDark ? 'rgba(235, 235, 245, 0.3)' : 'rgba(60, 60, 67, 0.3)',
  quaternaryLabel: isDark ? 'rgba(235, 235, 245, 0.18)' : 'rgba(60, 60, 67, 0.18)',

  // Fills & Separators
  systemFill: isDark ? 'rgba(120, 120, 128, 0.36)' : 'rgba(120, 120, 128, 0.2)',
  secondarySystemFill: isDark ? 'rgba(120, 120, 128, 0.32)' : 'rgba(120, 120, 128, 0.16)',
  tertiarySystemFill: isDark ? 'rgba(118, 118, 128, 0.24)' : 'rgba(118, 118, 128, 0.12)',
  separator: isDark ? 'rgba(84, 84, 88, 0.65)' : 'rgba(60, 60, 67, 0.29)',
  opaqueSeparator: isDark ? 'rgb(56, 56, 58)' : 'rgb(198, 198, 200)',

  // Vibrant Tint Colors
  systemBlue: isDark ? 'rgb(10, 132, 255)' : 'rgb(0, 122, 255)',
  systemGreen: isDark ? 'rgb(48, 209, 88)' : 'rgb(52, 199, 89)',
  systemIndigo: isDark ? 'rgb(94, 92, 230)' : 'rgb(88, 86, 214)',
  systemOrange: isDark ? 'rgb(255, 159, 10)' : 'rgb(255, 149, 0)',
  systemPink: isDark ? 'rgb(255, 55, 95)' : 'rgb(255, 45, 85)',
  systemPurple: isDark ? 'rgb(191, 90, 242)' : 'rgb(175, 82, 222)',
  systemRed: isDark ? 'rgb(255, 69, 58)' : 'rgb(255, 59, 48)',
  systemTeal: isDark ? 'rgb(100, 210, 255)' : 'rgb(48, 176, 199)',
  systemYellow: isDark ? 'rgb(255, 214, 10)' : 'rgb(255, 204, 0)',
  systemGray: 'rgb(142, 142, 147)',
  systemGray4: isDark ? 'rgb(58, 58, 60)' : 'rgb(209, 209, 214)',
  systemGray5: isDark ? 'rgb(44, 44, 46)' : 'rgb(229, 229, 234)',
  systemGray6: isDark ? 'rgb(28, 28, 30)' : 'rgb(242, 242, 247)',

  // Blur / Vibrancy Materials
  chromeMaterial: isDark ? 'rgba(28, 28, 30, 0.82)' : 'rgba(249, 249, 249, 0.82)'
});

/**
 * Native SF Symbols Renderer
 * Maps official Apple SF Symbol names (e.g., "figure.strengthtraining.traditional",
 * "clock.arrow.circlepath", "chevron.backward") to crisp vector paths.
 */
const SFSymbol = ({ name, size = 18, color = 'currentColor', style = {} }) => {
  const s = { width: size, height: size, display: 'inline-block', flexShrink: 0, ...style };

  switch (name) {
    case 'chevron.backward':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <path d="M15 19l-7-7 7-7" />
        </svg>
      );
    case 'chevron.forward':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <path d="M9 5l7 7-7 7" />
        </svg>
      );
    case 'chevron.up.chevron.down':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <path d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
        </svg>
      );
    case 'chevron.down':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case 'chevron.up':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <path d="M18 15l-6-6-6 6" />
        </svg>
      );
    case 'figure.strengthtraining.traditional':
    case 'dumbbell.fill':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <path d="M6.5 6.5L17.5 17.5" />
          <path d="M3 10l7-7M2.5 5.5l3-3M14 21l7-7M18.5 21.5l3-3" />
        </svg>
      );
    case 'play.fill':
      return (
        <svg viewBox="0 0 24 24" fill={color} style={s} aria-label={name}>
          <path d="M6 4.5v15a1 1 0 001.52.85l12-7.5a1 1 0 000-1.7l-12-7.5A1 1 0 006 4.5z" />
        </svg>
      );
    case 'clock.arrow.circlepath':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'trophy.fill':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
      );
    case 'arrow.triangle.2.circlepath':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 16h5v5" />
        </svg>
      );
    case 'person.crop.circle':
    case 'person.crop.circle.fill':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="9.5" r="3" />
          <path d="M6.5 18.5c1.5-2.3 3.4-3.5 5.5-3.5s4 1.2 5.5 3.5" />
        </svg>
      );
    case 'plus':
    case 'plus.circle.fill':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          {name.includes('circle') && <circle cx="12" cy="12" r="9.5" />}
          <path d="M12 7.5v9M7.5 12h9" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
          <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />
        </svg>
      );
    case 'checkmark':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case 'checkmark.circle.fill':
      return (
        <svg viewBox="0 0 24 24" fill={color} style={s} aria-label={name}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.4 14.6L6 12l1.4-1.4 3.2 3.2 6-6L18 9.2l-7.4 7.4z" />
        </svg>
      );
    case 'circle':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" style={s} aria-label={name}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case 'trash':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
        </svg>
      );
    case 'timer':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2.5M10 2h4" />
        </svg>
      );
    case 'speaker.wave.2.fill':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      );
    case 'speaker.slash.fill':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      );
    case 'scalemass.fill':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'line.3.horizontal.decrease.circle':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <circle cx="12" cy="12" r="10" />
          <path d="M7 9h10M9 12h6M11 15h2" />
        </svg>
      );
    case 'calendar':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'sun.max.fill':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      );
    case 'moon.fill':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={s} aria-label={name}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    case 'exclamationmark.circle.fill':
      return (
        <svg viewBox="0 0 24 24" fill={color} style={s} aria-label={name}>
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" style={s} aria-label={name}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
};

// ============================================================================
// 2. EXERCISE LIBRARY, PRESETS & 1RM ENGINE (DATA LAYER)
// ============================================================================

const WARMUP_MOVEMENTS = [
  '1min Plank',
  'Cat Curl',
  'Thread the Needle',
  'Downward Dog',
  'Arm Walks',
  "World's Greatest",
  'Back Slaps',
  'Arm Circles Backward',
  'Arm Circles Forward',
  'Shoulder Blade Pulls',
  'Shoulder Overs',
  'Band Overhead Press'
];

const EXERCISE_LIBRARY = [
  {
    id: 'barbell_bench_press',
    name: 'Barbell Bench Press',
    equipment: 'Barbell',
    category: 'Compound Lift',
    muscleGroup: 'Chest',
    specificMuscles: ['Mid Pectorals', 'Anterior Deltoid', 'Triceps'],
    isPriority: true,
    default1RM: 225,
    alternatives: ['dumbbell_press', 'incline_bench_press', 'dumbbell_incline_press']
  },
  {
    id: 'barbell_back_squat',
    name: 'Barbell Back Squat',
    equipment: 'Barbell',
    category: 'Compound Lift',
    muscleGroup: 'Legs',
    specificMuscles: ['Quadriceps', 'Glutes', 'Hamstrings'],
    isPriority: true,
    default1RM: 285,
    alternatives: ['front_squat', 'split_squat', 'goblet_squat']
  },
  {
    id: 'barbell_deadlift',
    name: 'Barbell Deadlift',
    equipment: 'Barbell',
    category: 'Compound Lift',
    muscleGroup: 'Back',
    specificMuscles: ['Hamstrings', 'Glutes', 'Lats', 'Upper Back / Rhomboids'],
    isPriority: true,
    default1RM: 335,
    alternatives: ['landmine_rdl', 'dumbbell_rdl', 'barbell_row']
  },
  {
    id: 'overhead_press',
    name: 'Barbell Overhead Press',
    equipment: 'Barbell',
    category: 'Compound Lift',
    muscleGroup: 'Shoulders',
    specificMuscles: ['Anterior Deltoid', 'Lateral Deltoid', 'Triceps'],
    isPriority: true,
    default1RM: 145,
    alternatives: ['dumbbell_shoulder_press', 'incline_bench_press']
  },
  {
    id: 'incline_bench_press',
    name: 'Incline Bench Press',
    equipment: 'Barbell',
    category: 'Compound Lift',
    muscleGroup: 'Chest',
    specificMuscles: ['Upper Pectorals', 'Anterior Deltoid', 'Triceps'],
    isPriority: true,
    default1RM: 195,
    alternatives: ['dumbbell_incline_press', 'dumbbell_press', 'barbell_bench_press']
  },
  {
    id: 'chin_ups',
    name: 'Chin-Ups / Pull-Ups',
    equipment: 'Bodyweight / Weighted',
    category: 'Compound Lift',
    muscleGroup: 'Back',
    specificMuscles: ['Lats', 'Biceps', 'Upper Back / Rhomboids'],
    isPriority: true,
    default1RM: 210,
    alternatives: ['meadows_row', 'barbell_row', 'dumbbell_row']
  },
  {
    id: 'dumbbell_press',
    name: 'Dumbbell Press',
    equipment: 'Dumbbell',
    category: 'Compound Lift',
    muscleGroup: 'Chest',
    specificMuscles: ['Mid Pectorals', 'Anterior Deltoid', 'Triceps'],
    isPriority: false,
    default1RM: 180,
    alternatives: ['barbell_bench_press', 'incline_bench_press', 'dumbbell_incline_press']
  },
  {
    id: 'dumbbell_incline_press',
    name: 'Dumbbell Incline Press',
    equipment: 'Dumbbell',
    category: 'Compound Lift',
    muscleGroup: 'Chest',
    specificMuscles: ['Upper Pectorals', 'Anterior Deltoid', 'Triceps'],
    isPriority: false,
    default1RM: 160,
    alternatives: ['incline_bench_press', 'dumbbell_press', 'barbell_bench_press']
  },
  {
    id: 'meadows_row',
    name: "Meadow's Row",
    equipment: 'Landmine / Barbell',
    category: 'Compound Lift',
    muscleGroup: 'Back',
    specificMuscles: ['Lats', 'Upper Back / Rhomboids', 'Posterior Deltoid', 'Biceps'],
    isPriority: false,
    default1RM: 165,
    alternatives: ['barbell_row', 'dumbbell_row', 'chin_ups']
  },
  {
    id: 'barbell_row',
    name: 'Barbell Bent-Over Row',
    equipment: 'Barbell',
    category: 'Compound Lift',
    muscleGroup: 'Back',
    specificMuscles: ['Upper Back / Rhomboids', 'Lats', 'Biceps'],
    isPriority: false,
    default1RM: 195,
    alternatives: ['meadows_row', 'dumbbell_row', 'chin_ups']
  },
  {
    id: 'dumbbell_row',
    name: 'Single-Arm Dumbbell Row',
    equipment: 'Dumbbell',
    category: 'Compound Lift',
    muscleGroup: 'Back',
    specificMuscles: ['Lats', 'Upper Back / Rhomboids', 'Biceps'],
    isPriority: false,
    default1RM: 110,
    alternatives: ['meadows_row', 'barbell_row', 'chin_ups']
  },
  {
    id: 'front_squat',
    name: 'Front Squat',
    equipment: 'Barbell',
    category: 'Compound Lift',
    muscleGroup: 'Legs',
    specificMuscles: ['Quadriceps', 'Glutes', 'Abs / Core'],
    isPriority: false,
    default1RM: 225,
    alternatives: ['barbell_back_squat', 'split_squat', 'goblet_squat']
  },
  {
    id: 'landmine_rdl',
    name: 'Landmine RDL',
    equipment: 'Landmine / Barbell',
    category: 'Compound Lift',
    muscleGroup: 'Legs',
    specificMuscles: ['Hamstrings', 'Glutes', 'Lats'],
    isPriority: false,
    default1RM: 215,
    alternatives: ['barbell_deadlift', 'dumbbell_rdl']
  },
  {
    id: 'dumbbell_rdl',
    name: 'Dumbbell RDL',
    equipment: 'Dumbbell',
    category: 'Compound Lift',
    muscleGroup: 'Legs',
    specificMuscles: ['Hamstrings', 'Glutes'],
    isPriority: false,
    default1RM: 175,
    alternatives: ['landmine_rdl', 'barbell_deadlift']
  },
  {
    id: 'split_squat',
    name: 'Split Squat',
    equipment: 'Dumbbell / Barbell',
    category: 'Compound Lift',
    muscleGroup: 'Legs',
    specificMuscles: ['Quadriceps', 'Glutes', 'Hamstrings'],
    isPriority: false,
    default1RM: 155,
    alternatives: ['front_squat', 'reverse_lunge', 'barbell_back_squat']
  },
  {
    id: 'dumbbell_shoulder_press',
    name: 'Dumbbell Shoulder Press',
    equipment: 'Dumbbell',
    category: 'Compound Lift',
    muscleGroup: 'Shoulders',
    specificMuscles: ['Anterior Deltoid', 'Lateral Deltoid', 'Triceps'],
    isPriority: false,
    default1RM: 125,
    alternatives: ['overhead_press', 'incline_bench_press']
  },
  {
    id: 'goblet_squat',
    name: 'Dumbbell Goblet Squat',
    equipment: 'Dumbbell',
    category: 'Compound Lift',
    muscleGroup: 'Legs',
    specificMuscles: ['Quadriceps', 'Glutes'],
    isPriority: false,
    default1RM: 120,
    alternatives: ['front_squat', 'split_squat']
  },
  {
    id: 'reverse_lunge',
    name: 'Reverse Lunge',
    equipment: 'Dumbbell / Barbell',
    category: 'Accessories',
    muscleGroup: 'Legs',
    specificMuscles: ['Quadriceps', 'Glutes', 'Hamstrings'],
    isPriority: false,
    default1RM: 135,
    alternatives: ['split_squat', 'pistol_squats']
  },
  {
    id: 'front_flies',
    name: 'Front Flies',
    equipment: 'Dumbbell',
    category: 'Accessories',
    muscleGroup: 'Chest',
    specificMuscles: ['Mid Pectorals', 'Upper Pectorals', 'Anterior Deltoid'],
    isPriority: false,
    default1RM: 65,
    alternatives: ['reverse_flies', 'dumbbell_press']
  },
  {
    id: 'pistol_squats',
    name: 'Pistol Squats',
    equipment: 'Bodyweight / Dumbbell',
    category: 'Accessories',
    muscleGroup: 'Legs',
    specificMuscles: ['Quadriceps', 'Glutes'],
    isPriority: false,
    default1RM: 95,
    alternatives: ['reverse_lunge', 'split_squat']
  },
  {
    id: 'reverse_flies',
    name: 'Reverse Flies',
    equipment: 'Dumbbell',
    category: 'Accessories',
    muscleGroup: 'Shoulders',
    specificMuscles: ['Posterior Deltoid', 'Upper Back / Rhomboids'],
    isPriority: false,
    default1RM: 55,
    alternatives: ['band_pulldown', 'side_raise_dumbbell']
  },
  {
    id: 'band_pulldown',
    name: 'Band Pulldown',
    equipment: 'Band',
    category: 'Accessories',
    muscleGroup: 'Back',
    specificMuscles: ['Lats', 'Upper Back / Rhomboids', 'Triceps'],
    isPriority: false,
    default1RM: 90,
    alternatives: ['chin_ups', 'reverse_flies']
  },
  {
    id: 'front_raise_ez_bar',
    name: 'Front Raise EZ Bar',
    equipment: 'EZ Bar / Barbell',
    category: 'Accessories',
    muscleGroup: 'Shoulders',
    specificMuscles: ['Anterior Deltoid', 'Upper Pectorals'],
    isPriority: false,
    default1RM: 65,
    alternatives: ['side_raise_dumbbell', 'dumbbell_shoulder_press']
  },
  {
    id: 'side_raise_dumbbell',
    name: 'Side Raise Dumbbell',
    equipment: 'Dumbbell',
    category: 'Accessories',
    muscleGroup: 'Shoulders',
    specificMuscles: ['Lateral Deltoid'],
    isPriority: false,
    default1RM: 45,
    alternatives: ['front_raise_ez_bar', 'reverse_flies']
  },
  {
    id: 'barbell_bicep_curl',
    name: 'Barbell Bicep Curl',
    equipment: 'Barbell',
    category: 'Accessories',
    muscleGroup: 'Arms',
    specificMuscles: ['Biceps', 'Forearms'],
    isPriority: false,
    default1RM: 95,
    alternatives: ['dumbbell_hammer_curl', 'tricep_skullcrusher']
  },
  {
    id: 'dumbbell_hammer_curl',
    name: 'Dumbbell Hammer Curl',
    equipment: 'Dumbbell',
    category: 'Accessories',
    muscleGroup: 'Arms',
    specificMuscles: ['Biceps', 'Forearms'],
    isPriority: false,
    default1RM: 80,
    alternatives: ['barbell_bicep_curl', 'tricep_skullcrusher']
  },
  {
    id: 'tricep_skullcrusher',
    name: 'EZ-Bar Skullcrusher',
    equipment: 'Barbell / EZ Bar',
    category: 'Accessories',
    muscleGroup: 'Arms',
    specificMuscles: ['Triceps'],
    isPriority: false,
    default1RM: 95,
    alternatives: ['dumbbell_overhead_extension', 'barbell_bicep_curl']
  },
  {
    id: 'dumbbell_overhead_extension',
    name: 'Dumbbell Tricep Extension',
    equipment: 'Dumbbell',
    category: 'Accessories',
    muscleGroup: 'Arms',
    specificMuscles: ['Triceps'],
    isPriority: false,
    default1RM: 75,
    alternatives: ['tricep_skullcrusher', 'dumbbell_hammer_curl']
  },
  {
    id: 'warmup_12_step',
    name: '12-Step Mobility & Activation Warm-Up',
    equipment: 'Bodyweight / Band',
    category: 'Warm-Up Routine',
    muscleGroup: 'Core',
    specificMuscles: ['Abs / Core', 'Anterior Deltoid', 'Posterior Deltoid', 'Hamstrings'],
    isPriority: false,
    default1RM: 0,
    alternatives: []
  },
  {
    id: 'hollow_holds',
    name: 'Hollow Holds (45s)',
    equipment: 'Bodyweight',
    category: 'Abs',
    muscleGroup: 'Core',
    specificMuscles: ['Abs / Core'],
    isPriority: false,
    default1RM: 45,
    alternatives: ['hanging_leg_raises', 'weighted_plank']
  },
  {
    id: 'hanging_leg_raises',
    name: 'Hanging Leg Raises',
    equipment: 'Bodyweight',
    category: 'Abs',
    muscleGroup: 'Core',
    specificMuscles: ['Abs / Core'],
    isPriority: false,
    default1RM: 50,
    alternatives: ['hollow_holds', 'weighted_plank']
  },
  {
    id: 'weighted_plank',
    name: 'Weighted Plank (60s)',
    equipment: 'Plate / Bodyweight',
    category: 'Abs',
    muscleGroup: 'Core',
    specificMuscles: ['Abs / Core'],
    isPriority: false,
    default1RM: 60,
    alternatives: ['hollow_holds', 'hanging_leg_raises']
  }
];

const EXERCISE_MAP = Object.fromEntries(EXERCISE_LIBRARY.map(ex => [ex.id, ex]));

const roundTo5 = (val) => Math.max(5, Math.round(val / 5) * 5);

const generateSetsForScheme = (scheme, oneRepMax, category = 'Compound Lift', exerciseId = '') => {
  const base1RM = oneRepMax || (EXERCISE_MAP[exerciseId]?.default1RM ?? 135);
  const ts = Date.now() + Math.floor(Math.random() * 1000);

  if (category === 'Warm-Up Routine' || exerciseId === 'warmup_12_step') {
    return WARMUP_MOVEMENTS.map((stepName, idx) => ({
      id: `set_${ts}_wu_${idx}`,
      setNumber: idx + 1,
      type: stepName,
      reps: null,
      weight: 0,
      completed: false,
      completedAt: null,
      restLoggedSeconds: null,
      interLiftSeconds: null
    }));
  }

  if (category === 'Abs' || exerciseId === 'hollow_holds') {
    return [
      {
        id: `set_${ts}_abs1`,
        setNumber: 1,
        type: 'Timed Hold',
        reps: 45,
        weight: 0,
        completed: false,
        completedAt: null,
        restLoggedSeconds: null,
        interLiftSeconds: null
      },
      {
        id: `set_${ts}_abs2`,
        setNumber: 2,
        type: 'Timed Hold',
        reps: 45,
        weight: 0,
        completed: false,
        completedAt: null,
        restLoggedSeconds: null,
        interLiftSeconds: null
      }
    ];
  }

  switch (scheme) {
    case '5x5': {
      const wu1 = roundTo5(base1RM * 0.55);
      const wu2 = roundTo5(base1RM * 0.70);
      const working = roundTo5(base1RM * 0.82);
      const cfg5x5 = [
        { reps: 5, weight: wu1, label: 'Warmup 1' },
        { reps: 5, weight: wu2, label: 'Warmup 2' },
        { reps: 5, weight: working, label: 'Working 1' },
        { reps: 5, weight: working, label: 'Working 2' },
        { reps: 5, weight: working, label: 'Working 3' }
      ];
      return cfg5x5.map((cfg, idx) => ({
        id: `set_${ts}_${idx}`,
        setNumber: idx + 1,
        type: cfg.label,
        reps: cfg.reps,
        weight: cfg.weight,
        completed: false,
        completedAt: null,
        restLoggedSeconds: null,
        interLiftSeconds: null
      }));
    }
    case '3x5': {
      const working = roundTo5(base1RM * 0.85);
      return Array.from({ length: 3 }, (_, idx) => ({
        id: `set_${ts}_${idx}`,
        setNumber: idx + 1,
        type: `Working ${idx + 1}`,
        reps: 5,
        weight: working,
        completed: false,
        completedAt: null,
        restLoggedSeconds: null,
        interLiftSeconds: null
      }));
    }
    case 'Pyramid': {
      const pyramidConfig = [
        { reps: 8, pct: 0.70, label: 'Pyramid 8x' },
        { reps: 5, pct: 0.80, label: 'Pyramid 5x' },
        { reps: 3, pct: 0.88, label: 'Pyramid 3x' },
        { reps: 2, pct: 0.92, label: 'Pyramid 2x' },
        { reps: 1, pct: 0.96, label: 'Peak 1x' }
      ];
      return pyramidConfig.map((cfg, idx) => ({
        id: `set_${ts}_${idx}`,
        setNumber: idx + 1,
        type: cfg.label,
        reps: cfg.reps,
        weight: roundTo5(base1RM * cfg.pct),
        completed: false,
        completedAt: null,
        restLoggedSeconds: null,
        interLiftSeconds: null
      }));
    }
    case 'Reverse Pyramid': {
      const warmupWeight = roundTo5(base1RM * 0.50);
      const topSetWeight = roundTo5(base1RM * 0.85);
      const set3Weight = roundTo5(topSetWeight * 0.90);
      const set4Weight = roundTo5(set3Weight * 0.90);
      const set5Weight = roundTo5(set4Weight * 0.90);
      const rptConfig = [
        { reps: 8, weight: warmupWeight, label: 'Light Warmup' },
        { reps: 4, weight: topSetWeight, label: 'Top Set' },
        { reps: 6, weight: set3Weight, label: 'Drop -10%' },
        { reps: 8, weight: set4Weight, label: 'Drop -10%' },
        { reps: 10, weight: set5Weight, label: 'Drop -10%' }
      ];
      return rptConfig.map((cfg, idx) => ({
        id: `set_${ts}_${idx}`,
        setNumber: idx + 1,
        type: cfg.label,
        reps: cfg.reps,
        weight: cfg.weight,
        completed: false,
        completedAt: null,
        restLoggedSeconds: null,
        interLiftSeconds: null
      }));
    }
    case '5x8':
    default: {
      const wu1 = roundTo5(base1RM * 0.50);
      const wu2 = roundTo5(base1RM * 0.65);
      const working = roundTo5(base1RM * 0.75);
      const defaultConfig = [
        { reps: 8, weight: wu1, label: 'Warmup 1' },
        { reps: 8, weight: wu2, label: 'Warmup 2' },
        { reps: 8, weight: working, label: 'Working 1' },
        { reps: 8, weight: working, label: 'Working 2' },
        { reps: 8, weight: working, label: 'Working 3' }
      ];
      return defaultConfig.map((cfg, idx) => ({
        id: `set_${ts}_${idx}`,
        setNumber: idx + 1,
        type: cfg.label,
        reps: cfg.reps,
        weight: cfg.weight,
        completed: false,
        completedAt: null,
        restLoggedSeconds: null,
        interLiftSeconds: null
      }));
    }
  }
};

const createWorkoutSlot = ({
  category,
  slotLabel,
  exerciseId,
  secondaryExerciseId = null,
  scheme = '5x8',
  oneRepMaxes = {},
  restSeconds = 90
}) => {
  const ex1 = EXERCISE_MAP[exerciseId] || EXERCISE_LIBRARY[0];
  const ex2 = secondaryExerciseId ? EXERCISE_MAP[secondaryExerciseId] : null;
  const uid = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const sets1 = generateSetsForScheme(
    scheme,
    oneRepMaxes[ex1.id] ?? ex1.default1RM,
    category,
    ex1.id
  );
  const sets2 = ex2
    ? generateSetsForScheme(
        scheme,
        oneRepMaxes[ex2.id] ?? ex2.default1RM,
        category,
        ex2.id
      )
    : [];

  return {
    id: uid,
    category,
    slotLabel,
    scheme,
    restSeconds,
    exerciseId: ex1.id,
    secondaryExerciseId: ex2 ? ex2.id : null,
    sets: sets1,
    secondarySets: sets2
  };
};

const normalizeSlotLabels = (slots) => {
  let compoundCount = 0;
  let supersetCount = 0;
  return (slots || []).map(slot => {
    const isCompound = slot.category === 'Compound Lift' || slot.category === 'Compound Lifts';
    if (isCompound) {
      compoundCount += 1;
      return {
        ...slot,
        category: 'Compound Lift',
        slotLabel: `Compound Lift ${compoundCount}`
      };
    }
    if (slot.category === 'Supersets') {
      supersetCount += 1;
      return {
        ...slot,
        slotLabel: `Superset ${supersetCount}`
      };
    }
    return slot;
  });
};

const buildPresetSlots = (presetKey, oneRepMaxes) => {
  switch (presetKey) {
    case 'mon_tue':
    case 'fri_sat':
      return normalizeSlotLabels([
        createWorkoutSlot({
          category: 'Warm-Up Routine',
          slotLabel: 'Warm-Up Routine',
          exerciseId: 'warmup_12_step',
          scheme: '5x8',
          oneRepMaxes
        }),
        createWorkoutSlot({
          category: 'Compound Lift',
          slotLabel: 'Compound Lift 1',
          exerciseId: 'dumbbell_press',
          scheme: '5x8',
          oneRepMaxes
        }),
        createWorkoutSlot({
          category: 'Compound Lift',
          slotLabel: 'Compound Lift 2',
          exerciseId: 'meadows_row',
          scheme: '5x8',
          oneRepMaxes
        }),
        createWorkoutSlot({
          category: 'Compound Lift',
          slotLabel: 'Compound Lift 3',
          exerciseId: 'front_squat',
          scheme: '5x8',
          oneRepMaxes
        }),
        createWorkoutSlot({
          category: 'Supersets',
          slotLabel: 'Superset 1',
          exerciseId: 'reverse_lunge',
          secondaryExerciseId: 'front_flies',
          scheme: '5x8',
          oneRepMaxes
        }),
        createWorkoutSlot({
          category: 'Abs',
          slotLabel: 'Abs',
          exerciseId: 'hollow_holds',
          scheme: '5x8',
          oneRepMaxes
        })
      ]);
    case 'wed_thu':
      return normalizeSlotLabels([
        createWorkoutSlot({
          category: 'Warm-Up Routine',
          slotLabel: 'Warm-Up Routine',
          exerciseId: 'warmup_12_step',
          scheme: '5x8',
          oneRepMaxes
        }),
        createWorkoutSlot({
          category: 'Compound Lift',
          slotLabel: 'Compound Lift 1',
          exerciseId: 'incline_bench_press',
          scheme: '5x8',
          oneRepMaxes
        }),
        createWorkoutSlot({
          category: 'Compound Lift',
          slotLabel: 'Compound Lift 2',
          exerciseId: 'landmine_rdl',
          scheme: '5x8',
          oneRepMaxes
        }),
        createWorkoutSlot({
          category: 'Compound Lift',
          slotLabel: 'Compound Lift 3',
          exerciseId: 'split_squat',
          scheme: '5x8',
          oneRepMaxes
        }),
        createWorkoutSlot({
          category: 'Supersets',
          slotLabel: 'Superset 1',
          exerciseId: 'pistol_squats',
          secondaryExerciseId: 'reverse_flies',
          scheme: '5x8',
          oneRepMaxes
        }),
        createWorkoutSlot({
          category: 'Abs',
          slotLabel: 'Abs',
          exerciseId: 'hollow_holds',
          scheme: '5x8',
          oneRepMaxes
        })
      ]);
    case 'arms_pump':
      return normalizeSlotLabels([
        createWorkoutSlot({
          category: 'Warm-Up Routine',
          slotLabel: 'Warm-Up Routine',
          exerciseId: 'warmup_12_step',
          scheme: '5x8',
          oneRepMaxes
        }),
        createWorkoutSlot({
          category: 'Compound Lift',
          slotLabel: 'Compound Lift 1',
          exerciseId: 'meadows_row',
          scheme: '5x8',
          oneRepMaxes
        }),
        createWorkoutSlot({
          category: 'Compound Lift',
          slotLabel: 'Compound Lift 2',
          exerciseId: 'incline_bench_press',
          scheme: '5x8',
          oneRepMaxes
        }),
        createWorkoutSlot({
          category: 'Supersets',
          slotLabel: 'Superset 1',
          exerciseId: 'reverse_flies',
          secondaryExerciseId: 'band_pulldown',
          scheme: '5x8',
          oneRepMaxes
        }),
        createWorkoutSlot({
          category: 'Supersets',
          slotLabel: 'Superset 2',
          exerciseId: 'front_raise_ez_bar',
          secondaryExerciseId: 'side_raise_dumbbell',
          scheme: '5x8',
          oneRepMaxes
        })
      ]);
    case 'legs_pump':
    default:
      return [];
  }
};

const STORAGE_KEYS = {
  USER: 'ironpulse_user_v1',
  MAXES: 'ironpulse_1rm_v1',
  HISTORY: 'ironpulse_history_v1',
  ACTIVE_SESSION: 'ironpulse_active_session_v1',
  CUSTOM_PRESETS: 'ironpulse_custom_presets_v1'
};

const BUILTIN_PRESETS = [
  { key: 'mon_tue', label: 'LS Mon/Tue Oct/Nov' },
  { key: 'wed_thu', label: 'LS Wed/Thu Oct/Nov' },
  { key: 'fri_sat', label: 'LS Fri/Sat Oct/Nov' },
  { key: 'arms_pump', label: 'LS Arms Pump Oct/Nov' },
  { key: 'legs_pump', label: 'LS Legs Pump Oct/Nov' }
];

const getInitial1RMs = () => {
  const map = {};
  EXERCISE_LIBRARY.forEach(ex => {
    if (ex.default1RM > 0) map[ex.id] = ex.default1RM;
  });
  return map;
};

const getInitialSeedHistory = (oneRepMaxes) => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();

  const slotsYesterday = normalizeSlotLabels([
    createWorkoutSlot({
      category: 'Warm-Up Routine',
      slotLabel: 'Warm-Up Routine',
      exerciseId: 'warmup_12_step',
      oneRepMaxes
    }),
    createWorkoutSlot({
      category: 'Compound Lift',
      slotLabel: 'Compound Lift 1',
      exerciseId: 'barbell_bench_press',
      scheme: 'Pyramid',
      oneRepMaxes
    }),
    createWorkoutSlot({
      category: 'Compound Lift',
      slotLabel: 'Compound Lift 2',
      exerciseId: 'incline_bench_press',
      scheme: '5x8',
      oneRepMaxes
    }),
    createWorkoutSlot({
      category: 'Abs',
      slotLabel: 'Abs',
      exerciseId: 'hollow_holds',
      oneRepMaxes
    })
  ]).map(slot => ({
    ...slot,
    sets: slot.sets.map(s => ({
      ...s,
      completed: true,
      completedAt: yesterday,
      restLoggedSeconds: 92,
      interLiftSeconds: 130
    }))
  }));

  const slotsFourDaysAgo = buildPresetSlots('wed_thu', oneRepMaxes).map((slot, sIdx) => ({
    ...slot,
    sets: slot.sets.map((s, idx) => {
      const isLeftIncomplete = sIdx === 2 && idx >= 3;
      return {
        ...s,
        completed: !isLeftIncomplete,
        completedAt: !isLeftIncomplete ? fourDaysAgo : null,
        restLoggedSeconds: !isLeftIncomplete ? 95 : null,
        interLiftSeconds: !isLeftIncomplete ? 140 : null
      };
    }),
    secondarySets: (slot.secondarySets || []).map(s => ({
      ...s,
      completed: true,
      completedAt: fourDaysAgo,
      restLoggedSeconds: 88,
      interLiftSeconds: 115
    }))
  }));

  return [
    {
      id: 'hist_yesterday_push',
      title: 'Upper Push & Barbell Bench Session',
      presetUsed: 'Custom Push',
      startedAt: yesterday,
      updatedAt: yesterday,
      defaultRestSeconds: 90,
      isComplete: true,
      verifiedByUser: true,
      slots: slotsYesterday
    },
    {
      id: 'hist_4days_wed_thu',
      title: 'LS Wed/Thu Oct/Nov',
      presetUsed: 'wed_thu',
      startedAt: fourDaysAgo,
      updatedAt: fourDaysAgo,
      defaultRestSeconds: 90,
      isComplete: false,
      verifiedByUser: false,
      slots: slotsFourDaysAgo
    }
  ];
};

const checkIsWorkoutComplete = (slots) => {
  if (!slots || slots.length === 0) return false;
  for (const slot of slots) {
    if (!slot.sets || slot.sets.length === 0) return false;
    if (slot.sets.some(s => !s.completed)) return false;
    if (slot.secondaryExerciseId && slot.secondarySets?.some(s => !s.completed)) {
      return false;
    }
  }
  return true;
};

const calculateUpdated1RMsFromWorkouts = (workouts, currentMaxes) => {
  const updated = { ...currentMaxes };
  let changesCount = 0;

  workouts.forEach(workout => {
    if (!workout.isComplete && !workout.verifiedByUser) return;
    (workout.slots || []).forEach(slot => {
      if (slot.category === 'Warm-Up Routine' || slot.category === 'Abs') return;
      const processSetList = (exId, sets) => {
        if (!exId || !sets) return;
        sets.forEach(s => {
          if (s.completed && s.weight > 0 && s.reps > 0) {
            const estimated = Math.round(s.weight * (1 + s.reps / 30));
            const current = updated[exId] || 0;
            if (estimated > current) {
              updated[exId] = roundTo5(estimated);
              changesCount++;
            }
          }
        });
      };
      processSetList(slot.exerciseId, slot.sets);
      if (slot.secondaryExerciseId) {
        processSetList(slot.secondaryExerciseId, slot.secondarySets);
      }
    });
  });

  return { updatedMaxes: updated, changesCount };
};

const playTimerDing = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1318.5, now + 0.12);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1760, now);

    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

    gain2.gain.setValueAtTime(0.18, now);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(ctx.destination);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.45);
    osc2.stop(now + 0.85);
  } catch {
    // Ignore audio context autoplay errors
  }
};

const formatTimerSeconds = (sec) => {
  const isNeg = sec < 0;
  const abs = Math.abs(sec);
  const mins = Math.floor(abs / 60);
  const rem = abs % 60;
  const formatted = `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  return isNeg ? `-${formatted}` : formatted;
};

// ============================================================================
// 3. NATIVE iOS 17/18 UIKIT / SWIFTUI PRIMITIVES (INSET GROUPED LIST, SHEETS)
// ============================================================================

/**
 * Native SwiftUI `Section` inside `List(.insetGrouped)`
 * Standard 16pt horizontal margin, 10pt corner radius, and hairline separators.
 */
const IOSListSection = ({ header, footer, children, colors }) => (
  <section style={{ marginBottom: '24px', paddingLeft: '16px', paddingRight: '16px' }}>
    {header && (
      <div
        style={{
          ...IOS_TEXT.footnote,
          color: colors.secondaryLabel,
          textTransform: 'uppercase',
          paddingLeft: '16px',
          paddingRight: '16px',
          paddingBottom: '6px'
        }}
      >
        {header}
      </div>
    )}
    <div
      style={{
        backgroundColor: colors.secondarySystemGroupedBackground,
        borderRadius: '10px',
        overflow: 'hidden'
      }}
    >
      {children}
    </div>
    {footer && (
      <div
        style={{
          ...IOS_TEXT.footnote,
          color: colors.secondaryLabel,
          paddingLeft: '16px',
          paddingRight: '16px',
          paddingTop: '6px'
        }}
      >
        {footer}
      </div>
    )}
  </section>
);

/**
 * Native SwiftUI `ListRow` with minimum 44pt tap target & inset hairline separator
 */
const IOSListRow = ({
  children,
  onClick,
  isLast = false,
  colors,
  minHeight = '44px',
  padding = '11px 16px'
}) => (
  <div
    onClick={onClick}
    style={{
      position: 'relative',
      minHeight,
      padding,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      cursor: onClick ? 'pointer' : 'default',
      WebkitTapHighlightColor: 'transparent'
    }}
  >
    {children}
    {!isLast && (
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '16px',
          right: 0,
          height: '0.5px',
          backgroundColor: colors.separator
        }}
      />
    )}
  </div>
);

/**
 * Native iOS `UISegmentedControl`
 */
const IOSSegmentedControl = ({ options, value, onChange, colors }) => (
  <div
    style={{
      backgroundColor: colors.tertiarySystemFill,
      borderRadius: '8.9px',
      padding: '2px',
      display: 'grid',
      gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      gap: '2px'
    }}
  >
    {options.map(opt => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            ...IOS_TEXT.footnote,
            fontWeight: active ? 600 : 500,
            color: colors.label,
            backgroundColor: active ? colors.tertiarySystemBackground : 'transparent',
            border: 'none',
            borderRadius: '6.9px',
            padding: '6px 8px',
            cursor: 'pointer',
            boxShadow: active ? '0 1px 3px rgba(0,0,0,0.18)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

/**
 * Native iOS `Sheet` Modal Presentation (with top Grabber Pill & NavigationBar)
 */
const IOSSheet = ({ isOpen, onClose, title, leftLabel = 'Cancel', rightLabel, onRightAction, colors, children }) => {
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          maxHeight: '88vh',
          backgroundColor: colors.systemGroupedBackground,
          borderTopLeftRadius: '14px',
          borderTopRightRadius: '14px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.35)'
        }}
      >
        {/* Standard iOS Sheet Grabber (36pt x 5pt) */}
        <div style={{ paddingTop: '6px', paddingBottom: '4px', display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: '36px',
              height: '5px',
              borderRadius: '2.5px',
              backgroundColor: colors.systemFill
            }}
          />
        </div>

        {/* Sheet Navigation Bar */}
        <div
          style={{
            minHeight: '44px',
            padding: '4px 16px 10px',
            display: 'grid',
            gridTemplateColumns: '80px 1fr 80px',
            alignItems: 'center',
            borderBottom: `0.5px solid ${colors.separator}`
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              ...IOS_TEXT.body,
              color: colors.systemBlue,
              background: 'none',
              border: 'none',
              textAlign: 'left',
              padding: 0,
              cursor: 'pointer'
            }}
          >
            {leftLabel}
          </button>

          <div
            style={{
              ...IOS_TEXT.headline,
              color: colors.label,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {title}
          </div>

          <div style={{ textAlign: 'right' }}>
            {rightLabel && (
              <button
                type="button"
                onClick={onRightAction}
                style={{
                  ...IOS_TEXT.headline,
                  color: colors.systemBlue,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer'
                }}
              >
                {rightLabel}
              </button>
            )}
          </div>
        </div>

        {/* Sheet Scrollable Content */}
        <div style={{ overflowY: 'auto', paddingTop: '16px', paddingBottom: '28px' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. MAIN NATIVE iOS 17/18 APPLICATION
// ============================================================================

export default function App() {
  // --- Dynamic Appearance (Dark Mode by Default, Supports Light Mode Automatic/Toggle) ---
  const [isDarkMode, setIsDarkMode] = useState(true);
  const colors = useMemo(() => getSystemColors(isDarkMode), [isDarkMode]);

  // --- Responsive Real-Device Detection (Removes Simulated Bezel on Real Phones) ---
  const [isRealMobileViewport, setIsRealMobileViewport] = useState(false);
  useEffect(() => {
    const checkViewport = () => {
      setIsRealMobileViewport(window.innerWidth <= 480);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // --- Auth State ---
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      if (saved) return JSON.parse(saved);
      return supabaseCloud.isConfigured ? null : { email: 'athlete@ironpulse.app', id: 'usr_demo_01' };
    } catch {
      return supabaseCloud.isConfigured ? null : { email: 'athlete@ironpulse.app', id: 'usr_demo_01' };
    }
  });
  const [authMode, setAuthMode] = useState('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // --- 1RM State ---
  const [oneRepMaxes, setOneRepMaxes] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MAXES);
      return saved ? JSON.parse(saved) : getInitial1RMs();
    } catch {
      return getInitial1RMs();
    }
  });

  // --- Workout History State ---
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (saved) return JSON.parse(saved);
      return getInitialSeedHistory(getInitial1RMs());
    } catch {
      return getInitialSeedHistory(getInitial1RMs());
    }
  });

  // --- Active Live Session State ---
  const [activeSession, setActiveSession] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // --- Historical Workout Entry Draft ---
  const [historicalDraft, setHistoricalDraft] = useState(null);

  // --- NavigationStack View ('home' | 'session' | 'history' | 'historical_entry' | 'auth') ---
  const [currentView, setCurrentView] = useState('home');

  // --- iOS Notification Banner ---
  const [bannerMessage, setBannerMessage] = useState(null);
  const triggerBanner = (msg, type = 'info') => {
    setBannerMessage({ msg, type });
    setTimeout(() => {
      setBannerMessage(prev => (prev?.msg === msg ? null : prev));
    }, 4000);
  };

  // --- Multi-Slot Selection for "Suggest Alternative" ---
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);

  // --- Collapsible Slots State ---
  const [collapsedSlotIds, setCollapsedSlotIds] = useState([]);
  const toggleCollapseSlot = (slotId) => {
    setCollapsedSlotIds(prev =>
      prev.includes(slotId) ? prev.filter(id => id !== slotId) : [...prev, slotId]
    );
  };

  // --- Custom User Workouts State ---
  const [customPresets, setCustomPresets] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_PRESETS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState(() =>
    new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  );

  // --- Add Slot Sheet State ---
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [newSlotCategory, setNewSlotCategory] = useState('Compound Lift');
  const [newSlotEx1, setNewSlotEx1] = useState('barbell_bench_press');
  const [newSlotEx2, setNewSlotEx2] = useState('reverse_flies');
  const [newSlotScheme, setNewSlotScheme] = useState('5x8');

  // --- Plate & Weight Calculator Sheet State ---
  const [plateCalcTarget, setPlateCalcTarget] = useState(null);
  const [calcUnit, setCalcUnit] = useState('lb');
  const [calcMode, setCalcMode] = useState('per_side');
  const [calcBarWeight, setCalcBarWeight] = useState(45);
  const [calcPlatesPerSide, setCalcPlatesPerSide] = useState([]);
  const [calcDirectTotal, setCalcDirectTotal] = useState(135);

  // --- Native iOS ConfirmationDialog (Action Sheet) for Reset / Cancel ---
  const [confirmAction, setConfirmAction] = useState(null);

  // --- Rest Timer & Telemetry State ---
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [timerState, setTimerState] = useState({
    isRunning: false,
    targetSeconds: 90,
    remainingSeconds: 90,
    startedAtMs: null,
    dingPlayed: false,
    activeLabel: null
  });
  const lastCompletedSetTimestampRef = useRef(null);

  // --- History Page Filters ---
  const [historyFilterLift, setHistoryFilterLift] = useState('ALL');
  const [historyFilterMuscleGroup, setHistoryFilterMuscleGroup] = useState('ALL');
  const [historyFilterSpecificMuscle, setHistoryFilterSpecificMuscle] = useState('ALL');
  const [expandedHistoryId, setExpandedHistoryId] = useState('hist_4days_wed_thu');

  // --- 1RM Calculator Sheet State ---
  const [maxCalcTarget, setMaxCalcTarget] = useState(null);
  const [maxCalcMode, setMaxCalcMode] = useState('scheme');
  const [maxCalcScheme, setMaxCalcScheme] = useState('5x8');
  const [maxCalcSets, setMaxCalcSets] = useState([]);
  const [maxCalcDirectValue, setMaxCalcDirectValue] = useState('225');
  const [showAllMaxes, setShowAllMaxes] = useState(false);

  const openMaxCalculatorModal = (ex, currentMax) => {
    setMaxCalcTarget({
      id: ex.id,
      name: ex.name,
      equipment: ex.equipment,
      currentMax
    });
    setMaxCalcMode('scheme');
    setMaxCalcScheme('5x8');
    setMaxCalcSets(generateSetsForScheme('5x8', currentMax, ex.category, ex.id));
    setMaxCalcDirectValue(String(currentMax));
  };

  const handleMaxCalcSchemeChange = (scm) => {
    setMaxCalcScheme(scm);
    const baseMax = maxCalcTarget?.currentMax || 185;
    setMaxCalcSets(
      generateSetsForScheme(scm, baseMax, maxCalcTarget?.category || 'Compound Lift', maxCalcTarget?.id || '')
    );
  };

  const handleUpdateMaxCalcSet = (setId, field, rawVal) => {
    const val = Math.max(0, Number(rawVal) || 0);
    setMaxCalcSets(prev =>
      prev.map(st => (st.id === setId ? { ...st, [field]: val } : st))
    );
  };

  const computedModal1RM = useMemo(() => {
    if (maxCalcMode === 'direct') {
      return Math.max(5, roundTo5(Number(maxCalcDirectValue) || 0));
    }
    if (!maxCalcSets || maxCalcSets.length === 0) return maxCalcTarget?.currentMax || 135;

    let highest1RM = 0;
    maxCalcSets.forEach(s => {
      const w = Number(s.weight) || 0;
      const r = Number(s.reps) || 0;
      if (w > 0 && r > 0) {
        const est = r === 1 ? w : w * (1 + r / 30);
        if (est > highest1RM) highest1RM = est;
      }
    });
    return highest1RM > 0 ? roundTo5(highest1RM) : maxCalcTarget?.currentMax || 135;
  }, [maxCalcMode, maxCalcDirectValue, maxCalcSets, maxCalcTarget]);

  // --- Persistence Effects & Cloud Hydration ---
  useEffect(() => {
    try {
      if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEYS.USER);
    } catch {}
  }, [user]);

  // Hydrate 1RMs, Workout History & Custom Workouts from Supabase when signed in
  useEffect(() => {
    if (!user?.id || !user?.accessToken || !supabaseCloud.isConfigured) return;
    let isMounted = true;
    supabaseCloud
      .fetchUserData(user.id, user.accessToken)
      .then(cloud => {
        if (!isMounted) return;
        if (cloud.oneRepMaxes && Object.keys(cloud.oneRepMaxes).length > 0) {
          setOneRepMaxes(prev => ({ ...prev, ...cloud.oneRepMaxes }));
        }
        if (cloud.history && cloud.history.length > 0) {
          setHistory(cloud.history);
        }
        if (cloud.customPresets && cloud.customPresets.length > 0) {
          setCustomPresets(cloud.customPresets);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.accessToken]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MAXES, JSON.stringify(oneRepMaxes));
      if (user?.accessToken && supabaseCloud.isConfigured) {
        supabaseCloud.upsertProfile(user, oneRepMaxes);
      }
    } catch {}
  }, [oneRepMaxes, user]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch {}
  }, [history]);

  useEffect(() => {
    try {
      if (activeSession) localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(activeSession));
      else localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    } catch {}
  }, [activeSession]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_PRESETS, JSON.stringify(customPresets));
    } catch {}
  }, [customPresets]);

  // --- Timer Countdown & Negative Overtime Engine ---
  useEffect(() => {
    if (!timerState.isRunning || !timerState.startedAtMs) return;
    const interval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - timerState.startedAtMs) / 1000);
      const nextRemaining = timerState.targetSeconds - elapsedSec;

      setTimerState(prev => {
        const shouldDing = nextRemaining <= 0 && !prev.dingPlayed;
        if (shouldDing && soundEnabled) playTimerDing();
        return {
          ...prev,
          remainingSeconds: nextRemaining,
          dingPlayed: prev.dingPlayed || nextRemaining <= 0
        };
      });
    }, 250);

    return () => clearInterval(interval);
  }, [timerState.isRunning, timerState.startedAtMs, timerState.targetSeconds, soundEnabled]);

  const startRestTimer = (targetSeconds = 90, label = 'Rest Period') => {
    setTimerState({
      isRunning: true,
      targetSeconds,
      remainingSeconds: targetSeconds,
      startedAtMs: Date.now(),
      dingPlayed: false,
      activeLabel: label
    });
  };

  const stopRestTimer = () => {
    setTimerState(prev => ({
      ...prev,
      isRunning: false,
      startedAtMs: null
    }));
  };

  // --- Computed History & Filter Lists ---
  const incompleteWorkoutsCount = useMemo(
    () => history.filter(w => !w.isComplete && !w.verifiedByUser).length,
    [history]
  );

  const allMuscleGroups = useMemo(() => {
    const groups = new Set(['ALL']);
    EXERCISE_LIBRARY.forEach(ex => {
      if (ex.muscleGroup) groups.add(ex.muscleGroup);
    });
    return Array.from(groups);
  }, []);

  const allSpecificMuscles = useMemo(() => {
    const muscles = new Set(['ALL']);
    EXERCISE_LIBRARY.forEach(ex => {
      (ex.specificMuscles || []).forEach(m => muscles.add(m));
    });
    return Array.from(muscles);
  }, []);

  const filteredHistory = useMemo(() => {
    return [...history]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .filter(workout => {
        const slots = workout.slots || [];
        if (
          historyFilterLift === 'ALL' &&
          historyFilterMuscleGroup === 'ALL' &&
          historyFilterSpecificMuscle === 'ALL'
        ) {
          return true;
        }
        return slots.some(slot => {
          const exIds = [slot.exerciseId, slot.secondaryExerciseId].filter(Boolean);
          return exIds.some(id => {
            const ex = EXERCISE_MAP[id];
            if (!ex) return false;
            if (historyFilterLift !== 'ALL' && ex.id !== historyFilterLift) return false;
            if (historyFilterMuscleGroup !== 'ALL' && ex.muscleGroup !== historyFilterMuscleGroup) {
              return false;
            }
            if (
              historyFilterSpecificMuscle !== 'ALL' &&
              !(ex.specificMuscles || []).includes(historyFilterSpecificMuscle)
            ) {
              return false;
            }
            return true;
          });
        });
      });
  }, [history, historyFilterLift, historyFilterMuscleGroup, historyFilterSpecificMuscle]);

  // --- Session & History Actions ---
  const syncSessionToHistory = (sessionToSync) => {
    if (!user) return;
    if (!sessionToSync || !sessionToSync.slots || sessionToSync.slots.length === 0) return;
    const isComp = checkIsWorkoutComplete(sessionToSync.slots);
    const updatedSession = {
      ...sessionToSync,
      updatedAt: new Date().toISOString(),
      isComplete: isComp
    };

    supabaseCloud.upsertWorkoutHistory(user, updatedSession);

    setHistory(prev => {
      const exists = prev.some(w => w.id === updatedSession.id);
      const nextHistory = exists
        ? prev.map(w => (w.id === updatedSession.id ? updatedSession : w))
        : [updatedSession, ...prev];

      if (isComp) {
        const { updatedMaxes } = calculateUpdated1RMsFromWorkouts(nextHistory, oneRepMaxes);
        setOneRepMaxes(updatedMaxes);
      }
      return nextHistory;
    });
  };

  const handleOpenNewSession = () => {
    if (!activeSession) {
      setActiveSession({
        id: `session_${Date.now()}`,
        title: `Workout — ${new Date().toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric'
        })}`,
        presetUsed: null,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        defaultRestSeconds: 90,
        isComplete: false,
        verifiedByUser: false,
        suggestionReason: null,
        slots: []
      });
    }
    setCurrentView('session');
  };

  const handleBackToHomeFromSession = () => {
    if (activeSession && activeSession.slots.length > 0) {
      if (user) {
        syncSessionToHistory(activeSession);
        triggerBanner('Session auto-saved to History.', 'success');
      } else {
        triggerBanner('Session saved locally. Sign in to store in History.', 'info');
      }
    }
    setCurrentView('home');
  };

  const handleOpenHistoricalEntry = () => {
    if (!user) {
      triggerBanner('Sign in to store historical workouts.', 'warning');
      setCurrentView('auth');
      return;
    }
    const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    setHistoricalDraft({
      id: `hist_manual_${Date.now()}`,
      title: 'Past Workout Log',
      workoutDate: yesterdayDate,
      presetUsed: null,
      defaultRestSeconds: 90,
      isComplete: true,
      verifiedByUser: true,
      slots: []
    });
    setCurrentView('historical_entry');
  };

  const handleSaveHistoricalDraft = () => {
    if (!historicalDraft || historicalDraft.slots.length === 0) {
      triggerBanner('Add at least one exercise before saving.', 'warning');
      return;
    }
    const isoDate = new Date(`${historicalDraft.workoutDate}T12:00:00`).toISOString();
    const completedSlots = normalizeSlotLabels(historicalDraft.slots);
    const finalizedWorkout = {
      ...historicalDraft,
      startedAt: isoDate,
      updatedAt: new Date().toISOString(),
      isComplete: checkIsWorkoutComplete(completedSlots),
      verifiedByUser: checkIsWorkoutComplete(completedSlots),
      slots: completedSlots
    };

    supabaseCloud.upsertWorkoutHistory(user, finalizedWorkout);

    setHistory(prev => {
      const next = [finalizedWorkout, ...prev];
      const { updatedMaxes } = calculateUpdated1RMsFromWorkouts(next, oneRepMaxes);
      setOneRepMaxes(updatedMaxes);
      return next;
    });

    setHistoricalDraft(null);
    setCurrentView('history');
    triggerBanner('Historical workout saved.', 'success');
  };

  const updateCurrentWorkoutState = (updater) => {
    if (currentView === 'historical_entry') {
      setHistoricalDraft(prev => {
        const next = updater(prev);
        return next ? { ...next, slots: normalizeSlotLabels(next.slots) } : next;
      });
    } else {
      setActiveSession(prev => {
        const next = updater(prev);
        return next ? { ...next, slots: normalizeSlotLabels(next.slots) } : next;
      });
    }
  };

  const handleLoadPreset = (presetKey, label) => {
    if (!presetKey) return;
    const customMatch = customPresets.find(cp => cp.key === presetKey);
    const ts = Date.now();
    const slots = customMatch
      ? normalizeSlotLabels(
          (customMatch.slots || []).map((slot, sIdx) => {
            const ex1 = EXERCISE_MAP[slot.exerciseId] || EXERCISE_LIBRARY[0];
            const ex2 = slot.secondaryExerciseId ? EXERCISE_MAP[slot.secondaryExerciseId] : null;
            return {
              ...slot,
              id: `slot_${ts}_${sIdx}_${Math.random().toString(36).substring(2, 6)}`,
              sets: (slot.sets || []).map((st, idx) => ({
                ...st,
                id: `set_${ts}_${sIdx}_1_${idx}`,
                completed: currentView === 'historical_entry',
                completedAt: null,
                restLoggedSeconds: null,
                interLiftSeconds: null
              })),
              secondarySets: ex2
                ? (slot.secondarySets || []).map((st, idx) => ({
                    ...st,
                    id: `set_${ts}_${sIdx}_2_${idx}`,
                    completed: currentView === 'historical_entry',
                    completedAt: null,
                    restLoggedSeconds: null,
                    interLiftSeconds: null
                  }))
                : []
            };
          })
        )
      : buildPresetSlots(presetKey, oneRepMaxes);

    const resolvedLabel =
      label ||
      customMatch?.label ||
      BUILTIN_PRESETS.find(p => p.key === presetKey)?.label ||
      'Workout Session';

    updateCurrentWorkoutState(prev => ({
      ...(prev || {
        id: `session_${Date.now()}`,
        startedAt: new Date().toISOString(),
        verifiedByUser: false
      }),
      title: resolvedLabel,
      presetUsed: presetKey,
      defaultRestSeconds: 90,
      updatedAt: new Date().toISOString(),
      suggestionReason: null,
      slots
    }));
    setSelectedSlotIds([]);
    setCollapsedSlotIds([]);
    if (currentView === 'session') {
      setTimerState(prev => ({
        ...prev,
        targetSeconds: 90,
        remainingSeconds: prev.isRunning ? prev.remainingSeconds : 90
      }));
    }
    if (presetKey === 'legs_pump') {
      triggerBanner('Legs Pump is empty — tap Add Exercise below.', 'info');
    } else {
      triggerBanner(`Loaded ${resolvedLabel}.`, 'success');
    }
  };

  const handleOpenSavePresetModal = () => {
    const currentWorkout = currentView === 'historical_entry' ? historicalDraft : activeSession;
    if (!currentWorkout || !currentWorkout.slots || currentWorkout.slots.length === 0) {
      triggerBanner('Add at least one exercise before saving a workout.', 'warning');
      return;
    }
    const defaultDateName = new Date().toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    setNewPresetName(defaultDateName);
    setShowSavePresetModal(true);
  };

  const handleSaveNewPreset = () => {
    const currentWorkout = currentView === 'historical_entry' ? historicalDraft : activeSession;
    if (!currentWorkout || !currentWorkout.slots || currentWorkout.slots.length === 0) {
      triggerBanner('Add at least one exercise before saving a workout.', 'warning');
      return;
    }
    const defaultDateName = new Date().toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const finalName = (newPresetName || '').trim() || defaultDateName;
    const newKey = `custom_${Date.now()}`;
    const cleanSlots = normalizeSlotLabels(currentWorkout.slots).map(slot => ({
      ...slot,
      sets: (slot.sets || []).map(s => ({
        ...s,
        completed: false,
        completedAt: null,
        restLoggedSeconds: null,
        interLiftSeconds: null
      })),
      secondarySets: (slot.secondarySets || []).map(s => ({
        ...s,
        completed: false,
        completedAt: null,
        restLoggedSeconds: null,
        interLiftSeconds: null
      }))
    }));

    const newPresetObj = {
      key: newKey,
      label: finalName,
      createdAt: new Date().toISOString(),
      slots: cleanSlots
    };

    supabaseCloud.upsertCustomPreset(user, newPresetObj);

    setCustomPresets(prev => [newPresetObj, ...prev]);
    updateCurrentWorkoutState(prev => (prev ? { ...prev, presetUsed: newKey, title: finalName } : prev));
    setNewPresetName(defaultDateName);
    setShowSavePresetModal(false);
    triggerBanner(`Saved workout "${finalName}".`, 'success');
  };

  const handleSuggestWorkoutFromHistory = () => {
    const sorted = [...history].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    const lastWorkout = sorted[0];
    const recentGroups = new Set();

    if (lastWorkout) {
      (lastWorkout.slots || []).forEach(slot => {
        const ex1 = EXERCISE_MAP[slot.exerciseId];
        const ex2 = slot.secondaryExerciseId ? EXERCISE_MAP[slot.secondaryExerciseId] : null;
        if (ex1?.muscleGroup) recentGroups.add(ex1.muscleGroup);
        if (ex2?.muscleGroup) recentGroups.add(ex2.muscleGroup);
      });
    }

    let c1 = 'barbell_back_squat';
    let c2 = 'overhead_press';
    let c3 = 'chin_ups';
    let reason = 'Prioritizing Big 3 + OHP & Chin-Ups.';

    if (recentGroups.has('Chest')) {
      c1 = 'barbell_back_squat';
      c2 = 'barbell_deadlift';
      c3 = 'chin_ups';
      reason = `Last session hit Chest (${lastWorkout?.title}). Switching to Squat, Deadlift & Chin-Ups.`;
    } else if (recentGroups.has('Legs')) {
      c1 = 'barbell_bench_press';
      c2 = 'overhead_press';
      c3 = 'chin_ups';
      reason = `Last session hit Legs. Prioritizing Barbell Bench, Overhead Press & Chin-Ups.`;
    } else {
      c1 = 'barbell_bench_press';
      c2 = 'barbell_back_squat';
      c3 = 'barbell_deadlift';
      reason = 'Balanced Big 3 session (Bench, Squat, Deadlift).';
    }

    const suggestedSlots = normalizeSlotLabels([
      createWorkoutSlot({
        category: 'Warm-Up Routine',
        slotLabel: 'Warm-Up Routine',
        exerciseId: 'warmup_12_step',
        oneRepMaxes
      }),
      createWorkoutSlot({
        category: 'Compound Lift',
        slotLabel: 'Compound Lift 1',
        exerciseId: c1,
        scheme: '5x8',
        oneRepMaxes
      }),
      createWorkoutSlot({
        category: 'Compound Lift',
        slotLabel: 'Compound Lift 2',
        exerciseId: c2,
        scheme: '5x8',
        oneRepMaxes
      }),
      createWorkoutSlot({
        category: 'Compound Lift',
        slotLabel: 'Compound Lift 3',
        exerciseId: c3,
        scheme: '5x8',
        oneRepMaxes
      }),
      createWorkoutSlot({
        category: 'Supersets',
        slotLabel: 'Superset 1',
        exerciseId: 'reverse_flies',
        secondaryExerciseId: 'barbell_bicep_curl',
        scheme: '5x8',
        oneRepMaxes
      }),
      createWorkoutSlot({
        category: 'Abs',
        slotLabel: 'Abs',
        exerciseId: 'hollow_holds',
        oneRepMaxes
      })
    ]);

    setActiveSession(prev => ({
      ...(prev || { id: `session_${Date.now()}`, startedAt: new Date().toISOString() }),
      title: 'Suggested Priority Session',
      presetUsed: 'suggested',
      defaultRestSeconds: 90,
      updatedAt: new Date().toISOString(),
      suggestionReason: reason,
      slots: suggestedSlots
    }));
    setSelectedSlotIds([]);
    triggerBanner('Suggested workout generated from history.', 'success');
  };

  const toggleSelectSlot = (slotId) => {
    setSelectedSlotIds(prev =>
      prev.includes(slotId) ? prev.filter(id => id !== slotId) : [...prev, slotId]
    );
  };

  const handleSuggestAlternativesForSelected = () => {
    if (!activeSession || selectedSlotIds.length === 0) return;

    setActiveSession(prev => {
      const nextSlots = prev.slots.map(slot => {
        if (!selectedSlotIds.includes(slot.id)) return slot;
        const currentEx = EXERCISE_MAP[slot.exerciseId];
        if (!currentEx) return slot;

        const altPool =
          currentEx.alternatives && currentEx.alternatives.length > 0
            ? currentEx.alternatives
            : EXERCISE_LIBRARY.filter(
                e => e.muscleGroup === currentEx.muscleGroup && e.id !== currentEx.id
              ).map(e => e.id);

        const nextExId =
          altPool.length > 0
            ? altPool[Math.floor(Math.random() * altPool.length)]
            : currentEx.id;

        const nextEx = EXERCISE_MAP[nextExId] || currentEx;
        const newSets = generateSetsForScheme(
          slot.scheme,
          oneRepMaxes[nextEx.id] ?? nextEx.default1RM,
          slot.category,
          nextEx.id
        );

        return {
          ...slot,
          exerciseId: nextEx.id,
          sets: newSets
        };
      });

      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        slots: nextSlots
      };
    });

    triggerBanner(`Replaced ${selectedSlotIds.length} selected exercise(s).`, 'success');
    setSelectedSlotIds([]);
  };

  const handleUpdateSlotExerciseOrScheme = (slotId, changes) => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;
        const updatedExId = changes.exerciseId ?? slot.exerciseId;
        const updatedSecExId =
          changes.secondaryExerciseId !== undefined
            ? changes.secondaryExerciseId
            : slot.secondaryExerciseId;
        const updatedScheme = changes.scheme ?? slot.scheme;

        const ex1 = EXERCISE_MAP[updatedExId] || EXERCISE_LIBRARY[0];
        const ex2 = updatedSecExId ? EXERCISE_MAP[updatedSecExId] : null;

        const newSets1 = generateSetsForScheme(
          updatedScheme,
          oneRepMaxes[ex1.id] ?? ex1.default1RM,
          slot.category,
          ex1.id
        );
        const newSets2 = ex2
          ? generateSetsForScheme(
              updatedScheme,
              oneRepMaxes[ex2.id] ?? ex2.default1RM,
              slot.category,
              ex2.id
            )
          : [];

        return {
          ...slot,
          exerciseId: ex1.id,
          secondaryExerciseId: ex2 ? ex2.id : null,
          scheme: updatedScheme,
          sets: newSets1,
          secondarySets: newSets2
        };
      });

      return { ...prev, updatedAt: new Date().toISOString(), slots: nextSlots };
    });
  };

  const handleRemoveSlot = (slotId) => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        slots: prev.slots.filter(s => s.id !== slotId)
      };
    });
    setSelectedSlotIds(prev => prev.filter(id => id !== slotId));
  };

  const handleAddManualSlot = () => {
    const targetSession = currentView === 'historical_entry' ? historicalDraft : activeSession;
    const newSlot = createWorkoutSlot({
      category: newSlotCategory,
      slotLabel: newSlotCategory,
      exerciseId: newSlotCategory === 'Warm-Up Routine' ? 'warmup_12_step' : newSlotEx1,
      secondaryExerciseId: newSlotCategory === 'Supersets' ? newSlotEx2 : null,
      scheme: newSlotScheme,
      oneRepMaxes,
      restSeconds: targetSession?.defaultRestSeconds || 90
    });

    const slotToInsert =
      currentView === 'historical_entry'
        ? {
            ...newSlot,
            sets: newSlot.sets.map(s => ({ ...s, completed: true })),
            secondarySets: (newSlot.secondarySets || []).map(s => ({ ...s, completed: true }))
          }
        : newSlot;

    updateCurrentWorkoutState(prev => ({
      ...(prev || {
        id: `session_${Date.now()}`,
        title: 'Custom Session',
        startedAt: new Date().toISOString(),
        defaultRestSeconds: 90
      }),
      updatedAt: new Date().toISOString(),
      slots: [...(prev?.slots || []), slotToInsert]
    }));
    setShowAddSlotModal(false);
    triggerBanner(`Added ${newSlotCategory}.`, 'success');
  };

  const handleUpdateSet = (slotId, isSecondary, setId, field, rawVal) => {
    const val = Math.max(0, Number(rawVal) || 0);
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;
        const targetKey = isSecondary ? 'secondarySets' : 'sets';
        const updatedList = (slot[targetKey] || []).map(st =>
          st.id === setId ? { ...st, [field]: val } : st
        );
        return { ...slot, [targetKey]: updatedList };
      });
      return { ...prev, updatedAt: new Date().toISOString(), slots: nextSlots };
    });
  };

  const handleAddSetToSlot = (slotId, isSecondary = false) => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;
        const addOne = (list) => {
          const lastSet = list[list.length - 1] || { weight: 135, reps: 8, type: 'Working' };
          return [
            ...list,
            {
              id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              setNumber: list.length + 1,
              type: `Set ${list.length + 1}`,
              reps: lastSet.reps ?? 8,
              weight: lastSet.weight ?? 135,
              completed: currentView === 'historical_entry',
              completedAt: null,
              restLoggedSeconds: null,
              interLiftSeconds: null
            }
          ];
        };

        if (slot.category === 'Supersets' && slot.secondaryExerciseId) {
          return {
            ...slot,
            sets: addOne(slot.sets || []),
            secondarySets: addOne(slot.secondarySets || [])
          };
        }

        const key = isSecondary ? 'secondarySets' : 'sets';
        return { ...slot, [key]: addOne(slot[key] || []) };
      });
      return { ...prev, updatedAt: new Date().toISOString(), slots: nextSlots };
    });
  };

  const handleRemoveLastSetFromSlot = (slotId, isSecondary = false) => {
    updateCurrentWorkoutState(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(slot => {
        if (slot.id !== slotId) return slot;
        if (slot.category === 'Supersets' && slot.secondaryExerciseId) {
          return {
            ...slot,
            sets: (slot.sets || []).length > 1 ? slot.sets.slice(0, -1) : slot.sets,
            secondarySets:
              (slot.secondarySets || []).length > 1
                ? slot.secondarySets.slice(0, -1)
                : slot.secondarySets
          };
        }
        const key = isSecondary ? 'secondarySets' : 'sets';
        const list = slot[key] || [];
        if (list.length <= 1) return slot;
        return { ...slot, [key]: list.slice(0, -1) };
      });
      return { ...prev, updatedAt: new Date().toISOString(), slots: nextSlots };
    });
  };

  const openPlateCalculator = (slotId, isSecondary, setItem, exerciseName) => {
    const initialWeight = Number(setItem.weight) || 135;
    const defaultBar = 45;
    setCalcUnit('lb');
    setCalcBarWeight(defaultBar);
    setCalcDirectTotal(initialWeight);

    const availableLbPlates = [45, 35, 25, 10, 5, 2.5];
    let remPerSide = Math.max(0, (initialWeight - defaultBar) / 2);
    const initialPlates = [];
    availableLbPlates.forEach(plate => {
      while (remPerSide >= plate - 0.01) {
        initialPlates.push(plate);
        remPerSide = Math.round((remPerSide - plate) * 100) / 100;
      }
    });

    setCalcPlatesPerSide(initialPlates);
    setCalcMode('per_side');
    setPlateCalcTarget({
      slotId,
      isSecondary,
      setId: setItem.id,
      setNumber: setItem.setNumber,
      exerciseName
    });
  };

  const computedPlateCalculatorTotal = useMemo(() => {
    if (calcMode === 'total') {
      return Math.max(0, Number(calcDirectTotal) || 0);
    }
    const oneSideSum = calcPlatesPerSide.reduce((acc, p) => acc + p, 0);
    return Math.round((calcBarWeight + oneSideSum * 2) * 100) / 100;
  }, [calcMode, calcDirectTotal, calcPlatesPerSide, calcBarWeight]);

  const handleApplyCalculatedWeight = () => {
    if (!plateCalcTarget) return;
    const finalWeightLbs =
      calcUnit === 'kg'
        ? Math.round(computedPlateCalculatorTotal * 2.20462 * 2) / 2
        : computedPlateCalculatorTotal;

    if (plateCalcTarget.slotId === '__MAX_CALC__') {
      handleUpdateMaxCalcSet(plateCalcTarget.setId, 'weight', finalWeightLbs);
      setPlateCalcTarget(null);
      return;
    }

    handleUpdateSet(
      plateCalcTarget.slotId,
      plateCalcTarget.isSecondary,
      plateCalcTarget.setId,
      'weight',
      finalWeightLbs
    );
    setPlateCalcTarget(null);
  };

  const handleToggleSetDone = (slot, isSecondary, setItem) => {
    const nowMs = Date.now();
    const markingDone = !setItem.completed;

    if (currentView === 'historical_entry') {
      updateCurrentWorkoutState(prev => {
        if (!prev) return prev;
        const nextSlots = prev.slots.map(s => {
          if (s.id !== slot.id) return s;
          const key = isSecondary ? 'secondarySets' : 'sets';
          const nextList = (s[key] || []).map(st =>
            st.id === setItem.id
              ? {
                  ...st,
                  completed: markingDone,
                  completedAt: markingDone ? new Date(nowMs).toISOString() : null
                }
              : st
          );
          return { ...s, [key]: nextList };
        });
        return { ...prev, slots: nextSlots };
      });
      return;
    }

    let loggedRestSec = null;
    if (markingDone && timerState.startedAtMs) {
      loggedRestSec = Math.floor((nowMs - timerState.startedAtMs) / 1000);
    }

    let interLiftSec = null;
    if (markingDone && lastCompletedSetTimestampRef.current) {
      interLiftSec = Math.floor((nowMs - lastCompletedSetTimestampRef.current) / 1000);
    }

    if (markingDone) {
      lastCompletedSetTimestampRef.current = nowMs;
      startRestTimer(
        slot.restSeconds || activeSession?.defaultRestSeconds || 90,
        `${EXERCISE_MAP[slot.exerciseId]?.name || 'Lift'} Set ${setItem.setNumber}`
      );
    }

    setActiveSession(prev => {
      if (!prev) return prev;
      const nextSlots = prev.slots.map(s => {
        if (s.id !== slot.id) return s;
        const key = isSecondary ? 'secondarySets' : 'sets';
        const nextList = (s[key] || []).map(st =>
          st.id === setItem.id
            ? {
                ...st,
                completed: markingDone,
                completedAt: markingDone ? new Date(nowMs).toISOString() : null,
                restLoggedSeconds: markingDone ? loggedRestSec : null,
                interLiftSeconds: markingDone ? interLiftSec : null
              }
            : st
        );
        return { ...s, [key]: nextList };
      });

      const updatedSession = {
        ...prev,
        updatedAt: new Date(nowMs).toISOString(),
        isComplete: checkIsWorkoutComplete(nextSlots),
        slots: nextSlots
      };

      syncSessionToHistory(updatedSession);
      return updatedSession;
    });
  };

  const handleConfirmResetSession = () => {
    stopRestTimer();
    setActiveSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        presetUsed: null,
        suggestionReason: null,
        isComplete: false,
        updatedAt: new Date().toISOString(),
        slots: []
      };
    });
    setSelectedSlotIds([]);
    setConfirmAction(null);
    triggerBanner('Session cleared and reset.', 'info');
  };

  const handleConfirmCancelSession = () => {
    stopRestTimer();
    if (activeSession) {
      supabaseCloud.deleteWorkoutHistory(user, activeSession.id);
      setHistory(prev => prev.filter(w => w.id !== activeSession.id));
    }
    setActiveSession(null);
    setSelectedSlotIds([]);
    setConfirmAction(null);
    setCurrentView('home');
    triggerBanner('Workout session cancelled.', 'info');
  };

  const handleVerifyAndCompleteHistoryWorkout = (workoutId) => {
    setHistory(prev => {
      const next = prev.map(w => {
        if (w.id !== workoutId) return w;
        const completedSlots = (w.slots || []).map(slot => ({
          ...slot,
          sets: (slot.sets || []).map(s => ({
            ...s,
            completed: true,
            completedAt: s.completedAt || new Date().toISOString()
          })),
          secondarySets: (slot.secondarySets || []).map(s => ({
            ...s,
            completed: true,
            completedAt: s.completedAt || new Date().toISOString()
          }))
        }));
        const verifiedWorkout = {
          ...w,
          isComplete: true,
          verifiedByUser: true,
          updatedAt: new Date().toISOString(),
          slots: completedSlots
        };
        supabaseCloud.upsertWorkoutHistory(user, verifiedWorkout);
        return verifiedWorkout;
      });

      const { updatedMaxes } = calculateUpdated1RMsFromWorkouts(next, oneRepMaxes);
      setOneRepMaxes(updatedMaxes);
      return next;
    });
    triggerBanner('Workout verified & 1RMs updated.', 'success');
  };

  const handleToggleHistorySet = (workoutId, slotId, isSecondary, setId) => {
    setHistory(prev => {
      const next = prev.map(w => {
        if (w.id !== workoutId) return w;
        const nextSlots = (w.slots || []).map(slot => {
          if (slot.id !== slotId) return slot;
          const key = isSecondary ? 'secondarySets' : 'sets';
          const updatedSets = (slot[key] || []).map(st =>
            st.id === setId ? { ...st, completed: !st.completed } : st
          );
          return { ...slot, [key]: updatedSets };
        });
        const nowComplete = checkIsWorkoutComplete(nextSlots);
        const updatedW = {
          ...w,
          isComplete: nowComplete,
          verifiedByUser: nowComplete ? true : w.verifiedByUser,
          slots: nextSlots
        };
        supabaseCloud.upsertWorkoutHistory(user, updatedW);
        return updatedW;
      });

      const { updatedMaxes } = calculateUpdated1RMsFromWorkouts(next, oneRepMaxes);
      setOneRepMaxes(updatedMaxes);
      return next;
    });
  };

  // ============================================================================
  // 5. RENDER NATIVE iOS 17/18 VIEWPORT (FULLSCREEN ON MOBILE, FRAMED ON DESKTOP)
  // ============================================================================

  const navTitle =
    currentView === 'home'
      ? "You Can't Cry in Here"
      : currentView === 'session'
      ? 'Workout Session'
      : currentView === 'history'
      ? 'History'
      : currentView === 'historical_entry'
      ? 'Log Past Workout'
      : 'Account';

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: isRealMobileViewport
          ? colors.systemGroupedBackground
          : isDarkMode
          ? '#111113'
          : '#E5E5EA',
        display: 'flex',
        alignItems: isRealMobileViewport ? 'stretch' : 'center',
        justifyContent: 'center',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif',
        WebkitFontSmoothing: 'antialiased',
        color: colors.label
      }}
    >
      {/* Responsive Viewport Container: Fullscreen on Real Phones, iPhone Frame on Desktop */}
      <div
        style={{
          width: '100%',
          maxWidth: isRealMobileViewport ? '100%' : '393px',
          height: isRealMobileViewport ? '100dvh' : '852px',
          backgroundColor: colors.systemGroupedBackground,
          borderRadius: isRealMobileViewport ? '0px' : '44px',
          border: isRealMobileViewport
            ? 'none'
            : isDarkMode
            ? '6px solid rgb(44, 44, 46)'
            : '6px solid rgb(199, 199, 204)',
          boxShadow: isRealMobileViewport ? 'none' : '0 24px 60px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Simulated Status Bar (Only shown on Desktop preview; real phones use native iOS status bar) */}
        {!isRealMobileViewport && (
          <div
            style={{
              height: '44px',
              paddingLeft: '24px',
              paddingRight: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.chromeMaterial,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              zIndex: 40,
              flexShrink: 0
            }}
          >
            <span style={{ ...IOS_TEXT.footnote, fontWeight: 600, color: colors.label }}>9:41</span>

            {/* Dynamic Island Live Activity Pill */}
            <div
              style={{
                width: '120px',
                height: '28px',
                borderRadius: '999px',
                backgroundColor: 'rgb(0, 0, 0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '0 10px'
              }}
            >
              {timerState.isRunning && (
                <>
                  <SFSymbol
                    name="timer"
                    size={12}
                    color={timerState.remainingSeconds < 0 ? colors.systemRed : colors.systemGreen}
                  />
                  <span
                    style={{
                      ...IOS_TEXT.caption2,
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: timerState.remainingSeconds < 0 ? colors.systemRed : colors.systemGreen
                    }}
                  >
                    {formatTimerSeconds(timerState.remainingSeconds)}
                  </span>
                </>
              )}
            </div>

            {/* Right Status Bar + Appearance Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setIsDarkMode(prev => !prev)}
                title="Toggle iOS Light / Dark System Appearance"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <SFSymbol
                  name={isDarkMode ? 'moon.fill' : 'sun.max.fill'}
                  size={15}
                  color={isDarkMode ? colors.systemYellow : colors.systemOrange}
                />
              </button>
              <span style={{ ...IOS_TEXT.caption2, fontWeight: 600, color: colors.label }}>100%</span>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* NATIVE iOS `NavigationStack` TOP BAR + STICKY SESSION ACCESSORY    */}
        {/* ================================================================== */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 35,
            paddingTop: isRealMobileViewport ? 'env(safe-area-inset-top, 0px)' : '0px',
            backgroundColor: colors.chromeMaterial,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: `0.5px solid ${colors.separator}`,
            flexShrink: 0
          }}
        >
          {/* Standard 44pt UINavigationBar */}
          <div
            style={{
              height: '44px',
              paddingLeft: '8px',
              paddingRight: '16px',
              display: 'grid',
              gridTemplateColumns: '90px 1fr 110px',
              alignItems: 'center'
            }}
          >
            {/* Leading NavigationBarItem (Back Button) */}
            <div>
              {currentView !== 'home' && (
                <button
                  type="button"
                  onClick={
                    currentView === 'session'
                      ? handleBackToHomeFromSession
                      : currentView === 'historical_entry'
                      ? () => setCurrentView('history')
                      : () => setCurrentView('home')
                  }
                  style={{
                    ...IOS_TEXT.body,
                    color: colors.systemBlue,
                    background: 'none',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '4px 6px',
                    cursor: 'pointer'
                  }}
                >
                  <SFSymbol name="chevron.backward" size={20} color={colors.systemBlue} />
                  <span>Back</span>
                </button>
              )}
            </div>

            {/* Center Inline Title */}
            <div
              style={{
                ...IOS_TEXT.headline,
                color: colors.label,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {currentView === 'home' ? '' : navTitle}
            </div>

            {/* Trailing NavigationBarItem (Theme Toggle on Mobile + Account / Auth Button) */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
              {isRealMobileViewport && (
                <button
                  type="button"
                  onClick={() => setIsDarkMode(prev => !prev)}
                  title="Toggle Light / Dark Mode"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '2px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <SFSymbol
                    name={isDarkMode ? 'moon.fill' : 'sun.max.fill'}
                    size={16}
                    color={isDarkMode ? colors.systemYellow : colors.systemOrange}
                  />
                </button>
              )}
              <button
                type="button"
                onClick={() => setCurrentView('auth')}
                style={{
                  ...IOS_TEXT.subheadline,
                  fontWeight: 600,
                  color: colors.systemBlue,
                  background: 'none',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 0',
                  cursor: 'pointer'
                }}
              >
                <SFSymbol name="person.crop.circle" size={19} color={colors.systemBlue} />
                <span
                  style={{
                    maxWidth: '64px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {user ? user.email.split('@')[0] : 'Sign In'}
                </span>
              </button>
            </div>
          </div>

          {/* Native NavigationBar Accessory Toolbar: Always-Visible Rest Timer & Suggest Alternative During Session */}
          {currentView === 'session' && activeSession && (
            <div
              style={{
                padding: '8px 16px',
                borderTop: `0.5px solid ${colors.separator}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}
              >
                {/* Native Menu Picker for Rest Duration */}
                <div
                  style={{
                    backgroundColor: colors.tertiarySystemFill,
                    borderRadius: '8px',
                    padding: '5px 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <SFSymbol name="timer" size={14} color={colors.systemBlue} />
                  <select
                    value={activeSession.defaultRestSeconds || 90}
                    onChange={e => {
                      const sec = Number(e.target.value);
                      setActiveSession(prev => ({
                        ...prev,
                        defaultRestSeconds: sec,
                        slots: prev.slots.map(s => ({ ...s, restSeconds: sec }))
                      }));
                      setTimerState(prev => ({
                        ...prev,
                        targetSeconds: sec,
                        remainingSeconds: prev.isRunning ? prev.remainingSeconds : sec
                      }));
                    }}
                    style={{
                      ...IOS_TEXT.footnote,
                      fontWeight: 600,
                      color: colors.label,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value={60}>Rest 1:00</option>
                    <option value={90}>Rest 1:30</option>
                    <option value={120}>Rest 2:00</option>
                    <option value={180}>Rest 3:00</option>
                    <option value={10}>Rest 0:10</option>
                  </select>
                </div>

                {/* Live Rest Countdown / Negative Overtime Pill */}
                <div
                  style={{
                    flex: 1,
                    backgroundColor:
                      timerState.isRunning && timerState.remainingSeconds < 0
                        ? 'rgba(255, 69, 58, 0.18)'
                        : timerState.isRunning
                        ? 'rgba(48, 209, 88, 0.16)'
                        : colors.tertiarySystemFill,
                    borderRadius: '8px',
                    padding: '5px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span
                    style={{
                      ...IOS_TEXT.caption1,
                      fontWeight: 600,
                      color:
                        timerState.isRunning && timerState.remainingSeconds < 0
                          ? colors.systemRed
                          : colors.secondaryLabel
                    }}
                  >
                    {timerState.isRunning && timerState.remainingSeconds < 0 ? 'OVERTIME' : 'REST'}
                  </span>

                  <span
                    style={{
                      ...IOS_TEXT.headline,
                      fontVariantNumeric: 'tabular-nums',
                      color:
                        timerState.isRunning && timerState.remainingSeconds < 0
                          ? colors.systemRed
                          : timerState.isRunning
                          ? colors.systemGreen
                          : colors.label
                    }}
                  >
                    {formatTimerSeconds(timerState.remainingSeconds)}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      timerState.isRunning
                        ? stopRestTimer()
                        : startRestTimer(activeSession.defaultRestSeconds || 90, 'Manual Rest')
                    }
                    style={{
                      ...IOS_TEXT.caption1,
                      fontWeight: 600,
                      color: timerState.isRunning ? colors.systemRed : colors.systemBlue,
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer'
                    }}
                  >
                    {timerState.isRunning ? 'Stop' : 'Start'}
                  </button>
                </div>

                {/* Sound Toggle */}
                <button
                  type="button"
                  onClick={() => setSoundEnabled(prev => !prev)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: colors.tertiarySystemFill,
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <SFSymbol
                    name={soundEnabled ? 'speaker.wave.2.fill' : 'speaker.slash.fill'}
                    size={15}
                    color={soundEnabled ? colors.systemBlue : colors.secondaryLabel}
                  />
                </button>
              </div>

              {/* Sticky "Suggest Alternative" Action Bar when 1 or more workout slots are selected */}
              {selectedSlotIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleSuggestAlternativesForSelected}
                  style={{
                    ...IOS_TEXT.subheadline,
                    fontWeight: 600,
                    width: '100%',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: colors.systemOrange,
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <SFSymbol name="sparkles" size={15} color="#FFFFFF" />
                  <span>Suggest Alternative ({selectedSlotIds.length} Selected)</span>
                </button>
              )}
            </div>
          )}
        </header>

        {/* ================================================================== */}
        {/* MAIN SCROLLABLE `List(.insetGrouped)` CONTENT AREA                 */}
        {/* ================================================================== */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingTop: '8px',
            paddingBottom: '32px'
          }}
        >
          {/* Native iOS Notification Banner */}
          {bannerMessage && (
            <div style={{ padding: '0 16px 12px' }}>
              <div
                style={{
                  backgroundColor: colors.secondarySystemGroupedBackground,
                  borderRadius: '12px',
                  padding: '10px 14px',
                  border: `0.5px solid ${colors.separator}`,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SFSymbol
                    name={
                      bannerMessage.type === 'warning'
                        ? 'exclamationmark.circle.fill'
                        : 'checkmark.circle.fill'
                    }
                    size={18}
                    color={
                      bannerMessage.type === 'warning' ? colors.systemOrange : colors.systemGreen
                    }
                  />
                  <span style={{ ...IOS_TEXT.subheadline, color: colors.label }}>
                    {bannerMessage.msg}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* VIEW 1: HOME (`List` with Primary Actions & 1RM Section)         */}
          {/* ================================================================ */}
          {currentView === 'home' && (
            <div>
              {/* Primary Navigation Rows (Inset Grouped List) */}
              <IOSListSection colors={colors}>
                <IOSListRow onClick={handleOpenNewSession} colors={colors}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '7px',
                        backgroundColor: colors.systemBlue,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <SFSymbol name="play.fill" size={15} color="#FFFFFF" />
                    </div>
                    <span style={{ ...IOS_TEXT.body, fontWeight: 600, color: colors.label }}>
                      New Session
                    </span>
                  </div>
                  <SFSymbol name="chevron.forward" size={16} color={colors.tertiaryLabel} />
                </IOSListRow>

                <IOSListRow onClick={() => setCurrentView('history')} isLast colors={colors}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '7px',
                        backgroundColor: colors.systemIndigo,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <SFSymbol name="clock.arrow.circlepath" size={16} color="#FFFFFF" />
                    </div>
                    <span style={{ ...IOS_TEXT.body, fontWeight: 600, color: colors.label }}>
                      History
                    </span>
                  </div>

                  {/* Red Notification Dot on History Row when Incomplete Workouts Exist */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {incompleteWorkoutsCount > 0 && (
                      <span
                        title={`${incompleteWorkoutsCount} incomplete workout(s)`}
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '5px',
                          backgroundColor: colors.systemRed,
                          display: 'inline-block'
                        }}
                      />
                    )}
                    <SFSymbol name="chevron.forward" size={16} color={colors.tertiaryLabel} />
                  </div>
                </IOSListRow>
              </IOSListSection>

              {/* Active Session Resume Card (If In Progress) */}
              {activeSession && activeSession.slots && activeSession.slots.length > 0 && (
                <IOSListSection header="In Progress" colors={colors}>
                  <IOSListRow onClick={() => setCurrentView('session')} isLast colors={colors}>
                    <div>
                      <div style={{ ...IOS_TEXT.headline, color: colors.label }}>
                        {activeSession.title}
                      </div>
                      <div style={{ ...IOS_TEXT.footnote, color: colors.secondaryLabel }}>
                        {activeSession.slots.length} exercises configured
                      </div>
                    </div>
                    <span style={{ ...IOS_TEXT.subheadline, fontWeight: 600, color: colors.systemBlue }}>
                      Resume
                    </span>
                  </IOSListRow>
                </IOSListSection>
              )}

              {/* 1RM Section */}
              <IOSListSection
                header={
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>1RM</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) {
                          triggerBanner(
                            'Sign in to auto-recalculate from History, or tap any lift below.',
                            'warning'
                          );
                          return;
                        }
                        const { updatedMaxes, changesCount } = calculateUpdated1RMsFromWorkouts(
                          history,
                          oneRepMaxes
                        );
                        setOneRepMaxes(updatedMaxes);
                        triggerBanner(
                          changesCount > 0
                            ? `Recalculated ${changesCount} 1RM record(s).`
                            : '1RMs are up to date with verified history.',
                          'success'
                        );
                      }}
                      style={{
                        ...IOS_TEXT.footnote,
                        fontWeight: 600,
                        color: colors.systemBlue,
                        background: 'none',
                        border: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: 0,
                        cursor: 'pointer',
                        textTransform: 'none'
                      }}
                    >
                      <SFSymbol
                        name="arrow.triangle.2.circlepath"
                        size={13}
                        color={colors.systemBlue}
                      />
                      <span>Recalculate</span>
                    </button>
                  </div>
                }
                colors={colors}
              >
                {EXERCISE_LIBRARY.filter(
                  ex =>
                    ex.category !== 'Warm-Up Routine' &&
                    ex.category !== 'Abs' &&
                    (showAllMaxes || ex.isPriority)
                ).map((ex) => {
                  const currentMax = oneRepMaxes[ex.id] ?? ex.default1RM;
                  return (
                    <IOSListRow
                      key={ex.id}
                      onClick={() => openMaxCalculatorModal(ex, currentMax)}
                      colors={colors}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            ...IOS_TEXT.body,
                            color: colors.label,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {ex.name}
                        </div>
                        <div style={{ ...IOS_TEXT.caption1, color: colors.secondaryLabel }}>
                          {ex.equipment} • {ex.muscleGroup}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          flexShrink: 0
                        }}
                      >
                        <span style={{ ...IOS_TEXT.body, color: colors.secondaryLabel }}>
                          {currentMax} lb
                        </span>
                        <SFSymbol name="chevron.forward" size={14} color={colors.tertiaryLabel} />
                      </div>
                    </IOSListRow>
                  );
                })}

                <IOSListRow
                  onClick={() => setShowAllMaxes(prev => !prev)}
                  isLast
                  colors={colors}
                >
                  <span style={{ ...IOS_TEXT.body, color: colors.systemBlue }}>
                    {showAllMaxes ? 'Show Priority Lifts Only' : 'Show All Lifts'}
                  </span>
                </IOSListRow>
              </IOSListSection>
            </div>
          )}

          {/* ================================================================ */}
          {/* VIEW 2: WORKOUT SESSION & HISTORICAL ENTRY (`Form` / `List`)     */}
          {/* ================================================================ */}
          {(currentView === 'session' || currentView === 'historical_entry') &&
            (currentView === 'session' ? activeSession : historicalDraft) && (() => {
              const isHistoricalMode = currentView === 'historical_entry';
              const currentWorkout = isHistoricalMode ? historicalDraft : activeSession;

              return (
                <div>
                  {/* Workout Metadata & Workouts Dropdown Section */}
                  <IOSListSection header="Session Details & Workouts" colors={colors}>
                    {/* Title Input Row */}
                    <IOSListRow colors={colors}>
                      <span style={{ ...IOS_TEXT.body, color: colors.secondaryLabel }}>Title</span>
                      <input
                        type="text"
                        value={currentWorkout.title}
                        onChange={e =>
                          updateCurrentWorkoutState(prev => ({
                            ...prev,
                            title: e.target.value
                          }))
                        }
                        style={{
                          ...IOS_TEXT.body,
                          fontWeight: 600,
                          color: colors.label,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          textAlign: 'right',
                          flex: 1
                        }}
                      />
                    </IOSListRow>

                    {/* Date Picker Row (Historical Mode Only) */}
                    {isHistoricalMode && (
                      <IOSListRow colors={colors}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <SFSymbol name="calendar" size={16} color={colors.systemBlue} />
                          <span style={{ ...IOS_TEXT.body, color: colors.label }}>Workout Date</span>
                        </div>
                        <input
                          type="date"
                          value={currentWorkout.workoutDate}
                          onChange={e =>
                            setHistoricalDraft(prev => ({
                              ...prev,
                              workoutDate: e.target.value
                            }))
                          }
                          style={{
                            ...IOS_TEXT.subheadline,
                            color: colors.systemBlue,
                            backgroundColor: colors.tertiarySystemFill,
                            border: 'none',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            outline: 'none'
                          }}
                        />
                      </IOSListRow>
                    )}

                    {/* Workouts Dropdown Menu Row */}
                    <IOSListRow isLast={isHistoricalMode} colors={colors}>
                      <span style={{ ...IOS_TEXT.body, color: colors.label, flexShrink: 0 }}>
                        Workout
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '6px',
                          flex: 1,
                          minWidth: 0
                        }}
                      >
                        <select
                          value={currentWorkout.presetUsed || ''}
                          onChange={e => {
                            const val = e.target.value;
                            if (!val) return;
                            handleLoadPreset(val);
                          }}
                          style={{
                            ...IOS_TEXT.body,
                            color: colors.systemBlue,
                            fontWeight: 600,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            textAlign: 'right',
                            width: '100%',
                            maxWidth: '240px',
                            cursor: 'pointer',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          <option value="" disabled>
                            Select a Workout...
                          </option>
                          <optgroup label="LS Workouts">
                            {BUILTIN_PRESETS.map(p => (
                              <option key={p.key} value={p.key}>
                                {p.label}
                              </option>
                            ))}
                          </optgroup>
                          {customPresets.length > 0 && (
                            <optgroup label="Saved Custom Workouts">
                              {customPresets.map(cp => (
                                <option key={cp.key} value={cp.key}>
                                  {cp.label}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                        <SFSymbol
                          name="chevron.up.chevron.down"
                          size={14}
                          color={colors.systemBlue}
                        />
                      </div>
                    </IOSListRow>

                    {/* Suggest Workout Row (Live Session Only) */}
                    {!isHistoricalMode && (
                      <IOSListRow
                        onClick={handleSuggestWorkoutFromHistory}
                        isLast
                        colors={colors}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <SFSymbol name="sparkles" size={17} color={colors.systemIndigo} />
                          <span
                            style={{
                              ...IOS_TEXT.body,
                              fontWeight: 600,
                              color: colors.systemIndigo
                            }}
                          >
                            Suggest Workout
                          </span>
                        </div>
                        <SFSymbol name="chevron.forward" size={15} color={colors.tertiaryLabel} />
                      </IOSListRow>
                    )}
                  </IOSListSection>

                  {/* Exercise Slots Rendered as Collapsible Native Inset Grouped Sections */}
                  {currentWorkout.slots.map(slot => {
                    const ex1 = EXERCISE_MAP[slot.exerciseId] || EXERCISE_LIBRARY[0];
                    const ex2 = slot.secondaryExerciseId
                      ? EXERCISE_MAP[slot.secondaryExerciseId]
                      : null;
                    const isSelected = selectedSlotIds.includes(slot.id);
                    const isWarmup = slot.category === 'Warm-Up Routine';
                    const isCollapsed = collapsedSlotIds.includes(slot.id);
                    const completedCount = (slot.sets || []).filter(s => s.completed).length;
                    const totalCount = (slot.sets || []).length;

                    return (
                      <IOSListSection
                        key={slot.id}
                        colors={colors}
                        header={
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {!isWarmup && !isHistoricalMode && (
                                <button
                                  type="button"
                                  onClick={() => toggleSelectSlot(slot.id)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center'
                                  }}
                                  title="Select for Suggest Alternative"
                                >
                                  <SFSymbol
                                    name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                                    size={18}
                                    color={isSelected ? colors.systemOrange : colors.secondaryLabel}
                                  />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleCollapseSlot(slot.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  color: colors.secondaryLabel,
                                  ...IOS_TEXT.footnote,
                                  textTransform: 'uppercase',
                                  fontWeight: 600
                                }}
                              >
                                <span>{slot.slotLabel || slot.category}</span>
                                <SFSymbol
                                  name={isCollapsed ? 'chevron.forward' : 'chevron.down'}
                                  size={13}
                                  color={colors.secondaryLabel}
                                />
                              </button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <button
                                type="button"
                                onClick={() => toggleCollapseSlot(slot.id)}
                                style={{
                                  ...IOS_TEXT.caption1,
                                  color: colors.systemBlue,
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  textTransform: 'none'
                                }}
                              >
                                {isCollapsed ? `Show (${completedCount}/${totalCount})` : 'Collapse'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveSlot(slot.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                                title="Remove Exercise"
                              >
                                <SFSymbol name="trash" size={15} color={colors.systemRed} />
                              </button>
                            </div>
                          </div>
                        }
                      >
                        {isCollapsed ? (
                          <IOSListRow
                            onClick={() => toggleCollapseSlot(slot.id)}
                            isLast
                            colors={colors}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  ...IOS_TEXT.headline,
                                  color: colors.label,
                                  wordBreak: 'break-word'
                                }}
                              >
                                {ex1.name}
                                {slot.category === 'Supersets' && ex2 ? ` + ${ex2.name}` : ''}
                              </div>
                              <div style={{ ...IOS_TEXT.footnote, color: colors.secondaryLabel }}>
                                {completedCount} of {totalCount} sets completed
                                {!isWarmup && slot.category !== 'Abs' ? ` • ${slot.scheme}` : ''}
                              </div>
                            </div>
                            <SFSymbol name="chevron.down" size={16} color={colors.tertiaryLabel} />
                          </IOSListRow>
                        ) : (
                          <>
                            {/* Exercise & Scheme Pickers (Non-Warmup) */}
                            {!isWarmup && (
                              <>
                                <IOSListRow colors={colors}>
                                  <select
                                    value={slot.exerciseId}
                                    onChange={e =>
                                      handleUpdateSlotExerciseOrScheme(slot.id, {
                                        exerciseId: e.target.value
                                      })
                                    }
                                    style={{
                                      ...IOS_TEXT.headline,
                                      color: colors.label,
                                      backgroundColor: 'transparent',
                                      border: 'none',
                                      outline: 'none',
                                      width: '100%',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {EXERCISE_LIBRARY.filter(
                                      e => e.category !== 'Warm-Up Routine'
                                    ).map(item => (
                                      <option key={item.id} value={item.id}>
                                        {item.name} ({item.equipment}) — 1RM:{' '}
                                        {oneRepMaxes[item.id] ?? item.default1RM}
                                      </option>
                                    ))}
                                  </select>
                                </IOSListRow>

                                {slot.category === 'Supersets' && (
                                  <IOSListRow colors={colors}>
                                    <select
                                      value={slot.secondaryExerciseId || 'front_flies'}
                                      onChange={e =>
                                        handleUpdateSlotExerciseOrScheme(slot.id, {
                                          secondaryExerciseId: e.target.value
                                        })
                                      }
                                      style={{
                                        ...IOS_TEXT.subheadline,
                                        fontWeight: 600,
                                        color: colors.systemOrange,
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        width: '100%',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      {EXERCISE_LIBRARY.filter(
                                        e => e.category !== 'Warm-Up Routine'
                                      ).map(item => (
                                        <option key={item.id} value={item.id}>
                                          + Superset: {item.name} ({item.equipment})
                                        </option>
                                      ))}
                                    </select>
                                  </IOSListRow>
                                )}

                                {slot.category !== 'Abs' && (
                                  <IOSListRow colors={colors} minHeight="40px" padding="8px 16px">
                                    <div
                                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                      <select
                                        value={slot.scheme}
                                        onChange={e =>
                                          handleUpdateSlotExerciseOrScheme(slot.id, {
                                            scheme: e.target.value
                                          })
                                        }
                                        style={{
                                          ...IOS_TEXT.subheadline,
                                          fontWeight: 600,
                                          color: colors.systemBlue,
                                          backgroundColor: colors.tertiarySystemFill,
                                          border: 'none',
                                          borderRadius: '6px',
                                          padding: '4px 8px',
                                          outline: 'none',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        <option value="5x8">5x8</option>
                                        <option value="5x5">5x5</option>
                                        <option value="3x5">3x5</option>
                                        <option value="Pyramid">Pyramid</option>
                                        <option value="Reverse Pyramid">Reverse Pyramid</option>
                                      </select>
                                    </div>

                                    <div
                                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => handleAddSetToSlot(slot.id, false)}
                                        style={{
                                          ...IOS_TEXT.footnote,
                                          fontWeight: 600,
                                          color: colors.systemBlue,
                                          backgroundColor: colors.tertiarySystemFill,
                                          border: 'none',
                                          borderRadius: '6px',
                                          padding: '4px 8px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        + Set
                                      </button>
                                      {slot.sets.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveLastSetFromSlot(slot.id, false)}
                                          style={{
                                            ...IOS_TEXT.footnote,
                                            fontWeight: 600,
                                            color: colors.secondaryLabel,
                                            backgroundColor: colors.tertiarySystemFill,
                                            border: 'none',
                                            borderRadius: '6px',
                                            padding: '4px 8px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          - Set
                                        </button>
                                      )}
                                    </div>
                                  </IOSListRow>
                                )}
                              </>
                            )}

                            {/* Primary Sets List (Warmup Checklist vs Two-Line Readable Set Rows) */}
                            {isWarmup ? (
                              slot.sets.map((setItem, idx) => (
                                <IOSListRow
                                  key={setItem.id}
                                  isLast={idx === slot.sets.length - 1}
                                  colors={colors}
                                >
                                  <div
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                                  >
                                    <span
                                      style={{
                                        ...IOS_TEXT.caption1,
                                        fontWeight: 600,
                                        color: colors.secondaryLabel,
                                        width: '20px'
                                      }}
                                    >
                                      {setItem.setNumber}.
                                    </span>
                                    <span style={{ ...IOS_TEXT.body, color: colors.label }}>
                                      {setItem.type}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleSetDone(slot, false, setItem)}
                                    style={{
                                      ...IOS_TEXT.footnote,
                                      fontWeight: 600,
                                      backgroundColor: setItem.completed
                                        ? colors.systemGreen
                                        : colors.tertiarySystemFill,
                                      color: setItem.completed ? '#FFFFFF' : colors.systemBlue,
                                      border: 'none',
                                      borderRadius: '999px',
                                      padding: '5px 12px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Done
                                  </button>
                                </IOSListRow>
                              ))
                            ) : (() => {
                              // Intertwine sets when slot is a Superset (A1 Set 1 -> A2 Set 1 -> A1 Set 2 -> A2 Set 2)
                              const isSupersetWithEx2 = Boolean(slot.category === 'Supersets' && ex2);
                              const combinedSets = [];
                              if (isSupersetWithEx2) {
                                const maxLen = Math.max(
                                  slot.sets?.length || 0,
                                  slot.secondarySets?.length || 0
                                );
                                for (let i = 0; i < maxLen; i++) {
                                  if (slot.sets?.[i]) {
                                    combinedSets.push({
                                      setItem: slot.sets[i],
                                      isSecondary: false,
                                      ex: ex1,
                                      prefix: `A1 #${slot.sets[i].setNumber}`
                                    });
                                  }
                                  if (slot.secondarySets?.[i]) {
                                    combinedSets.push({
                                      setItem: slot.secondarySets[i],
                                      isSecondary: true,
                                      ex: ex2,
                                      prefix: `A2 #${slot.secondarySets[i].setNumber}`
                                    });
                                  }
                                }
                              } else {
                                (slot.sets || []).forEach(st => {
                                  combinedSets.push({
                                    setItem: st,
                                    isSecondary: false,
                                    ex: ex1,
                                    prefix: `#${st.setNumber}`
                                  });
                                });
                              }

                              return combinedSets.map(({ setItem, isSecondary, ex, prefix }, idx) => (
                                <IOSListRow
                                  key={setItem.id}
                                  isLast={idx === combinedSets.length - 1}
                                  colors={colors}
                                  padding="10px 16px"
                                >
                                  {/* Two-Line Layout: Line 1 = Full Name + Done Button; Line 2 = Weight Box + Reps Box */}
                                  <div
                                    style={{
                                      width: '100%',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '8px'
                                    }}
                                  >
                                    {/* Line 1: Full Workout & Set Name + Done Button */}
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '10px'
                                      }}
                                    >
                                      <div style={{ minWidth: 0, flex: 1 }}>
                                        <span
                                          style={{
                                            ...IOS_TEXT.subheadline,
                                            fontWeight: 600,
                                            color: isSecondary ? colors.systemOrange : colors.label,
                                            wordBreak: 'break-word'
                                          }}
                                        >
                                          {prefix} {ex.name}
                                        </span>
                                        <span
                                          style={{
                                            ...IOS_TEXT.caption1,
                                            color: colors.secondaryLabel,
                                            marginLeft: '6px'
                                          }}
                                        >
                                          ({setItem.type})
                                        </span>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleToggleSetDone(slot, isSecondary, setItem)}
                                        style={{
                                          ...IOS_TEXT.caption1,
                                          fontWeight: 600,
                                          backgroundColor: setItem.completed
                                            ? colors.systemGreen
                                            : colors.tertiarySystemFill,
                                          color: setItem.completed ? '#FFFFFF' : colors.systemBlue,
                                          border: 'none',
                                          borderRadius: '999px',
                                          padding: '5px 12px',
                                          cursor: 'pointer',
                                          flexShrink: 0
                                        }}
                                      >
                                        Done
                                      </button>
                                    </div>

                                    {/* Line 2: Vertically Aligned Weight Box (Launches Plate Calculator) & Reps Box */}
                                    <div
                                      style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '10px',
                                        alignItems: 'center'
                                      }}
                                    >
                                      {/* Weight Box Column */}
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px'
                                        }}
                                      >
                                        <span
                                          style={{
                                            ...IOS_TEXT.caption1,
                                            color: colors.secondaryLabel
                                          }}
                                        >
                                          Weight
                                        </span>
                                        {slot.category !== 'Abs' ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openPlateCalculator(slot.id, isSecondary, setItem, ex.name)
                                            }
                                            title="Tap to calculate barbell / lift weight"
                                            style={{
                                              ...IOS_TEXT.subheadline,
                                              fontWeight: 600,
                                              color: colors.systemBlue,
                                              backgroundColor: colors.tertiarySystemFill,
                                              border: 'none',
                                              borderRadius: '8px',
                                              padding: '5px 10px',
                                              minWidth: '84px',
                                              textAlign: 'center',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            {setItem.weight} lb
                                          </button>
                                        ) : (
                                          <span
                                            style={{
                                              ...IOS_TEXT.subheadline,
                                              fontWeight: 600,
                                              color: colors.secondaryLabel,
                                              backgroundColor: colors.tertiarySystemFill,
                                              borderRadius: '8px',
                                              padding: '5px 10px',
                                              minWidth: '84px',
                                              textAlign: 'center'
                                            }}
                                          >
                                            BW
                                          </span>
                                        )}
                                      </div>

                                      {/* Reps Box Column */}
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'flex-end',
                                          gap: '6px'
                                        }}
                                      >
                                        <input
                                          type="number"
                                          value={setItem.reps}
                                          onChange={e =>
                                            handleUpdateSet(
                                              slot.id,
                                              isSecondary,
                                              setItem.id,
                                              'reps',
                                              e.target.value
                                            )
                                          }
                                          style={{
                                            ...IOS_TEXT.subheadline,
                                            fontWeight: 600,
                                            color: colors.label,
                                            backgroundColor: colors.tertiarySystemFill,
                                            border: 'none',
                                            borderRadius: '8px',
                                            width: '54px',
                                            padding: '5px 6px',
                                            textAlign: 'center',
                                            outline: 'none'
                                          }}
                                        />
                                        <span
                                          style={{
                                            ...IOS_TEXT.caption1,
                                            color: colors.secondaryLabel,
                                            minWidth: '28px'
                                          }}
                                        >
                                          {slot.category === 'Abs' ? 'sec' : 'reps'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </IOSListRow>
                              ));
                            })()}
                          </>
                        )}
                      </IOSListSection>
                    );
                  })}

                  {/* "Add Exercise" Row */}
                  <IOSListSection colors={colors}>
                    <IOSListRow onClick={() => setShowAddSlotModal(true)} isLast colors={colors}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <SFSymbol name="plus.circle.fill" size={20} color={colors.systemBlue} />
                        <span style={{ ...IOS_TEXT.body, fontWeight: 600, color: colors.systemBlue }}>
                          Add Exercise
                        </span>
                      </div>
                    </IOSListRow>
                  </IOSListSection>

                  {/* Single Button to Open Save as New Workout Sheet */}
                  <IOSListSection colors={colors}>
                    <IOSListRow onClick={handleOpenSavePresetModal} isLast colors={colors}>
                      <span
                        style={{
                          ...IOS_TEXT.body,
                          fontWeight: 600,
                          color: colors.systemBlue,
                          width: '100%',
                          textAlign: 'center'
                        }}
                      >
                        Save as New Workout
                      </span>
                    </IOSListRow>
                  </IOSListSection>

                  {/* Destructive / Save Actions Section */}
                  {isHistoricalMode ? (
                    <IOSListSection colors={colors}>
                      <IOSListRow onClick={handleSaveHistoricalDraft} colors={colors}>
                        <span
                          style={{
                            ...IOS_TEXT.headline,
                            color: colors.systemBlue,
                            width: '100%',
                            textAlign: 'center'
                          }}
                        >
                          Save Historical Workout
                        </span>
                      </IOSListRow>
                      <IOSListRow
                        onClick={() => {
                          setHistoricalDraft(null);
                          setCurrentView('history');
                        }}
                        isLast
                        colors={colors}
                      >
                        <span
                          style={{
                            ...IOS_TEXT.body,
                            color: colors.systemRed,
                            width: '100%',
                            textAlign: 'center'
                          }}
                        >
                          Cancel
                        </span>
                      </IOSListRow>
                    </IOSListSection>
                  ) : (
                    <IOSListSection colors={colors}>
                      <IOSListRow onClick={() => setConfirmAction('reset')} colors={colors}>
                        <span
                          style={{
                            ...IOS_TEXT.body,
                            color: colors.systemOrange,
                            width: '100%',
                            textAlign: 'center'
                          }}
                        >
                          Reset
                        </span>
                      </IOSListRow>
                      <IOSListRow onClick={() => setConfirmAction('cancel')} isLast colors={colors}>
                        <span
                          style={{
                            ...IOS_TEXT.body,
                            color: colors.systemRed,
                            width: '100%',
                            textAlign: 'center'
                          }}
                        >
                          Cancel
                        </span>
                      </IOSListRow>
                    </IOSListSection>
                  )}
                </div>
              );
            })()}

          {/* ================================================================ */}
          {/* VIEW 3: HISTORY (`List` with 3-Tier Filter Pickers)              */}
          {/* ================================================================ */}
          {currentView === 'history' && (
            <div>
              {/* 3-Tier Filter Section */}
              <IOSListSection
                header={
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>Filters</span>
                    {(historyFilterLift !== 'ALL' ||
                      historyFilterMuscleGroup !== 'ALL' ||
                      historyFilterSpecificMuscle !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryFilterLift('ALL');
                          setHistoryFilterMuscleGroup('ALL');
                          setHistoryFilterSpecificMuscle('ALL');
                        }}
                        style={{
                          ...IOS_TEXT.footnote,
                          color: colors.systemBlue,
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          textTransform: 'none'
                        }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                }
                colors={colors}
              >
                <IOSListRow colors={colors}>
                  <span style={{ ...IOS_TEXT.body, color: colors.label }}>Lift</span>
                  <select
                    value={historyFilterLift}
                    onChange={e => setHistoryFilterLift(e.target.value)}
                    style={{
                      ...IOS_TEXT.body,
                      color: colors.secondaryLabel,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      textAlign: 'right',
                      maxWidth: '210px'
                    }}
                  >
                    <option value="ALL">All Lifts</option>
                    {EXERCISE_LIBRARY.map(ex => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name}
                      </option>
                    ))}
                  </select>
                </IOSListRow>

                <IOSListRow colors={colors}>
                  <span style={{ ...IOS_TEXT.body, color: colors.label }}>Muscle Group</span>
                  <select
                    value={historyFilterMuscleGroup}
                    onChange={e => setHistoryFilterMuscleGroup(e.target.value)}
                    style={{
                      ...IOS_TEXT.body,
                      color: colors.secondaryLabel,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      textAlign: 'right'
                    }}
                  >
                    {allMuscleGroups.map(mg => (
                      <option key={mg} value={mg}>
                        {mg === 'ALL' ? 'All Groups' : mg}
                      </option>
                    ))}
                  </select>
                </IOSListRow>

                <IOSListRow isLast colors={colors}>
                  <span style={{ ...IOS_TEXT.body, color: colors.label }}>Specific Muscle</span>
                  <select
                    value={historyFilterSpecificMuscle}
                    onChange={e => setHistoryFilterSpecificMuscle(e.target.value)}
                    style={{
                      ...IOS_TEXT.body,
                      color: colors.secondaryLabel,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      textAlign: 'right'
                    }}
                  >
                    {allSpecificMuscles.map(sm => (
                      <option key={sm} value={sm}>
                        {sm === 'ALL' ? 'All Muscles' : sm}
                      </option>
                    ))}
                  </select>
                </IOSListRow>
              </IOSListSection>

              {/* Enter Historical Workout Button Row (Directly Below Filters) */}
              <IOSListSection colors={colors}>
                <IOSListRow onClick={handleOpenHistoricalEntry} isLast colors={colors}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <SFSymbol name="plus.circle.fill" size={20} color={colors.systemBlue} />
                    <span style={{ ...IOS_TEXT.body, fontWeight: 600, color: colors.systemBlue }}>
                      Enter historical workout
                    </span>
                  </div>
                  <SFSymbol name="chevron.forward" size={15} color={colors.tertiaryLabel} />
                </IOSListRow>
              </IOSListSection>

              {/* Chronological Workout History Feed */}
              <IOSListSection header="Logged Workouts" colors={colors}>
                {filteredHistory.map((workout, idx) => {
                  const isExpanded = expandedHistoryId === workout.id;
                  const needsVerification = !workout.isComplete && !workout.verifiedByUser;

                  return (
                    <div key={workout.id}>
                      <IOSListRow
                        onClick={() => setExpandedHistoryId(isExpanded ? null : workout.id)}
                        isLast={idx === filteredHistory.length - 1 && !isExpanded}
                        colors={colors}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {needsVerification && (
                              <span
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '4px',
                                  backgroundColor: colors.systemRed,
                                  flexShrink: 0
                                }}
                              />
                            )}
                            <span
                              style={{
                                ...IOS_TEXT.headline,
                                color: colors.label,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {workout.title}
                            </span>
                          </div>
                          <div style={{ ...IOS_TEXT.footnote, color: colors.secondaryLabel }}>
                            {new Date(workout.startedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}{' '}
                            • {workout.slots?.length || 0} Exercises
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {needsVerification && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                handleVerifyAndCompleteHistoryWorkout(workout.id);
                              }}
                              style={{
                                ...IOS_TEXT.caption1,
                                fontWeight: 600,
                                backgroundColor: colors.systemRed,
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '999px',
                                padding: '4px 10px',
                                cursor: 'pointer'
                              }}
                            >
                              Verify
                            </button>
                          )}
                          <SFSymbol
                            name={isExpanded ? 'chevron.up' : 'chevron.down'}
                            size={16}
                            color={colors.tertiaryLabel}
                          />
                        </div>
                      </IOSListRow>

                      {isExpanded && (
                        <div
                          style={{
                            backgroundColor: colors.tertiarySystemGroupedBackground,
                            padding: '8px 16px 12px',
                            borderBottom:
                              idx < filteredHistory.length - 1
                                ? `0.5px solid ${colors.separator}`
                                : 'none'
                          }}
                        >
                          {(workout.slots || []).map(slot => {
                            const ex1 = EXERCISE_MAP[slot.exerciseId];
                            return (
                              <div key={slot.id} style={{ marginTop: '8px' }}>
                                <div style={{ ...IOS_TEXT.subheadline, fontWeight: 600, color: colors.label }}>
                                  {ex1?.name || slot.exerciseId}
                                </div>
                                {(slot.sets || []).map(st => (
                                  <div
                                    key={st.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '4px 0'
                                    }}
                                  >
                                    <span style={{ ...IOS_TEXT.footnote, color: colors.secondaryLabel }}>
                                      Set {st.setNumber}: {st.weight} lb × {st.reps ?? 'Done'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleToggleHistorySet(workout.id, slot.id, false, st.id)
                                      }
                                      style={{
                                        ...IOS_TEXT.caption1,
                                        fontWeight: 600,
                                        color: st.completed ? colors.systemGreen : colors.systemRed,
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      {st.completed ? 'Completed' : 'Verify Set'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </IOSListSection>
            </div>
          )}

          {/* ================================================================ */}
          {/* VIEW 4: ACCOUNT / LOG IN / CREATE NEW USER (`Form`)              */}
          {/* ================================================================ */}
          {currentView === 'auth' && (
            <div>
              {user && (
                <IOSListSection header="Current Session" colors={colors}>
                  <IOSListRow colors={colors}>
                    <div>
                      <div style={{ ...IOS_TEXT.headline, color: colors.label }}>{user.email}</div>
                      <div style={{ ...IOS_TEXT.footnote, color: colors.secondaryLabel }}>
                        {supabaseCloud.isConfigured && user.accessToken
                          ? 'Connected to Supabase Cloud • Syncing History & 1RMs'
                          : 'Signed In • Local Browser Storage Mode'}
                      </div>
                    </div>
                    <SFSymbol name="checkmark.circle.fill" size={20} color={colors.systemGreen} />
                  </IOSListRow>
                  <IOSListRow
                    onClick={async () => {
                      if (user?.accessToken && supabaseCloud.isConfigured) {
                        await supabaseCloud.signOut(user.accessToken);
                      }
                      setUser(null);
                      setAuthEmail('');
                      setAuthPassword('');
                      setAuthConfirmPassword('');
                      triggerBanner('Signed out.', 'info');
                    }}
                    isLast
                    colors={colors}
                  >
                    <span style={{ ...IOS_TEXT.body, color: colors.systemRed }}>Sign Out</span>
                  </IOSListRow>
                </IOSListSection>
              )}

              <div style={{ padding: '0 16px 16px' }}>
                <IOSSegmentedControl
                  options={[
                    { label: 'Log In', value: 'login' },
                    { label: 'Create New User', value: 'signup' }
                  ]}
                  value={authMode}
                  onChange={setAuthMode}
                  colors={colors}
                />
              </div>

              <form
                onSubmit={async e => {
                  e.preventDefault();
                  const trimmedEmail = authEmail.trim();
                  if (!trimmedEmail) {
                    triggerBanner('Enter a valid email address.', 'warning');
                    return;
                  }
                  if (authMode === 'signup') {
                    if (authPassword.length < 6) {
                      triggerBanner('Password must be at least 6 characters.', 'warning');
                      return;
                    }
                    if (authPassword !== authConfirmPassword) {
                      triggerBanner('Passwords do not match.', 'warning');
                      return;
                    }
                  }

                  setAuthLoading(true);
                  try {
                    if (supabaseCloud.isConfigured) {
                      if (authMode === 'signup') {
                        const data = await supabaseCloud.signUp(
                          trimmedEmail,
                          authPassword,
                          authName.trim() || trimmedEmail.split('@')[0]
                        );
                        const supaUser = data.user || data.session?.user;
                        const token = data.access_token || data.session?.access_token;
                        if (!token) {
                          triggerBanner(
                            'Check your email to confirm your account, or disable Confirm Email in Supabase Auth settings.',
                            'info'
                          );
                          setAuthLoading(false);
                          return;
                        }
                        const newUser = {
                          id: supaUser.id,
                          email: supaUser.email,
                          name: authName.trim() || trimmedEmail.split('@')[0],
                          accessToken: token
                        };
                        setUser(newUser);
                        await supabaseCloud.upsertProfile(newUser, oneRepMaxes);
                        setCurrentView('home');
                        triggerBanner(`Cloud account created for ${newUser.email}.`, 'success');
                      } else {
                        const data = await supabaseCloud.signIn(trimmedEmail, authPassword);
                        const loggedInUser = {
                          id: data.user.id,
                          email: data.user.email,
                          name:
                            data.user.user_metadata?.display_name ||
                            trimmedEmail.split('@')[0],
                          accessToken: data.access_token
                        };
                        setUser(loggedInUser);
                        setCurrentView('home');
                        triggerBanner(`Signed in as ${loggedInUser.email}.`, 'success');
                      }
                    } else {
                      // Local preview fallback when NEXT_PUBLIC_SUPABASE_URL is not configured yet
                      const localUser = {
                        id: `usr_${Date.now()}`,
                        email: trimmedEmail,
                        name: authName.trim() || trimmedEmail.split('@')[0]
                      };
                      setUser(localUser);
                      setCurrentView('home');
                      triggerBanner(
                        authMode === 'signup'
                          ? `Account created for ${localUser.email}.`
                          : `Signed in as ${localUser.email}.`,
                        'success'
                      );
                    }
                  } catch (err) {
                    triggerBanner(err.message || 'Authentication error.', 'warning');
                  } finally {
                    setAuthLoading(false);
                  }
                }}
              >
                <IOSListSection
                  header={authMode === 'login' ? 'Credentials' : 'New User Profile'}
                  footer="Guest users can calculate 1RMs and run workouts freely. Signing in stores historical workouts and automatically recalculates 1RMs."
                  colors={colors}
                >
                  {authMode === 'signup' && (
                    <IOSListRow colors={colors}>
                      <span style={{ ...IOS_TEXT.body, color: colors.label, width: '95px' }}>
                        Name
                      </span>
                      <input
                        type="text"
                        placeholder="Optional"
                        value={authName}
                        onChange={e => setAuthName(e.target.value)}
                        style={{
                          ...IOS_TEXT.body,
                          color: colors.label,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          flex: 1
                        }}
                      />
                    </IOSListRow>
                  )}

                  <IOSListRow colors={colors}>
                    <span style={{ ...IOS_TEXT.body, color: colors.label, width: '95px' }}>
                      Email
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="you@domain.com"
                      value={authEmail}
                      onChange={e => setAuthEmail(e.target.value)}
                      style={{
                        ...IOS_TEXT.body,
                        color: colors.label,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        flex: 1
                      }}
                    />
                  </IOSListRow>

                  <IOSListRow isLast={authMode === 'login'} colors={colors}>
                    <span style={{ ...IOS_TEXT.body, color: colors.label, width: '95px' }}>
                      Password
                    </span>
                    <input
                      type="password"
                      required
                      placeholder="Required"
                      value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                      style={{
                        ...IOS_TEXT.body,
                        color: colors.label,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        flex: 1
                      }}
                    />
                  </IOSListRow>

                  {authMode === 'signup' && (
                    <IOSListRow isLast colors={colors}>
                      <span style={{ ...IOS_TEXT.body, color: colors.label, width: '95px' }}>
                        Verify
                      </span>
                      <input
                        type="password"
                        required
                        placeholder="Confirm password"
                        value={authConfirmPassword}
                        onChange={e => setAuthConfirmPassword(e.target.value)}
                        style={{
                          ...IOS_TEXT.body,
                          color: colors.label,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          flex: 1
                        }}
                      />
                    </IOSListRow>
                  )}
                </IOSListSection>

                <div style={{ padding: '0 16px' }}>
                  <button
                    type="submit"
                    disabled={authLoading}
                    style={{
                      ...IOS_TEXT.headline,
                      width: '100%',
                      minHeight: '48px',
                      backgroundColor: colors.systemBlue,
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '12px',
                      opacity: authLoading ? 0.65 : 1,
                      cursor: authLoading ? 'wait' : 'pointer'
                    }}
                  >
                    {authLoading
                      ? 'Connecting...'
                      : authMode === 'login'
                      ? 'Log In'
                      : 'Create New User'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Native iOS Home Indicator (Only shown in Desktop frame preview) */}
        {!isRealMobileViewport && (
          <div
            style={{
              height: '22px',
              backgroundColor: colors.systemGroupedBackground,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <div
              style={{
                width: '134px',
                height: '5px',
                borderRadius: '2.5px',
                backgroundColor: colors.label,
                opacity: 0.25
              }}
            />
          </div>
        )}

        {/* ================================================================== */}
        {/* NATIVE iOS `ConfirmationDialog` (Action Sheet) FOR RESET / CANCEL  */}
        {/* ================================================================== */}
        {confirmAction && (
          <div
            onClick={() => setConfirmAction(null)}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 70,
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: '12px'
            }}
          >
            <div onClick={e => e.stopPropagation()} style={{ display: 'grid', gap: '8px' }}>
              <div
                style={{
                  backgroundColor: colors.secondarySystemGroupedBackground,
                  borderRadius: '14px',
                  overflow: 'hidden',
                  textAlign: 'center'
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: `0.5px solid ${colors.separator}`
                  }}
                >
                  <div style={{ ...IOS_TEXT.footnote, fontWeight: 600, color: colors.secondaryLabel }}>
                    {confirmAction === 'reset'
                      ? 'Clear and reset all exercises from this session?'
                      : 'Discard this workout session and return Home?'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={
                    confirmAction === 'reset'
                      ? handleConfirmResetSession
                      : handleConfirmCancelSession
                  }
                  style={{
                    ...IOS_TEXT.title3,
                    color: colors.systemRed,
                    width: '100%',
                    padding: '14px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {confirmAction === 'reset' ? 'Reset Session' : 'Discard Workout'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                style={{
                  ...IOS_TEXT.title3,
                  fontWeight: 600,
                  color: colors.systemBlue,
                  backgroundColor: colors.secondarySystemGroupedBackground,
                  borderRadius: '14px',
                  width: '100%',
                  padding: '14px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* SHEET 1: ADD EXERCISE SLOT (`Sheet`)                                 */}
      {/* ==================================================================== */}
      <IOSSheet
        isOpen={showAddSlotModal}
        onClose={() => setShowAddSlotModal(false)}
        title="Add Exercise"
        rightLabel="Add"
        onRightAction={handleAddManualSlot}
        colors={colors}
      >
        <IOSListSection header="Category" colors={colors}>
          {['Warm-Up Routine', 'Compound Lift', 'Supersets', 'Accessories', 'Abs'].map(
            (cat, idx, arr) => (
              <IOSListRow
                key={cat}
                isLast={idx === arr.length - 1}
                onClick={() => {
                  setNewSlotCategory(cat);
                  if (cat === 'Compound Lift') setNewSlotEx1('barbell_bench_press');
                  if (cat === 'Supersets') {
                    setNewSlotEx1('reverse_lunge');
                    setNewSlotEx2('front_flies');
                  }
                  if (cat === 'Accessories') setNewSlotEx1('barbell_bicep_curl');
                  if (cat === 'Abs') setNewSlotEx1('hollow_holds');
                }}
                colors={colors}
              >
                <span style={{ ...IOS_TEXT.body, color: colors.label }}>{cat}</span>
                {newSlotCategory === cat && (
                  <SFSymbol name="checkmark" size={17} color={colors.systemBlue} />
                )}
              </IOSListRow>
            )
          )}
        </IOSListSection>

        {newSlotCategory !== 'Warm-Up Routine' && (
          <IOSListSection header="Exercise & Progression" colors={colors}>
            <IOSListRow
              isLast={newSlotCategory === 'Abs' && newSlotCategory !== 'Supersets'}
              colors={colors}
            >
              <span style={{ ...IOS_TEXT.body, color: colors.label }}>Primary Lift</span>
              <select
                value={newSlotEx1}
                onChange={e => setNewSlotEx1(e.target.value)}
                style={{
                  ...IOS_TEXT.body,
                  color: colors.secondaryLabel,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  textAlign: 'right',
                  maxWidth: '200px'
                }}
              >
                {EXERCISE_LIBRARY.filter(e =>
                  newSlotCategory === 'Abs'
                    ? e.category === 'Abs'
                    : e.category !== 'Warm-Up Routine'
                ).map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.equipment})
                  </option>
                ))}
              </select>
            </IOSListRow>

            {newSlotCategory === 'Supersets' && (
              <IOSListRow colors={colors}>
                <span style={{ ...IOS_TEXT.body, color: colors.label }}>Paired Lift</span>
                <select
                  value={newSlotEx2}
                  onChange={e => setNewSlotEx2(e.target.value)}
                  style={{
                    ...IOS_TEXT.body,
                    color: colors.secondaryLabel,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    textAlign: 'right',
                    maxWidth: '200px'
                  }}
                >
                  {EXERCISE_LIBRARY.filter(e => e.category !== 'Warm-Up Routine').map(ex => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} ({ex.equipment})
                    </option>
                  ))}
                </select>
              </IOSListRow>
            )}

            {newSlotCategory !== 'Abs' && (
              <IOSListRow isLast colors={colors}>
                <span style={{ ...IOS_TEXT.body, color: colors.label }}>Scheme</span>
                <select
                  value={newSlotScheme}
                  onChange={e => setNewSlotScheme(e.target.value)}
                  style={{
                    ...IOS_TEXT.body,
                    color: colors.systemBlue,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    textAlign: 'right'
                  }}
                >
                  <option value="5x8">5x8</option>
                  <option value="5x5">5x5</option>
                  <option value="3x5">3x5</option>
                  <option value="Pyramid">Pyramid</option>
                  <option value="Reverse Pyramid">Reverse Pyramid</option>
                </select>
              </IOSListRow>
            )}
          </IOSListSection>
        )}
      </IOSSheet>

      {/* ==================================================================== */}
      {/* SHEET 1B: SAVE AS NEW WORKOUT (`Sheet`)                              */}
      {/* ==================================================================== */}
      <IOSSheet
        isOpen={showSavePresetModal}
        onClose={() => setShowSavePresetModal(false)}
        title="Save as New Workout"
        rightLabel="Save"
        onRightAction={handleSaveNewPreset}
        colors={colors}
      >
        <IOSListSection
          header="Workout Name"
          footer="Enter a name for this workout (defaults to today's date). It will appear in the Workout dropdown menu at the top of the session page."
          colors={colors}
        >
          <IOSListRow isLast colors={colors}>
            <span style={{ ...IOS_TEXT.body, color: colors.secondaryLabel }}>Name</span>
            <input
              type="text"
              value={newPresetName}
              onChange={e => setNewPresetName(e.target.value)}
              autoFocus
              style={{
                ...IOS_TEXT.body,
                fontWeight: 600,
                color: colors.label,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                textAlign: 'right',
                flex: 1
              }}
            />
          </IOSListRow>
        </IOSListSection>
      </IOSSheet>

      {/* ==================================================================== */}
      {/* SHEET 2: PLATE & WEIGHT INCREMENT CALCULATOR (`Sheet`)               */}
      {/* ==================================================================== */}
      <IOSSheet
        isOpen={Boolean(plateCalcTarget)}
        onClose={() => setPlateCalcTarget(null)}
        title={plateCalcTarget ? `${plateCalcTarget.exerciseName}` : 'Plate Calculator'}
        rightLabel="Apply"
        onRightAction={handleApplyCalculatedWeight}
        colors={colors}
      >
        {plateCalcTarget && (
          <>
            <div style={{ padding: '0 16px 12px', display: 'grid', gap: '8px' }}>
              <IOSSegmentedControl
                options={[
                  { label: 'LBS', value: 'lb' },
                  { label: 'KILOS (KG)', value: 'kg' }
                ]}
                value={calcUnit}
                onChange={u => {
                  setCalcUnit(u);
                  setCalcBarWeight(u === 'lb' ? 45 : 20);
                  setCalcPlatesPerSide([]);
                }}
                colors={colors}
              />

              <IOSSegmentedControl
                options={[
                  { label: 'Each Side', value: 'per_side' },
                  { label: 'Total Weight', value: 'total' }
                ]}
                value={calcMode}
                onChange={m => {
                  if (m === 'total') setCalcDirectTotal(computedPlateCalculatorTotal);
                  setCalcMode(m);
                }}
                colors={colors}
              />
            </div>

            <IOSListSection header="Calculated Total" colors={colors}>
              <IOSListRow isLast colors={colors}>
                <span style={{ ...IOS_TEXT.body, color: colors.secondaryLabel }}>
                  Set #{plateCalcTarget.setNumber} Weight
                </span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ ...IOS_TEXT.title2, color: colors.label }}>
                    {computedPlateCalculatorTotal} {calcUnit.toUpperCase()}
                  </div>
                  {calcUnit === 'kg' && (
                    <div style={{ ...IOS_TEXT.caption1, color: colors.secondaryLabel }}>
                      ≈ {Math.round(computedPlateCalculatorTotal * 2.20462 * 2) / 2} lb
                    </div>
                  )}
                </div>
              </IOSListRow>
            </IOSListSection>

            {calcMode === 'per_side' ? (
              <>
                <IOSListSection header="Barbell Weight" colors={colors}>
                  <IOSListRow isLast colors={colors}>
                    <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                      {(calcUnit === 'lb' ? [45, 35, 15, 0] : [20, 15, 10, 0]).map(bw => (
                        <button
                          key={bw}
                          type="button"
                          onClick={() => setCalcBarWeight(bw)}
                          style={{
                            ...IOS_TEXT.footnote,
                            fontWeight: 600,
                            flex: 1,
                            padding: '8px 4px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor:
                              calcBarWeight === bw ? colors.systemBlue : colors.tertiarySystemFill,
                            color: calcBarWeight === bw ? '#FFFFFF' : colors.label,
                            cursor: 'pointer'
                          }}
                        >
                          {bw} {calcUnit}
                        </button>
                      ))}
                    </div>
                  </IOSListRow>
                </IOSListSection>

                <IOSListSection header="Tap Plates to Add (Each Side)" colors={colors}>
                  <IOSListRow colors={colors}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '8px',
                        width: '100%',
                        padding: '4px 0'
                      }}
                    >
                      {(calcUnit === 'lb'
                        ? [
                            { val: 45, sub: '20.4 kg' },
                            { val: 35, sub: '15.9 kg' },
                            { val: 25, sub: '11.3 kg' },
                            { val: 10, sub: '4.5 kg' },
                            { val: 5, sub: '2.25 kg' },
                            { val: 2.5, sub: '1.25 kg' }
                          ]
                        : [
                            { val: 20, sub: '45 lb' },
                            { val: 15, sub: '35 lb' },
                            { val: 10, sub: '25 lb' },
                            { val: 5, sub: '10 lb' },
                            { val: 2.5, sub: '5 lb' },
                            { val: 1.25, sub: '2.5 lb' }
                          ]
                      ).map(plate => (
                        <button
                          key={plate.val}
                          type="button"
                          onClick={() => setCalcPlatesPerSide(prev => [...prev, plate.val])}
                          style={{
                            backgroundColor: colors.tertiarySystemFill,
                            border: 'none',
                            borderRadius: '10px',
                            padding: '10px 6px',
                            cursor: 'pointer',
                            textAlign: 'center'
                          }}
                        >
                          <div style={{ ...IOS_TEXT.headline, color: colors.label }}>
                            +{plate.val}
                          </div>
                          <div style={{ ...IOS_TEXT.caption2, color: colors.secondaryLabel }}>
                            {plate.sub}
                          </div>
                        </button>
                      ))}
                    </div>
                  </IOSListRow>

                  <IOSListRow isLast colors={colors}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
                      {calcPlatesPerSide.length === 0 ? (
                        <span style={{ ...IOS_TEXT.footnote, color: colors.secondaryLabel }}>
                          No plates loaded on each side
                        </span>
                      ) : (
                        calcPlatesPerSide.map((p, idx) => (
                          <button
                            key={`${p}_${idx}`}
                            type="button"
                            onClick={() =>
                              setCalcPlatesPerSide(prev => prev.filter((_, i) => i !== idx))
                            }
                            style={{
                              ...IOS_TEXT.caption1,
                              fontWeight: 600,
                              backgroundColor: colors.systemBlue,
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              cursor: 'pointer'
                            }}
                          >
                            {p} {calcUnit} ×
                          </button>
                        ))
                      )}
                    </div>
                    {calcPlatesPerSide.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCalcPlatesPerSide([])}
                        style={{
                          ...IOS_TEXT.footnote,
                          color: colors.systemRed,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </IOSListRow>
                </IOSListSection>
              </>
            ) : (
              <IOSListSection header="Direct Weight Entry" colors={colors}>
                <IOSListRow isLast colors={colors}>
                  <span style={{ ...IOS_TEXT.body, color: colors.label }}>
                    Total ({calcUnit.toUpperCase()})
                  </span>
                  <input
                    type="number"
                    step="2.5"
                    value={calcDirectTotal}
                    onChange={e => setCalcDirectTotal(e.target.value)}
                    style={{
                      ...IOS_TEXT.title3,
                      color: colors.systemBlue,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      textAlign: 'right',
                      width: '120px'
                    }}
                  />
                </IOSListRow>
              </IOSListSection>
            )}
          </>
        )}
      </IOSSheet>

      {/* ==================================================================== */}
      {/* SHEET 3: 1RM SCHEME CALCULATOR (`Sheet`)                             */}
      {/* ==================================================================== */}
      <IOSSheet
        isOpen={Boolean(maxCalcTarget)}
        onClose={() => setMaxCalcTarget(null)}
        title={maxCalcTarget ? maxCalcTarget.name : '1RM Calculator'}
        rightLabel="Save"
        onRightAction={() => {
          if (!maxCalcTarget) return;
          const finalMax = Math.max(5, computedModal1RM || maxCalcTarget.currentMax);
          setOneRepMaxes(prev => ({ ...prev, [maxCalcTarget.id]: finalMax }));
          triggerBanner(`Saved ${maxCalcTarget.name} 1RM as ${finalMax} lb.`, 'success');
          setMaxCalcTarget(null);
        }}
        colors={colors}
      >
        {maxCalcTarget && (
          <>
            <div style={{ padding: '0 16px 16px' }}>
              <IOSSegmentedControl
                options={[
                  { label: 'From Scheme', value: 'scheme' },
                  { label: 'Direct 1RM', value: 'direct' }
                ]}
                value={maxCalcMode}
                onChange={m => {
                  if (m === 'direct') {
                    setMaxCalcDirectValue(String(computedModal1RM || maxCalcTarget.currentMax));
                  }
                  setMaxCalcMode(m);
                }}
                colors={colors}
              />
            </div>

            <IOSListSection header="Estimated 1 Rep Max" colors={colors}>
              <IOSListRow isLast colors={colors}>
                <span style={{ ...IOS_TEXT.body, color: colors.label }}>Calculated 1RM</span>
                <span style={{ ...IOS_TEXT.title2, color: colors.systemBlue }}>
                  {computedModal1RM} lb
                </span>
              </IOSListRow>
            </IOSListSection>

            {maxCalcMode === 'scheme' ? (
              <IOSListSection
                header="Scheme & Set Entries"
                footer="Select a scheme and enter specific weights and reps across sets (such as Pyramid or Reverse Pyramid). Tap any Weight box to use the Barbell Plate Calculator."
                colors={colors}
              >
                <IOSListRow colors={colors}>
                  <span style={{ ...IOS_TEXT.body, color: colors.label }}>Scheme</span>
                  <select
                    value={maxCalcScheme}
                    onChange={e => handleMaxCalcSchemeChange(e.target.value)}
                    style={{
                      ...IOS_TEXT.body,
                      color: colors.systemBlue,
                      fontWeight: 600,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      textAlign: 'right'
                    }}
                  >
                    <option value="5x8">5x8</option>
                    <option value="5x5">5x5</option>
                    <option value="3x5">3x5</option>
                    <option value="Pyramid">Pyramid</option>
                    <option value="Reverse Pyramid">Reverse Pyramid</option>
                  </select>
                </IOSListRow>

                {maxCalcSets.map((setItem, idx) => (
                  <IOSListRow
                    key={setItem.id}
                    isLast={idx === maxCalcSets.length - 1}
                    colors={colors}
                    padding="10px 16px"
                  >
                    <div
                      style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      {/* Line 1: Set Name */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          <span
                            style={{
                              ...IOS_TEXT.subheadline,
                              fontWeight: 600,
                              color: colors.label
                            }}
                          >
                            #{setItem.setNumber} {maxCalcTarget.name}
                          </span>
                          <span
                            style={{
                              ...IOS_TEXT.caption1,
                              color: colors.secondaryLabel,
                              marginLeft: '6px'
                            }}
                          >
                            ({setItem.type})
                          </span>
                        </div>
                      </div>

                      {/* Line 2: Weight Box (Launches Plate Calculator) & Reps Box */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '10px',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ ...IOS_TEXT.caption1, color: colors.secondaryLabel }}>
                            Weight
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              openPlateCalculator(
                                '__MAX_CALC__',
                                false,
                                setItem,
                                maxCalcTarget.name
                              )
                            }
                            style={{
                              ...IOS_TEXT.subheadline,
                              fontWeight: 600,
                              color: colors.systemBlue,
                              backgroundColor: colors.tertiarySystemFill,
                              border: 'none',
                              borderRadius: '8px',
                              padding: '5px 10px',
                              minWidth: '84px',
                              textAlign: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            {setItem.weight} lb
                          </button>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '6px'
                          }}
                        >
                          <input
                            type="number"
                            value={setItem.reps}
                            onChange={e =>
                              handleUpdateMaxCalcSet(setItem.id, 'reps', e.target.value)
                            }
                            style={{
                              ...IOS_TEXT.subheadline,
                              fontWeight: 600,
                              color: colors.label,
                              backgroundColor: colors.tertiarySystemFill,
                              border: 'none',
                              borderRadius: '8px',
                              width: '54px',
                              padding: '5px 6px',
                              textAlign: 'center',
                              outline: 'none'
                            }}
                          />
                          <span
                            style={{
                              ...IOS_TEXT.caption1,
                              color: colors.secondaryLabel,
                              minWidth: '28px'
                            }}
                          >
                            reps
                          </span>
                        </div>
                      </div>
                    </div>
                  </IOSListRow>
                ))}
              </IOSListSection>
            ) : (
              <IOSListSection header="Direct 1RM Entry" colors={colors}>
                <IOSListRow isLast colors={colors}>
                  <span style={{ ...IOS_TEXT.body, color: colors.label }}>1 Rep Max (lb)</span>
                  <input
                    type="number"
                    step="5"
                    value={maxCalcDirectValue}
                    onChange={e => setMaxCalcDirectValue(e.target.value)}
                    style={{
                      ...IOS_TEXT.title3,
                      color: colors.systemBlue,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      textAlign: 'right',
                      width: '100px'
                    }}
                  />
                </IOSListRow>
              </IOSListSection>
            )}
          </>
        )}
      </IOSSheet>
    </div>
  );
}