/**
 * Keystroke sound.
 *
 * Raw WebAudio rather than a sample library: a click is 30ms of filtered noise,
 * and shipping an audio dependency plus a wav file to produce one is not a
 * trade worth making.
 *
 * Muted by default, and that is not negotiable. A page that makes noise before
 * you have asked it to is a page you close. Browsers agree -- an AudioContext
 * created before a user gesture starts suspended anyway.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "prophecy:sound";

export function useKeystrokes() {
  const [enabled, setEnabled] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const noiseRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    try {
      setEnabled(window.localStorage.getItem(STORAGE_KEY) === "on");
    } catch {
      // Private mode, or storage disabled. Silence is a fine default.
    }
  }, []);

  const context = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();

      // One second of white noise, generated once and reused for every click.
      const ctx = ctxRef.current;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      noiseRef.current = buffer;
    }
    return ctxRef.current;
  }, []);

  const click = useCallback(
    (pitch = 1) => {
      if (!enabled) return;
      const ctx = context();
      const buffer = noiseRef.current;
      if (!ctx || !buffer) return;
      if (ctx.state === "suspended") void ctx.resume();

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = pitch;

      // Band-pass turns white noise into something that reads as a keyswitch
      // rather than a burst of static.
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1400 + Math.random() * 900;
      filter.Q.value = 1.2;

      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start(now);
      source.stop(now + 0.06);
    },
    [context, enabled],
  );

  const toggle = useCallback(() => {
    setEnabled((was) => {
      const next = !was;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
      } catch {
        // Not worth failing the toggle over.
      }
      if (next) context()?.resume();
      return next;
    });
  }, [context]);

  return { enabled, toggle, click };
}
