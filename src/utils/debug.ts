import { promptManager } from '../agent/core';

// Interface for debug command response
interface DebugResponse {
  isDebugCommand: boolean;
  response?: string;
}

/**
 * Centralized debug command handler
 * Processes debug commands and returns appropriate responses
 */
export async function handleDebugCommand(text: string, conversationKey: string): Promise<DebugResponse> {
  const trimmedText = text?.trim();
  
  if (!trimmedText) {
    return { isDebugCommand: false };
  }

  switch (trimmedText) {
    case 'msg.db':
      return handleMessageDatabaseDebug(conversationKey);
    
    case 'clear.convo':
      return handleClearConversation(conversationKey);
    
    case 'action.items':
      return handleActionItemsDebug(conversationKey);
    
    case 'clear.actions':
      return handleClearActionItems(conversationKey);
    
    case 'help.debug':
      return handleDebugHelp();
    
    default:
      return { isDebugCommand: false };
  }
}

/**
 * Show database debug information
 */
function handleMessageDatabaseDebug(conversationKey: string): DebugResponse {
  const debugOutput = promptManager.getStorage().debugPrintDatabase(conversationKey);
  
  return {
    isDebugCommand: true,
    response: `🔍 **Database Debug Info:**\n\`\`\`json\n${debugOutput}\n\`\`\``
  };
}

/**
 * Clear conversation history
 */
function handleClearConversation(conversationKey: string): DebugResponse {
  promptManager.clearConversation(conversationKey);
  
  return {
    isDebugCommand: true,
    response: `🧹 **Conversation Cleared!**\n\nAll conversation history for this chat has been cleared from the database.\n\n💡 This includes:\n- Message history\n- Timestamps\n- Context data\n\nYou can start fresh now!`
  };
}

/**
 * Show action items debug information
 */
function handleActionItemsDebug(conversationKey: string): DebugResponse {
  const storage = promptManager.getStorage();
  const actionItems = storage.getActionItemsByConversation(conversationKey);
  const summary = storage.getActionItemsSummary();
  
  let response = `📋 **Action Items Debug Info:**\n\n`;
  
  if (actionItems.length > 0) {
    response += `**Action Items for this conversation (${actionItems.length}):**\n`;
    actionItems.forEach(item => {
      const statusEmoji = item.status === 'completed' ? '✅' : 
                         item.status === 'in_progress' ? '🔄' : 
                         item.status === 'cancelled' ? '❌' : '⏳';
      const priorityEmoji = item.priority === 'urgent' ? '🔥' : 
                           item.priority === 'high' ? '⚡' : 
                           item.priority === 'medium' ? '📍' : '🔹';
      
      response += `\n${statusEmoji} **#${item.id}** ${priorityEmoji} ${item.title}\n`;
      response += `   👤 Assigned to: ${item.assigned_to}\n`;
      response += `   📝 ${item.description}\n`;
      response += `   📅 Created: ${new Date(item.created_at).toLocaleDateString()}\n`;
      if (item.due_date) {
        response += `   ⏰ Due: ${new Date(item.due_date).toLocaleDateString()}\n`;
      }
    });
  } else {
    response += `**No action items found for this conversation.**\n`;
  }
  
  response += `\n**Overall Summary:**\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\``;
  
  return {
    isDebugCommand: true,
    response
  };
}

/**
 * Clear all action items for the conversation
 */
function handleClearActionItems(conversationKey: string): DebugResponse {
  const storage = promptManager.getStorage();
  const clearedCount = storage.clearActionItems(conversationKey);
  
  return {
    isDebugCommand: true,
    response: `🧹 **Action Items Cleared!**\n\n${clearedCount} action items have been removed from this conversation.\n\n💡 This includes:\n- All pending tasks\n- Completed action items\n- Assignment history\n\nAction item tracking has been reset for this chat.`
  };
}

/**
 * Show debug help with all available commands
 */
function handleDebugHelp(): DebugResponse {
  const helpText = `🛠️ **Debug Commands Help**\n\n**Available Commands:**\n\n` +
    `📊 **\`msg.db\`** - Show database and message history debug info\n` +
    `🧹 **\`clear.convo\`** - Clear conversation messages and history\n` +
    `📋 **\`action.items\`** - Show action items debug info\n` +
    `🗑️ **\`clear.actions\`** - Clear all action items for this conversation\n` +
    `❓ **\`help.debug\`** - Show this help message\n\n` +
    `**Usage:** Simply type any command in the chat to execute it.\n\n` +
    `💡 **Note:** Debug commands work in any conversation and only affect the current chat.`;

  return {
    isDebugCommand: true,
    response: helpText
  };
}

/**
 * Get list of all available debug commands
 */
export function getDebugCommands(): string[] {
  return [
    'msg.db',
    'clear.convo', 
    'action.items',
    'clear.actions',
    'help.debug'
  ];
}

/**
 * Check if a text string is a debug command
 */
export function isDebugCommand(text: string): boolean {
  const trimmedText = text?.trim();
  return getDebugCommands().includes(trimmedText);
}
