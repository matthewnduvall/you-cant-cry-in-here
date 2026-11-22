'use client';

// Performance page, under the lift rows: how well the engine predicts you (ACCURACY) and your rep curves (REP CURVE).
// Both come from page.js `predictionReport` (utils/modelLearning.js): the prediction replay over your History, the
// prediction log (set.plan) and the rep curves / rest effect learned from the sets you rate by hand.
// Numbers sit in readout strips (caps label over a light value); prose is one short line; empty states are words.

import React, { useState } from 'react';
import { CRY, UI } from '../styles/kineticTokens';
import { EXERCISE_MAP } from '../data/exerciseLibrary';
import { DEFAULT_REP_CURVE } from '../utils/intensity';
import { restFatigueFactor } from '../utils/workoutEngine';
import { MIN_FORECASTS, repsAtShare } from '../utils/modelLearning';

const ESTIMATOR_LABELS = { last: 'LAST', smooth: 'SMOOTHED', kalman: 'KALMAN' };
const ESTIMATOR_WORDS = { last: 'Last session', smooth: 'Smoothed', kalman: 'Kalman' };

const tile = { background: CRY.tile, borderRadius: CRY.radiusLg, overflow: 'hidden' };
const cellLabel = { ...UI.capsLabel, fontSize: '10px' };
const sentence = { ...UI.sentence, fontSize: '13px', color: CRY.textLabel, lineHeight: 1.45, margin: 0 };
const hairline = `1px solid ${CRY.hairline}`;
const pill = { ...UI.badge(true), fontSize: '9px', padding: '3px 8px', display: 'inline-block' };

const Heading = ({ children }) => <div style={{ ...UI.sectionTitle, margin: '24px 0 8px' }}>{children}</div>;

/** A readout strip: equal cells divided by hairlines, each a caps label over a light value (+ unit, + optional note). */
function Readouts({ cells, size = 24 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
      {cells.map((c, i) => (
        <div key={c.label} style={{ padding: '10px 14px 12px', borderLeft: i > 0 ? hairline : 'none' }}>
          <div style={cellLabel}>{c.label}</div>
          <div style={{ marginTop: '4px', whiteSpace: 'nowrap' }}>
            <span className="cr-num" style={{ fontSize: `${size}px`, fontWeight: 300, color: CRY.text }}>{c.value}</span>
            {c.unit && <span style={{ ...cellLabel, marginLeft: '4px' }}>{c.unit}</span>}
          </div>
          {c.note !== undefined && <div style={{ minHeight: '20px', marginTop: '4px' }}>{c.note}</div>}
        </div>
      ))}
    </div>
  );
}

const Note = ({ children, top = true }) => (
  <div style={{ padding: '10px 14px 12px', borderTop: top ? hairline : 'none' }}>
    <p style={sentence}>{children}</p>
  </div>
);

function AccuracyTile({ report }) {
  const inUse = report.best || 'smooth';
  const f = report.forecasts || {};
  const n = f.smooth?.n || 0;
  const reps = report.reps || {};
  const follow = report.follow || { n: 0 };
  const share = v => `${Math.round((v / follow.n) * 100)}`;
  const bias = f[inUse]?.bias || 0;
  return (
    <div style={tile}>
      <div style={{ padding: '12px 14px 0' }}>
        <div style={cellLabel}>FORECAST ERROR · NEXT SESSION 1RM</div>
      </div>
      {n === 0 ? (
        <Note top={false}>Log an exercise twice to see how well the app predicts your next session.</Note>
      ) : (
        <>
          <Readouts
            cells={['last', 'smooth', 'kalman'].map(m => ({
              label: ESTIMATOR_LABELS[m],
              value: `± ${(f[m].mae * 100).toFixed(1)}`,
              unit: '%',
              note: m === inUse ? <span style={pill}>IN USE</span> : null
            }))}
          />
          <Note>
            {n} forecasts · sessions ran {bias >= 0 ? '+' : '−'}
            {Math.abs(bias * 100).toFixed(1)} % vs forecast.{' '}
            {report.best ? `${ESTIMATOR_WORDS[inUse]} fits you best.` : `Smoothed until ${MIN_FORECASTS} forecasts.`}
          </Note>
        </>
      )}
      {reps.standard?.n > 0 && (
        <div style={{ borderTop: hairline }}>
          <div style={{ padding: '12px 14px 0' }}>
            <div style={cellLabel}>REP PREDICTION ERROR · {reps.standard.n} RATED SETS</div>
          </div>
          <Readouts
            cells={[
              { label: 'STANDARD CURVE', value: `± ${reps.standard.mae.toFixed(1)}`, unit: 'REPS' },
              { label: 'YOUR CURVE', value: `± ${reps.personal.mae.toFixed(1)}`, unit: 'REPS' }
            ]}
          />
        </div>
      )}
      <div style={{ borderTop: hairline }}>
        <div style={{ padding: '12px 14px 0' }}>
          <div style={cellLabel}>PLANNED VS DONE{follow.n > 0 ? ` · ${follow.n} SETS` : ''}</div>
        </div>
        {follow.n > 0 ? (
          <>
            <Readouts
              size={22}
              cells={[
                { label: 'AS PLANNED', value: share(follow.asPlanned), unit: '%' },
                { label: 'MORE REPS', value: share(follow.moreReps), unit: '%' },
                { label: 'FEWER REPS', value: share(follow.fewerReps), unit: '%' }
              ]}
            />
            <Note>
              Heavier than planned {share(follow.heavier)} % · lighter {share(follow.lighter)} %.
            </Note>
          </>
        ) : (
          <Note top={false}>Sets you finish from now on are compared with what the app planned.</Note>
        )}
      </div>
    </div>
  );
}

// The curve: % of 1RM (y) against reps to failure (x); the standard in grey (dashed when yours is drawn), yours in
// red, each labelled at its end
const Y_MIN = 60;
function RepCurveChart({ k }) {
  const W = 320;
  const H = 150;
  const pad = { l: 36, r: 66, t: 10, b: 30 };
  const xs = r => pad.l + ((r - 1) / 14) * (W - pad.l - pad.r);
  const ys = p => pad.t + ((100 - p) / (100 - Y_MIN)) * (H - pad.t - pad.b);
  const shareAt = (r, kk) => 100 / (1 + (r - 1) / kk);
  const path = kk =>
    Array.from({ length: 15 }, (_, i) => i + 1)
      .map((r, i) => `${i === 0 ? 'M' : 'L'}${xs(r).toFixed(1)},${ys(shareAt(r, kk)).toFixed(1)}`)
      .join(' ');
  const text = { fontSize: '11px', fill: CRY.textLabel, fontFamily: 'var(--cr-face-display)' };
  // End labels: kept apart when the two curves end close together
  let yStd = ys(shareAt(15, DEFAULT_REP_CURVE));
  let yMine = k ? ys(shareAt(15, k)) : null;
  if (yMine !== null && Math.abs(yMine - yStd) < 13) {
    const mid = (yMine + yStd) / 2;
    const up = yMine < yStd ? -1 : 1;
    yMine = mid + up * 6.5;
    yStd = mid - up * 6.5;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Rep curve: % of 1RM by reps to failure">
      {[100, 90, 80, 70, 60].map(p => (
        <g key={p}>
          <line x1={pad.l} x2={W - pad.r} y1={ys(p)} y2={ys(p)} stroke={CRY.hairline} strokeWidth="1" />
          <text x={pad.l - 6} y={ys(p) + 4} textAnchor="end" style={text}>{p}%</text>
        </g>
      ))}
      {[1, 5, 10, 15].map(r => (
        <text key={r} x={xs(r)} y={H - 14} textAnchor="middle" style={text}>{r}</text>
      ))}
      <text x={(pad.l + W - pad.r) / 2} y={H - 1} textAnchor="middle" style={{ ...text, letterSpacing: '0.1em' }}>REPS</text>
      <path d={path(DEFAULT_REP_CURVE)} fill="none" stroke={CRY.textDim} strokeWidth="1.5" strokeDasharray={k ? '4 3' : undefined} />
      <text x={xs(15) + 6} y={yStd + 4} style={text}>STANDARD</text>
      {k && (
        <>
          <path d={path(k)} fill="none" stroke={CRY.redText} strokeWidth="2.5" />
          <text x={xs(15) + 6} y={yMine + 4} style={{ ...text, fill: CRY.text }}>YOU</text>
        </>
      )}
    </svg>
  );
}

function RepCurveTile({ repCurves, highlightId, rest }) {
  const learned = Object.entries(repCurves || {}).sort((a, b) => b[1].pairs - a[1].pairs);
  // Which lift's curve is drawn: one tapped in the list, else the selected lift on the chart, else the most data
  const [picked, setPicked] = useState(null);
  const shownId = repCurves?.[picked] ? picked : repCurves?.[highlightId] ? highlightId : learned[0]?.[0] || null;
  const shown = shownId ? repCurves[shownId] : null;
  const nameOf = id => EXERCISE_MAP[id]?.name || id;
  const at80 = kk => repsAtShare(0.8, kk).toFixed(1);
  const restAt = sec => restFatigueFactor(sec, rest?.exponent).toFixed(1);
  return (
    <div style={tile}>
      <div style={{ padding: '12px 14px 0' }}>
        <div style={cellLabel}>% OF 1RM BY REPS TO FAILURE{shown ? ` · ${nameOf(shownId).toUpperCase()}` : ''}</div>
      </div>
      <div style={{ padding: '6px 8px 0' }}>
        <RepCurveChart k={shown?.k || null} />
      </div>
      {shown ? (
        <Readouts
          cells={[
            { label: 'YOU @ 80 %', value: at80(shown.k), unit: 'REPS' },
            { label: 'STANDARD @ 80 %', value: at80(DEFAULT_REP_CURVE), unit: 'REPS' }
          ]}
        />
      ) : (
        <Note top={false}>Rate the effort of sets at different reps (say 5 and 10) to learn your own curve.</Note>
      )}
      {shown && <Note>From {shown.pairs} pairs of sets you rated · plans and estimates use it.</Note>}
      {learned.length > 1 && (
        <div role="group" aria-label="Lifts with a learned curve" style={{ borderTop: hairline }}>
          {learned.map(([id, c], i) => {
            const on = id === shownId;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(id)}
                style={{
                  width: '100%',
                  minHeight: '52px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '0 14px',
                  border: 'none',
                  borderTop: i > 0 ? hairline : 'none',
                  background: on ? CRY.text : 'transparent',
                  color: on ? '#000' : CRY.text,
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <span style={{ ...UI.sentence, fontSize: '15px', color: 'inherit' }}>{nameOf(id)}</span>
                <span className="cr-num" style={{ ...cellLabel, color: on ? '#000' : CRY.textLabel, whiteSpace: 'nowrap' }}>
                  {at80(c.k)} REPS @ 80 %
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div style={{ borderTop: hairline }}>
        <div style={{ padding: '12px 14px 0' }}>
          <div style={cellLabel}>FATIGUE BY REST{rest ? ` · ${rest.pairs} PAIRS` : ' · DEFAULT'}</div>
        </div>
        <Readouts
          size={22}
          cells={[
            { label: '0:45', value: `${restAt(45)}×` },
            { label: '1:30', value: `${restAt(90)}×` },
            { label: '3:00', value: `${restAt(180)}×` }
          ]}
        />
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
