import { ChatPrompt } from '@microsoft/teams.ai';
import { CitationAppearance } from '@microsoft/teams.api';
import { MessageRecord } from '../storage/storage';
import { BaseCapability, CapabilityConfig } from './capability';
/**
 * Create a Citation object from a message record for display in Teams
 */
export declare function createCitationFromRecord(message: MessageRecord, conversationId: string): CitationAppearance;
/**
 * Refactored Search Capability that implements the unified capability interface
 */
export declare class SearchCapability extends BaseCapability {
    readonly name = "search";
    createPrompt(config: CapabilityConfig): ChatPrompt;
    getFunctionSchemas(): Array<{
        name: string;
        schema: any;
    }>;
}
