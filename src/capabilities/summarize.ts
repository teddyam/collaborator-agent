import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { SqliteKVStore } from '../storage/storage';
import { SUMMARY_PROMPT } from '../agent/instructions';

// Function schemas for the summarizer
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

/**
 * Creates a specialized summarizer prompt with conversation history and summarization functions
 */
export function createSummarizerPrompt(conversationId: string, storage: SqliteKVStore): ChatPrompt {
  console.log(`📋 Creating Summarizer Agent for conversation: ${conversationId}`);
  
  // Get conversation history with names and timestamps
  const conversationHistoryWithNames = storage.getAllMessagesWithTimestamps(conversationId);
  console.log(`📚 Loading ${conversationHistoryWithNames.length} messages with names for summarizer`);
  
  // Convert to the format expected by ChatPrompt, including names in the content for user messages
  const conversationHistory = conversationHistoryWithNames.map(msg => ({
    role: msg.role,
    content: msg.role === 'user' ? `${msg.name}: ${msg.content}` : msg.content
  }));

  // Create the specialized summarizer prompt
  const summarizerPrompt = new ChatPrompt({
    instructions: SUMMARY_PROMPT,
    messages: conversationHistory as any,
    model: new OpenAIChatModel({
      model: process.env.AOAI_MODEL!,
      apiKey: process.env.AOAI_API_KEY!,
      endpoint: process.env.AOAI_ENDPOINT!,
      apiVersion: '2025-04-01-preview',
    }),
  })
  .function('get_recent_messages', 'Retrieve recent messages from the conversation history with timestamps', GET_RECENT_MESSAGES_SCHEMA, async (args: any) => {
    const limit = args.limit || 5;
    const recentMessages = storage.getRecentMessages(conversationId, limit);
    return JSON.stringify({
      status: 'success',
      messages: recentMessages.map(msg => ({
        timestamp: msg.timestamp,
        role: msg.role,
        name: msg.name,
        content: msg.content
      })),
      count: recentMessages.length
    });
  })
  .function('get_messages_by_time_range', 'Retrieve messages from a specific time range', GET_MESSAGES_BY_TIME_RANGE_SCHEMA, async (args: any) => {
    const { start_time, end_time } = args;
    const rangeMessages = storage.getMessagesByTimeRange(conversationId, start_time, end_time);
    return JSON.stringify({
      status: 'success',
      messages: rangeMessages.map(msg => ({
        timestamp: msg.timestamp,
        role: msg.role,
        name: msg.name,
        content: msg.content
      })),
      count: rangeMessages.length,
      timeRange: { start: start_time, end: end_time }
    });
  })
  .function('show_recent_messages', 'Display recent messages in a formatted way for the user', SHOW_RECENT_MESSAGES_SCHEMA, async (args: any) => {
    const displayCount = args.count || 5;
    const messagesToShow = storage.getRecentMessages(conversationId, displayCount);
    const messageList = messagesToShow.map(msg => 
      `[${new Date(msg.timestamp).toLocaleString()}] ${msg.name} (${msg.role}): ${msg.content}`
    ).join('\n');
    
    return JSON.stringify({
      status: 'success',
      formatted_messages: messageList || 'No messages found',
      count: messagesToShow.length,
      display_text: `📅 Recent messages (${messagesToShow.length}):\n${messageList || 'No messages found'}`
    });
  })
  .function('summarize_conversation', 'Get a summary of the conversation with message counts and time span', EMPTY_SCHEMA, async (_args: any) => {
    const allMessages = storage.getAllMessagesWithTimestamps(conversationId);
    return JSON.stringify({
      status: 'success',
      totalMessages: allMessages.length,
      conversationId: conversationId,
      oldestMessage: allMessages.length > 0 ? allMessages[0].timestamp : null,
      newestMessage: allMessages.length > 0 ? allMessages[allMessages.length - 1].timestamp : null,
      messagesByRole: allMessages.reduce((acc, msg) => {
        acc[msg.role] = (acc[msg.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      messagesByName: allMessages.reduce((acc, msg) => {
        acc[msg.name] = (acc[msg.name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      participants: [...new Set(allMessages.map(msg => msg.name))],
      messages: allMessages.map(msg => ({
        timestamp: msg.timestamp,
        role: msg.role,
        name: msg.name,
        content: msg.content
      }))
    });
  });

  console.log(`📋 Summarizer Agent created with conversation history and functions`);
  return summarizerPrompt;
}

/**
 * Helper function to get recent messages with proper attribution
 */
export function getRecentMessagesWithNames(storage: SqliteKVStore, conversationId: string, limit: number = 10) {
  return storage.getRecentMessages(conversationId, limit);
}

/**
 * Helper function to get messages by time range with proper attribution
 */
export function getMessagesByTimeRangeWithNames(storage: SqliteKVStore, conversationId: string, startTime?: string, endTime?: string) {
  return storage.getMessagesByTimeRange(conversationId, startTime, endTime);
}

/**
 * Helper function to get all messages with timestamps and names
 */
export function getAllMessagesWithNames(storage: SqliteKVStore, conversationId: string) {
  return storage.getAllMessagesWithTimestamps(conversationId);
}
