"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDebugCommand = handleDebugCommand;
exports.getDebugCommands = getDebugCommands;
exports.isDebugCommand = isDebugCommand;
const core_1 = require("../agent/core");
const message_1 = require("../storage/message");
/**
 * Centralized debug command handler
 * Processes debug commands and returns appropriate responses
 */
async function handleDebugCommand(text, conversationKey) {
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
        case 'personal.actions':
            return handlePersonalActionItemsDebug(conversationKey);
        case 'feedback.stats':
            return handleFeedbackStats();
        case 'feedback.clear':
            return handleClearFeedback();
        default:
            return { isDebugCommand: false };
    }
}
/**
 * Show database debug information
 */
function handleMessageDatabaseDebug(conversationKey) {
    const storage = core_1.promptManager.getStorage();
    const debugOutput = storage.debugPrintDatabase(conversationKey);
    // Get message records to show activity ID statistics
    const messages = (0, message_1.getMessagesWithTimestamps)(conversationKey);
    const messagesWithIds = messages.filter(msg => msg.activity_id && msg.activity_id !== null);
    let response = `🔍 **Database Debug Info:**\n\n`;
    response += `📊 **Activity ID Statistics:**\n`;
    response += `- Total messages: ${messages.length}\n`;
    response += `- Messages with IDs: ${messagesWithIds.length}\n`;
    response += `- Coverage: ${messages.length > 0 ? Math.round((messagesWithIds.length / messages.length) * 100) : 0}%\n\n`;
    if (messagesWithIds.length > 0) {
        response += `� **Recent Messages with Activity IDs:**\n`;
        messagesWithIds.slice(-5).forEach(msg => {
            const preview = msg.content.substring(0, 30) + (msg.content.length > 30 ? '...' : '');
            response += `- ${msg.name} (${msg.role}): "${preview}" [ID: ${msg.activity_id}]\n`;
        });
        response += `\n`;
    }
    response += `📋 **Full Database Details:**\n\`\`\`json\n${debugOutput}\n\`\`\``;
    return {
        isDebugCommand: true,
        response
    };
}
/**
 * Clear conversation history
 */
function handleClearConversation(conversationKey) {
    core_1.promptManager.clearConversation(conversationKey);
    return {
        isDebugCommand: true,
        response: `🧹 **Conversation Cleared!**\n\nAll conversation history for this chat has been cleared from the database.\n\n💡 This includes:\n- Message history\n- Timestamps\n- Context data\n\nYou can start fresh now!`
    };
}
/**
 * Show action items debug information
 */
function handleActionItemsDebug(conversationKey) {
    const storage = core_1.promptManager.getStorage();
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
    }
    else {
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
function handleClearActionItems(conversationKey) {
    const storage = core_1.promptManager.getStorage();
    const clearedCount = storage.clearActionItems(conversationKey);
    return {
        isDebugCommand: true,
        response: `🧹 **Action Items Cleared!**\n\n${clearedCount} action items have been removed from this conversation.\n\n💡 This includes:\n- All pending tasks\n- Completed action items\n- Assignment history\n\nAction item tracking has been reset for this chat.`
    };
}
/**
 * Show debug help with all available commands
 */
function handleDebugHelp() {
    const helpText = `🛠️ **Debug Commands Help**\n\n**Available Commands:**\n\n` +
        `📊 **\`msg.db\`** - Show database and message history debug info\n` +
        `🧹 **\`clear.convo\`** - Clear conversation messages and history\n` +
        `📋 **\`action.items\`** - Show action items debug info\n` +
        `🗑️ **\`clear.actions\`** - Clear all action items for this conversation\n` +
        `👤 **\`personal.actions\`** - Show personal action items debug info\n` +
        `� **\`feedback.stats\`** - Show AI response feedback statistics\n` +
        `🧹 **\`feedback.clear\`** - Clear all feedback records\n` +
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
function getDebugCommands() {
    return [
        'msg.db',
        'clear.convo',
        'action.items',
        'clear.actions',
        'help.debug',
        'personal.actions',
        'feedback.stats',
        'feedback.clear'
    ];
}
/**
 * Check if a text string is a debug command
 */
function isDebugCommand(text) {
    const trimmedText = text?.trim();
    return getDebugCommands().includes(trimmedText);
}
/**
 * Show personal action items debug information for a specific user
 */
function handlePersonalActionItemsDebug(_conversationKey) {
    const storage = core_1.promptManager.getStorage();
    // Get all action items across all conversations to show user IDs
    const allActionItems = storage.getAllActionItems();
    let response = `👤 **Personal Action Items Debug:**\n\n`;
    if (allActionItems.length > 0) {
        response += `**All Action Items Across All Conversations (${allActionItems.length}):**\n`;
        allActionItems.forEach(item => {
            const statusEmoji = item.status === 'completed' ? '✅' :
                item.status === 'in_progress' ? '🔄' :
                    item.status === 'cancelled' ? '❌' : '⏳';
            const priorityEmoji = item.priority === 'urgent' ? '🔥' :
                item.priority === 'high' ? '⚡' :
                    item.priority === 'medium' ? '📍' : '🔹';
            response += `\n${statusEmoji} **#${item.id}** ${priorityEmoji} ${item.title}\n`;
            response += `   👤 Assigned to: ${item.assigned_to}\n`;
            response += `   🆔 User ID: ${item.assigned_to_id || 'N/A'}\n`;
            response += `   📝 ${item.description}\n`;
            response += `   📅 Created: ${new Date(item.created_at).toLocaleDateString()}\n`;
            response += `   💬 Conversation: ${item.conversation_id}\n`;
            if (item.due_date) {
                response += `   ⏰ Due: ${new Date(item.due_date).toLocaleDateString()}\n`;
            }
        });
        // Show breakdown by user ID
        response += `\n**Breakdown by User ID:**\n`;
        const userGroups = allActionItems.reduce((groups, item) => {
            const userId = item.assigned_to_id || 'NO_ID';
            if (!groups[userId])
                groups[userId] = [];
            groups[userId].push(item);
            return groups;
        }, {});
        Object.entries(userGroups).forEach(([userId, items]) => {
            response += `- **${userId}**: ${items.length} action items (${items[0]?.assigned_to || 'Unknown'})\n`;
        });
    }
    else {
        response += `**No action items found across all conversations.**\n`;
    }
    return {
        isDebugCommand: true,
        response
    };
}
/**
 * Show feedback statistics
 */
function handleFeedbackStats() {
    const storage = core_1.promptManager.getStorage();
    const summary = storage.getFeedbackSummary();
    const allFeedback = storage.getAllFeedback();
    let response = `**🔄 Feedback Statistics**\n\n`;
    response += `**Summary:**\n`;
    response += `- Total feedback records: ${summary.total_feedback_records}\n`;
    response += `- Total likes: ${summary.total_likes}\n`;
    response += `- Total dislikes: ${summary.total_dislikes}\n`;
    response += `- Like ratio: ${summary.like_ratio}\n\n`;
    if (allFeedback.length > 0) {
        response += `**Recent Feedback (last 5):**\n`;
        allFeedback.slice(0, 5).forEach((feedback, index) => {
            const feedbacks = JSON.parse(feedback.feedbacks || '[]');
            const feedbackTexts = feedbacks.map((f) => f.feedbackText || 'N/A').join(', ');
            response += `${index + 1}. Message: ${feedback.message_id.substring(0, 8)}...\n`;
            response += `   👍 ${feedback.likes} | 👎 ${feedback.dislikes}\n`;
            if (feedbackTexts) {
                response += `   Comments: "${feedbackTexts}"\n`;
            }
            response += `   Created: ${new Date(feedback.created_at).toLocaleDateString()}\n\n`;
        });
    }
    else {
        response += `**No feedback records found.**\n`;
    }
    return {
        isDebugCommand: true,
        response
    };
}
/**
 * Clear all feedback records
 */
function handleClearFeedback() {
    const storage = core_1.promptManager.getStorage();
    const deletedCount = storage.clearAllFeedback();
    const response = `**🧹 Feedback Database Cleared**\n\nDeleted ${deletedCount} feedback records.`;
    return {
        isDebugCommand: true,
        response
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMvZGVidWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFhQSxnREFtQ0M7QUE4SEQsNENBV0M7QUFLRCx3Q0FHQztBQWpNRCx3Q0FBOEM7QUFDOUMsZ0RBQStEO0FBUS9EOzs7R0FHRztBQUNJLEtBQUssVUFBVSxrQkFBa0IsQ0FBQyxJQUFZLEVBQUUsZUFBdUI7SUFDNUUsTUFBTSxXQUFXLEdBQUcsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDO0lBRWpDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNqQixPQUFPLEVBQUUsY0FBYyxFQUFFLEtBQUssRUFBRSxDQUFDO0lBQ25DLENBQUM7SUFFRCxRQUFRLFdBQVcsRUFBRSxDQUFDO1FBQ3BCLEtBQUssUUFBUTtZQUNYLE9BQU8sMEJBQTBCLENBQUMsZUFBZSxDQUFDLENBQUM7UUFFckQsS0FBSyxhQUFhO1lBQ2hCLE9BQU8sdUJBQXVCLENBQUMsZUFBZSxDQUFDLENBQUM7UUFFbEQsS0FBSyxjQUFjO1lBQ2pCLE9BQU8sc0JBQXNCLENBQUMsZUFBZSxDQUFDLENBQUM7UUFFakQsS0FBSyxlQUFlO1lBQ2xCLE9BQU8sc0JBQXNCLENBQUMsZUFBZSxDQUFDLENBQUM7UUFFakQsS0FBSyxZQUFZO1lBQ2YsT0FBTyxlQUFlLEVBQUUsQ0FBQztRQUUzQixLQUFLLGtCQUFrQjtZQUNyQixPQUFPLDhCQUE4QixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBRXpELEtBQUssZ0JBQWdCO1lBQ25CLE9BQU8sbUJBQW1CLEVBQUUsQ0FBQztRQUUvQixLQUFLLGdCQUFnQjtZQUNuQixPQUFPLG1CQUFtQixFQUFFLENBQUM7UUFFL0I7WUFDRSxPQUFPLEVBQUUsY0FBYyxFQUFFLEtBQUssRUFBRSxDQUFDO0lBQ3JDLENBQUM7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLDBCQUEwQixDQUFDLGVBQXVCO0lBQ3pELE1B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