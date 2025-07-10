"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const teams_apps_1 = require("@microsoft/teams.apps");
const teams_dev_1 = require("@microsoft/teams.dev");
const teams_api_1 = require("@microsoft/teams.api");
const core_1 = require("./agent/core");
const config_1 = require("./utils/config");
const debug_1 = require("./utils/debug");
/**
 * Helper function to send a message with optional adaptive cards
 */
async function sendMessageWithCards(send, text, adaptiveCards) {
    const messageActivity = new teams_api_1.MessageActivity(text)
        .addAiGenerated()
        .addFeedback();
    // If we have adaptive cards, add them as attachments
    if (adaptiveCards && adaptiveCards.length > 0) {
        // Teams AI SDK v2 supports attachments on MessageActivity
        for (const card of adaptiveCards) {
            messageActivity.addAttachments({
                contentType: 'application/vnd.microsoft.card.adaptive',
                content: card
            });
        }
    }
    const { id: sentMessageId } = await send(messageActivity);
    return sentMessageId;
}
const app = new teams_apps_1.App({
    plugins: [new teams_dev_1.DevtoolsPlugin()],
});
// Initialize feedback storage (reuse the same storage instance from promptManager)
const feedbackStorage = core_1.promptManager.getStorage();
// Handle feedback submissions
app.on('message.submit.feedback', async ({ activity, log }) => {
    try {
        const { reaction, feedback: feedbackJson } = activity.value.actionValue;
        if (activity.replyToId == null) {
            log.warn(`No replyToId found for messageId ${activity.id}`);
            return;
        }
        console.log(`👍 Received feedback for message ${activity.replyToId}: ${reaction}`, feedbackJson);
        // Check if feedback record exists (it should since we store delegated agent info when sending)
        let existingFeedback = feedbackStorage.getFeedbackByMessageId(activity.replyToId);
        if (!existingFeedback) {
            // If no record exists, initialize without delegated agent info (fallback)
            feedbackStorage.initializeFeedbackRecord(activity.replyToId);
            console.log(`📝 Initialized feedback record for message ${activity.replyToId} (no prior delegated agent info)`);
        }
        // Update feedback in storage
        const success = feedbackStorage.updateFeedback(activity.replyToId, reaction, feedbackJson);
        if (success) {
            console.log(`✅ Successfully recorded feedback for message ${activity.replyToId}`);
            // Optionally send a confirmation response
            // await send({ type: 'message', text: `Thank you for your feedback! 👍` });
        }
        else {
            log.warn(`Failed to record feedback for message ${activity.replyToId}`);
        }
    }
    catch (error) {
        console.error('❌ Error handling feedback submission:', error);
        log.error(`Error processing feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
// Handle all messages for tracking and debug commands
app.on('message', async ({ send, activity, next }) => {
    const conversationKey = `${activity.conversation.id}`;
    const isPersonalChat = activity.conversation.conversationType === 'personal';
    const debugResult = await (0, debug_1.handleDebugCommand)(activity.text || '', conversationKey);
    console.log(new Date().toISOString().split('T')[0]); // YYYY-MM-DD format);
    console.log(activity);
    if (debugResult.isDebugCommand) {
        if (debugResult.response) {
            await send({
                type: 'message',
                text: debugResult.response
            });
        }
        return;
    }
    // If this is a personal chat, always route to the manager for full conversational experience
    if (isPersonalChat && activity.text && activity.text.trim() !== '') {
        console.log('🔍 Personal chat detected - routing to manager with personal action items support');
        const userId = activity.from.id;
        const userName = activity.from.name || 'User';
        // Extract timezone from Teams activity (cast to any to access localTimezone)
        const userTimezone = activity.localTimezone;
        if (userTimezone) {
            console.log(`🕒 Detected user timezone: ${userTimezone}`);
        }
        // Track the user message first
        core_1.promptManager.addMessageToTracking(conversationKey, 'user', activity.text, activity, userName);
        // Use the manager to process the request, but enable personal mode for action items
        const result = await core_1.promptManager.processUserRequestWithPersonalMode(conversationKey, activity.text, null, // no API in personal chat
        userId, userName, userTimezone);
        if (result.response && result.response.trim() !== '') {
            const sentMessageId = await sendMessageWithCards(send, result.response, result.adaptiveCards);
            // Store delegated agent info for potential feedback
            feedbackStorage.storeDelegatedAgent(sentMessageId, result.delegatedAgent);
            console.log(`🤖 Personal chat response sent with feedback enabled: ${sentMessageId} (delegated to: ${result.delegatedAgent || 'direct'})${result.adaptiveCards ? ` with ${result.adaptiveCards.length} cards` : ''}`);
            // Track AI response
            core_1.promptManager.addMessageToTracking(conversationKey, 'assistant', result.response, { id: sentMessageId }, 'AI Assistant');
        }
        else {
            await send({ type: 'message', text: 'Hello! I can help you with conversation summaries, action item management, and general assistance. What would you like help with?' });
            console.log('🤖 Personal chat fallback response sent');
        }
        // Save messages to database
        await core_1.promptManager.saveMessagesDirectly(conversationKey);
        console.log('💾 Personal chat messages saved to database');
        return;
    }
    // Track all user messages for conversation history
    const userName = activity.from.name || 'user';
    core_1.promptManager.addMessageToTracking(conversationKey, 'user', activity.text, activity, userName);
    // Save messages to database
    await core_1.promptManager.saveMessagesDirectly(conversationKey);
    console.log('💾 Messages saved to database');
    await next();
});
app.on('mention', async ({ send, activity, api }) => {
    const conversationKey = `${activity.conversation.id}`;
    console.log('🔍 Bot @mentioned - processing query with manager agent');
    const members = await api.conversations.members(conversationKey).get();
    console.log(members);
    if (activity.type === 'message' && activity.text && activity.text.trim() !== '') {
        // Check for debug commands first, even when @mentioned
        const debugResult = await (0, debug_1.handleDebugCommand)(activity.text, conversationKey);
        if (debugResult.isDebugCommand) {
            if (debugResult.response) {
                await send({ type: 'message', text: debugResult.response });
                console.log('🛠️ Debug command executed via @mention:', activity.text.trim());
            }
            return;
        }
        // Extract timezone from Teams activity (cast to any to access localTimezone)
        const userTimezone = activity.localTimezone;
        if (userTimezone) {
            console.log(`🕒 Detected user timezone: ${userTimezone}`);
        }
        // Use the manager to process the request (now with API access)
        const result = await core_1.promptManager.processUserRequest(conversationKey, activity.text, api, userTimezone);
        // Always send a response when @mentioned
        if (result.response && result.response.trim() !== '') {
            const sentMessageId = await sendMessageWithCards(send, result.response, result.adaptiveCards);
            // Store delegated agent info for potential feedback
            feedbackStorage.storeDelegatedAgent(sentMessageId, result.delegatedAgent);
            console.log(`🤖 AI Response sent with feedback enabled: ${sentMessageId} (delegated to: ${result.delegatedAgent || 'direct'})${result.adaptiveCards ? ` with ${result.adaptiveCards.length} cards` : ''}`);
            // Track AI response
            core_1.promptManager.addMessageToTracking(conversationKey, 'assistant', result.response, { id: sentMessageId }, 'AI Assistant');
        }
        else {
            // Fallback response if manager returns empty
            await send({ type: 'message', text: 'I received your message but I\'m not sure how to help with that. I can help with conversation summaries and message analysis.' });
            console.log('🤖 Fallback response sent');
        }
        // Save messages including AI response
        await core_1.promptManager.saveMessagesDirectly(conversationKey);
        console.log('💾 Messages saved to database after mention response');
    }
});
(async () => {
    const port = +(process.env.PORT || 3978);
    // Validate environment and log model configurations
    try {
        (0, config_1.validateEnvironment)();
        (0, config_1.logModelConfigs)();
    }
    catch (error) {
        console.error('❌ Configuration error:', error);
        process.exit(1);
    }
    await app.start(port);
    console.log(`🚀 Teams Collaborator Bot started on port ${port}`);
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxzREFBNEM7QUFDNUMsb0RBQXNEO0FBQ3RELG9EQUF1RDtBQUN2RCx1Q0FBNkM7QUFDN0MsMkNBQXNFO0FBQ3RFLHlDQUFtRDtBQUVuRDs7R0FFRztBQUNILEtBQUssVUFBVSxvQkFBb0IsQ0FBQyxJQUFTLEVBQUUsSUFBWSxFQUFFLGFBQXFCO0lBQ2hGLE1BQU0sZUFBZSxHQUFHLElBQUksMkJBQWUsQ0FBQyxJQUFJLENBQUM7U0FDOUMsY0FBYyxFQUFFO1NBQ2hCLFdBQVcsRUFBRSxDQUFDO0lBRWpCLHFEQUFxRDtJQUNyRCxJQUFJLGFBQWEsSUFBSSxhQUFhLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQzlDLDBEQUEwRDtRQUMxRCxLQUFLLE1BQU0sSUFBSSxJQUFJLGFBQWEsRUFBRSxDQUFDO1lBQ2pDLGVBQWUsQ0FBQyxjQUFjLENBQUM7Z0JBQzdCLFdBQVcsRUFBRSx5Q0FBeUM7Z0JBQ3RELE9BQU8sRUFBRSxJQUFJO2FBQ2QsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztJQUNILENBQUM7SUFFRCxNQUFNLEVBQUUsRUFBRSxFQUFFLGFBQWEsRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQzFELE9BQU8sYUFBYSxDQUFDO0FBQ3ZCLENBQUM7QUFFRCxNQUFNLEdBQUcsR0FBRyxJQUFJLGdCQUFHLENBQUM7SUFDbEIsT0FBTyxFQUFFLENBQUMsSUFBSSwwQkFBYyxFQUFFLENBQUM7Q0FDaEMsQ0FBQyxDQUFDO0FBRUgsbUZBQW1GO0FBQ25GLE1BQU0sZUFBZSxHQUFHLG9CQUFhLENBQUMsVUFBVSxFQUFFLENBQUM7QUFFbkQsOEJBQThCO0FBQzlCLEdBQUcsQ0FBQyxFQUFFLENBQUMseUJBQXlCLEVBQUUsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFBRSxF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