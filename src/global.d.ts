declare const workbox: {
  routing: {
    registerRoute: (...args: unknown[]) => void;
  };
  strategies: {
    StaleWhileRevalidate: new (...args: unknown[]) => unknown;
    NetworkFirst: new (...args: unknown[]) => unknown;
  };
};
