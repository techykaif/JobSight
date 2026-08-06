import { providerRegistry } from '../registry.js';
import { SearchEngineProvider } from './SearchEngineProvider.js';
import { GreenhouseProvider } from './GreenhouseProvider.js';
import { LeverProvider } from './LeverProvider.js';
import { AshbyProvider } from './AshbyProvider.js';
import { WorkdayProvider } from './WorkdayProvider.js';
import { RSSProvider } from './RSSProvider.js';
import { SitemapProvider } from './SitemapProvider.js';
import { CareersPageProvider } from './CareersPageProvider.js';
import { CustomProvider } from './CustomProvider.js';

// Initialize core providers
export function registerCoreProviders() {
  providerRegistry.register(new CustomProvider());
  
  // High priority ATS
  providerRegistry.register(new GreenhouseProvider());
  providerRegistry.register(new LeverProvider());
  providerRegistry.register(new AshbyProvider());
  providerRegistry.register(new WorkdayProvider());
  
  // Medium priority
  providerRegistry.register(new RSSProvider());
  providerRegistry.register(new SitemapProvider());
  providerRegistry.register(new CareersPageProvider());
  
  // Fallback
  providerRegistry.register(new SearchEngineProvider());
}

export { 
  SearchEngineProvider, 
  GreenhouseProvider, 
  LeverProvider,
  AshbyProvider,
  WorkdayProvider,
  RSSProvider,
  SitemapProvider,
  CareersPageProvider,
  CustomProvider
};
