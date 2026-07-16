import type { PwaRegistrationEnvironment, ServiceWorkerRegister } from './pwaTypes';
import { scheduleServiceWorkerRegistration } from './registerServiceWorker';

const createRegister = (
  implementation: ServiceWorkerRegister = () => Promise.resolve(),
): jest.Mock<Promise<unknown>, [string, RegistrationOptions]> =>
  jest.fn<Promise<unknown>, [string, RegistrationOptions]>(implementation);

const createEnvironment = (
  register: ServiceWorkerRegister | null,
  overrides: Partial<PwaRegistrationEnvironment> = {},
): PwaRegistrationEnvironment => ({
  baseUri: 'https://victorzakharov.github.io/neonplex/',
  enabled: true,
  onLoad: (listener) => listener(),
  readyState: 'complete',
  register,
  secureContext: true,
  ...overrides,
});

describe('service worker registration', () => {
  it('registers the worker relative to the current GitHub Pages directory', () => {
    const register = createRegister();

    scheduleServiceWorkerRegistration(createEnvironment(register));

    expect(register).toHaveBeenCalledWith(
      'https://victorzakharov.github.io/neonplex/service-worker.js',
      { scope: './', updateViaCache: 'none' },
    );
  });

  it('keeps PR preview registration inside the preview directory', () => {
    const register = createRegister();

    scheduleServiceWorkerRegistration(
      createEnvironment(register, {
        baseUri: 'https://victorzakharov.github.io/neonplex/pr-preview/pr-11/',
      }),
    );

    expect(register).toHaveBeenCalledWith(
      'https://victorzakharov.github.io/neonplex/pr-preview/pr-11/service-worker.js',
      { scope: './', updateViaCache: 'none' },
    );
  });

  it('waits for the document load event when the page is still loading', () => {
    const register = createRegister();
    const onLoad = jest.fn<void, [() => void]>();
    scheduleServiceWorkerRegistration(
      createEnvironment(register, {
        onLoad,
        readyState: 'interactive',
      }),
    );

    expect(register).not.toHaveBeenCalled();
    const loadListener = onLoad.mock.calls[0]?.[0];
    if (loadListener === undefined) throw new Error('Load listener was not scheduled.');
    loadListener();
    expect(register).toHaveBeenCalledTimes(1);
  });

  const skippedEnvironments: Array<[string, Partial<PwaRegistrationEnvironment>]> = [
    ['development builds', { enabled: false }],
    ['insecure contexts', { secureContext: false }],
    ['unsupported browsers', { register: null }],
  ];

  it.each(skippedEnvironments)('skips registration in %s', (_caseName, overrides) => {
    const register = createRegister();

    scheduleServiceWorkerRegistration(createEnvironment(register, overrides));

    expect(register).not.toHaveBeenCalled();
  });

  it('contains rejected and synchronous registration failures', async () => {
    const rejected = createRegister(() => Promise.reject(new Error('denied')));
    const thrown = createRegister(() => {
      throw new Error('unsupported');
    });

    expect(() => scheduleServiceWorkerRegistration(createEnvironment(rejected))).not.toThrow();
    expect(() => scheduleServiceWorkerRegistration(createEnvironment(thrown))).not.toThrow();
    await Promise.resolve();
  });
});
