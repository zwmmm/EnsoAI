import { useSyncExternalStore } from 'react';

const IDLE_THRESHOLD_MS = 5 * 60 * 1000;

let isWindowFocused = !document.hidden;
let isIdle = false;
let idleTimeoutId: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

let cachedSnapshot = { isWindowFocused, isIdle };

function updateSnapshot() {
  cachedSnapshot = { isWindowFocused, isIdle };
}

function notifyListeners() {
  updateSnapshot();
  for (const listener of listeners) {
    listener();
  }
}

function handleVisibilityChange() {
  const wasFocused = isWindowFocused;
  isWindowFocused = !document.hidden;

  if (isWindowFocused && !wasFocused) {
    if (idleTimeoutId) {
      clearTimeout(idleTimeoutId);
      idleTimeoutId = null;
    }
    if (isIdle) {
      isIdle = false;
    }
    notifyListeners();
  } else if (!isWindowFocused && wasFocused) {
    if (idleTimeoutId) {
      clearTimeout(idleTimeoutId);
    }
    idleTimeoutId = setTimeout(() => {
      isIdle = true;
      notifyListeners();
    }, IDLE_THRESHOLD_MS);
    notifyListeners();
  }
}

function handleWindowFocus() {
  if (!isWindowFocused) {
    isWindowFocused = true;
    if (idleTimeoutId) {
      clearTimeout(idleTimeoutId);
      idleTimeoutId = null;
    }
    if (isIdle) {
      isIdle = false;
    }
    notifyListeners();
  }
}

function handleWindowBlur() {
  if (isWindowFocused) {
    isWindowFocused = false;
    if (idleTimeoutId) {
      clearTimeout(idleTimeoutId);
    }
    idleTimeoutId = setTimeout(() => {
      isIdle = true;
      notifyListeners();
    }, IDLE_THRESHOLD_MS);
    notifyListeners();
  }
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('blur', handleWindowBlur);
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot() {
  return cachedSnapshot;
}

const serverSnapshot = { isWindowFocused: true, isIdle: false };
function getServerSnapshot() {
  return serverSnapshot;
}

export function useWindowFocus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useShouldPoll() {
  const { isIdle } = useWindowFocus();
  return !isIdle;
}
