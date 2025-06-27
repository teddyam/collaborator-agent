import { ChatPrompt } from '@microsoft/teams.ai';
import { SqliteKVStore, MessageRecord } from '../storage/storage';
export interface PromptManager {
    getOrCreatePrompt(conversationKey: string): ChatPrompt;
    saveConversation(conversationKey: string, prompt: ChatPrompt): Promise<void>;
    clearConversation(conversationKey: string): void;
    getMessagesWithTimestamps(conversationKey: string): MessageRecord[];
    getMessagesByTimeRange(conversationKey: string, startTime?: string, endTime?: string): MessageRecord[];
    getRecentMessages(conversationKey: string, limit?: number): MessageRecord[];
}
export declare class CorePromptManager implements PromptManager {
    private prompts;
    getOrCreatePrompt(conversationKey: string): ChatPrompt;
    private handleFunctionCall;
    saveConversation(conversationKey: string, prompt: ChatPrompt): Promise<void>;
    clearConversation(conversationKey: string): void;
    getStorage(): SqliteKVStore;
    getMessagesWithTimestamps(conversationKey: string): MessageRecord[];
    getMessagesByTimeRange(conversationKey: string, startTime?: string, endTime?: string): MessageRecord[];
    getRecentMessages(conversationKey: string, limit?: number): MessageRecord[];
}
export declare const promptManager: CorePromptManager;
