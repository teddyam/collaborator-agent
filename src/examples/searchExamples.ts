import { 
  createSearchCapability, 
  NaiveSearchCapability, 
  AzureSearchCapability,
  SearchCapability,
  NaiveSearchProvider,
  AzureSearchProvider
} from '../capabilities/search';

// Example 1: Using the factory function (recommended)
function createSearchExample() {
  // Create naive search (default)
  const naiveSearch = createSearchCapability('naive');
  
  // Create Azure AI search
  const azureSearch = createSearchCapability('azure', {
    endpoint: 'https://your-search-service.search.windows.net',
    apiKey: 'your-api-key',
    indexName: 'messages-index',
    apiVersion: '2023-11-01'
  });
  
  return { naiveSearch, azureSearch };
}

// Example 2: Direct instantiation
function directInstantiationExample() {
  // Naive search
  const naiveSearch = new NaiveSearchCapability();
  
  // Azure search with configuration
  const azureSearch = new AzureSearchCapability({
    endpoint: 'https://your-search-service.search.windows.net',
    apiKey: 'your-api-key',
    indexName: 'messages-index',
    apiVersion: '2023-11-01'
  });
  
  return { naiveSearch, azureSearch };
}

// Example 3: Backward compatibility
function backwardCompatibilityExample() {
  // This still works and uses naive search by default
  const search = new SearchCapability();
  return search;
}

// Example 4: Using with Manager (automatic configuration)
function managerExample() {
  // The Manager class now automatically creates the appropriate
  // search capability based on environment configuration
  
  // Set these environment variables:
  // SEARCH_TYPE=azure
  // AZURE_SEARCH_ENDPOINT=https://your-search-service.search.windows.net
  // AZURE_SEARCH_API_KEY=your-api-key
  // AZURE_SEARCH_INDEX_NAME=messages-index
  
  // The manager will automatically use Azure search when configured
  console.log('Manager will use configured search type from environment');
}

// Example 5: Testing different search types
function searchComparisonExample() {
  const conversationId = 'test-conversation';
  const searchParams = {
    keywords: ['meeting', 'project'],
    participants: ['John', 'Sarah'],
    maxResults: 10
  };
  
  // Test naive search
  const naiveProvider = new NaiveSearchProvider();
  const naiveResults = naiveProvider.searchMessages(conversationId, searchParams);
  console.log('Naive search results:', naiveResults);
  
  // Test Azure search (if configured)
  try {
    const azureProvider = new AzureSearchProvider();
    console.log('Azure search provider created:', azureProvider.name);
    // Initialize would be done with proper config in real usage
  } catch (error) {
    console.log('Azure search not available, using naive search');
  }
}

export {
  createSearchExample,
  directInstantiationExample,
  backwardCompatibilityExample,
  managerExample,
  searchComparisonExample
};
