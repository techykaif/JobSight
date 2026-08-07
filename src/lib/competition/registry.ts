import type { BaseCompetitionProvider } from './interfaces';

class CompetitionRegistry {
  private providers: BaseCompetitionProvider[] = [];

  register(provider: BaseCompetitionProvider) {
    this.providers.push(provider);
  }

  getProviders(): BaseCompetitionProvider[] {
    return this.providers;
  }

  clear() {
    this.providers = [];
  }
}

export const competitionRegistry = new CompetitionRegistry();
