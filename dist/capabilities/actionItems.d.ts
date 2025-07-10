import { ChatPrompt } from '@microsoft/teams.ai';
import { SqliteKVStore } from '../storage/storage';
/**
 * Creates a specialized action items prompt with function tools for managing action items
 * Handles both group conversations and personal DMs
 */
export declare function createActionItemsPrompt(conversationId: string, storage: SqliteKVStore, availableMembers?: Array<{
    name: string;
    id: string;
}>, isPersonalChat?: boolean, currentUserId?: string, currentUserName?: string, userTimezone?: string): ChatPrompt;
/**
 * Helper function to get conversation participants using Teams API
 */
export declare function getConversationParticipantsFromAPI(api: any, conversationId: string): Promise<Array<{
    name: string;
    id: string;
}>>;
