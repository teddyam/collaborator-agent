"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptManager = exports.CorePromptManager = void 0;
const teams_ai_1 = require("@microsoft/teams.ai");
const teams_openai_1 = require("@microsoft/teams.openai");
const storage_1 = require("../storage/storage");
// Initialize storage
const storage = new storage_1.SqliteKVStore();
// Function definitions for the AI model - restructured to avoid schema issues
const GET_RECENT_MESSAGES_SCHEMA = {
    type: 'object',
    properties: {
        limit: {
            type: 'number',
            description: 'Number of recent messages to retrieve (default: 5, max: 20)',
            minimum: 1,
            maximum: 20
        }
    }
};
const GET_MESSAGES_BY_TIME_RANGE_SCHEMA = {
    type: 'object',
    properties: {
        start_time: {
            type: 'string',
            description: 'Start time in ISO format (e.g., 2024-01-01T00:00:00.000Z). Optional.'
        },
        end_time: {
            type: 'string',
            description: 'End time in ISO format (e.g., 2024-01-01T23:59:59.999Z). Optional.'
        }
    }
};
const EMPTY_SCHEMA = {
    type: 'object',
    properties: {}
};
class CorePromptManager {
    prompts = new Map();
    getOrCreatePrompt(conversationKey) {
        // Check if we already have this prompt in memory (reuse existing)
        if (this.prompts.has(conversationKey)) {
            console.log(`♻️ Reusing existing prompt for conversation: ${conversationKey}`);
            return this.prompts.get(conversationKey);
        }
        // First call for this conversation - create new prompt
        console.log(`✨ Creating new prompt for conversation: ${conversationKey}`);
        // Get conversation history from storage
        const conversationHistory = storage.get(conversationKey) || [];
        console.log(`📚 Loading ${conversationHistory.length} messages from storage into new prompt`);
        // Create new ChatPrompt with conversation history
        const prompt = new teams_ai_1.ChatPrompt({
            messages: conversationHistory,
            model: new teams_openai_1.OpenAIChatModel({
                model: process.env.AOAI_MODEL,
                apiKey: process.env.AOAI_API_KEY,
                endpoint: process.env.AOAI_ENDPOINT,
                apiVersion: '2025-04-01-preview',
            }),
        });
        // Add function definitions to the prompt using the function method
        prompt.function('get_recent_messages', 'Retrieve recent messages from the conversation history with timestamps', GET_RECENT_MESSAGES_SCHEMA, async (args) => {
            return await this.handleFunctionCall(conversationKey, 'get_recent_messages', args);
        });
        prompt.function('get_messages_by_time_range', 'Retrieve messages from a specific time range', GET_MESSAGES_BY_TIME_RANGE_SCHEMA, async (args) => {
            return await this.handleFunctionCall(conversationKey, 'get_messages_by_time_range', args);
        });
        prompt.function('clear_conversation_history', 'Clear all conversation history for this chat. Use with caution!', EMPTY_SCHEMA, async (args) => {
            return await this.handleFunctionCall(conversationKey, 'clear_conversation_history', args);
        });
        prompt.function('summarize_conversation', 'Get a summary of the conversation with message counts and time span', EMPTY_SCHEMA, async (args) => {
            return await this.handleFunctionCall(conversationKey, 'summarize_conversation', args);
        });
        // Store in memory for reuse
        this.prompts.set(conversationKey, prompt);
        console.log(`✨ Created new prompt with 4 functions for key: ${conversationKey}`);
        return prompt;
    }
    // Handle function calls from the LLM
    async handleFunctionCall(conversationKey, functionName, args) {
        console.log(`🔧 Function call: ${functionName} with args:`, args);
        try {
            let result;
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
                        }, {})
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
        }
        catch (error) {
            console.error(`❌ Error in function call ${functionName}:`, error);
            const errorResult = JSON.stringify({
                status: 'error',
                message: `Error executing function ${functionName}: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
            console.log(`❌ Function ${functionName} error result:`, errorResult);
            return errorResult;
        }
    }
    async saveConversation(conversationKey, prompt) {
        try {
            // Use prompt.messages.values() to get the current conversation state
            const messagesResult = prompt.messages.values();
            // Handle both sync and async results
            const messages = Array.isArray(messagesResult)
                ? messagesResult
                : await messagesResult;
            // Filter out any null/undefined messages and ensure all messages have content
            const validMessages = messages.filter(msg => msg &&
                msg.role &&
                msg.content !== null &&
                msg.content !== undefined &&
                msg.content !== '');
            console.log(`💾 Saving ${validMessages.length} valid messages (filtered from ${messages.length} total) using prompt.messages.values()`);
            // Log any filtered messages for debugging
            if (messages.length !== validMessages.length) {
                const filteredMessages = messages.filter(msg => !msg || !msg.role || msg.content === null || msg.content === undefined || msg.content === '');
                console.log(`🚫 Filtered out ${filteredMessages.length} invalid messages:`, filteredMessages);
            }
            // Save to storage
            storage.set(conversationKey, validMessages);
        }
        catch (error) {
            console.error(`❌ Error saving conversation for key ${conversationKey}:`, error);
            console.log('🔍 Prompt.messages structure:', prompt.messages);
            // Try to get messages for debugging
            try {
                const messagesForDebug = prompt.messages.values();
                const debugMessages = Array.isArray(messagesForDebug) ? messagesForDebug : await messagesForDebug;
                console.log('🔍 Raw messages result:', debugMessages);
            }
            catch (debugError) {
                console.log('🔍 Could not retrieve messages for debugging:', debugError);
            }
        }
    }
    clearConversation(conversationKey) {
        // Clear from storage
        storage.clearConversation(conversationKey);
        // Remove prompt from memory so it gets recreated fresh next time
        if (this.prompts.has(conversationKey)) {
            this.prompts.delete(conversationKey);
            console.log(`🧹 Removed prompt from memory for conversation: ${conversationKey}`);
            console.log(`💡 Next message will create a fresh prompt for this conversation`);
        }
    }
    getStorage() {
        return storage;
    }
    // ===== Timestamp-based Message Retrieval Methods =====
    getMessagesWithTimestamps(conversationKey) {
        return storage.getAllMessagesWithTimestamps(conversationKey);
    }
    getMessagesByTimeRange(conversationKey, startTime, endTime) {
        return storage.getMessagesByTimeRange(conversationKey, startTime, endTime);
    }
    getRecentMessages(conversationKey, limit = 10) {
        return storage.getRecentMessages(conversationKey, limit);
    }
}
exports.CorePromptManager = CorePromptManager;
// Export singleton instance
exports.promptManager = new CorePromptManager();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29yZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hZ2VudC9jb3JlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLGtEQUFpRDtBQUNqRCwwREFBMEQ7QUFDMUQsZ0RBQWtFO0FBRWxFLHFCQUFxQjtBQUNyQixNQUFNLE9BQU8sR0FBRyxJQUFJLHVCQUFhLEVBQUUsQ0FBQztBQUVwQyw4RUFBOEU7QUFDOUUsTUFBTSwwQkFBMEIsR0FBRztJQUNqQyxJQUFJLEVBQUUsUUFBaUI7SUFDdkIsVUFBVSxFQUFFO1FBQ1YsS0FBSyxFQUFFO1lBQ0wsSUFBSSxFQUFFLFFBQWlCO1lBQ3ZCLFdBQVcsRUFBRSw2REFBNkQ7WUFDMUUsT0FBTyxFQUFFLENBQUM7WUFDVixPQUFPLEVBQUUsRUFBRTtTQUNaO0tBQ0Y7Q0FDRixDQUFDO0FBRUYsTUFBTSxpQ0FBaUMsR0FBRztJQUN4QyxJQUFJLEVBQUUsUUFBaUI7SUFDdkIsVUFBVSxFQUFFO1FBQ1YsVUFBVSxFQUFFO1lBQ1YsSUFBSSxFQUFFLFFBQWlCO1lBQ3ZCLFdBQVcsRUFBRSxzRUFBc0U7U0FDcEY7UUFDRCxRQUFRLEVBQUU7WUFDUixJQUFJLEVBQUUsUUFBaUI7WUFDdkIsV0FBVyxFQUFFLG9FQUFvRTtTQUNsRjtLQUNGO0NBQ0YsQ0FBQztBQUVGLE1BQU0sWUFBWSxHQUFHO0lBQ25CLElBQUksRUFBRSxRQUFpQjtJQUN2QixVQUFVLEVBQUUsRUFBRTtDQUNmLENBQUM7QUFXRixNQUFhLGlCQUFpQjtJQUNwQixPQUFPLEdBQUcsSUFBSSxHQUFHLEVBQXNCLENBQUM7SUFFaEQsaUJBQWlCLENBQUMsZUFBdUI7UUFDdkMsa0VBQWtFO1FBQ2xFLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQztZQUN0QyxPQUFPLENBQUMsR0FBRyxDQUFDLGdEQUFnRCxlQUFlLEVBQUUsQ0FBQyxDQUFDO1lBQy9FLE9BQU8sSUFBSSxDQUFD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