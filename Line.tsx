/**
 * One line on screen.
 *
 * Split out so the typewriter hook lives on the single line that is animating
 * rather than on the whole scrollback -- otherwise every new line restarts the
 * animation on all the ones above it.
 */

import { useTypewriter } from "./useTypewriter";
import type { Line as LineData } from "./types";

interface LineProps {
  line: LineData;
  onType?: () => void;
}

export function Line({ line, onType }: LineProps) {
  const { shown, done } = useTypewriter(line.text, {
    enabled: Boolean(line.typed),
    speed: line.kind === "prophecy" ? 55 : 240,
    onDone: onType,
  });

  return (
    <div className="line" data-kind={line.kind}>
      {line.typed ? shown : line.text}
      {line.typed && !done && <span className="line__cursor">▊</span>}
      {/* A non-breaking space keeps empty lines from collapsing to zero height. */}
      {!line.text && "\u00A0"}
    </div>
  );
}
