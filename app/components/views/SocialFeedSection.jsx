'use client';

// Home, below the readout tiles: CHALLENGES (yours and your friends'; JOIN / LEAVE, + NEW) and the FEED (posts by you
// and your friends: workouts and routines you posted, PRs posted automatically, challenges finished), each with
// reactions and comments. Data and actions come from useSocialFeed (page.js). Signed in only.

import React, { useEffect, useState } from 'react';
import { UI } from '../../styles/kineticTokens';
import { Button, CloseButton } from '../Controls';
import { ProfileAvatar } from '../ProfileAvatar';
import { ExercisePicker } from '../ExercisePicker';
import { useModalScrollLock } from '../../hooks/useModalScrollLock';
import { FEED_REACTIONS } from '../../hooks/useSocialFeed';
import {
  challengeKindOf,
  describeChallenge,
  challengeDaysLeft,
  challengeGoal,
  challengePeriodCount,
  challengePeriodEnd,
  challengePeriodOf,
  challengePeriodsPassed,
  CHALLENGE_PERIODS
} from '../../utils/challenges';
import { EXERCISE_MAP } from '../../data/exerciseLibrary';
import { oneRepMaxLabel } from '../../utils/workoutEngine';

const tile = { backgroundColor: '#1C1C1C', borderRadius: '14px', padding: '12px', boxSizing: 'border-box' };
const heading = { ...UI.sectionTitle, margin: '0 0 6px' };
const meta = { fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', color: '#9A9A9A', textTransform: 'uppercase' };
const smallBtn = {
  minHeight: '36px',
  padding: '0 12px',
  borderRadius: '10px',
  border: 'none',
  fontFamily: 'inherit',
  fontSize: '12px',
  fontWeight: 500,
  letterSpacing: '0.06em',
  cursor: 'pointer'
};
const greyTextBtn = { ...smallBtn, backgroundColor: 'transparent', color: '#9A9A9A', padding: '0 8px' };

/** "3H AGO", "2D AGO", "JUST NOW" — `nowMs` read after mount. */
const timeAgo = (iso, nowMs) => {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t) || !nowMs) return '';
  const mins = Math.max(0, Math.round((nowMs - t) / 60000));
  if (mins < 1) return 'JUST NOW';
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  return `${Math.round(hrs / 24)}D AGO`;
};
const fmtNum = (n, unit) => {
  const v = Math.round(Number(n) || 0).toLocaleString('en-US');
  return unit === 'LB' ? `${v} LB` : unit === 'REPS' ? `${v} REPS` : unit === 'SESSIONS' ? `${v} SESSIONS` : v;
};

// ---------------------------------------------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------------------------------------------

function ChallengeCard({ challenge, me, nowMs, canJoin, onJoin, onLeave, onDelete, myProgress = null }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const kind = challengeKindOf(challenge.kind);
  // Repeating (each day / week / month): progress = periods met in a row, out of all of them; one that passed unmet
  // ends the run
  const per = challengePeriodOf(challenge);
  const goal = challengeGoal(challenge);
  const periods = per ? challengePeriodCount(challenge) : 0;
  const passed = per ? challengePeriodsPassed(challenge, nowMs) : 0;
  const currentIdx = Math.min(periods - 1, passed);
  const currentAmount = per ? myProgress?.periodic?.amounts?.[currentIdx] ?? null : null;
  const daysLeft = challengeDaysLeft(challenge, nowMs);
  const ended = nowMs ? Date.parse(challenge.ends_at) < nowMs : false;
  const joined = challenge.participants.some(p => p.user_id === me);
  const mine = challenge.creator_id === me;
  const people = [...challenge.participants].sort((a, b) => b.progress - a.progress);
  return (
    <div style={tile}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...meta, marginBottom: '4px' }}>
            {kind.label}
            {per ? ` · ${per.each.toUpperCase()}` : ''} · {challenge.isPrivate ? 'JUST YOU' : `BY @${challenge.username || 'friend'}`} ·{' '}
            {ended ? 'ENDED' : daysLeft === null ? '' : daysLeft === 0 ? 'ENDS TODAY' : `${daysLeft}D LEFT`}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 500, color: '#FFFFFF', lineHeight: 1.3 }}>
            {challenge.title || describeChallenge(challenge)}
          </div>
          {challenge.title && <div style={{ ...UI.rowContents, marginTop: '2px' }}>{describeChallenge(challenge)}</div>}
        </div>
        {mine &&
          (confirmDelete ? (
            <span style={{ display: 'inline-flex', gap: '2px', flexShrink: 0 }}>
              <button type="button" style={{ ...greyTextBtn, color: 'var(--cr-red-text)' }} onClick={() => onDelete(challenge)}>
                DELETE
              </button>
              <button type="button" style={greyTextBtn} onClick={() => setConfirmDelete(false)}>
                KEEP
              </button>
            </span>
          ) : (
            <button type="button" aria-label="Delete this challenge" style={{ ...greyTextBtn, minWidth: '44px', minHeight: '44px', fontSize: '16px' }} onClick={() => setConfirmDelete(true)}>
              ✕
            </button>
          ))}
      </div>

      {/* Everyone who joined: progress toward the target (white bar on an outline track) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
        {people.length === 0 && <div style={{ ...UI.sentence, fontSize: '12px' }}>Nobody has joined yet.</div>}
        {people.map(p => {
          const share = Math.max(0, Math.min(1, goal > 0 ? p.progress / goal : 0));
          const value = per
            ? `${Math.round(p.progress)} / ${periods} ${per.units.toUpperCase()}`
            : `${challenge.kind === 'target_weight' ? `${oneRepMaxLabel(Math.round(p.progress), p.progress_calculated)} LB` : fmtNum(p.progress, kind.unit)} / ${fmtNum(challenge.target, kind.unit)}`;
          // A day / week / month passed without meeting the target: the run is over
          const missed = Boolean(per) && !p.completed_at && p.progress < passed;
          return (
            <div key={p.user_id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '13px', color: '#FFFFFF' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  @{p.username || 'friend'}
                  {p.user_id === me ? ' (you)' : ''}
                </span>
                <span className="cr-num" style={{ flexShrink: 0, color: p.completed_at ? '#FFFFFF' : missed ? '#8A8A8A' : '#BDBDBD' }}>
                  {p.completed_at ? 'DONE ✓ ' : missed ? `MISSED ${per.unit.toUpperCase()} ${Math.round(p.progress) + 1} · ` : ''}
                  {value}
                </span>
              </div>
              <div style={{ height: '4px', borderRadius: '2px', backgroundColor: '#3A3A3A', marginTop: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${share * 100}%`, height: '100%', backgroundColor: missed ? '#8A8A8A' : '#FFFFFF' }} />
              </div>
              {/* Your current day / week / month (still running): how far into its target you are */}
              {per && p.user_id === me && !p.completed_at && !missed && currentAmount !== null && passed < periods && (
                <div style={{ ...meta, marginTop: '4px' }}>
                  {per.unit.toUpperCase()} {currentIdx + 1}: {fmtNum(currentAmount, kind.unit)} / {fmtNum(challenge.target, kind.unit)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!ended && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
          {joined ? (
            !mine && (
              <button type="button" style={greyTextBtn} onClick={() => onLeave(challenge)}>
                LEAVE
              </button>
            )
          ) : canJoin ? (
            <button type="button" style={{ ...smallBtn, backgroundColor: '#FFFFFF', color: '#000000' }} onClick={() => onJoin(challenge)}>
              JOIN
            </button>
          ) : (
            <span style={{ ...UI.sentence, fontSize: '12px' }}>Share your stats with friends (Menu → Privacy) to join.</span>
          )}
        </div>
      )}
    </div>
  );
}

// Lengths of a whole-window challenge (repeating ones use CHALLENGE_PERIODS[period].lengths)
const DURATIONS = [7, 14, 30, 60];

function NewChallengeModal({ onCreate, onClose }) {
  useModalScrollLock(true);
  const [kind, setKind] = useState('total_reps');
  const [exerciseId, setExerciseId] = useState('barbell_bench_press');
  const [target, setTarget] = useState('');
  // in total (over the whole window), or each day / week / month (the target every period; not for a weight target)
  const [period, setPeriod] = useState('total');
  // The length picked for each pattern: days for total, else the number of periods
  const [lengths, setLengths] = useState({ total: 30, day: 30, week: 4, month: 3 });
  // Who it's for: your friends (they see it and can join) or just you (a challenge to yourself)
  const [audience, setAudience] = useState('friends');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const k = challengeKindOf(kind);
  const justMe = audience === 'me';
  const per = CHALLENGE_PERIODS[period] || null;
  const repeating = Boolean(per);
  const length = lengths[period];
  const targetNum = Number(target);
  const valid = targetNum > 0 && (!k.needsExercise || EXERCISE_MAP[exerciseId]);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    // A repeating challenge starts at midnight today (whole days / weeks / months); a total one starts now
    const start = new Date();
    if (per) start.setHours(0, 0, 0, 0);
    const end = new Date(per ? challengePeriodEnd(period, start.getTime(), length) : start.getTime() + length * 86400000);
    const res = await onCreate({
      kind,
      exerciseId: k.needsExercise ? exerciseId : null,
      target: targetNum,
      title,
      period: per ? period : 'total',
      isPrivate: justMe,
      startsAt: start.toISOString(),
      endsAt: end.toISOString()
    });
    setBusy(false);
    if (res?.ok) onClose();
    else if (res?.needsServerUpdate)
      setError(
        "The server isn't set up for repeating or personal challenges yet. Run the 2026-11-17 challenge migration in Supabase, or make an in-total challenge for your friends."
      );
    else setError("Couldn't create the challenge. Check your connection and try again.");
  };

  // The challenge is written as a sentence whose variables are dropdowns, starting "Challenge [my friends ▾ / myself ▾]
  // to …":
  //   [100] [reps ▾] of [Bodyweight Push-Up ▾] [in total ▾] [over 30 days ▾]
  //   [3] [sessions ▾] [each week ▾] [for 4 weeks ▾]
  //   [100] [reps ▾] of [Bodyweight Push-Up ▾] [each day ▾] [for 30 days ▾]   (also each month)
  //   [315] [lb 1RM ▾] on [Barbell Bench Press ▾] [within 30 days ▾]   (a weight target never repeats)
  const [pickingExercise, setPickingExercise] = useState(false);
  const chip = {
    height: '44px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#2A2A2A',
    color: '#FFFFFF',
    fontFamily: 'inherit',
    fontSize: '16px',
    fontWeight: 500,
    boxSizing: 'border-box',
    maxWidth: '100%'
  };
  const selectChip = { ...chip, width: 'auto', minWidth: 0, cursor: 'pointer' };
  const word = { fontSize: '18px', fontWeight: 300, color: '#FFFFFF', lineHeight: '44px' };
  const UNIT_OPTIONS = [
    { id: 'total_reps', label: 'reps' },
    { id: 'total_volume', label: 'lb lifted' },
    { id: 'target_weight', label: 'lb 1RM' },
    { id: 'sessions', label: 'sessions' }
  ];
  const placeholder = per
    ? period === 'day'
      ? kind === 'total_reps' ? '100' : kind === 'total_volume' ? '5000' : '1'
      : period === 'month'
        ? kind === 'total_reps' ? '1000' : kind === 'total_volume' ? '100000' : '12'
        : kind === 'total_reps' ? '300' : kind === 'total_volume' ? '25000' : '3'
    : kind === 'target_weight' ? '315' : kind === 'total_reps' ? '100' : kind === 'total_volume' ? '100000' : '12';
  const isWeight = kind === 'target_weight';
  const lengthOptions = per
    ? per.lengths.map(n => ({ value: n, label: `for ${n} ${n === 1 ? per.unit : per.units}` }))
    : DURATIONS.map(d => ({ value: d, label: `${isWeight ? 'within' : 'over'} ${d} days` }));

  return (
    <div style={{ ...UI.modalBackdrop, zIndex: 1300 }}>
      <div role="dialog" aria-label="New challenge" style={UI.modalCard('420px')}>
        <div style={UI.modalHeader}>
          <span>NEW CHALLENGE</span>
          <CloseButton onClick={onClose} />
        </div>
        <div style={{ ...UI.sentence, marginBottom: '12px' }}>
          {justMe
            ? 'Only you see it. Only workouts logged between now and the end count.'
            : 'Your friends see it and can join. Only workouts logged between now and the end count.'}
        </div>

        {/* The challenge, as a sentence */}
        <div
          aria-label="Challenge"
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '10px' }}
        >
          <span style={word}>Challenge</span>
          <select
            aria-label="Who it's for"
            className="kinetic-filter-select cr-sentence-select"
            value={audience}
            onChange={e => setAudience(e.target.value)}
            style={selectChip}
          >
            <option value="friends">my friends</option>
            <option value="me">myself</option>
          </select>
          <span style={word}>to</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label={`Target in ${k.unit.toLowerCase()}`}
            placeholder={placeholder}
            value={target}
            onChange={e => setTarget(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))}
            style={{
              ...chip,
              width: `calc(${Math.max(3, (target || placeholder).length)}ch + 24px)`,
              padding: '0 12px',
              textAlign: 'center',
              outline: 'none'
            }}
          />
          <select
            aria-label="What to count"
            className="kinetic-filter-select cr-sentence-select"
            value={kind}
            onChange={e => setKind(e.target.value)}
            style={selectChip}
          >
            {UNIT_OPTIONS.map(o => (
              <option key={o.id} value={o.id} disabled={repeating && o.id === 'target_weight'}>
                {o.label}
              </option>
            ))}
          </select>
          {k.needsExercise && (
            <>
              <span style={word}>{isWeight ? 'on' : 'of'}</span>
              <button
                type="button"
                aria-expanded={pickingExercise}
                aria-label="Exercise"
                onClick={() => setPickingExercise(v => !v)}
                style={{
                  ...selectChip,
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  overflow: 'hidden'
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {EXERCISE_MAP[exerciseId]?.name || 'Exercise'}
                </span>
                <span aria-hidden="true" style={{ color: '#9A9A9A', fontSize: '11px', flexShrink: 0 }}>
                  {pickingExercise ? '▴' : '▾'}
                </span>
              </button>
              {/* The exercise dropdown opens inside the sentence: it takes a full line of its own, and the rest of the
                  sentence carries on underneath it */}
              {pickingExercise && (
                <div style={{ flexBasis: '100%', margin: '2px 0', position: 'relative', overflow: 'visible' }}>
                  <ExercisePicker exerciseId={exerciseId} types={['Compound', 'Accessory']} onChange={setExerciseId} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" style={{ ...greyTextBtn, minHeight: '44px' }} onClick={() => setPickingExercise(false)}>
                      DONE ▴
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {!isWeight && (
            <select
              aria-label="Pattern"
              className="kinetic-filter-select cr-sentence-select"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              style={selectChip}
            >
              <option value="total">in total</option>
              {Object.values(CHALLENGE_PERIODS).map(o => (
                <option key={o.id} value={o.id}>
                  {o.each}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Length"
            className="kinetic-filter-select cr-sentence-select"
            value={length}
            onChange={e => {
              const n = Number(e.target.value);
              setLengths(l => ({ ...l, [period]: n }));
            }}
            style={selectChip}
          >
            {lengthOptions.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ ...UI.sentence, fontSize: '12px', marginBottom: '12px' }}>
          {per ? `Reach it ${per.each}, counted from today; a missed ${per.unit} ends the run.` : k.help}
        </div>

        <div style={{ ...UI.fieldLabel, marginBottom: '6px' }}>NAME (OPTIONAL)</div>
        <input
          type="text"
          aria-label="Challenge name"
          placeholder="e.g. November push-ups"
          maxLength={80}
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ ...UI.field, width: '100%', boxSizing: 'border-box', marginBottom: '14px' }}
        />

        {error && <div style={{ ...UI.sentence, color: 'var(--cr-red-text)', marginBottom: '10px' }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <Button variant="secondary" onClick={onClose}>
            CANCEL
          </Button>
          <Button variant="primary" disabled={!valid || busy} onClick={submit} style={{ opacity: !valid || busy ? 0.4 : 1 }}>
            {busy ? 'CREATING…' : 'CREATE'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------------------------------------------

function PostBody({ post }) {
  const p = post.payload || {};
  if (post.kind === 'pr') {
    const records = Array.isArray(p.records) ? p.records : [];
    return (
      <>
        <div style={{ ...meta, marginBottom: '4px' }}>{records.length === 1 ? 'NEW RECORD' : `${records.length} NEW RECORDS`}</div>
        {records.map(r => (
          <div key={r.exerciseId} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '15px', color: '#FFFFFF', padding: '2px 0' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
            <span className="cr-num" style={{ flexShrink: 0 }}>
              {oneRepMaxLabel(r.value, r.calculated)} LB <span style={{ ...meta, letterSpacing: 0 }}>WAS {r.previous}</span>
            </span>
          </div>
        ))}
      </>
    );
  }
  if (post.kind === 'challenge_done') {
    const k = challengeKindOf(p.kind);
    const doneChallenge = { kind: p.kind, exercise_id: p.exerciseId, target: p.target, period: p.period, starts_at: p.startsAt, ends_at: p.endsAt };
    const donePer = challengePeriodOf(doneChallenge);
    return (
      <>
        <div style={{ ...meta, marginBottom: '4px' }}>CHALLENGE DONE</div>
        <div style={{ fontSize: '15px', fontWeight: 500, color: '#FFFFFF' }}>
          {p.title || describeChallenge(doneChallenge)}
        </div>
        <div style={{ ...UI.rowContents, marginTop: '2px' }}>
          {donePer
            ? `${donePer.each[0].toUpperCase()}${donePer.each.slice(1)}: ${p.value} of ${challengePeriodCount(doneChallenge)}`
            : p.kind === 'target_weight'
              ? `${oneRepMaxLabel(p.value, p.calculated)} lb`
              : fmtNum(p.value, k.unit).toLowerCase()}
        </div>
      </>
    );
  }
  const exercises = Array.isArray(p.exercises) ? p.exercises : [];
  return (
    <>
      <div style={{ ...meta, marginBottom: '4px' }}>{post.kind === 'routine' ? 'ROUTINE' : 'WORKOUT'}</div>
      <div style={{ ...UI.sessionName, fontSize: '15px', color: '#FFFFFF' }}>{p.title || (post.kind === 'routine' ? 'Routine' : 'Workout')}</div>
      {exercises.length > 0 && (
        <div style={{ ...UI.rowContents, marginTop: '2px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {exercises.join(', ')}
        </div>
      )}
    </>
  );
}

function PostCard({ post, me, nowMs, photoOf, onReact, onComment, onDeleteComment, onDelete, onStart, onOpenProfile }) {
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mine = post.user_id === me;
  const canStart = !mine && (post.kind === 'workout' || post.kind === 'routine') && Array.isArray(post.payload?.slots) && post.payload.slots.length > 0;

  const send = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    const ok = await onComment(post, draft);
    setSending(false);
    if (ok) setDraft('');
  };

  return (
    <article style={tile} aria-label={`Post by @${post.username || 'friend'}`}>
      {/* Who and when */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <button
          type="button"
          onClick={() => onOpenProfile?.(post.user_id)}
          aria-label={`Open @${post.username || 'friend'}'s profile`}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
        >
          <ProfileAvatar photo={photoOf(post.user_id)} username={post.username || ''} size={32} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              @{post.username || 'friend'}
            </span>
            <span style={meta}>{timeAgo(post.created_at, nowMs)}</span>
          </span>
        </button>
        {mine &&
          (confirmDelete ? (
            <span style={{ display: 'inline-flex', gap: '2px', flexShrink: 0 }}>
              <button type="button" style={{ ...greyTextBtn, color: 'var(--cr-red-text)' }} onClick={() => onDelete(post)}>
                DELETE
              </button>
              <button type="button" style={greyTextBtn} onClick={() => setConfirmDelete(false)}>
                KEEP
              </button>
            </span>
          ) : (
            <button type="button" aria-label="Delete this post" style={{ ...greyTextBtn, minWidth: '44px', minHeight: '44px', fontSize: '16px' }} onClick={() => setConfirmDelete(true)}>
              ✕
            </button>
          ))}
      </div>

      {post.caption && <div style={{ fontSize: '14px', color: '#FFFFFF', lineHeight: 1.45, marginBottom: '8px', whiteSpace: 'pre-wrap' }}>{post.caption}</div>}
      <PostBody post={post} />
      {canStart && (
        <div style={{ marginTop: '10px' }}>
          <button type="button" style={{ ...smallBtn, backgroundColor: '#2A2A2A', color: '#FFFFFF' }} onClick={() => onStart(post)}>
            {post.kind === 'routine' ? 'LOAD' : 'START'}
          </button>
        </div>
      )}

      {/* Reactions (tap to add / remove yours), then the comments toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
        {FEED_REACTIONS.map(emoji => {
          const who = post.reactions.filter(r => r.emoji === emoji);
          const on = who.some(r => r.user_id === me);
          return (
            <button
              key={emoji}
              type="button"
              aria-pressed={on}
              aria-label={`${emoji} ${who.length}${on ? ', yours' : ''}`}
              title={who.map(r => `@${r.username || 'friend'}`).join(', ')}
              onClick={() => onReact(post, emoji)}
              style={{
                ...smallBtn,
                minHeight: '36px',
                minWidth: '52px',
                padding: '0 10px',
                borderRadius: '18px',
                backgroundColor: on ? '#FFFFFF' : '#2A2A2A',
                color: on ? '#000000' : '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '16px', lineHeight: 1 }}>{emoji}</span>
              {who.length > 0 && <span className="cr-num">{who.length}</span>}
            </button>
          );
        })}
        <button type="button" style={{ ...greyTextBtn, marginLeft: 'auto' }} aria-expanded={showComments} onClick={() => setShowComments(v => !v)}>
          {post.comments.length > 0 ? `${post.comments.length} ${post.comments.length === 1 ? 'COMMENT' : 'COMMENTS'}` : 'COMMENT'}
        </button>
      </div>

      {showComments && (
        <div style={{ marginTop: '10px', borderTop: '1px solid #2E2E2E', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {post.comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: '13px', lineHeight: 1.45, color: '#BDBDBD', overflowWrap: 'anywhere' }}>
                <span style={{ color: '#FFFFFF', fontWeight: 500 }}>@{c.username || 'friend'}</span> {c.body}
              </div>
              {(c.user_id === me || mine) && (
                <button type="button" aria-label="Delete this comment" style={{ ...greyTextBtn, minHeight: '28px', fontSize: '13px' }} onClick={() => onDeleteComment(c)}>
                  ✕
                </button>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              aria-label="Write a comment"
              placeholder="Write a comment"
              maxLength={500}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') send();
              }}
              style={{ ...UI.field, flex: 1, minWidth: 0 }}
            />
            <button
              type="button"
              disabled={!draft.trim() || sending}
              onClick={send}
              style={{ ...smallBtn, minHeight: '44px', backgroundColor: '#FFFFFF', color: '#000000', opacity: !draft.trim() || sending ? 0.4 : 1 }}
            >
              POST
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------------------------------------------

export function SocialFeedSection({
  user,
  social,
  // Your photo and your friends' ({ id, profilePhoto })
  profilePhoto = null,
  friendsList = [],
  shareStatsWithFriends = true,
  // A friend's posted workout / routine: START opens it as a preview; LOAD loads the routine
  onStartPost,
  onOpenProfile,
  onSignIn
}) {
  const [creating, setCreating] = useState(false);
  const [showEnded, setShowEnded] = useState(false);
  // "Now" for time-ago labels and days left: read after mount and every minute (never Date.now() in render)
  const [nowMs, setNowMs] = useState(null);
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  const wrap = { padding: '4px var(--dp-spacing-gutter) 16px', display: 'flex', flexDirection: 'column', gap: '8px' };

  if (!user) {
    return (
      <section aria-label="Feed" style={wrap}>
        <div style={heading}>FEED</div>
        <div style={{ ...tile, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={UI.sentence}>Sign in to see your friends&rsquo; workouts, records and challenges.</span>
          <button type="button" style={{ ...smallBtn, backgroundColor: '#FFFFFF', color: '#000000', flexShrink: 0, minHeight: '44px' }} onClick={onSignIn}>
            SIGN IN
          </button>
        </div>
      </section>
    );
  }
  if (!social.available) {
    return (
      <section aria-label="Feed" style={wrap}>
        <div style={heading}>FEED</div>
        <div style={{ ...tile, ...UI.sentence }}>The feed isn&rsquo;t set up on the server yet.</div>
      </section>
    );
  }

  const photoOf = id => (id === user.id ? profilePhoto : (friendsList || []).find(f => f?.id === id)?.profilePhoto || null);
  const ended = c => (nowMs ? Date.parse(c.ends_at) < nowMs : false);
  const active = social.challenges.filter(c => !ended(c));
  const finished = social.challenges.filter(ended);

  return (
    <>
      <section aria-label="Challenges" style={wrap}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ ...heading, margin: 0 }}>CHALLENGES</div>
          <button type="button" style={{ ...smallBtn, minHeight: '44px', backgroundColor: 'transparent', color: '#FFFFFF' }} onClick={() => setCreating(true)}>
            + NEW
          </button>
        </div>
        {active.length === 0 && (
          <div style={{ ...tile, ...UI.sentence }}>
            {social.loaded ? 'No challenges yet. Start one and your friends can join.' : 'Loading…'}
          </div>
        )}
        {active.map(c => (
          <ChallengeCard
            key={c.id}
            challenge={c}
            me={user.id}
            nowMs={nowMs}
            canJoin={shareStatsWithFriends}
            onJoin={social.joinChallenge}
            onLeave={social.leaveChallenge}
            onDelete={social.deleteChallenge}
            myProgress={social.myProgress?.[c.id] || null}
          />
        ))}
        {finished.length > 0 && (
          <button type="button" style={{ ...greyTextBtn, alignSelf: 'flex-start' }} aria-expanded={showEnded} onClick={() => setShowEnded(v => !v)}>
            {showEnded ? 'HIDE ENDED ▴' : `ENDED (${finished.length}) ▾`}
          </button>
        )}
        {showEnded &&
          finished.map(c => (
            <ChallengeCard key={c.id} challenge={c} me={user.id} nowMs={nowMs} canJoin={false} onJoin={() => {}} onLeave={() => {}} onDelete={social.deleteChallenge} />
          ))}
      </section>

      <section aria-label="Feed" style={wrap}>
        <div style={heading}>FEED</div>
        {social.error && <div style={{ ...tile, ...UI.sentence }}>{social.error}</div>}
        {social.posts.length === 0 && !social.error && (
          <div style={{ ...tile, ...UI.sentence }}>
            {social.loaded
              ? 'Nothing here yet. Turn on POST when you finish a workout, or set a record: it posts itself.'
              : 'Loading…'}
          </div>
        )}
        {social.posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            me={user.id}
            nowMs={nowMs}
            photoOf={photoOf}
            onReact={social.toggleReaction}
            onComment={social.addComment}
            onDeleteComment={social.removeComment}
            onDelete={social.removePost}
            onStart={onStartPost}
            onOpenProfile={onOpenProfile}
          />
        ))}
      </section>

      {creating && <NewChallengeModal onCreate={social.createChallenge} onClose={() => setCreating(false)} />}
    </>
  );
}

export default SocialFeedSection;
