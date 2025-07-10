import { ChatPrompt } from '@microsoft/teams.ai';
import { SqliteKVStore } from '../storage/storage';
export declare function routeToPrompt(capabilityType: string, conversationId: string, storage: SqliteKVStore, participants?: Array<{
    name: string;
    id: string;
}>, userTimezone?: string, adaptiveCardsArray?: any[]): Promise<ChatPrompt>;
export declare function createCapabilityRouter(): {
    addRoute: (capabilityType: string, factory: (conversationId: string, userTimezone?: string) => ChatPrompt) => void;
    route: (capabilityType: string, conversationId: string, userTimezone?: string) => Promise<ChatPrompt>;
};
