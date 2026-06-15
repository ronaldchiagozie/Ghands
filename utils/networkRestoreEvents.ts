type NetworkRestoreListener = () => void;

const listeners = new Set<NetworkRestoreListener>();

export function subscribeToNetworkRestore(listener: NetworkRestoreListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Fires once when connectivity returns after being offline. */
export function notifyNetworkRestored(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* best effort */
    }
  });
}
