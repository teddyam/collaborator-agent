import { AzureSearchConfig } from '../capabilities/search/azureSearch';

/**
 * Search configuration interface
 */
export interface SearchConfig {
  // Default search type to use
  defaultSearchType: 'naive' | 'azure';
  
  // Azure AI Search configuration (if using Azure search)
  azureSearch?: AzureSearchConfig;
  
  // Feature flags
  enableSemanticSearch?: boolean;
  fallbackToNaive?: boolean;
}

/**
 * Get search configuration from environment variables
 */
export function getSearchConfig(): SearchConfig {
  const config: SearchConfig = {
    defaultSearchType: (process.env.SEARCH_TYPE as 'naive' | 'azure') || 'naive',
    enableSemanticSearch: process.env.ENABLE_SEMANTIC_SEARCH === 'true',
    fallbackToNaive: process.env.FALLBACK_TO_NAIVE_SEARCH !== 'false' // Default to true
  };
  
  // Configure Azure Search if enabled
  if (config.defaultSearchType === 'azure' || config.enableSemanticSearch) {
    const azureEndpoint = process.env.AZURE_SEARCH_ENDPOINT;
    const azureApiKey = process.env.AZURE_SEARCH_API_KEY;
    const azureIndexName = process.env.AZURE_SEARCH_INDEX_NAME;
    
    if (azureEndpoint && azureApiKey && azureIndexName) {
      config.azureSearch = {
        endpoint: azureEndpoint,
        apiKey: azureApiKey,
        indexName: azureIndexName,
        apiVersion: process.env.AZURE_SEARCH_API_VERSION || '2023-11-01'
      };
    } else {
      console.warn('⚠️ Azure Search configured but missing required environment variables. Falling back to naive search.');
      config.defaultSearchType = 'naive';
    }
  }
  
  return config;
}

/**
 * Example environment variables for Azure AI Search:
 * 
 * SEARCH_TYPE=azure
 * ENABLE_SEMANTIC_SEARCH=true
 * FALLBACK_TO_NAIVE_SEARCH=true
 * AZURE_SEARCH_ENDPOINT=https://your-search-service.search.windows.net
 * AZURE_SEARCH_API_KEY=your-api-key
 * AZURE_SEARCH_INDEX_NAME=messages-index
 * AZURE_SEARCH_API_VERSION=2023-11-01
 */
