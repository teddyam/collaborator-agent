import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { SqliteKVStore, MessageRecord } from '../storage/storage';
import { SUMMARY_PROMPT } from './instructions';
import { createMockDatabase } from '../mock/mockMessages';
import { USE_MOCK_DATA, DEFAULT_MOCK_CONVERSATION } from '../utils/constants';

// Function schema definitions
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

const SHOW_RECENT_MESSAGES_SCHEMA = {
  type: 'object' as const,
  properties: {
    count: {
      type: 'number' as const,
      description: 'Number of recent messages to display (default: 5)',
      minimum: 1,
      maximum: 20
    }
  }
};

const EMPTY_SCHEMA = {
  type: 'object' as const,
  properties: {}
};

// Initialize storage
const storage = new SqliteKVStore();

export interface PromptManager {
  getOrCreatePrompt(conversationKey: string, promptInstruction?: string): ChatPrompt;
  getOrCreateSummarizerPrompt(conversationKey: string): ChatPrompt;
  clearConversation(conversationKey: string): void;
  getMessagesWithTimestamps(conversationKey: string): MessageRecord[];
  getMessagesByTimeRange(conversationKey: string, startTime?: string, endTime?: string): MessageRecord[];
  getRecentMessages(conversationKey: string, limit?: number): MessageRecord[];
  getStorage(): SqliteKVStore;
  saveMessagesDirectly(conversationKey: string): Promise<void>;
  addMessageToTracking(conversationKey: string, role: string, content: string, activity?: any, name?: string): void;
}

export class CorePromptManager implements PromptManager {
  private prompts = new Map<string, ChatPrompt>();
  private conversationMessages = new Map<string, any[]>(); // Our own message tracking
  private activityContext = new Map<string, any>(); // Store activity context for chat type detection

  getOrCreatePrompt(conversationKey: string, promptInstruction?: string): ChatPrompt {
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

    // Initialize our own message tracking
    this.conversationMessages.set(conversationKey, [...conversationHistory]);

    // Prepare system message if prompt instruction is provided
    const messages = [...conversationHistory];
    // if (promptInstruction) {
    //   console.log(`🎯 Adding custom prompt instruction for ${conversationKey}`);
    //   // Add system message at the beginning if not already present
    //   if (messages.length === 0 || messages[0].role !== 'system') {
    //     messages.unshift({
    //       role: 'system',
    //       content: promptInstruction
    //     });
    //   }
    // }

    // Create new ChatPrompt with conversation history and chain function declarations
    const prompt = new ChatPrompt({
      instructions: promptInstruction,
      messages: messages,
      model: new OpenAIChatModel({
        model: process.env.AOAI_MODEL!,
        apiKey: process.env.AOAI_API_KEY!,
        endpoint: process.env.AOAI_ENDPOINT!,
        apiVersion: '2025-04-01-preview',
      }),
    })
    .function('get_recent_messages', 'Retrieve recent messages from the conversation history with timestamps', GET_RECENT_MESSAGES_SCHEMA, async (args: any) => {
      return await this.handleFunctionCall(conversationKey, 'get_recent_messages', args);
    })
    .function('get_messages_by_time_range', 'Retrieve messages from a specific time range', GET_MESSAGES_BY_TIME_RANGE_SCHEMA, async (args: any) => {
      return await this.handleFunctionCall(conversationKey, 'get_messages_by_time_range', args);
    })
    .function('show_recent_messages', 'Display recent messages in a formatted way for the user', SHOW_RECENT_MESSAGES_SCHEMA, async (args: any) => {
      return await this.handleFunctionCall(conversationKey, 'show_recent_messages', args);
    })
    .function('clear_conversation_history', 'Clear all conversation history for this chat. Use with caution!', EMPTY_SCHEMA, async (args: any) => {
      return await this.handleFunctionCall(conversationKey, 'clear_conversation_history', args);
    })
    .function('summarize_conversation', 'Get a summary of the conversation with message counts and time span', EMPTY_SCHEMA, async (args: any) => {
      return await this.handleFunctionCall(conversationKey, 'summarize_conversation', args);
    })
    .function('debug_database', 'Debug function to print database contents for this conversation', EMPTY_SCHEMA, async (args: any) => {
      return await this.handleFunctionCall(conversationKey, 'debug_database', args);
    })
    .function('create_mock_database', 'Create mock conversations for testing and debugging', EMPTY_SCHEMA, async (args: any) => {
      return await this.handleFunctionCall(conversationKey, 'create_mock_database', args);
    });

    console.log(`✨ Created prompt with chained functions for conversation: ${conversationKey}`);

    // Store in memory for reuse
    this.prompts.set(conversationKey, prompt);
    console.log(`✨ Created new prompt for key: ${conversationKey}`);

    return prompt;
  }

  // Helper method to create a summarizer prompt
  getOrCreateSummarizerPrompt(conversationKey: string): ChatPrompt {
    return this.getOrCreatePrompt(conversationKey, SUMMARY_PROMPT);
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

        case 'show_recent_messages':
          const displayCount = args.count || 5;
          const messagesToShow = this.getRecentMessages(conversationKey, displayCount);
          const messageList = messagesToShow.map(msg => 
            `[${new Date(msg.timestamp).toLocaleString()}] ${msg.role}: ${msg.content}`
          ).join('\n');
          
          result = {
            status: 'success',
            formatted_messages: messageList || 'No messages found',
            count: messagesToShow.length,
            display_text: `📅 Recent messages (${messagesToShow.length}):\n${messageList || 'No messages found'}`
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
            message: '🧹 Conversation history has been cleared successfully.',
            display_text: '🧹 This conversation history has been cleared.'
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

        case 'debug_database':
          const debugOutput = storage.debugPrintDatabase(conversationKey);
          result = {
            status: 'success',
            debug_info: 'Database contents printed to console and returned below',
            database_contents: JSON.parse(debugOutput)
          };
          break;

        case 'create_mock_database':
          this.createMockDatabase('mock-conversation');
          result = {
            status: 'success',
            message: 'Mock database created successfully',
            summary: 'Mock conversation data has been created with sample messages'
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



  // Add a message to our tracking (called when user sends or AI responds)
  addMessageToTracking(conversationKey: string, role: string, content: string, activity?: any, name?: string): void {
    const messages = this.conversationMessages.get(conversationKey) || [];
    const newMessage = { 
      role, 
      content,
      name: name || (role === 'user' ? 'Unknown User' : 'Assistant')
    };
    messages.push(newMessage);
    this.conversationMessages.set(conversationKey, messages);
    
    console.log(`📝 Added ${role} message from "${newMessage.name}" to tracking for ${conversationKey} (total: ${messages.length})`);
    
    // Store or update activity context for better chat type detection
    if (activity) {
      this.activityContext.set(conversationKey, activity);
      console.log(`💾 Updated activity context for ${conversationKey}`);
      
      // Log key activity properties for debugging
      console.log(`🔍 Activity Debug Info:`);
      console.log(`  - channelId: ${activity.channelId}`);
      console.log(`  - serviceUrl: ${activity.serviceUrl}`);
      console.log(`  - conversation.id: ${activity.conversation?.id}`);
      console.log(`  - conversation.isGroup: ${activity.conversation?.isGroup}`);
      console.log(`  - conversation.conversationType: ${activity.conversation?.conversationType}`);
      console.log(`  - conversation.name: ${activity.conversation?.name || 'undefined'}`);
      console.log(`  - conversation.tenantId: ${activity.conversation?.tenantId || 'undefined'}`);
      
      // Immediate chat type detection to log the result
      const detectedType = activity?.conversation?.isGroup === false ? '1-on-1' : 'Group/Channel';
      console.log(`🎯 Detected chat type: ${detectedType}`);
    }
  }

  clearConversation(conversationKey: string): void {
    // Clear from storage
    storage.clearConversation(conversationKey);
    
    // Clear our own message tracking
    this.conversationMessages.delete(conversationKey);
    console.log(`🧹 Cleared message tracking for conversation: ${conversationKey}`);
    
    // Clear activity context
    this.activityContext.delete(conversationKey);
    console.log(`🧹 Cleared activity context for conversation: ${conversationKey}`);
    
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

  // ===== Mock Database for Debug Mode =====
  
  createMockDatabase(conversationId: string = 'mock-conversation'): void {
    // Use the helper function to insert messages with custom timestamps
    const insertMessageFn = (convId: string, role: string, content: string, timestamp: string, name?: string) => {
      storage.insertMessageWithTimestamp(convId, role, content, timestamp, name);
    };
    
    // Create mock database using the external function
    createMockDatabase(insertMessageFn, conversationId);
  }

  /**
   * Initialize mock data if USE_MOCK_DATA is true
   */
  initializeMockDataIfNeeded(): void {
    if (USE_MOCK_DATA) {
      console.log('🎭 Mock mode is enabled - initializing mock database...');
      this.createMockDatabase(DEFAULT_MOCK_CONVERSATION);
      console.log(`✅ Mock database initialized with conversation: ${DEFAULT_MOCK_CONVERSATION}`);
    }
  }

  // Save messages directly without needing a prompt
  async saveMessagesDirectly(conversationKey: string): Promise<void> {
    try {
      // Use our own message tracking to save directly
      const messages = this.conversationMessages.get(conversationKey) || [];
      console.log(`💾 Saving messages directly using tracking: ${messages.length} messages`);
      
      // Smart filtering based on chat type for storage optimization
      let messagesToStore: any[];
      const storedActivity = this.activityContext.get(conversationKey);
      const isOneOnOne = storedActivity?.conversation?.isGroup === false;
      
      if (isOneOnOne) {
        // Store user + AI messages (conversational content)
        messagesToStore = messages.filter(msg => 
          msg.role === 'user' || msg.role === 'model'
        );
        console.log(`💬 1-on-1 chat: Storing user + AI messages (${messagesToStore.length}/${messages.length})`);
      } else {
        // Store only user messages (group chats can get noisy)
        messagesToStore = messages.filter(msg => msg.role === 'user');
        console.log(`👥 Group chat: Storing user messages only (${messagesToStore.length}/${messages.length})`);
      }
      
      // Save filtered messages to storage
      storage.set(conversationKey, messagesToStore);
      
    } catch (error) {
      console.error(`❌ Error saving messages directly for key ${conversationKey}:`, error);
    }
  }
}

// Export singleton instance
export const promptManager = new CorePromptManager();
