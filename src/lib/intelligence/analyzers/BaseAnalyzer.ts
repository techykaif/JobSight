import type { DiscoveryAnalyzer, AnalyzerContext, AnalyzerResult } from '../interfaces.js';

export abstract class BaseAnalyzer implements DiscoveryAnalyzer {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly version: string;

  abstract analyze(context: AnalyzerContext): Promise<AnalyzerResult>;

  supports(context: AnalyzerContext): boolean {
    return true; // Default to always supporting unless overridden
  }

  protected emitTelemetry(event: string, payload: any): void {
    console.log(`[Analyzer Telemetry] ${event} - ${this.name}:`, payload);
  }
}
