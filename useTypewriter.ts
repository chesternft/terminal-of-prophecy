/**
 * Text that arrives one character at a time.
 *
 * Uses a timestamp-driven interval rather than one timeout per character:
 * a 300-character prophecy would otherwise schedule 300 timers, and any tab
 * throttling turns that into a stutter. One interval, and the count is derived
 * from elapsed time, so a throttled tab catches up instead of falling behind.
 */

import { useEffect, useRef, useState } from "react";

export interface TypewriterOptions {
  /** Characters per second. */
  speed?: number;
  enabled?: boolean;
  onDone?: () => void;
}

export function useTypewriter(text: string, options: TypewriterOptions = {}) {
  const { speed = 60, enabled = true, onDone } = options;
  const [count, setCount] = useState(enabled ? 0 : text.length);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!enabled) {
      setCount(text.length);
      return;
    }
    setCount(0);
    if (!text) {
      doneRef.current?.();
      return;
    }

    const start = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      const next = Math.floor(elapsed * speed);
      if (next >= text.length) {
        setCount(text.length);
        window.clearInterval(timer);
        doneRef.current?.();
      } else {
        setCount(next);
      }
    }, 1000 / Math.max(speed, 1));

    return () => window.clearInterval(timer);
  }, [text, speed, enabled]);

  return {
    shown: text.slice(0, count),
    done: count >= text.length,
    /** Let an impatient reader skip the animation. */
    skip: () => setCount(text.length),
  };
}
