/**
 * Context object that stores all important information for processing a message
 */
export interface MessageContext {
  text: string;
  conversationKey: string;
  api?: any;
  userId?: string;
  userName?: string;
  currentDateTime: string;
  isPersonalChat: boolean;
  activity: any; // The original Teams activity object
}

/**
 * Global map to store MessageContext objects by activity ID
 * This allows us to pass just the activity ID through function calls
 * and retrieve the full context when needed
 */
const globalContextMap = new Map<string, MessageContext>();

/**
 * Store a MessageContext with the given activity ID
 */
export function setContextById(activityId: string, context: MessageContext): void {
  console.log(`📝 Storing context for activity: ${activityId}`);
  globalContextMap.set(activityId, context);
}

/**
 * Retrieve a MessageContext by activity ID
 */
export function getContextById(activityId: string): MessageContext | undefined {
  const context = globalContextMap.get(activityId);
  if (!context) {
    console.warn(`⚠️ Context not found for activity: ${activityId}`);
  }
  return context;
}

/**
 * Remove a context from the global map
 */
export function removeContextById(activityId: string): void {
  console.log(`🗑️ Removing context for activity: ${activityId}`);
  globalContextMap.delete(activityId);
}

/**
 * Get current number of stored contexts (for debugging)
 */
export function getStoredContextCount(): number {
  return globalContextMap.size;
}

/**
 * JSON Schema for MessageContext used in function definitions
 */
export const MESSAGE_CONTEXT_SCHEMA = {
  type: 'object' as const,
  description: 'The complete message context containing user info, datetime, and conversation details',
  properties: {
    text: {
      type: 'string' as const,
      description: 'The original message text'
    },
    conversationKey: {
      type: 'string' as const,
      description: 'The conversation identifier'
    },
    userId: {
      type: 'string' as const,
      description: 'The user ID who sent the message'
    },
    userName: {
      type: 'string' as const,
      description: 'The display name of the user'
    },
    currentDateTime: {
      type: 'string' as const,
      description: 'The current date and time when the message was processed'
    },
    isPersonalChat: {
      type: 'boolean' as const,
      description: 'Whether this is a personal (1:1) chat or group conversation'
    }
  },
  required: ['text', 'conversationKey', 'currentDateTime', 'isPersonalChat']
};

/**
 * Factory function to create a MessageContext from a Teams activity
 * Now also stores the context in the global map using the activity ID
 */
export function createMessageContext(
  activity: any,
  api?: any
): string {
  const conversationKey = `${activity.conversation.id}`;
  const isPersonalChat = activity.conversation.conversationType === 'personal';
  const text = activity.text || '';
  const userId = activity.from.id;
  const userName = activity.from.name || 'User';
  
  // Get current date/time formatted consistently
  const currentDate = new Date();
  const currentDayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
  const currentDateTime = `${currentDate} (${currentDayOfWeek})`;

  const context: MessageContext = {
    text,
    conversationKey,
    api,
    userId,
    userName,
    currentDateTime,
    isPersonalChat,
    activity
  };

  // Store in global map and return the activity ID
  const activityId = activity.id;
  setContextById(activityId, context);
  
  return activityId;
}
