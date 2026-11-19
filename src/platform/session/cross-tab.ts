// Tabs of this application tell each other two things, and never data (ADR-F05 decision 8; blueprint
// §12.4):
//   - `signed-out`: the session ended here, so every tab forgets it;
//   - `invalidate`: a command changed something, so every tab re-reads the named query roots.
// The channel is same-origin by construction. A message is validated before it is acted on: anything
// else on the channel is ignored.

export type CrossTabMessage = { type: 'signed-out' } | { type: 'invalidate'; roots: readonly string[] };

const CHANNEL = 'finapp-customer';
const ROOT = /^[a-z][a-z0-9-]{0,40}$/;

export function parseCrossTabMessage(data: unknown): CrossTabMessage | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const message = data as Record<string, unknown>;
  if (message['type'] === 'signed-out') return { type: 'signed-out' };
  const roots = message['roots'];
  if (message['type'] === 'invalidate' && Array.isArray(roots)) {
    const valid = roots.filter((r): r is string => typeof r === 'string' && ROOT.test(r));
    return valid.length > 0 ? { type: 'invalidate', roots: valid } : undefined;
  }
  return undefined;
}

export interface CrossTab {
  post(message: CrossTabMessage): void;
  close(): void;
}

/** Opens the channel; `onMessage` hears only other tabs (BroadcastChannel never echoes to its sender). */
export function openCrossTab(onMessage: (message: CrossTabMessage) => void): CrossTab {
  if (typeof BroadcastChannel === 'undefined') return { post: () => undefined, close: () => undefined };
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const message = parseCrossTabMessage(event.data);
    if (message !== undefined) onMessage(message);
  };
  return {
    post: (message) => channel.postMessage(message),
    close: () => channel.close(),
  };
}
