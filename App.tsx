/** The whole application: one terminal, centred, on a dark room. */

import { Terminal } from "./Terminal";

export function App() {
  return (
    <main className="room">
      <Terminal />
    </main>
  );
}
