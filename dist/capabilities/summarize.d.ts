import { ChatPrompt } from '@microsoft/teams.ai';
/**
 * Creates a specialized summarizer prompt with function tools for dynamic message retrieval
 */
export declare function createSummarizerPrompt(conversationId: string, userTimezone?: string): ChatPrompt;
/**
 * Helper function to get recent messages with proper attribution
 */
export declare function getRecentMessagesWithNames(conversationId: string, limit?: number): import("../storage/storage").MessageRecord[];
/**
 * Helper function to get messages by time range with proper attribution
 */
export declare function getMessagesByTimeRangeWithNames(conversationId: string, startTime?: string, endTime?: string): import("../storage/storage").MessageRecord[];
/**
 * Helper function to get all messages with timestamps and names
 */
export declare function getAllMessagesWithNames(conversationId: string): import("../storage/storage").MessageRecord[];
