import type { GameEvent, GameEventType } from "./types";

type Listener<E extends GameEvent = GameEvent> = (event: E) => void;

/**
 * Typed game event bus (Step 01). Listeners are scoped per bus instance
 * (one per session/runtime) — no global state. `subscribe` returns an
 * unsubscribe function; `clear` removes every listener so sessions can
 * be disposed without leaking handlers.
 */
export class GameEventBus {
  private listeners = new Map<GameEventType, Set<Listener>>();

  subscribe<T extends GameEventType>(type: T, listener: Listener<Extract<GameEvent, { type: T }>>): () => void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener as Listener);
    this.listeners.set(type, set);
    return () => {
      set.delete(listener as Listener);
      if (set.size === 0) this.listeners.delete(type);
    };
  }

  emit(event: GameEvent): void {
    const set = this.listeners.get(event.type);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        listener(event);
      } catch {
        /* A failing listener must never break gameplay. */
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }

  listenerCount(type?: GameEventType): number {
    if (type) return this.listeners.get(type)?.size ?? 0;
    return [...this.listeners.values()].reduce((n, s) => n + s.size, 0);
  }
}
