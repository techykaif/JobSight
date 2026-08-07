import type { BaseSignalProvider, FoundationContext, ObservableSignal } from './interfaces';

class FoundationRegistry {
  private providers: BaseSignalProvider[] = [];

  register(provider: BaseSignalProvider) {
    this.providers.push(provider);
  }

  getProviders(): BaseSignalProvider[] {
    return this.providers;
  }

  clear() {
    this.providers = [];
  }
}

export const foundationRegistry = new FoundationRegistry();
