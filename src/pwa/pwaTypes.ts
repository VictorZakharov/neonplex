export type ServiceWorkerRegister = (
  scriptUrl: string,
  options: RegistrationOptions,
) => Promise<unknown>;

export interface PwaRegistrationEnvironment {
  readonly baseUri: string;
  readonly enabled: boolean;
  readonly onLoad: (listener: () => void) => void;
  readonly readyState: DocumentReadyState;
  readonly register: ServiceWorkerRegister | null;
  readonly secureContext: boolean;
}

declare global {
  const __NEONPLEX_PWA__: boolean;
}
