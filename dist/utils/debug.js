"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDebugCommand = handleDebugCommand;
exports.getDebugCommands = getDebugCommands;
exports.isDebugCommand = isDebugCommand;
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
    const storage = (0, message_1.getMessageStorage)();
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
    (0, message_1.clearConversation)(conversationKey);
    return {
        isDebugCommand: true,
        response: `🧹 **Conversation Cleared!**\n\nAll conversation history for this chat has been cleared from the database.\n\n💡 This includes:\n- Message history\n- Timestamps\n- Context data\n\nYou can start fresh now!`
    };
}
/**
 * Show action items debug information
 */
function handleActionItemsDebug(conversationKey) {
    const storage = (0, message_1.getMessageStorage)();
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
    const storage = (0, message_1.getMessageStorage)();
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
    const storage = (0, message_1.getMessageStorage)();
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
    const storage = (0, message_1.getMessageStorage)();
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
    const storage = (0, message_1.getMessageStorage)();
    const deletedCount = storage.clearAllFeedback();
    const response = `**🧹 Feedback Database Cleared**\n\nDeleted ${deletedCount} feedback records.`;
    return {
        isDebugCommand: true,
        response
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMvZGVidWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFZQSxnREFtQ0M7QUE4SEQsNENBV0M7QUFLRCx3Q0FHQztBQWhNRCxnREFBcUc7QUFRckc7OztHQUdHO0FBQ0ksS0FBSyxVQUFVLGtCQUFrQixDQUFDLElBQVksRUFBRSxlQUF1QjtJQUM1RSxNQUFNLFdBQVcsR0FBRyxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFFakMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ2pCLE9BQU8sRUFBRSxjQUFjLEVBQUUsS0FBSyxFQUFFLENBQUM7SUFDbkMsQ0FBQztJQUVELFFBQVEsV0FBVyxFQUFFLENBQUM7UUFDcEIsS0FBSyxRQUFRO1lBQ1gsT0FBTywwQkFBMEIsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUVyRCxLQUFLLGFBQWE7WUFDaEIsT0FBTyx1QkFBdUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUVsRCxLQUFLLGNBQWM7WUFDakIsT0FBTyxzQkFBc0IsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUVqRCxLQUFLLGVBQWU7WUFDbEIsT0FBTyxzQkFBc0IsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUVqRCxLQUFLLFlBQVk7WUFDZixPQUFPLGVBQWUsRUFBRSxDQUFDO1FBRTNCLEtBQUssa0JBQWtCO1lBQ3JCLE9BQU8sOEJBQThCLENBQUMsZUFBZSxDQUFDLENBQUM7UUFFekQsS0FBSyxnQkFBZ0I7WUFDbkIsT0FBTyxtQkFBbUIsRUFBRSxDQUFDO1FBRS9CLEtBQUssZ0JBQWdCO1lBQ25CLE9BQU8sbUJBQW1CLEVBQUUsQ0FBQztRQUUvQjtZQUNFLE9BQU8sRUFBRSxjQUFjLEVBQUUsS0FBSyxFQUFFLENBQUM7SUFDckMsQ0FBQztBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsMEJBQTBCLENBQUMsZUFBdUI7SUFDekQsTUFBTSxPQUFPLEdBQUcs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