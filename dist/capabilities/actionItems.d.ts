import { ChatPrompt } from '@microsoft/teams.ai';
import { BaseCapability, CapabilityConfig } from './capability';
/**
 * Refactored Action Items Capability that implements the unified capability interface
 */
export declare class ActionItemsCapability extends BaseCapability {
    readonly name = "action_items";
    createPrompt(config: CapabilityConfig): ChatPrompt;
    getFunctionSchemas(): Array<{
        name: string;
        schema: any;
    }>;
}
/**
 * Helper function to get conversation participants using Teams API
 */
export declare function getConversationParticipantsFromAPI(api: any, conversationId: string): Promise<Array<{
    name: string;
    id: string;
}>>;
