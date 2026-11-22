// Speech-to-text for the whole app (Web Speech API: SpeechRecognition / webkitSpeechRecognition).
//
// iPhone Safari is fragile here: a recogniser started while a previous one hasn't really let go of the microphone turns
// the mic on (the system indicator shows) but never sends any words. So:
//   - ONE recogniser is created for the page and reused for every session (start() again after it has ended);
//   - its real state comes from its own events (start / end), never from what we asked it to do;
//   - a session asked for while it is still ending waits for its `end` (aborting it if it takes longer than
//     HANDOVER_MS, replacing it if even that doesn't end it) and RESTART_GAP_MS more, then starts;
//   - a watchdog restarts a session once if the mic is on but no words arrive (WATCHDOG_MS after start, or
//     SOUND_WATCHDOG_MS after sound is detected);
//   - every event is kept in a short log (getSpeechLog) that FEEDBACK sends with its diagnostics.
// Nothing is recorded or kept: results are handed to the caller as text.

const recogniserApi = () =>
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition || null : null;

/** True where the browser can turn speech into text. */
export const speechSupported = () => Boolean(recogniserApi());

export const HANDOVER_MS = 800;
export const WATCHDOG_MS = 6000;
export const SOUND_WATCHDOG_MS = 3500;
export const RESTART_GAP_MS = 300;

let rec = null; // the one recogniser
let engine = 'idle'; // 'idle' | 'starting' | 'listening' | 'ending' | 'cooldown' — from its events
let owner = null; // the session the recogniser is working for
let pending = null; // the session waiting for the recogniser to end
let watchdog = null;

// ---- the diagnostic log (merged into FEEDBACK's session logs by page.js)
const LOG_MAX = 60;
const log = [];
const note = (type, detail = '') => {
  log.push({ timestamp: new Date().toISOString(), type: `speech_${type}`, detail: String(detail).slice(0, 80) });
  if (log.length > LOG_MAX) log.shift();
};
export const getSpeechLog = () => log.slice();

// Waits for the recogniser to end, then starts `session`. If it hasn't ended after HANDOVER_MS it is aborted; if even
// that doesn't end it within another HANDOVER_MS, it is dropped and a fresh one starts (an iPhone recogniser can stick).
const queue = session => {
  pending = session;
  const abortIfStuck = () => {
    if (pending !== session || engine === 'idle' || engine === 'cooldown') return;
    note('handover_abort');
    try {
      rec?.abort();
    } catch {
      // already ended
    }
    setTimeout(() => {
      if (pending !== session || engine === 'idle' || engine === 'cooldown') return;
      note('handover_replace');
      if (rec) {
        rec.onstart = rec.onaudiostart = rec.onsoundstart = rec.onspeechstart = null;
        rec.onresult = rec.onnomatch = rec.onerror = rec.onend = null;
      }
      rec = null;
      engine = 'idle';
      owner = null;
      pending = null;
      begin(session);
    }, HANDOVER_MS);
  };
  setTimeout(abortIfStuck, HANDOVER_MS);
};

const clearWatchdog = () => {
  if (watchdog) clearTimeout(watchdog);
  watchdog = null;
};
// Restart the session once when the mic is on but nothing is heard (the iPhone's silent recogniser)
const armWatchdog = ms => {
  clearWatchdog();
  const session = owner;
  if (!session || session.restarted || session.heard) return;
  watchdog = setTimeout(() => {
    watchdog = null;
    if (owner !== session || session.stopped || session.heard) return;
    note('watchdog_restart');
    session.restarted = true;
    owner = null;
    engine = 'ending';
    queue(session);
    try {
      rec.abort();
    } catch {
      // already ended
    }
  }, ms);
};

const recogniser = () => {
  if (rec) return rec;
  const Api = recogniserApi();
  rec = new Api();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  rec.onstart = () => {
    engine = 'listening';
    note('start');
    armWatchdog(WATCHDOG_MS);
  };
  rec.onaudiostart = () => note('audiostart');
  rec.onsoundstart = () => {
    note('soundstart');
    if (owner && !owner.heard) armWatchdog(SOUND_WATCHDOG_MS);
  };
  rec.onspeechstart = () => note('speechstart');
  rec.onresult = e => {
    const text = [...(e?.results || [])].map(r => r?.[0]?.transcript || '').join(' ').trim();
    note('result', text);
    if (!text || !owner || owner.stopped) return;
    owner.heard = true;
    clearWatchdog();
    owner.onText?.(text);
  };
  rec.onnomatch = () => note('nomatch');
  rec.onerror = e => note('error', e?.error || e?.message || '');
  rec.onend = () => {
    note('end');
    clearWatchdog();
    const finished = owner;
    owner = null;
    if (finished && finished !== pending) finished.finish();
    // A short rest before the next start: an iPhone recogniser started the moment the last one ended can be deaf
    engine = 'cooldown';
    const ended = rec;
    setTimeout(() => {
      if (rec !== ended || engine !== 'cooldown') return;
      engine = 'idle';
      if (pending) {
        const next = pending;
        pending = null;
        begin(next);
      }
    }, RESTART_GAP_MS);
  };
  return rec;
};

const begin = session => {
  if (session.stopped) {
    session.finish();
    return;
  }
  owner = session;
  engine = 'starting';
  try {
    recogniser().start();
    note('start_called', session.restarted ? 'restart' : '');
  } catch (err) {
    // Still busy (InvalidStateError): wait for its end, then start
    note('start_failed', err?.name || '');
    owner = null;
    engine = 'ending';
    queue(session);
    try {
      rec?.abort();
    } catch {
      // nothing to abort
    }
  }
};

/**
 * Starts listening. onText(text) gets the words so far (interim results); onEnd() runs once when this session stops
 * listening for any reason. Returns { stop() }, or null where speech isn't supported.
 */
export function startSpeech({ onText, onEnd } = {}) {
  if (!recogniserApi()) return null;
  const session = { onText, onEnd, stopped: false, ended: false, heard: false, restarted: false };
  session.finish = () => {
    if (session.ended) return;
    session.ended = true;
    onEnd?.();
  };
  session.stop = () => {
    if (session.stopped) return;
    session.stopped = true;
    note('stop');
    if (pending === session) pending = null;
    if (owner === session) {
      clearWatchdog();
      engine = 'ending';
      try {
        // stop() lets the recogniser finish cleanly (abort() can leave an iPhone's mic half-held)
        rec.stop();
      } catch {
        // already ended
      }
    }
    session.finish();
  };

  // One session at a time: the newest wins
  if (owner && !owner.stopped) owner.stop();
  if (pending && pending !== session) {
    const waiting = pending;
    pending = null;
    waiting.stopped = true;
    waiting.finish();
  }
  note('request', engine);
  if (engine === 'idle') {
    begin(session);
  } else {
    queue(session);
  }
  return { stop: () => session.stop() };
}

/** For tests: forget the recogniser and its state. */
export const __resetSpeechForTests = () => {
  clearWatchdog();
  rec = null;
  engine = 'idle';
  owner = null;
  pending = null;
  log.length = 0;
};
