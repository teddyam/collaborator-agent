import { CitationAppearance } from '@microsoft/teams.api';
import { SqliteKVStore } from '../storage/storage';
export interface ManagerResult {
    response: string;
    delegatedCapability: string | null;
    citations?: CitationAppearance[];
}
export declare class ManagerPrompt {
    private prompt;
    private storage;
    private currentAPI?;
    private currentUserId?;
    private currentUserName?;
    private currentUserTimezone?;
    private lastDelegatedCapability;
    private lastSearchCitations;
    private summarizerCapability;
    private searchCapability;
    private actionItemsCapability;
    constructor(storage: SqliteKVStore);
    private initializePrompt;
    processRequest(userRequest: string, conversationId: string, userTimezone?: string): Promise<ManagerResult>;
    processRequestWithAPI(userRequest: string, conversationId: string, api: any, userTimezone?: string): Promise<ManagerResult>;
    processRequestWithPersonalMode(userRequest: string, conversationId: string, api: any, userId: string, userName: string, userTimezone?: string): Promise<ManagerResult>;
    private delegateToSummarizer;
    private delegateToActionItems;
    private delegateToSearch;
    addCapability(capabilityName: string, _description: string, _functionSchema: any, _handler: Function): void;
}
