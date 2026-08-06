import type { DiscoveryProvider, ProviderType, ProviderCapabilities, DiscoveryContext, DiscoveryResult, HealthCheckResult, DiscoveredJob } from '../interfaces.js';

export abstract class BaseProvider implements DiscoveryProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly providerType: ProviderType;
  abstract readonly version: string;
  abstract readonly priority: number;

  abstract capabilities(): ProviderCapabilities;

  abstract discover(context: DiscoveryContext): Promise<DiscoveryResult>;
  
  async healthCheck(sourceUrl: string): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const valid = await this.validate(sourceUrl);
      return {
        healthy: valid,
        reachable: valid,
        latencyMs: Date.now() - start,
        authenticationRequired: this.capabilities().supportsAuthentication,
      };
    } catch (e) {
      return {
        healthy: false,
        reachable: false,
        latencyMs: Date.now() - start,
        authenticationRequired: false,
        warnings: [(e as Error).message]
      };
    }
  }

  async validate(sourceUrl: string): Promise<boolean> {
    return this.supports(sourceUrl);
  }

  normalize(job: DiscoveredJob): DiscoveredJob {
    // Default normalization just returns the job. 
    // Subclasses can override this to map fields specific to their ATS.
    return job;
  }

  abstract supports(sourceUrl: string): boolean;

  emitTelemetry(event: string, payload: any): void {
    // We will connect this to the database telemetry system (pipeline_events)
    // For now, it delegates to the console, but the Orchestrator handles real DB logging.
    console.log(`[Telemetry] ${event} - ${this.name}:`, payload);
  }
}
