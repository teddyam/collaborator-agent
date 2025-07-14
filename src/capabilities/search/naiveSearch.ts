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
 * Naive search implementation using simple keyword matching
 */
export class NaiveSearchProvider implements MessageSearchProvider {
  readonly name = 'naive-keyword-search';
  
  searchMessages(
    conversationId: string,
    params: SearchParams
  ): SearchResult {
    try {
      console.log(`🔍 ${this.name}: Searching with keywords: ${params.keywords.join(', ')}`);
      
      // Get messages in the time range using centralized function
      const messages = getMessagesByTimeRange(conversationId, params.startTime, params.endTime);
      
      // Filter by keywords (case-insensitive)
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
      
      console.log(`📊 ${this.name}: Found ${filteredMessages.length} total matches, returning ${limitedResults.length}`);
      
      return {
        messages: limitedResults,
        totalFound: filteredMessages.length,
        searchMethod: this.name,
        debugInfo: {
          totalMessagesInRange: messages.length,
          keywordMatches: filteredMessages.length,
          participantFilter: params.participants?.length || 0,
          timeRange: {
            start: params.startTime,
            end: params.endTime
          }
        }
      };
      
    } catch (error) {
      console.error(`❌ ${this.name}: Error searching messages:`, error);
      return {
        messages: [],
        totalFound: 0,
        searchMethod: this.name,
        debugInfo: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}

/**
 * Naive search capability using simple keyword matching
 */
export class NaiveSearchCapability extends BaseSearchCapability {
  protected searchProvider = new NaiveSearchProvider();
  
  protected createSearchPrompt(
    config: CapabilityConfig, 
    instructions: string, 
    modelConfig: any
  ): ChatPrompt {
    const prompt = new ChatPrompt({
      instructions,
      model: new OpenAIChatModel({
        model: modelConfig.model,
        apiKey: modelConfig.apiKey,
        endpoint: modelConfig.endpoint,
        apiVersion: modelConfig.apiVersion,
      }),
    })
    .function('search_messages', 'Search for messages in the conversation history using keyword matching', this.getFunctionSchemas()[0].schema, async (args: any) => {
      const { keywords, participants = [], start_time, end_time, max_results = 10 } = args;
      
      console.log(`🔍 FUNCTION CALL: search_messages (${this.searchProvider.name}) with keywords: ${keywords.join(', ')}`);
      
      // Use the search provider to find messages
      const searchResult = this.searchProvider.searchMessages(config.conversationId, {
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
- Total messages in time range: ${searchResult.debugInfo?.totalMessagesInRange || 'unknown'}`;
      }
      
      // Group messages by time periods for better context
      const groupedMessages = groupMessagesByTime(searchResult.messages);
      
      // Create a summary response
      let response = `Found ${searchResult.totalFound} messages matching your search`;
      if (searchResult.totalFound > searchResult.messages.length) {
        response += ` (showing first ${searchResult.messages.length})`;
      }
      response += `:\n\n`;
      
      // Add search method info
      response += `*Search method: ${searchResult.searchMethod}*\n\n`;
      
      groupedMessages.forEach(group => {
        response += `**${group.period}** (${group.messages.length} messages)\n`;
        group.messages.slice(0, 3).forEach(msg => {
          const preview = msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content;
          response += `• ${msg.name}: "${preview}"\n`;
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
      if (searchResult.debugInfo) {
        response += `\n*Debug: Searched ${searchResult.debugInfo.totalMessagesInRange || 'unknown'} messages in time range*`;
      }
      
      // Return just the summary text (citations are handled via the shared array)
      return response;
    });
    
    console.log(`🔍 Naive Search Capability created with keyword matching`);
    return prompt;
  }
}
