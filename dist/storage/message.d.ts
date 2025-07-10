import { SqliteKVStore, MessageRecord } from './storage';
/**
 * Universal message retrieval functions used by all capabilities
 * These functions provide a centralized interface for accessing conversation messages
 */
export declare class MessageManager {
    private storage;
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
     * Get the underlying storage instance for advanced operations
     */
    getStorage(): SqliteKVStore;
}
export declare const messageManager: MessageManager;
export declare function getMessagesWithTimestamps(conversationKey: string): MessageRecord[];
export declare function getMessagesByTimeRange(conversationKey: string, startTime?: string, endTime?: string): MessageRecord[];
export declare function getRecentMessages(conversationKey: string, limit?: number): MessageRecord[];
export declare function getMessageStorage(): SqliteKVStore;
