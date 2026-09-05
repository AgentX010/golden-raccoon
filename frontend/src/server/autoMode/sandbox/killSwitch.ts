export type KillSwitchScope = { chainFamily: "evm" | "stellar"; network: string };
export type KillSwitchState = KillSwitchScope & { engaged: boolean; actor?: string; reason?: string; engagedAt?: string; reenabledAt?: string };
export type KillSwitchStore = { read(scope: KillSwitchScope): Promise<KillSwitchState | undefined>; write(state: KillSwitchState): Promise<void> };

const states = new Map<string, KillSwitchState>();
const keyFor = (scope: KillSwitchScope) => `${scope.chainFamily}:${scope.network.trim().toLowerCase()}`;

export class MemoryKillSwitchStore implements KillSwitchStore {
  failReads = false;
  async read(scope: KillSwitchScope) {
    if (this.failReads) throw new Error("kill_switch_state_unreadable");
    return states.get(keyFor(scope));
  }
  async write(state: KillSwitchState) {
    states.set(keyFor(state), { ...state, network: state.network.trim().toLowerCase() });
  }
}

export const killSwitchStore = new MemoryKillSwitchStore();

export async function getKillSwitchState(scope: KillSwitchScope, store: KillSwitchStore = killSwitchStore): Promise<KillSwitchState> {
  try {
    return (await store.read(scope)) ?? { ...scope, network: scope.network.trim().toLowerCase(), engaged: false };
  } catch {
    // An unreadable state is represented as engaged so automation fails closed.
    return { ...scope, network: scope.network.trim().toLowerCase(), engaged: true, reason: "kill_switch_state_unreadable" };
  }
}

export async function engageKillSwitch(scope: KillSwitchScope, actor: string, reason: string, store: KillSwitchStore = killSwitchStore) {
  const state: KillSwitchState = { ...scope, network: scope.network.trim().toLowerCase(), engaged: true, actor: actor.trim() || "operator", reason: reason.trim() || "operator_request", engagedAt: new Date().toISOString() };
  await store.write(state);
  return state;
}

export async function reenableKillSwitch(scope: KillSwitchScope, actor: string, store: KillSwitchStore = killSwitchStore) {
  const state: KillSwitchState = { ...scope, network: scope.network.trim().toLowerCase(), engaged: false, actor: actor.trim() || "operator", reenabledAt: new Date().toISOString() };
  await store.write(state);
  return state;
}
