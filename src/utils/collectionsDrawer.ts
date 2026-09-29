type Listener = () => void;

const listeners = new Set<Listener>();

export function requestOpenCollections() {
  listeners.forEach((listener) => listener());
}

export function subscribeOpenCollections(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
