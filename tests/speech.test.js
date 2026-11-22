import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// A fake recogniser like iPhone Safari's: abort() ends it a little later (asynchronously), and a recogniser started
// while another is still running hears nothing.
let running = 0;
let instances = [];
class FakeRecognition {
  constructor() {
    this.heard = false;
    this.started = false;
    instances.push(this);
  }
  start() {
    this.started = true;
    this.deaf = running > 0;
    running += 1;
  }
  abort() {
    setTimeout(() => this.end(), 50);
  }
  stop() {
    this.abort();
  }
  end() {
    if (!this.started || this.ended) return;
    this.ended = true;
    running -= 1;
    this.onend?.();
  }
  say(text) {
    if (this.deaf || this.ended) return;
    this.onresult?.({ results: [[{ transcript: text }]] });
  }
}

describe('shared speech controller', () => {
  let startSpeech;
  beforeEach(async () => {
    vi.useFakeTimers();
    running = 0;
    instances = [];
    globalThis.window = { SpeechRecognition: FakeRecognition };
    vi.resetModules();
    ({ startSpeech } = await import('../app/utils/speech'));
  });
  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.window;
  });

  it('hands text over and reports the end', () => {
    const heard = [];
    let ended = false;
    startSpeech({ onText: t => heard.push(t), onEnd: () => (ended = true) });
    instances[0].say('bench press 5x5');
    expect(heard).toEqual(['bench press 5x5']);
    instances[0].end();
    expect(ended).toBe(true);
  });

  it('a new session waits for the old recogniser to end, so it can hear (the dead-mic bug)', () => {
    const a = [];
    const b = [];
    startSpeech({ onText: t => a.push(t) });
    startSpeech({ onText: t => b.push(t) });
    // The second recogniser hasn't started yet: the first is still ending
    expect(instances.length).toBe(1);
    vi.advanceTimersByTime(60);
    expect(instances.length).toBe(2);
    instances[1].say('squat');
    expect(b).toEqual(['squat']);
    expect(a).toEqual([]);
  });

  it('stop() reports the end at once and drops later words', () => {
    const heard = [];
    let ends = 0;
    const s = startSpeech({ onText: t => heard.push(t), onEnd: () => (ends += 1) });
    s.stop();
    expect(ends).toBe(1);
    instances[0].say('too late');
    vi.advanceTimersByTime(100);
    expect(heard).toEqual([]);
    expect(ends).toBe(1);
  });
});
