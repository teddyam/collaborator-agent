import { ChatPrompt } from '@microsoft/teams.ai';
import { SqliteKVStore } from '../storage/storage';
export declare function routeToPrompt(agentType: string, conversationId: string, storage: SqliteKVStore, participants?: Array<{
    name: string;
    id: string;
}>, userTimezone?: string, adaptiveCardsArray?: any[]): Promise<ChatPrompt>;
export declare function createAgentRouter(): {
    addRoute: (agentType: string, factory: (conversationId: string, userTimezone?: string) => ChatPrompt) => void;
    route: (agentType: string, conversationId: string, userTimezone?: string) => Promise<ChatPrompt>;
};
