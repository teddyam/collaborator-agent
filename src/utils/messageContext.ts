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
  memory: ConversationMemory; // get convo memory by agent type
  startTime?: string;
  endTime?: string;
}

async function getConversationParticipantsFromAPI(
  api: Client,
  conversationId: string
): Promise<Array<{ name: string; id: string }>> {
  try {
    console.log(`🔍 Fetching conversation members for: ${conversationId}`);

    const members = await api.conversations.members(conversationId).get();

    if (Array.isArray(members)) {
      const participants = members.map((member) => ({
        name: member.name || 'Unknown',
        id: member.aadObjectId || member.id
      }));

      console.log(`👥 Found ${participants.length} conversation members`);
      return participants;
    } else {
      console.warn('⚠️ Expected an array from conversations.members but got:', members);
      return [];
    }
  } catch (error) {
    console.error('❌ Error fetching conversation members:', error);
    return [];
  }
}

/**
 * Factory function to create a MessageContext from a Teams activity
 */
export async function createMessageContext(
  storage: SqliteKVStore,
  activity: IMessageActivity,
  api?: Client
): Promise<MessageContext> {

  const text = activity.text || '';
  const conversationId = `${activity.conversation.id}`;
  const userId = activity.from.id;
  const userName = activity.from.name || 'User';
  const timestamp = activity.timestamp?.toString() || 'Unknown';
  const isPersonalChat = activity.conversation.conversationType === 'personal';
  const activityId = activity.id;

  // Fetch members for group conversations
  let members: Array<{ name: string, id: string }> = [];
  if (api) {
    members = await getConversationParticipantsFromAPI(api, conversationId);
    console.log(members);
  }

  const memory = new ConversationMemory(storage, conversationId);

  const context: MessageContext = {
    text,
    conversationId,
    userId,
    userName,
    timestamp,
    isPersonalChat,
    activityId,
    members,
    memory,
  };

  return context;
}

