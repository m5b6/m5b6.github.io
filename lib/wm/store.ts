"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import { DEFAULT_VIEWPORT } from "./geometry";
import {
  loadLayout,
  resolveLayoutStorage,
  saveLayout,
  type LayoutStorage,
} from "./persistence";
import { createDesktopState, desktopReducer } from "./reducer";
import type {
  DesktopAction,
  DesktopState,
  Viewport,
  WindowId,
  WindowState,
} from "./types";

export type Unsubscribe = () => void;
export type Listener = () => void;

export type DesktopStore = {
  getState(): DesktopState;
  getWindowOrder(): readonly WindowId[];
  getWindow(id: WindowId): WindowState | null;
  dispatch(action: DesktopAction): void;
  replace(next: DesktopState): void;
  subscribe(listener: Listener): Unsubscribe;
  subscribeStructure(listener: Listener): Unsubscribe;
  subscribeWindow(id: WindowId, listener: Listener): Unsubscribe;
};

export type CreateDesktopStoreOptions = {
  viewport?: Viewport;
  initialState?: DesktopState;
};

function addListener(set: Set<Listener>, listener: Listener): Unsubscribe {
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

function notify(listeners: Set<Listener> | undefined) {
  if (!listeners || listeners.size === 0) return;
  for (const listener of [...listeners]) listener();
}

export function createDesktopStore(
  options: CreateDesktopStoreOptions = {},
): DesktopStore {
  let state =
    options.initialState ??
    createDesktopState(options.viewport ?? DEFAULT_VIEWPORT);

  const anyListeners = new Set<Listener>();
  const structureListeners = new Set<Listener>();
  const windowListeners = new Map<WindowId, Set<Listener>>();

  function emit(previous: DesktopState, next: DesktopState) {
    const touched = new Set<WindowId>();
    for (const id of Object.keys(previous.windows)) {
      if (previous.windows[id] !== next.windows[id]) touched.add(id);
    }
    for (const id of Object.keys(next.windows)) {
      if (previous.windows[id] !== next.windows[id]) touched.add(id);
    }

    for (const id of touched) notify(windowListeners.get(id));
    if (previous.order !== next.order) notify(structureListeners);
    notify(anyListeners);
  }

  return {
    getState() {
      return state;
    },

    getWindowOrder() {
      return state.order;
    },

    getWindow(id) {
      return state.windows[id] ?? null;
    },

    dispatch(action) {
      const previous = state;
      const next = desktopReducer(previous, action);
      if (next === previous) return;

      state = next;
      emit(previous, next);
    },

    replace(next) {
      const previous = state;
      if (next === previous) return;

      state = next;
      const touched = new Set<WindowId>([
        ...Object.keys(previous.windows),
        ...Object.keys(next.windows),
      ]);
      for (const id of touched) notify(windowListeners.get(id));
      notify(structureListeners);
      notify(anyListeners);
    },

    subscribe(listener) {
      return addListener(anyListeners, listener);
    },

    subscribeStructure(listener) {
      return addListener(structureListeners, listener);
    },

    subscribeWindow(id, listener) {
      let listeners = windowListeners.get(id);
      if (!listeners) {
        listeners = new Set<Listener>();
        windowListeners.set(id, listeners);
      }

      const target = listeners;
      const remove = addListener(target, listener);

      return () => {
        remove();
        if (target.size === 0 && windowListeners.get(id) === target) {
          windowListeners.delete(id);
        }
      };
    },
  };
}

export type LayoutPersistenceOptions = {
  storage?: LayoutStorage | null;
  schedule?: (run: () => void) => void;
};

function defaultSchedule(run: () => void) {
  setTimeout(run, 250);
}

export function attachLayoutPersistence(
  store: DesktopStore,
  options: LayoutPersistenceOptions = {},
): Unsubscribe {
  const storage =
    options.storage === undefined ? resolveLayoutStorage() : options.storage;
  if (!storage) return () => {};

  const restored = loadLayout(storage, store.getState().viewport);
  if (restored) store.replace(restored);

  const schedule = options.schedule ?? defaultSchedule;
  let detached = false;
  let pending = false;

  const unsubscribe = store.subscribe(() => {
    if (pending || detached) return;
    pending = true;
    schedule(() => {
      pending = false;
      if (detached) return;
      saveLayout(storage, store.getState());
    });
  });

  return () => {
    detached = true;
    unsubscribe();
  };
}

export const DesktopStoreContext = createContext<DesktopStore | null>(null);

export function useDesktopStore() {
  const store = useContext(DesktopStoreContext);
  if (!store) throw new Error("DesktopStoreContext is missing a provider");
  return store;
}

export function useWindowOrder(store: DesktopStore) {
  const subscribe = useCallback(
    (listener: Listener) => store.subscribeStructure(listener),
    [store],
  );
  const snapshot = useCallback(() => store.getWindowOrder(), [store]);

  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function useWindow(store: DesktopStore, id: WindowId) {
  const subscribe = useCallback(
    (listener: Listener) => store.subscribeWindow(id, listener),
    [store, id],
  );
  const snapshot = useCallback(() => store.getWindow(id), [store, id]);

  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function useDesktopState(store: DesktopStore) {
  const subscribe = useCallback(
    (listener: Listener) => store.subscribe(listener),
    [store],
  );
  const snapshot = useCallback(() => store.getState(), [store]);

  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
