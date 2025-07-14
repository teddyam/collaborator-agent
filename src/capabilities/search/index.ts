// Export the search interface and base classes
export {
  MessageSearchProvider,
  SearchParams,
  SearchResult,
  BaseSearchCapability,
  createCitationFromRecord,
  groupMessagesByTime
} from './searchInterface';

// Export naive search implementation
export {
  NaiveSearchProvider,
  NaiveSearchCapability
} from './naiveSearch';

// Export Azure AI Search implementation
export {
  AzureSearchProvider,
  AzureSearchCapability,
  AzureSearchConfig
} from './azureSearch';

// Import for factory function
import { NaiveSearchCapability } from './naiveSearch';
import { AzureSearchCapability, AzureSearchConfig } from './azureSearch';

// For backward compatibility, export the NaiveSearchCapability as SearchCapability
export { NaiveSearchCapability as SearchCapability } from './naiveSearch';

/**
 * Factory function to create search capabilities based on configuration
 */
export function createSearchCapability(searchType: 'naive' | 'azure' = 'naive', azureConfig?: AzureSearchConfig) {
  switch (searchType) {
    case 'azure':
      return new AzureSearchCapability(azureConfig);
    case 'naive':
    default:
      return new NaiveSearchCapability();
  }
}
