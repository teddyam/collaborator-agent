import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { SqliteKVStore, MessageRecord } from '../storage/storage';

// Initialize storage
const storage = new SqliteKVStore();

// Function definitions for the AI model - restructured to avoid schema issues
const GET_RECENT_MESSAGES_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: {
      type: 'number' as const,
      description: 'Number of recent messages to retrieve (default: 5, max: 20)',
      minimum: 1,
      maximum: 20
    }
  }
};

const GET_MESSAGES_BY_TIME_RANGE_SCHEMA = {
  type: 'object' as const,
  properties: {
    start_time: {
      type: 'string' as const,
      description: 'Start time in ISO format (e.g., 2024-01-01T00:00:00.000Z). Optional.'
    },
    end_time: {
      type: 'string' as const,
      description: 'End time in ISO format (e.g., 2024-01-01T23:59:59.999Z). Optional.'
    }
  }
};

const EMPTY_SCHEMA = {
  type: 'object' as const,
  properties: {}
};

export interface PromptManager {
  getOrCreatePrompt(conversationKey: string): ChatPrompt;
  saveConversation(conversationKey: string, prompt: ChatPrompt): Promise<void>;
  clearConversation(conversationKey: string): void;
  getMessagesWithTimestamps(conversationKey: string): MessageRecord[];
  getMessagesByTimeRange(conversationKey: string, startTime?: string, endTime?: string): MessageRecord[];
  getRecentMessages(conversationKey: string, limit?: number): MessageRecord[];
}

export class CorePromptManager implements PromptManager {
  private prompts = new Map<string, ChatPrompt>();

  getOrCreatePrompt(conversationKey: string): ChatPrompt {
    // Check if we already have this prompt in memory (reuse existing)
    if (this.prompts.has(conversationKey)) {
      console.log(`♻️ Reusing existing prompt for conversation: ${conversationKey}`);
      return this.prompts.get(conversationKey)!;
    }

    // First call for this conversation - create new prompt
    console.log(`✨ Creating new prompt for conversation: ${conversationKey}`);
    
    // Get conversation history from storage
    const conversationHistory = storage.get(conversationKey) || [];
    console.log(`📚 Loading ${conversationHistory.length} messages from storage into new prompt`);

    // Create new ChatPrompt with conversation history
    const prompt = new ChatPrompt({
      messages: conversationHistory,
      model: new OpenAIChatModel({
        model: process.env.AOAI_MODEL!,
        apiKey: process.env.AOAI_API_KEY!,
        endpoint: process.env.AOAI_ENDPOINT!,
        apiVersion: '2025-04-01-preview',
      }),
    });

    // Add function definitions to the prompt using the function method
    try {
      prompt.function('get_recent_messages', 
        'Retrieve recent messages from the conversation history with timestamps', 
        GET_RECENT_MESSAGES_SCHEMA, 
        async (args) => {
          return await this.handleFunctionCall(conversationKey, 'get_recent_messages', args);
        });
      
      prompt.function('get_messages_by_time_range', 
        'Retrieve messages from a specific time range', 
        GET_MESSAGES_BY_TIME_RANGE_SCHEMA, 
        async (args) => {
          return await this.handleFunctionCall(conversationKey, 'get_messages_by_time_range', args);
        });
      
      prompt.function('clear_conversation_history', 
        'Clear all conversation history for this chat. Use with caution!', 
        EMPTY_SCHEMA, 
        async (args) => {
          return await this.handleFunctionCall(conversationKey, 'clear_conversation_history', args);
        });
      
      prompt.function('summarize_conversation', 
        'Get a summary of the conversation with message counts and time span', 
        EMPTY_SCHEMA, 
        async (args) => {
          return await this.handleFunctionCall(conversationKey, 'summarize_conversation', args);
        });

      console.log(`✨ Successfully registered 4 functions for conversation: ${conversationKey}`);
    } catch (error) {
      console.error(`❌ Error registering functions for conversation ${conversationKey}:`, error);
    }

    // Store in memory for reuse
    this.prompts.set(conversationKey, prompt);
    console.log(`✨ Created new prompt with 4 functions for key: ${conversationKey}`);

    return prompt;
  }

  // Handle function calls from the LLM
  private async handleFunctionCall(conversationKey: string, functionName: string, args: any): Promise<string> {
    console.log(`🔧 Function call: ${functionName} with args:`, args);
    
    try {
      let result: any;
      
      switch (functionName) {
        case 'get_recent_messages':
          const limit = args.limit || 5;
          const recentMessages = this.getRecentMessages(conversationKey, limit);
          result = {
            status: 'success',
            messages: recentMessages.map(msg => ({
              timestamp: msg.timestamp,
              role: msg.role,
              content: msg.content
            })),
            count: recentMessages.length
          };
          break;

        case 'get_messages_by_time_range':
          const { start_time, end_time } = args;
          const rangeMessages = this.getMessagesByTimeRange(conversationKey, start_time, end_time);
          result = {
            status: 'success',
            messages: rangeMessages.map(msg => ({
              timestamp: msg.timestamp,
              role: msg.role,
              content: msg.content
            })),
            count: rangeMessages.length,
            timeRange: { start: start_time, end: end_time }
          };
          break;

        case 'clear_conversation_history':
          this.clearConversation(conversationKey);
          result = {
            status: 'success',
            message: 'Conversation history has been cleared successfully.'
          };
          break;

        case 'summarize_conversation':
          const allMessages = this.getMessagesWithTimestamps(conversationKey);
          result = {
            status: 'success',
            totalMessages: allMessages.length,
            conversationId: conversationKey,
            oldestMessage: allMessages.length > 0 ? allMessages[0].timestamp : null,
            newestMessage: allMessages.length > 0 ? allMessages[allMessages.length - 1].timestamp : null,
            messagesByRole: allMessages.reduce((acc, msg) => {
              acc[msg.role] = (acc[msg.role] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          };
          break;

        default:
          result = {
            status: 'error',
            message: `Unknown function: ${functionName}`
          };
      }
      
      const jsonResult = JSON.stringify(result);
      console.log(`✅ Function ${functionName} result:`, jsonResult);
      return jsonResult;
      
    } catch (error) {
      console.error(`❌ Error in function call ${functionName}:`, error);
      const errorResult = JSON.stringify({
        status: 'error',
        message: `Error executing function ${functionName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      console.log(`❌ Function ${functionName} error result:`, errorResult);
      return errorResult;
    }
  }
  async saveConversation(conversationKey: string, prompt: ChatPrompt): Promise<void> {
    try {
      // Use prompt.messages.values() to get the current conversation state
      const messagesResult = prompt.messages.values();
      
      // Handle both sync and async results
      const messages = Array.isArray(messagesResult) 
        ? messagesResult 
        : await messagesResult;
      
      // Log all messages for debugging
      console.log(`🔍 All messages before filtering:`, messages.map(msg => ({
        role: msg?.role,
        hasContent: msg?.content !== null && msg?.content !== undefined,
        hasToolCalls: !!(msg as any)?.tool_calls,
        toolCallId: (msg as any)?.tool_call_id,
        contentPreview: typeof msg?.content === 'string' ? msg.content.substring(0, 50) + '...' : msg?.content
      })));
      
      // More sophisticated filtering that preserves function call message structure
      const validMessages = messages.filter(msg => {
        if (!msg || !msg.role) {
          return false;
        }
        
        // Allow function messages (function responses) - Teams AI uses 'function' role
        if (msg.role === 'function') {
          return true; // Function messages are always valid in function calling context
        }
        
        // Allow model messages with tool_calls even if no content - Teams AI uses 'model' for assistant
        if (msg.role === 'model' && (msg as any).tool_calls) {
          return true;
        }
        
        // For other messages, ensure they have content
        return msg.content !== null && msg.content !== undefined && msg.content !== '';
      });
        
      console.log(`💾 Saving ${validMessages.length} valid messages (filtered from ${messages.length} total)`);
      
      // Log any filtered messages for debugging
      if (messages.length !== validMessages.length) {
        const filteredMessages = messages.filter(msg => 
          !validMessages.includes(msg)
        );
        console.log(`🚫 Filtered out ${filteredMessages.length} invalid messages:`, filteredMessages.map(msg => ({
          role: msg?.role,
          content: msg?.content,
          hasToolCalls: !!(msg as any)?.tool_calls
        })));
      }
      
      // Save to storage
      storage.set(conversationKey, validMessages);
    } catch (error) {
      console.error(`❌ Error saving conversation for key ${conversationKey}:`, error);
      console.log('🔍 Prompt.messages structure:', prompt.messages);
      
      // Try to get messages for debugging
      try {
        const messagesForDebug = prompt.messages.values();
        const debugMessages = Array.isArray(messagesForDebug) ? messagesForDebug : await messagesForDebug;
        console.log('🔍 Raw messages result:', debugMessages);
      } catch (debugError) {
        console.log('🔍 Could not retrieve messages for debugging:', debugError);
      }
    }
  }
  clearConversation(conversationKey: string): void {
    // Clear from storage
    storage.clearConversation(conversationKey);
    
    // Remove prompt from memory so it gets recreated fresh next time
    if (this.prompts.has(conversationKey)) {
      this.prompts.delete(conversationKey);
      console.log(`🧹 Removed prompt from memory for conversation: ${conversationKey}`);
      console.log(`💡 Next message will create a fresh prompt for this conversation`);
    }
  }
  getStorage(): SqliteKVStore {
    return storage;
  }

  // ===== Timestamp-based Message Retrieval Methods =====

  getMessagesWithTimestamps(conversationKey: string): MessageRecord[] {
    return storage.getAllMessagesWithTimestamps(conversationKey);
  }

  getMessagesByTimeRange(conversationKey: string, startTime?: string, endTime?: string): MessageRecord[] {
    return storage.getMessagesByTimeRange(conversationKey, startTime, endTime);
  }

  getRecentMessages(conversationKey: string, limit: number = 10): MessageRecord[] {
    return storage.getRecentMessages(conversationKey, limit);
  }
}

// Export singleton instance
export const promptManager = new CorePromptManager();
