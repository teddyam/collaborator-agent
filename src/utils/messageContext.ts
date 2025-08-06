import { IMessageActivity } from "@microsoft/teams.api";
import { Client } from "@microsoft/teams.api";
import { SqliteKVStore } from "../storage/storage";
import { ConversationMemory } from '../storage/conversationMemory';

/**
 * Context object that stores all important information for processing a message
 */
export interface MessageContext {
  text: string;
  conversationId: string;
  userId?: string;
  userName: string;
  timestamp: string;
  isPersonalChat: boolean;
  activityId: string;
  members: Array<{ name: string, id: string }>; // Available conversation members
}

// // Import member fetching function from actionItems
// async function getConversationParticipantsFromAPI(api: Client, conversationId: string): Promise<Array<{ name: string, id: string }>> {
//   if (!api || !conversationId) {
//     return [];
//   }

//   try {
//     console.log(`🔍 Fetching conversation members for: ${conversationId}`);

//     const response = await api.conversations.members(conversationId).get();

//     if (response && response.value && Array.isArray(response.value)) {
//       const members = response.value.map((member: any) => ({
//         name: member.name || member.givenName || 'Unknown',
//         id: member.id || member.objectId
//       }));

//       console.log(`👥 Found ${members.length} conversation members`);
//       return members;
//     } else {
//       console.warn('⚠️ Unexpected response format when fetching members:', response);
//       return [];
//     }
//   } catch (error) {
//     console.error('❌ Error fetching conversation members:', error);
//     return [];
//   }
// }

/**
 * Factory function to create a MessageContext from a Teams activity
 * Now also stores the context in the global map using the activity ID
 */
export async function createMessageContext(
  storage: SqliteKVStore,
  activity: IMessageActivity, // import
  api?: Client
): Promise<{ context: MessageContext; conversationHistory: ConversationMemory }> {

  const text = activity.text || '';
  const conversationId = `${activity.conversation.id}`;
  const userId = activity.from.id;
  const userName = activity.from.name || 'User';
  const timestamp = activity.timestamp?.toString() || 'Unknown';
  const isPersonalChat = activity.conversation.conversationType === 'personal';
  const activityId = activity.id;

  // Fetch members for group conversations
  let members: Array<{ name: string, id: string }> = [];
  // if (api && !isPersonalChat) {
  //   members = await getConversationParticipantsFromAPI(api, conversationId);
  // }

  const context: MessageContext = {
    text,
    conversationId,
    userId,
    userName,
    timestamp,
    isPersonalChat,
    activityId,
    members
  };

  const conversationHistory = new ConversationMemory(storage, context);

  return { context, conversationHistory };
}

