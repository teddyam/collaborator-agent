import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { MessageRecord } from '../../storage/storage';
import { getMessagesByTimeRange } from '../../storage/message';
import { CapabilityConfig } from '../capability';
import { 
  MessageSearchProvider, 
  SearchParams, 
  SearchResult, 
  BaseSearchCapability,
  createCitationFromRecord,
  groupMessagesByTime
} from './searchInterface';

/**
 * Configuration for Azure AI Search
 */
export interface AzureSearchConfig {
  endpoint: string;
  apiKey: string;
  indexName: string;
  apiVersion?: string;
}

/**
 * Azure AI Search implementation for semantic search
 */
export class AzureSearchProvider implements MessageSearchProvider {
  readonly name = 'azure-ai-search';
  private config?: AzureSearchConfig;
  private isInitialized = false;
  
  constructor(config?: AzureSearchConfig) {
    if (config) {
      this.config = config;
    }
  }
  
  async initialize(config: AzureSearchConfig): Promise<void> {
    this.config = config;
    this.isInitialized = true;
    console.log(`🔍 ${this.name}: Initialized with endpoint ${config.endpoint} and index ${config.indexName}`);
  }
  
  async searchMessages(
    conversationId: string,
    params: SearchParams
  ): Promise<SearchResult> {
    if (!this.isInitialized || !this.config) {
      console.warn(`⚠️ ${this.name}: Not initialized, falling back to naive search`);
      return this.fallbackToNaiveSearch(conversationId, params);
    }
    
    try {
      console.log(`🔍 ${this.name}: Performing semantic search with keywords: ${params.keywords.join(', ')}`);
      
      // Construct Azure AI Search query
      const searchQuery = await this.buildAzureSearchQuery(conversationId, params);
      
      // Execute Azure AI Search
      const azureResults = await this.executeAzureSearch(searchQuery);
      
      // Convert Azure results to MessageRecord format
      const messages = await this.convertAzureResultsToMessages(azureResults, conversationId, params);
      
      console.log(`📊 ${this.name}: Found ${azureResults.totalCount || messages.length} results from Azure AI Search`);
      
      return {
        messages,
        totalFound: azureResults.totalCount || messages.length,
        searchMethod: this.name,
        debugInfo: {
          azureQuery: searchQuery,
          azureResponseTime: azureResults.responseTime,
          semanticScore: azureResults.semanticScore,
          searchMode: 'semantic'
        }
      };
      
    } catch (error) {
      console.error(`❌ ${this.name}: Error in Azure search, falling back to naive search:`, error);
      return this.fallbackToNaiveSearch(conversationId, params);
    }
  }
  
  private async buildAzureSearchQuery(conversationId: string, params: SearchParams): Promise<any> {
    // Build semantic search query for Azure AI Search
    const query = {
      search: params.keywords.join(' '),
      searchMode: 'all', // or 'any' depending on requirements
      queryType: 'semantic',
      semanticConfiguration: 'default', // Configure this in your Azure Search index
      select: ['id', 'content', 'timestamp', 'name', 'role', 'activity_id'],
      filter: `conversation_id eq '${conversationId}'`,
      top: params.maxResults || 10,
      orderby: ['timestamp desc']
    };
    
    // Add time range filters if provided
    if (params.startTime || params.endTime) {
      let timeFilter = '';
      if (params.startTime && params.endTime) {
        timeFilter = `timestamp ge ${params.startTime} and timestamp le ${params.endTime}`;
      } else if (params.startTime) {
        timeFilter = `timestamp ge ${params.startTime}`;
      } else if (params.endTime) {
        timeFilter = `timestamp le ${params.endTime}`;
      }
      
      if (timeFilter) {
        query.filter += ` and (${timeFilter})`;
      }
    }
    
    // Add participant filters if provided
    if (params.participants && params.participants.length > 0) {
      const participantFilter = params.participants
        .map(p => `search.ismatch('${p}', 'name')`)
        .join(' or ');
      query.filter += ` and (${participantFilter})`;
    }
    
    return query;
  }
  
  private async executeAzureSearch(query: any): Promise<any> {
    if (!this.config) {
      throw new Error('Azure Search not configured');
    }
    
    const url = `${this.config.endpoint}/indexes/${this.config.indexName}/docs/search?api-version=${this.config.apiVersion || '2023-11-01'}`;
    
    const startTime = Date.now();
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.config.apiKey
      },
      body: JSON.stringify(query)
    });
    
    if (!response.ok) {
      throw new Error(`Azure Search API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    const responseTime = Date.now() - startTime;
    
    return {
      ...result,
      responseTime,
      totalCount: result['@odata.count'] || result.value?.length || 0
    };
  }
  
  private async convertAzureResultsToMessages(
    azureResults: any, 
    conversationId: string, 
    _params: SearchParams
  ): Promise<MessageRecord[]> {
    if (!azureResults.value || !Array.isArray(azureResults.value)) {
      return [];
    }
    
    // Convert Azure search results to MessageRecord format
    const messages: MessageRecord[] = azureResults.value.map((result: any) => ({
      id: result.id,
      conversation_id: conversationId,
      timestamp: result.timestamp,
      name: result.name || 'Unknown',
      role: result.role || 'user',
      content: result.content || '',
      activity_id: result.activity_id,
      // Add Azure-specific metadata
      searchScore: result['@search.score'],
      semanticScore: result['@search.rerankerScore']
    }));
    
    // Sort by relevance (search score) first, then by timestamp
    messages.sort((a: any, b: any) => {
      // Primary sort by semantic/search score (higher is better)
      const scoreA = a.semanticScore || a.searchScore || 0;
      const scoreB = b.semanticScore || b.searchScore || 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      // Secondary sort by timestamp (newer first)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    
    return messages;
  }
  
  private fallbackToNaiveSearch(conversationId: string, params: SearchParams): SearchResult {
    console.log(`🔄 ${this.name}: Falling back to naive keyword search`);
    
    try {
      // Get messages in the time range
      const messages = getMessagesByTimeRange(conversationId, params.startTime, params.endTime);
      
      // Simple keyword filtering as fallback
      let filteredMessages = messages.filter((msg: MessageRecord) => {
        const content = msg.content.toLowerCase();
        return params.keywords.some(keyword => content.includes(keyword.toLowerCase()));
      });
      
      // Filter by participants if specified
      if (params.participants && params.participants.length > 0) {
        filteredMessages = filteredMessages.filter((msg: MessageRecord) => {
          const name = msg.name.toLowerCase();
          return params.participants!.some(participant => 
            name.includes(participant.toLowerCase()) || 
            participant.toLowerCase().includes(name)
          );
        });
      }
      
      // Sort by timestamp (most recent first) and limit results
      filteredMessages.sort((a: MessageRecord, b: MessageRecord) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      const maxResults = params.maxResults || 10;
      const limitedResults = filteredMessages.slice(0, maxResults);
      
      return {
        messages: limitedResults,
        totalFound: filteredMessages.length,
        searchMethod: `${this.name} (fallback to naive)`,
        debugInfo: {
          fallbackReason: 'Azure AI Search unavailable',
          totalMessagesInRange: messages.length,
          keywordMatches: filteredMessages.length
        }
      };
      
    } catch (error) {
      console.error(`❌ ${this.name}: Error in fallback search:`, error);
      return {
        messages: [],
        totalFound: 0,
        searchMethod: `${this.name} (fallback failed)`,
        debugInfo: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
  
  async dispose(): Promise<void> {
    // Clean up any resources if needed
    this.isInitialized = false;
    console.log(`🔍 ${this.name}: Disposed`);
  }
}

/**
 * Azure AI Search capability using semantic search
 */
export class AzureSearchCapability extends BaseSearchCapability {
  protected searchProvider: AzureSearchProvider;
  
  constructor(azureConfig?: AzureSearchConfig) {
    super();
    this.searchProvider = new AzureSearchProvider(azureConfig);
  }
  
  async initializeAzureSearch(config: AzureSearchConfig): Promise<void> {
    await this.searchProvider.initialize(config);
  }
  
  protected createSearchPrompt(
    config: CapabilityConfig, 
    instructions: string, 
    modelConfig: any
  ): ChatPrompt {
    const enhancedInstructions = `${instructions}

SEMANTIC SEARCH CAPABILITIES:
- This search uses Azure AI Search with semantic understanding
- It can understand context, synonyms, and related concepts
- Results are ranked by semantic relevance, not just keyword matching
- Can handle natural language queries better than simple keyword search

When searching:
- Use natural language descriptions of what you're looking for
- Include context and related terms in your keywords
- The system will understand conceptual relationships between terms`;

    const prompt = new ChatPrompt({
      instructions: enhancedInstructions,
      model: new OpenAIChatModel({
        model: modelConfig.model,
        apiKey: modelConfig.apiKey,
        endpoint: modelConfig.endpoint,
        apiVersion: modelConfig.apiVersion,
      }),
    })
    .function('search_messages', 'Search for messages using Azure AI Search with semantic understanding', this.getFunctionSchemas()[0].schema, async (args: any) => {
      const { keywords, participants = [], start_time, end_time, max_results = 10 } = args;
      
      console.log(`🔍 FUNCTION CALL: search_messages (${this.searchProvider.name}) with keywords: ${keywords.join(', ')}`);
      
      // Use the Azure search provider to find messages
      const searchResult = await this.searchProvider.searchMessages(config.conversationId, {
        keywords,
        participants,
        startTime: start_time,
        endTime: end_time,
        maxResults: max_results
      });
      
      if (searchResult.messages.length === 0) {
        return `No messages found matching your search criteria. Try different keywords or a broader time range.

Search Details:
- Method: ${searchResult.searchMethod}
- Keywords searched: ${keywords.join(', ')}
${searchResult.debugInfo?.fallbackReason ? `- Note: ${searchResult.debugInfo.fallbackReason}` : ''}`;
      }
      
      // Group messages by time periods for better context
      const groupedMessages = groupMessagesByTime(searchResult.messages);
      
      // Create a summary response
      let response = `Found ${searchResult.totalFound} messages matching your search`;
      if (searchResult.totalFound > searchResult.messages.length) {
        response += ` (showing top ${searchResult.messages.length} by relevance)`;
      }
      response += `:\n\n`;
      
      // Add search method info
      response += `*Search method: ${searchResult.searchMethod}*\n`;
      if (searchResult.debugInfo?.semanticScore) {
        response += `*Semantic relevance scoring enabled*\n`;
      }
      response += '\n';
      
      groupedMessages.forEach(group => {
        response += `**${group.period}** (${group.messages.length} messages)\n`;
        group.messages.slice(0, 3).forEach((msg: any) => {
          const preview = msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content;
          let messageEntry = `• ${msg.name}: "${preview}"`;
          
          // Add relevance score if available
          if (msg.semanticScore || msg.searchScore) {
            const score = msg.semanticScore || msg.searchScore;
            messageEntry += ` *(relevance: ${score.toFixed(2)})*`;
          }
          
          response += messageEntry + '\n';
        });
        if (group.messages.length > 3) {
          response += `  ... and ${group.messages.length - 3} more\n`;
        }
        response += '\n';
      });

      // Create citations for the first few results (limit to 5 to avoid overwhelming the user)
      const messagesToCite = searchResult.messages.slice(0, 5);
      const citations = messagesToCite.map(msg => createCitationFromRecord(msg, config.conversationId));
      
      // If we have an array to store citations, add them there for the manager to access
      if (config.citationsArray) {
        config.citationsArray.push(...citations);
      }
      
      // Add debug info if available
      if (searchResult.debugInfo?.azureResponseTime) {
        response += `\n*Search completed in ${searchResult.debugInfo.azureResponseTime}ms*`;
      }
      
      // Return just the summary text (citations are handled via the shared array)
      return response;
    });
    
    console.log(`🔍 Azure AI Search Capability created with semantic search`);
    return prompt;
  }
}
