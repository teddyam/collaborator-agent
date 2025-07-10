"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptManager = exports.CorePromptManager = void 0;
const storage_1 = require("../storage/storage");
const mockMessages_1 = require("../mock/mockMessages");
const constants_1 = require("../utils/constants");
const manager_1 = require("./manager");
// Initialize storage
const storage = new storage_1.SqliteKVStore();
class CorePromptManager {
    manager;
    conversationMessages = new Map(); // Our own message tracking
    activityContext = new Map(); // Store activity context for chat type detection
    constructor() {
        this.manager = new manager_1.ManagerPrompt(storage);
    }
    // Main entry point for processing user requests with API access
    async processUserRequest(conversationKey, userRequest, api, userTimezone) {
        return await this.manager.processRequestWithAPI(userRequest, conversationKey, api, userTimezone);
    }
    // Main entry point for processing user requests with personal mode (for 1:1 chats)
    async processUserRequestWithPersonalMode(conversationKey, userRequest, api, userId, userName, userTimezone) {
        return await this.manager.processRequestWithPersonalMode(userRequest, conversationKey, api, userId, userName, userTimezone);
    }
    // Add a message to our tracking (called when user sends or AI responds)
    addMessageToTracking(conversationKey, role, content, activity, name) {
        const messages = this.conversationMessages.get(conversationKey) || [];
        const newMessage = {
            role,
            content,
            name: name || (role === 'user' ? 'Unknown User' : 'Assistant'),
            activity_id: activity?.id || undefined
        };
        messages.push(newMessage);
        this.conversationMessages.set(conversationKey, messages);
        console.log(`📝 Added ${role} message from "${newMessage.name}" to tracking for ${conversationKey} (total: ${messages.length})`);
        if (activity) {
            this.activityContext.set(conversationKey, activity);
            const detectedType = activity?.conversation?.isGroup === false ? '1-on-1' : 'Group/Channel';
            console.log(`🎯 Detected chat type: ${detectedType}`);
        }
    }
    clearConversation(conversationKey) {
        storage.clearConversation(conversationKey);
        this.conversationMessages.delete(conversationKey);
        this.activityContext.delete(conversationKey);
        console.log(`🧹 Cleared conversation: ${conversationKey}`);
    }
    getStorage() {
        return storage;
    }
    // ===== Mock Database for Debug Mode =====
    createMockDatabase(conversationId = 'mock-conversation') {
        const insertMessageFn = (convId, role, content, timestamp, name, activityId) => {
            storage.insertMessageWithTimestamp(convId, role, content, timestamp, name, activityId);
        };
        (0, mockMessages_1.createMockDatabase)(insertMessageFn, conversationId);
    }
    /**
     * Initialize mock data if USE_MOCK_DATA is true
     */
    initializeMockDataIfNeeded() {
        if (constants_1.USE_MOCK_DATA) {
            console.log('🎭 Mock mode is enabled - initializing mock database...');
            this.createMockDatabase(constants_1.DEFAULT_MOCK_CONVERSATION);
            console.log(`✅ Mock database initialized with conversation: ${constants_1.DEFAULT_MOCK_CONVERSATION}`);
        }
    }
    // Save messages directly without needing a prompt
    async saveMessagesDirectly(conversationKey) {
        try {
            const messages = this.conversationMessages.get(conversationKey) || [];
            console.log(`💾 Saving messages directly using tracking: ${messages.length} messages`);
            let messagesToStore;
            const storedActivity = this.activityContext.get(conversationKey);
            const isOneOnOne = storedActivity?.conversation?.isGroup === false;
            if (isOneOnOne) {
                messagesToStore = messages.filter(msg => msg.role === 'user' || msg.role === 'model');
                console.log(`💬 1-on-1 chat: Storing user + AI messages (${messagesToStore.length}/${messages.length})`);
            }
            else {
                messagesToStore = messages.filter(msg => msg.role === 'user');
                console.log(`👥 Group chat: Storing user messages only (${messagesToStore.length}/${messages.length})`);
            }
            storage.set(conversationKey, messagesToStore);
        }
        catch (error) {
            console.error(`❌ Error saving messages directly for key ${conversationKey}:`, error);
        }
    }
}
exports.CorePromptManager = CorePromptManager;
// Export singleton instance
exports.promptManager = new CorePromptManager();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29yZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hZ2VudC9jb3JlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLGdEQUFtRDtBQUNuRCx1REFBMEQ7QUFDMUQsa0RBQThFO0FBQzlFLHVDQUF5RDtBQUV6RCxxQkFBcUI7QUFDckIsTUFBTSxPQUFPLEdBQUcsSUFBSSx1QkFBYSxFQUFFLENBQUM7QUFXcEMsTUFBYSxpQkFBaUI7SUFDcEIsT0FBTyxDQUFnQjtJQUN2QixvQkFBb0IsR0FBRyxJQUFJLEdBQUcsRUFBaUIsQ0FBQyxDQUFDLDJCQUEyQjtJQUM1RSxlQUFlLEdBQUcsSUFBSSxHQUFHLEVBQWUsQ0FBQyxDQUFDLGlEQUFpRDtJQUVuRztRQUNFLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSx1QkFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRCxnRUFBZ0U7SUFDaEUsS0FBSyxDQUFDLGtCQUFrQixDQUFDLGVBQXVCLEVBQUUsV0FBbUIsRUFBRSxHQUFRLEVBQUUsWUFBcUI7UUFDcEcsT0FBTyxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUMsV0FBVyxFQUFFLGVBQWUsRUFBRSxHQUFHLEVBQUUsWUFBWSxDQUFDLENBQUM7SUFDbkcsQ0FBQztJQUVELG1GQUFtRjtJQUNuRixLQUFLLENBQUMsa0NBQWtDLENBQUMsZUFBdUIsRUFBRSxXQUFtQixFQUFFLEdBQVEsRUFBRSxNQUFjLEVBQUUsUUFBZ0IsRUFBRSxZQUFxQjtRQUN0SixPQUFPLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyw4QkFBOEIsQ0FBQyxXQUFXLEVBQUUsZUFBZSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQzlILENBQUM7SUFFRCx3RUFBd0U7SUFDeEUsb0JBQW9CLENBQUMsZUFBdUIsRUFBRSxJQUFZLEVBQUUsT0FBZSxFQUFFLFFBQWMsRUFBRSxJ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