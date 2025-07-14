import { ChatPrompt } from '@microsoft/teams.ai';
import { CitationAppearance } from '@microsoft/teams.api';
import { SqliteKVStore } from '../storage/storage';
export declare function routeToPrompt(capabilityType: string, conversationId: string, storage: SqliteKVStore, participants?: Array<{
    name: string;
    id: string;
}>, userTimezone?: string, citationsArray?: CitationAppearance[]): Promise<ChatPrompt>;
