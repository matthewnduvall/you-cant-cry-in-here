import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// A fake recogniser that behaves like iPhone Safari's:
//   - stop() / abort() end it a little later (asynchronously);
//   - start() while a recogniser is still running, or within 200 ms of one ending, turns the mic on but hears nothing
//     (the dead-mic bug), until that session is aborted and started again later;
//   - `stuck` makes it ignore stop() / abort() altogether;
//   - a recogniser that has lost the mic (`loseMic()`: an `audio-capture` error, even while idle) is deaf for good
//     (logged on a real iPhone, 2026/11/22).
let running = 0;
let lastEndAt = -Infinity;
let instances = [];
let stuck = false;
class FakeRecognition {
  constructor() {
    this.live = false;
    this.starts = 0;
    instances.push(this);
  }
  start() {
    if (this.live) throw Object.assign(new Error('already started'), { name: 'InvalidStateError' });
    this.live = true;
    this.starts += 1;
    this.deaf = this.lostMic || running > 0 || Date.now() - lastEndAt < 200;
    running += 1;
    setTimeout(() => this.live && this.onstart?.(), 5);
  }
  abort() {
    this.aborts = (this.aborts || 0) + 1;
    if (stuck) return;
    setTimeout(() => this.end(), 50);
  }
  stop() {
    this.abort();
  }
  end() {
    if (!this.live) return;
    this.live = false;
    running -= 1;
    lastEndAt = Date.now();
    this.onend?.();
  }
  loseMic() {
    this.lostMic = true;
    this.onerror?.({ error: 'audio-capture' });
  }
  sound() {
    if (this.live) this.onsoundstart?.();
  }
  say(text) {
    if (!this.live || this.deaf) return;
    this.onresult?.({ results: [[{ transcript: text }]] });
  }
}

describe('speech controller', () => {
  let speech;
  beforeEach(async () => {
    vi.useFakeTimers();
    running = 0;
    lastEndAt = -Infinity;
    instances = [];
    stuck = false;
    globalThis.window = { SpeechRecognition: FakeRecognition };
    vi.resetModules();
    speech = await import('../app/utils/speech');
  });
  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.window;
  });
  const rec = () => instances[instances.length - 1];

  it('hands text over and reports the end once', () => {
    const heard = [];
    let ends = 0;
    speech.startSpeech({ onText: t => heard.push(t), onEnd: () => (ends += 1) });
    vi.advanceTimersByTime(10);
    rec().say('bench press 5x5');
    expect(heard).toEqual(['bench press 5x5']);
    rec().end();
    expect(ends).toBe(1);
  });

  it('every session gets a fresh recogniser', () => {
    for (let i = 0; i < 3; i += 1) {
      const s = speech.startSpeech({});
      vi.advanceTimersByTime(10);
      s.stop();
      vi.advanceTimersByTime(1000);
    }
    expect(instances).toHaveLength(3);
  });

  it('a recogniser that lost the mic while idle is never used again (the logged iPhone bug)', () => {
    const heard = [];
    speech.startSpeech({ onText: t => heard.push(t) });
    vi.advanceTimersByTime(10);
    rec().say('two sets of push-ups');
    rec().end(); // ends by itself after the words
    vi.advanceTimersByTime(20000);
    rec().loseMic(); // audio-capture, 22 s later, nothing listening
    speech.startSpeech({ onText: t => heard.push(t) });
    vi.advanceTimersByTime(1000);
    rec().say('curls');
    expect(heard).toEqual(['two sets of push-ups', 'curls']);
  });

  it('search, delete the card, search again: the second session hears (the dead-mic bug)', () => {
    const a = [];
    const b = [];
    const first = speech.startSpeech({ onText: t => a.push(t) });
    vi.advanceTimersByTime(10);
    rec().say('squat');
    first.stop(); // the card is deleted
    speech.startSpeech({ onText: t => b.push(t) }); // straight away, while the first is still ending
    vi.advanceTimersByTime(1000);
    rec().say('deadlift');
    expect(a).toEqual(['squat']);
    expect(b).toEqual(['deadlift']);
  });

  it('a new session replaces one that is still listening', () => {
    const a = [];
    const b = [];
    let aEnded = false;
    speech.startSpeech({ onText: t => a.push(t), onEnd: () => (aEnded = true) });
    vi.advanceTimersByTime(10);
    speech.startSpeech({ onText: t => b.push(t) });
    expect(aEnded).toBe(true);
    vi.advanceTimersByTime(1000);
    rec().say('curls');
    expect(a).toEqual([]);
    expect(b).toEqual(['curls']);
  });

  it('stop() reports the end at once and drops later words', () => {
    const heard = [];
    let ends = 0;
    const s = speech.startSpeech({ onText: t => heard.push(t), onEnd: () => (ends += 1) });
    vi.advanceTimersByTime(10);
    s.stop();
    expect(ends).toBe(1);
    rec().say('too late');
    vi.advanceTimersByTime(1000);
    expect(heard).toEqual([]);
    expect(ends).toBe(1);
  });

  it('a deaf mic is restarted by the watchdog once sound is heard without words', () => {
    const heard = [];
    lastEndAt = Date.now(); // something else just let go of the mic: this start will be deaf
    speech.startSpeech({ onText: t => heard.push(t) });
    vi.advanceTimersByTime(10);
    expect(rec().deaf).toBe(true);
    rec().sound();
    rec().say('lateral raise');
    expect(heard).toEqual([]);
    vi.advanceTimersByTime(speech.SOUND_WATCHDOG_MS + 1000);
    expect(instances).toHaveLength(2);
    rec().say('lateral raise');
    expect(heard).toEqual(['lateral raise']);
    expect(speech.getSpeechLog().some(e => e.type === 'speech_watchdog_restart')).toBe(true);
  });

  it('a recogniser that never ends is replaced by a fresh one', () => {
    const heard = [];
    speech.startSpeech({});
    vi.advanceTimersByTime(10);
    stuck = true;
    speech.startSpeech({ onText: t => heard.push(t) });
    vi.advanceTimersByTime(speech.HANDOVER_MS + 100);
    running = 0; // by the time it is replaced, the stuck one has let go of the mic
    vi.advanceTimersByTime(speech.HANDOVER_MS + 100);
    expect(instances).toHaveLength(2);
    rec().say('rows');
    expect(heard).toEqual(['rows']);
  });

  it('listens continuously and ends sessions itself with abort() (an iPhone session left to end keeps the mic)', () => {
    const s = speech.startSpeech({});
    vi.advanceTimersByTime(10);
    expect(rec().continuous).toBe(true);
    s.stop();
    expect(rec().aborts).toBe(1);
  });

  it('keeps a log of what the recogniser did, for FEEDBACK', () => {
    const s = speech.startSpeech({});
    vi.advanceTimersByTime(10);
    rec().onerror?.({ error: 'no-speech' });
    s.stop();
    vi.advanceTimersByTime(100);
    const types = speech.getSpeechLog().map(e => e.type);
    expect(types).toEqual(expect.arrayContaining(['speech_request', 'speech_start', 'speech_error', 'speech_stop', 'speech_end']));
    expect(speech.getSpeechLog().find(e => e.type === 'speech_error').detail).toBe('no-speech');
  });
});
