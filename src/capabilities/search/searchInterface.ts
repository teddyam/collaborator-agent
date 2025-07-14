import { ChatPrompt } from '@microsoft/teams.ai';
import { CitationAppearance } from '@microsoft/teams.api';
import { MessageRecord } from '../../storage/storage';
import { BaseCapability, CapabilityConfig } from '../capability';

/**
 * Search parameters for message searching
 */
export interface SearchParams {
  keywords: string[];
  participants?: string[];
  startTime?: string;
  endTime?: string;
  maxResults?: number;
}

/**
 * Search result containing matching messages and metadata
 */
export interface SearchResult {
  messages: MessageRecord[];
  totalFound: number;
  searchMethod: string;
  citations?: CitationAppearance[];
  debugInfo?: any;
}

/**
 * Interface for different search implementations
 */
export interface MessageSearchProvider {
  /**
   * The name/type of this search provider
   */
  readonly name: string;
  
  /**
   * Search for messages based on the provided parameters
   */
  searchMessages(
    conversationId: string,
    params: SearchParams
  ): Promise<SearchResult> | SearchResult;
  
  /**
   * Initialize the search provider with any necessary configuration
   */
  initialize?(config: any): Promise<void> | void;
  
  /**
   * Clean up resources when done
   */
  dispose?(): Promise<void> | void;
}

/**
 * Base search capability that can use different search providers
 */
export abstract class BaseSearchCapability extends BaseCapability {
  readonly name = 'search';
  protected abstract searchProvider: MessageSearchProvider;
  
  createPrompt(config: CapabilityConfig): ChatPrompt {
    this.logInit(config.conversationId, config.userTimezone);
    
    const searchModelConfig = this.getModelConfig('search');
    
    // Build additional time context if pre-calculated times are provided
    let timeContext = '';
    if (config.calculatedStartTime && config.calculatedEndTime) {
      console.log(`🕒 Search Capability (${this.searchProvider.name}) received pre-calculated time range: ${config.timespanDescription || 'calculated timespan'} (${config.calculatedStartTime} to ${config.calculatedEndTime})`);
      timeContext = `

IMPORTANT: Pre-calculated time range available:
- Start: ${config.calculatedStartTime}
- End: ${config.calculatedEndTime}
- Description: ${config.timespanDescription || 'calculated timespan'}

When searching messages, use these exact timestamps instead of calculating your own. This ensures consistency with the Manager's time calculations and reduces token usage.`;
    }
    
    // Get current date and timezone info for the LLM
    const currentDate = new Date().toISOString();
    const timezone = config.userTimezone || 'UTC';
    
    const instructions = `You are a search assistant for Teams conversations. You help users find specific messages, people, or topics within their chat history.

SEARCH PROVIDER: ${this.searchProvider.name}

CURRENT CONTEXT:
- Current date/time: ${currentDate}
- User timezone: ${timezone}
- When calculating time ranges like "earlier today", "yesterday", use the current time and timezone above
- Always provide start_time and end_time in ISO format when searching for time-based queries${timeContext}

Your role:
1. Parse user queries to extract keywords and search parameters
2. Use the search_messages function to find relevant conversations
3. Present results in an organized, helpful way
4. Create citations for found messages so users can navigate to them

Be helpful and thorough in your search results while being concise in your presentation.`;
    
    return this.createSearchPrompt(config, instructions, searchModelConfig);
  }
  
  /**
   * Create the actual ChatPrompt with search functions - implemented by subclasses
   */
  protected abstract createSearchPrompt(
    config: CapabilityConfig, 
    instructions: string, 
    modelConfig: any
  ): ChatPrompt;
  
  getFunctionSchemas(): Array<{name: string, schema: any}> {
    return [
      { 
        name: 'search_messages', 
        schema: {
          type: 'object' as const,
          properties: {
            keywords: {
              type: 'array' as const,
              items: { type: 'string' as const },
              description: 'Keywords to search for in message content (excluding time expressions)'
            },
            participants: {
              type: 'array' as const,
              items: { type: 'string' as const },
              description: 'Names of people who should be involved in the conversation'
            },
            start_time: {
              type: 'string' as const,
              description: 'Start time for search range (ISO format). Calculate this based on user request like "earlier today", "yesterday", etc.'
            },
            end_time: {
              type: 'string' as const,
              description: 'End time for search range (ISO format). Usually current time for "earlier today" or end of day for specific dates.'
            },
            max_results: {
              type: 'number' as const,
              description: 'Maximum number of results to return (default 10)',
              default: 10
            }
          },
          required: ['keywords']
        }
      }
    ];
  }
}

/**
 * Create a Citation object from a message record for display in Teams
 */
export function createCitationFromRecord(message: MessageRecord, conversationId: string): CitationAppearance {
  if (!message.activity_id) {
    throw new Error("Message record missing activity_id for deep linking");
  }

  const messageText = message.content ?? "<no message text>";
  const senderName = message.name ?? "Unknown";
  
  // Format timestamp for context
  const messageDate = new Date(message.timestamp);
  const formattedDate = messageDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  // Build deep link with chat context
  const chatId = conversationId;
  const messageId = message.activity_id;
  const contextParam = encodeURIComponent(JSON.stringify({ contextType: "chat" }));
  const deepLink = `https://teams.microsoft.com/l/message/${encodeURIComponent(chatId)}/${messageId}?context=${contextParam}`;

  // Create citation with message content and timestamp context
  const maxContentLength = 120; // Leave room for timestamp info
  const truncatedContent = messageText.length > maxContentLength ? 
    messageText.substring(0, maxContentLength) + '...' : 
    messageText;
  const abstractText = `${formattedDate}: "${truncatedContent}"`;
  
  const titleText = `Message from ${senderName}`.length > 80 ? `${senderName}` : `Message from ${senderName}`;

  return {
    name: titleText,
    url: deepLink,
    abstract: abstractText,
    keywords: senderName ? [senderName] : undefined
  };
}

/**
 * Group messages by time periods for better organization
 */
export function groupMessagesByTime(messages: MessageRecord[]): Array<{ period: string, messages: MessageRecord[] }> {
  const groups: { [key: string]: MessageRecord[] } = {};
  const now = new Date();
  
  messages.forEach(msg => {
    const msgDate = new Date(msg.timestamp);
    const diffHours = (now.getTime() - msgDate.getTime()) / (1000 * 60 * 60);
    
    let period: string;
    if (diffHours < 24) {
      period = 'Today';
    } else if (diffHours < 48) {
      period = 'Yesterday';
    } else if (diffHours < 168) { // 7 days
      period = 'This week';
    } else if (diffHours < 720) { // 30 days
      period = 'This month';
    } else {
      period = 'Older';
    }
    
    if (!groups[period]) {
      groups[period] = [];
    }
    groups[period].push(msg);
  });
  
  // Return in chronological order (most recent first)
  const orderedPeriods = ['Today', 'Yesterday', 'This week', 'This month', 'Older'];
  return orderedPeriods
    .filter(period => groups[period])
    .map(period => ({ period, messages: groups[period] }));
}
