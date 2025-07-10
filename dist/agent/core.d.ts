import { SqliteKVStore } from '../storage/storage';
import { ManagerResult } from './manager';
export interface PromptManager {
    processUserRequest(conversationKey: string, userRequest: string, api: any, userTimezone?: string): Promise<ManagerResult>;
    processUserRequestWithPersonalMode(conversationKey: string, userRequest: string, api: any, userId: string, userName: string, userTimezone?: string): Promise<ManagerResult>;
    clearConversation(conversationKey: string): void;
    getStorage(): SqliteKVStore;
    saveMessagesDirectly(conversationKey: string): Promise<void>;
    addMessageToTracking(conversationKey: string, role: string, content: string, activity?: any, name?: string): void;
}
export declare class CorePromptManager implements PromptManager {
    private manager;
    private conversationMessages;
    private activityContext;
    constructor();
    processUserRequest(conversationKey: string, userRequest: string, api: any, userTimezone?: string): Promise<ManagerResult>;
    processUserRequestWithPersonalMode(conversationKey: string, userRequest: string, api: any, userId: string, userName: string, userTimezone?: string): Promise<ManagerResult>;
    addMessageToTracking(conversationKey: string, role: string, content: string, activity?: any, name?: string): void;
    clearConversation(conversationKey: string): void;
    getStorage(): SqliteKVStore;
    createMockDatabase(conversationId?: string): void;
    /**
     * Initialize mock data if USE_MOCK_DATA is true
     */
    initializeMockDataIfNeeded(): void;
    saveMessagesDirectly(conversationKey: string): Promise<void>;
}
export declare const promptManager: CorePromptManager;
