// Whether the browser has a connection (blueprint §16): while offline, nothing is sent - command screens disable
// their confirm, and the shell says so. Moved from src/app/Banners.tsx (Stage 4) so modules can use it.
import { useSyncExternalStore } from 'react';

function subscribeOnline(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}
