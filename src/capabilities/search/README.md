# Search Capability Architecture

The search capability has been refactored into a modular, extensible architecture that supports multiple search implementations.

## Architecture Overview

### Base Interface (`searchInterface.ts`)
- `MessageSearchProvider` - Interface for search implementations
- `BaseSearchCapability` - Abstract base class for search capabilities
- `SearchParams` & `SearchResult` - Common data structures
- Utility functions: `createCitationFromRecord`, `groupMessagesByTime`

### Search Implementations

#### 1. Naive Search (`naiveSearch.ts`)
- **Class**: `NaiveSearchCapability`
- **Provider**: `NaiveSearchProvider`
- **Method**: Simple keyword matching (case-insensitive)
- **Features**:
  - Keyword filtering
  - Participant filtering
  - Time range filtering
  - Fast, local search
  - No external dependencies

#### 2. Azure AI Search (`azureSearch.ts`)
- **Class**: `AzureSearchCapability`
- **Provider**: `AzureSearchProvider`
- **Method**: Semantic search using Azure Cognitive Search
- **Features**:
  - Semantic understanding
  - Context-aware search
  - Relevance scoring
  - Synonym support
  - Natural language queries
  - Automatic fallback to naive search if Azure is unavailable

## Usage

### Basic Usage (Backward Compatible)
```typescript
import { SearchCapability } from '../capabilities/search';

// Uses naive search by default
const searchCapability = new SearchCapability();
```

### Factory Pattern (Recommended)
```typescript
import { createSearchCapability } from '../capabilities/search';

// Create naive search
const naiveSearch = createSearchCapability('naive');

// Create Azure AI search
const azureSearch = createSearchCapability('azure', {
  endpoint: 'https://your-search-service.search.windows.net',
  apiKey: 'your-api-key',
  indexName: 'messages-index',
  apiVersion: '2023-11-01'
});
```

### Environment Configuration
Set these environment variables to configure search:

```bash
# Search type: 'naive' or 'azure'
SEARCH_TYPE=azure

# Enable semantic search features
ENABLE_SEMANTIC_SEARCH=true

# Fallback to naive search if Azure fails
FALLBACK_TO_NAIVE_SEARCH=true

# Azure AI Search configuration
AZURE_SEARCH_ENDPOINT=https://your-search-service.search.windows.net
AZURE_SEARCH_API_KEY=your-api-key
AZURE_SEARCH_INDEX_NAME=messages-index
AZURE_SEARCH_API_VERSION=2023-11-01
```

## Azure AI Search Setup

### 1. Create Azure Search Service
1. Create an Azure Cognitive Search service in Azure Portal
2. Get the service endpoint and admin API key
3. Note the service name and region

### 2. Create Search Index
Create an index with the following schema:

```json
{
  "name": "messages-index",
  "fields": [
    {"name": "id", "type": "Edm.String", "key": true, "searchable": false},
    {"name": "conversation_id", "type": "Edm.String", "filterable": true},
    {"name": "content", "type": "Edm.String", "searchable": true, "analyzer": "en.microsoft"},
    {"name": "timestamp", "type": "Edm.DateTimeOffset", "filterable": true, "sortable": true},
    {"name": "name", "type": "Edm.String", "searchable": true, "filterable": true},
    {"name": "role", "type": "Edm.String", "filterable": true},
    {"name": "activity_id", "type": "Edm.String", "searchable": false}
  ],
  "semanticConfiguration": {
    "name": "default",
    "prioritizedFields": {
      "titleField": null,
      "prioritizedContentFields": [
        {"fieldName": "content"}
      ],
      "prioritizedKeywordsFields": [
        {"fieldName": "name"}
      ]
    }
  }
}
```

### 3. Index Your Data
You'll need to implement a data indexing process to push message data to Azure Search. This typically involves:

1. Extracting message data from your storage
2. Formatting it according to the index schema
3. Using the Azure Search REST API or SDK to upload documents
4. Setting up incremental indexing for new messages

## File Structure

```
src/capabilities/search/
├── index.ts              # Main exports and factory function
├── searchInterface.ts    # Base interfaces and abstract classes
├── naiveSearch.ts        # Naive keyword search implementation
└── azureSearch.ts        # Azure AI Search implementation

src/utils/
└── searchConfig.ts       # Configuration management

src/capabilities/
└── search.ts             # Backward compatibility exports
```

## Migration Guide

### From Old Search
The old `SearchCapability` class is now mapped to `NaiveSearchCapability` for backward compatibility. No code changes required for existing usage.

### To Azure Search
1. Set up Azure Cognitive Search service
2. Create and configure the search index
3. Index your message data
4. Update environment variables
5. Restart the application

The system will automatically use Azure search when properly configured, with fallback to naive search if needed.

## Benefits

1. **Extensibility**: Easy to add new search providers (Elasticsearch, Solr, etc.)
2. **Flexibility**: Choose the right search method for your needs
3. **Reliability**: Automatic fallback ensures search always works
4. **Performance**: Azure semantic search provides better relevance
5. **Compatibility**: Existing code continues to work unchanged

## Future Enhancements

- **Elasticsearch Provider**: Add support for Elasticsearch
- **Hybrid Search**: Combine multiple search methods
- **Search Analytics**: Track search performance and usage
- **Auto-indexing**: Automatically sync new messages to search indices
- **Search Suggestions**: Provide query suggestions and autocomplete
