import { strategyRegistry } from './registry.js';
import { 
  DefaultStrategy, 
  StealthStrategy, 
  HighCompensationStrategy, 
  RemoteFirstStrategy, 
  StartupStrategy, 
  EnterpriseStrategy,
  FastHiringStrategy 
} from './strategies.js';

export function registerCoreStrategies() {
  strategyRegistry.register(new DefaultStrategy());
  strategyRegistry.register(new StealthStrategy());
  strategyRegistry.register(new HighCompensationStrategy());
  strategyRegistry.register(new RemoteFirstStrategy());
  strategyRegistry.register(new StartupStrategy());
  strategyRegistry.register(new EnterpriseStrategy());
  strategyRegistry.register(new FastHiringStrategy());
}

export { strategyRegistry };
