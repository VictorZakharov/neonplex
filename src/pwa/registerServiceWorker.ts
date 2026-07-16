import type { PwaRegistrationEnvironment } from './pwaTypes';

const SERVICE_WORKER_PATH = './service-worker.js';

const registerFrom = (environment: PwaRegistrationEnvironment): void => {
  const register = environment.register;
  if (register === null) return;
  try {
    void register(new URL(SERVICE_WORKER_PATH, environment.baseUri).toString(), {
      scope: './',
      updateViaCache: 'none',
    }).catch(() => undefined);
  } catch {
    return;
  }
};

export const scheduleServiceWorkerRegistration = (
  environment: PwaRegistrationEnvironment,
): void => {
  if (!environment.enabled || !environment.secureContext || environment.register === null) return;
  if (environment.readyState === 'complete') {
    registerFrom(environment);
    return;
  }
  environment.onLoad(() => registerFrom(environment));
};

export const registerServiceWorker = (): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const serviceWorker = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
  scheduleServiceWorkerRegistration({
    baseUri: document.baseURI,
    enabled: typeof __NEONPLEX_PWA__ !== 'undefined' && __NEONPLEX_PWA__,
    onLoad: (listener) => window.addEventListener('load', listener, { once: true }),
    readyState: document.readyState,
    register:
      serviceWorker === null
        ? null
        : (scriptUrl, options) => serviceWorker.register(scriptUrl, options),
    secureContext: window.isSecureContext,
  });
};
