// One speech-to-text session for the whole app (Web Speech API: SpeechRecognition / webkitSpeechRecognition).
// Every exercise card's microphone goes through here, so only one recogniser ever runs: starting a new one stops the
// old one first and, if it is still shutting down, waits for it to end (iPhone Safari turns the microphone on for a
// second recogniser started while the first is still ending, but never sends it any words). Nothing is recorded or
// kept: results are handed to the caller as text.

const recogniserApi = () =>
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition || null : null;

/** True where the browser can turn speech into text. */
export const speechSupported = () => Boolean(recogniserApi());

let active = null;
// How long a new session waits for the previous recogniser to end before starting anyway
const HANDOVER_MS = 600;

/**
 * Starts listening. onText(text) gets the words so far (interim results); onEnd() runs when listening stops for any
 * reason (silence, an error, stop()). Returns { stop() }, or null where speech isn't supported.
 */
export function startSpeech({ onText, onEnd, lang = 'en-US' } = {}) {
  const Api = recogniserApi();
  if (!Api) return null;
  const session = { rec: null, stopped: false, ended: false };
  let endReported = false;
  const reportEnd = () => {
    if (endReported) return;
    endReported = true;
    onEnd?.();
  };
  const finish = () => {
    session.ended = true;
    if (active === session) active = null;
    reportEnd();
  };

  const launch = () => {
    if (session.stopped) return;
    try {
      const rec = new Api();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = e => {
        if (session.stopped) return;
        const text = [...e.results].map(r => r[0]?.transcript || '').join(' ').trim();
        if (text) onText?.(text);
      };
      rec.onerror = finish;
      rec.onend = finish;
      session.rec = rec;
      rec.start();
    } catch {
      finish();
    }
  };

  session.stop = () => {
    if (session.stopped) return;
    session.stopped = true;
    try {
      session.rec?.abort();
    } catch {
      // already ended
    }
    // abort() normally fires onend; report the end now either way so the button goes back at once
    if (active === session) active = null;
    reportEnd();
  };

  const previous = active;
  active = session;
  if (previous && !previous.ended && previous.rec) {
    // Hand over: stop the old recogniser and start once it has ended (or after HANDOVER_MS)
    let started = false;
    const go = () => {
      if (started) return;
      started = true;
      launch();
    };
    const previousEnd = previous.rec.onend;
    previous.rec.onend = ev => {
      previousEnd?.(ev);
      go();
    };
    previous.stop();
    setTimeout(go, HANDOVER_MS);
  } else {
    previous?.stop?.();
    launch();
  }
  return { stop: () => session.stop() };
}
