import { ChatPrompt, Message } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { SqliteKVStore, MessageRecord } from '../storage/storage';

// Initialize storage
const storage = new SqliteKVStore();

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

    // Store in memory for reuse
    this.prompts.set(conversationKey, prompt);
    console.log(`✨ Created new prompt for key: ${conversationKey}`);

    return prompt;
  }
  async saveConversation(conversationKey: string, prompt: ChatPrompt): Promise<void> {
    try {
      // Use prompt.messages.values() to get the current conversation state
      const messagesResult = prompt.messages.values();
      
      // Handle both sync and async results
      const messages = Array.isArray(messagesResult) 
        ? messagesResult 
        : await messagesResult;
        
      console.log(`💾 Saving ${messages.length} messages using prompt.messages.values()`);
      
      // Save to storage
      storage.set(conversationKey, messages);
    } catch (error) {
      console.error(`❌ Error saving conversation for key ${conversationKey}:`, error);
      console.log('🔍 Prompt.messages structure:', prompt.messages);
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
