'use client';

// Performance page, under the lift rows: how well the engine predicts you (ACCURACY) and your rep curves (REP CURVE).
// Both come from page.js `predictionReport` (utils/modelLearning.js): the prediction replay over your History, the
// prediction log (set.plan) and the rep curves / rest effect learned from the sets you rate by hand.

import React from 'react';
import { CRY, UI } from '../styles/kineticTokens';
import { EXERCISE_MAP } from '../data/exerciseLibrary';
import { DEFAULT_REP_CURVE } from '../utils/intensity';
import { MIN_FORECASTS, repsAtShare } from '../utils/modelLearning';

const ESTIMATOR_LABELS = { last: 'LAST', smooth: 'SMOOTHED', kalman: 'KALMAN' };
const pct = v => (v === null || v === undefined ? '—' : `${(Math.abs(v) * 100).toFixed(1)}`);
const signedPct = v => (v === null || v === undefined ? '—' : `${v >= 0 ? '+' : '−'}${(Math.abs(v) * 100).toFixed(1)} %`);

const tile = { background: CRY.tile, borderRadius: CRY.radiusLg, overflow: 'hidden' };
const cellLabel = { ...UI.capsLabel, fontSize: '10px' };
const sentence = { ...UI.sentence, fontSize: '13px', color: CRY.textLabel, lineHeight: 1.45, margin: 0 };
const hairline = `1px solid ${CRY.hairline}`;

const Heading = ({ children }) => <div style={{ ...UI.sectionTitle, margin: '24px 0 8px' }}>{children}</div>;

function AccuracyTile({ report }) {
  const inUse = report.best || 'smooth';
  const f = report.forecasts || {};
  const n = f.smooth?.n || 0;
  const reps = report.reps || {};
  const follow = report.follow || { n: 0 };
  return (
    <div style={tile}>
      {/* 1RM forecast error by estimator: a readout strip, the one in use marked */}
      <div style={{ padding: '12px 14px 4px' }}>
        <div style={cellLabel}>NEXT-SESSION 1RM FORECAST · AVERAGE ERROR</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {['last', 'smooth', 'kalman'].map((m, i) => (
          <div key={m} style={{ padding: '8px 14px 12px', borderLeft: i > 0 ? hairline : 'none' }}>
            <div style={cellLabel}>{ESTIMATOR_LABELS[m]}</div>
            <div style={{ marginTop: '4px', whiteSpace: 'nowrap' }}>
              <span className="cr-num" style={{ fontSize: '24px', fontWeight: 300, color: CRY.text }}>± {pct(f[m]?.mae)}</span>
              {f[m]?.mae !== null && f[m]?.mae !== undefined && <span style={{ ...cellLabel, marginLeft: '3px' }}>%</span>}
            </div>
            {/* The one the app plans from: a white pill under its number */}
            <div style={{ minHeight: '20px', marginTop: '4px' }}>
              {m === inUse && n > 0 && (
                <span style={{ ...UI.badge, background: CRY.text, color: '#000', fontSize: '9px', padding: '3px 8px' }}>IN USE</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 14px 12px', borderTop: hairline }}>
        <p style={sentence}>
          {n === 0
            ? 'Log an exercise twice to see how well the app forecasts your next session.'
            : `From ${n} forecast${n === 1 ? '' : 's'}: each session's 1RM predicted from only the sessions before it. ` +
              `Sessions came in ${signedPct(f[inUse]?.bias)} against the forecast on average. ` +
              (report.best
                ? `${ESTIMATOR_LABELS[inUse].charAt(0) + ESTIMATOR_LABELS[inUse].slice(1).toLowerCase()} forecasts you best, so the app plans from it.`
                : `The app plans from the smoothed estimate until there are ${MIN_FORECASTS} forecasts to compare.`)}
        </p>
      </div>
      {/* Reps: standard curve vs yours, on the sets you rated */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', borderTop: hairline }}>
        {[
          ['standard', 'REPS · STANDARD CURVE'],
          ['personal', 'REPS · YOUR CURVE']
        ].map(([key, label], i) => (
          <div key={key} style={{ padding: '10px 14px 12px', borderLeft: i > 0 ? hairline : 'none' }}>
            <div style={cellLabel}>{label}</div>
            <div style={{ marginTop: '4px', whiteSpace: 'nowrap' }}>
              <span className="cr-num" style={{ fontSize: '22px', fontWeight: 300, color: CRY.text }}>
                {reps[key]?.mae === null || reps[key]?.mae === undefined ? '—' : `± ${reps[key].mae.toFixed(1)}`}
              </span>
              {reps[key]?.mae !== null && reps[key]?.mae !== undefined && <span style={{ ...cellLabel, marginLeft: '4px' }}>REPS</span>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '0 14px 12px' }}>
        <p style={sentence}>
          {reps.standard?.n
            ? `Reps you had to failure (reps + RIR) on ${reps.standard.n} set${reps.standard.n === 1 ? '' : 's'} you rated, predicted from the forecast.`
            : 'Rate a set’s effort (its INTENSITY) by hand to check how well your reps are predicted.'}
        </p>
      </div>
      {/* The prediction log: what was planned vs what was done */}
      <div style={{ padding: '10px 14px 12px', borderTop: hairline }}>
        <div style={cellLabel}>PLANNED VS DONE</div>
        <p style={{ ...sentence, marginTop: '4px' }}>
          {follow.n > 0
            ? `${follow.n} working set${follow.n === 1 ? '' : 's'} logged with the app's plan: ${Math.round((follow.asPlanned / follow.n) * 100)} % as planned, ` +
              `${Math.round((follow.moreReps / follow.n) * 100)} % more reps, ${Math.round((follow.fewerReps / follow.n) * 100)} % fewer, ` +
              `${Math.round((follow.heavier / follow.n) * 100)} % heavier, ${Math.round((follow.lighter / follow.n) * 100)} % lighter.`
            : 'Sets you finish from now on keep what the app planned, so this shows how often you did it.'}
        </p>
      </div>
    </div>
  );
}

// The curve: % of 1RM (y) for 1–15 reps to failure (x), the standard one in grey and yours in red
function RepCurveChart({ k }) {
  const W = 320;
  const H = 150;
  const pad = { l: 34, r: 10, t: 10, b: 24 };
  const xs = r => pad.l + ((r - 1) / 14) * (W - pad.l - pad.r);
  const yMin = 50;
  const ys = p => pad.t + ((100 - p) / (100 - yMin)) * (H - pad.t - pad.b);
  const shareAt = (r, kk) => 100 / (1 + (r - 1) / kk);
  const path = kk =>
    Array.from({ length: 15 }, (_, i) => i + 1)
      .map((r, i) => `${i === 0 ? 'M' : 'L'}${xs(r).toFixed(1)},${ys(shareAt(r, kk)).toFixed(1)}`)
      .join(' ');
  const text = { fontSize: '11px', fill: CRY.textLabel, fontFamily: 'var(--cr-face-display)' };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Rep curve">
      {[100, 90, 80, 70, 60, 50].map(p => (
        <g key={p}>
          <line x1={pad.l} x2={W - pad.r} y1={ys(p)} y2={ys(p)} stroke={CRY.hairline} strokeWidth="1" />
          <text x={pad.l - 6} y={ys(p) + 4} textAnchor="end" style={text}>{p}%</text>
        </g>
      ))}
      {[1, 5, 10, 15].map(r => (
        <text key={r} x={xs(r)} y={H - 6} textAnchor="middle" style={text}>{r}</text>
      ))}
      <path d={path(DEFAULT_REP_CURVE)} fill="none" stroke={CRY.textDim} strokeWidth="1.5" strokeDasharray={k ? '4 3' : undefined} />
      {k && <path d={path(k)} fill="none" stroke={CRY.redText} strokeWidth="2.5" />}
    </svg>
  );
}

function RepCurveTile({ repCurves, highlightId, rest }) {
  const learned = Object.entries(repCurves || {}).sort((a, b) => b[1].pairs - a[1].pairs);
  const shownId = repCurves?.[highlightId] ? highlightId : learned[0]?.[0] || null;
  const shown = shownId ? repCurves[shownId] : null;
  const nameOf = id => EXERCISE_MAP[id]?.name || id;
  const at80 = kk => repsAtShare(0.8, kk);
  return (
    <div style={tile}>
      <div style={{ padding: '12px 14px 0' }}>
        <div style={cellLabel}>{shown ? `REPS TO FAILURE · ${nameOf(shownId).toUpperCase()}` : 'REPS TO FAILURE · STANDARD'}</div>
      </div>
      <div style={{ padding: '6px 8px 0' }}>
        <RepCurveChart k={shown?.k || null} />
      </div>
      <div style={{ padding: '4px 14px 12px' }}>
        <p style={sentence}>
          {shown
            ? `At 80 % of your 1RM you get about ${at80(shown.k).toFixed(1)} reps on ${nameOf(shownId)}; the standard curve says ${at80(DEFAULT_REP_CURVE).toFixed(1)}. ` +
              `Learned from ${shown.pairs} pairs of sets you rated (k ${shown.k}, standard ${DEFAULT_REP_CURVE}); the app plans and estimates this lift with it.`
            : 'Everyone starts on the standard curve (grey): 1RM = weight × (1 + (reps + RIR − 1) ÷ 30). Rate the effort of sets at different reps (say 5 and 10) by hand and your own curve is learned per lift.'}
        </p>
      </div>
      {learned.length > 0 && (
        <div style={{ borderTop: hairline }}>
          {learned.map(([id, c]) => (
            <div
              key={id}
              style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', borderTop: id === learned[0][0] ? 'none' : hairline }}
            >
              <span style={{ ...UI.sentence, fontSize: '15px', color: CRY.text }}>{nameOf(id)}</span>
              <span className="cr-num" style={{ ...cellLabel, fontSize: '11px', whiteSpace: 'nowrap', alignSelf: 'center' }}>
                {at80(c.k).toFixed(1)} REPS @ 80 % · K {c.k}
              </span>
            </div>
          ))}
        </div>
      )}
      <div style={{ padding: '10px 14px 12px', borderTop: hairline }}>
        <div style={cellLabel}>REST</div>
        <p style={{ ...sentence, marginTop: '4px' }}>
          {rest
            ? `Learned from ${rest.pairs} pairs of sets: a short rest costs you ${rest.exponent >= 0.5 ? 'as much or more' : 'less'} than average (exponent ${rest.exponent}). `
            : 'Shorter rest leaves more fatigue: 45 s counts about 1.4 × the fatigue of 1:30, 3:00 about 0.7 ×. '}
          The rest before each set you tick is recorded, so this is learned from your own sets.
        </p>
      </div>
    </div>
  );
}

export function PredictionAccuracy({ report, highlightId }) {
  if (!report) return null;
  return (
    <>
      <Heading>ACCURACY</Heading>
      <AccuracyTile report={report} />
      <Heading>REP CURVE</Heading>
      <RepCurveTile repCurves={report.repCurves} highlightId={highlightId} rest={report.rest} />
    </>
  );
}
