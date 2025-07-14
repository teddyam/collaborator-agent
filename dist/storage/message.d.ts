import { SqliteKVStore, MessageRecord } from './storage';
/**
 * Universal message retrieval functions used by all capabilities
 * These functions provide a centralized interface for accessing conversation messages
 */
export declare class MessageManager {
    private storage;
    private conversationMessages;
    private activityContext;
    constructor(storage: SqliteKVStore);
    /**
     * Get all messages with timestamps for a conversation
     */
    getMessagesWithTimestamps(conversationKey: string): MessageRecord[];
    /**
     * Get messages within a specific time range
     */
    getMessagesByTimeRange(conversationId: string, startTime?: string, endTime?: string): MessageRecord[];
    /**
     * Get recent messages with a limit
     */
    getRecentMessages(conversationId: string, limit?: number): MessageRecord[];
    /**
     * Add a message to tracking (called when user sends or AI responds)
     */
    addMessageToTracking(conversationKey: string, role: string, content: string, activity?: any, name?: string): void;
    /**
     * Clear conversation from both tracking and storage
     */
    clearConversation(conversationKey: string): void;
    /**
     * Save messages directly without needing a prompt
     */
    saveMessagesDirectly(conversationKey: string): Promise<void>;
    /**
     * Get the underlying storage instance for advanced operations
     */
    getStorage(): SqliteKVStore;
}
export declare const messageManager: MessageManager;
export declare function getMessagesWithTimestamps(conversationKey: string): MessageRecord[];
export declare function getMessagesByTimeRange(conversationKey: string, startTime?: string, endTime?: string): MessageRecord[];
export declare function getRecentMessages(conversationKey: string, limit?: number): MessageRecord[];
export declare function getMessageStorage(): SqliteKVStore;
export declare function addMessageToTracking(conversationKey: string, role: string, content: string, activity?: any, name?: string): void;
export declare function clearConversation(conversationKey: string): void;
export declare function saveMessagesDirectly(conversationKey: string): Promise<void>;
