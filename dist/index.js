"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const teams_apps_1 = require("@microsoft/teams.apps");
const teams_dev_1 = require("@microsoft/teams.dev");
const teams_api_1 = require("@microsoft/teams.api");
const manager_1 = require("./agent/manager");
const message_1 = require("./storage/message");
const config_1 = require("./utils/config");
const debug_1 = require("./utils/debug");
const mockData_1 = require("./utils/mockData");
/**
 * Helper function to finalize and send a prompt response with citations
 */
async function finalizePromptResponse(send, text, citations) {
    const messageActivity = new teams_api_1.MessageActivity(text)
        .addAiGenerated()
        .addFeedback();
    // Add citations if provided
    if (citations && citations.length > 0) {
        console.log(`Adding ${citations.length} citations to message activity`);
        citations.forEach((citation, index) => {
            const citationNumber = index + 1;
            messageActivity.addCitation(citationNumber, citation);
            // The corresponding citation needs to be added in the message content
            messageActivity.text += ` [${citationNumber}]`;
        });
    }
    console.log('Citations in message activity:');
    console.log(JSON.stringify(messageActivity.entities?.find(e => e.citation)?.citation, null, 2));
    const { id: sentMessageId } = await send(messageActivity);
    return sentMessageId;
}
const app = new teams_apps_1.App({
    plugins: [new teams_dev_1.DevtoolsPlugin()],
});
// Initialize storage and manager (reuse the singleton from message.ts)
const storage = (0, message_1.getMessageStorage)();
const manager = new manager_1.ManagerPrompt(storage);
const mockDataManager = new mockData_1.MockDataManager(storage);
// Initialize feedback storage
const feedbackStorage = storage;
app.on('message.submit.feedback', async ({ activity, log }) => {
    try {
        const { reaction, feedback: feedbackJson } = activity.value.actionValue;
        if (activity.replyToId == null) {
            log.warn(`No replyToId found for messageId ${activity.id}`);
            return;
        }
        let existingFeedback = feedbackStorage.getFeedbackByMessageId(activity.replyToId);
        if (!existingFeedback) {
            feedbackStorage.initializeFeedbackRecord(activity.replyToId);
        }
        const success = feedbackStorage.updateFeedback(activity.replyToId, reaction, feedbackJson);
        if (success) {
            console.log(`✅ Successfully recorded feedback for message ${activity.replyToId}`);
        }
        else {
            log.warn(`Failed to record feedback for message ${activity.replyToId}`);
        }
    }
    catch (error) {
        log.error(`Error processing feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
app.on('message', async ({ send, activity, next }) => {
    const conversationKey = `${activity.conversation.id}`;
    const isPersonalChat = activity.conversation.conversationType === 'personal';
    const debugResult = await (0, debug_1.handleDebugCommand)(activity.text || '', conversationKey);
    console.log(new Date().toISOString().split('T')[0]);
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
        await send({ type: 'typing' });
        const userId = activity.from.id;
        const userName = activity.from.name || 'User';
        const userTimezone = activity.localTimezone;
        (0, message_1.addMessageToTracking)(conversationKey, 'user', activity.text, activity, userName);
        const result = await manager.processRequestWithPersonalMode(activity.text, conversationKey, null, userId, userName, userTimezone);
        if (result.response && result.response.trim() !== '') {
            const sentMessageId = await finalizePromptResponse(send, result.response, result.citations);
            feedbackStorage.storeDelegatedCapability(sentMessageId, result.delegatedCapability);
            (0, message_1.addMessageToTracking)(conversationKey, 'assistant', result.response, { id: sentMessageId }, 'AI Assistant');
        }
        else {
            await send({ type: 'message', text: 'Hello! I can help you with conversation summaries, action item management, and general assistance. What would you like help with?' });
        }
        await (0, message_1.saveMessagesDirectly)(conversationKey);
        return;
    }
    const userName = activity.from.name || 'user';
    (0, message_1.addMessageToTracking)(conversationKey, 'user', activity.text, activity, userName);
    await (0, message_1.saveMessagesDirectly)(conversationKey);
    await next();
});
app.on('mention', async ({ send, activity, api }) => {
    await send({ type: 'typing' });
    const conversationKey = `${activity.conversation.id}`;
    if (activity.type === 'message' && activity.text && activity.text.trim() !== '') {
        const debugResult = await (0, debug_1.handleDebugCommand)(activity.text, conversationKey);
        if (debugResult.isDebugCommand) {
            if (debugResult.response) {
                await send({ type: 'message', text: debugResult.response });
            }
            return;
        }
        const userTimezone = activity.localTimezone;
        const result = await manager.processRequestWithAPI(activity.text, conversationKey, api, userTimezone);
        if (result.response && result.response.trim() !== '') {
            const sentMessageId = await finalizePromptResponse(send, result.response, result.citations);
            feedbackStorage.storeDelegatedCapability(sentMessageId, result.delegatedCapability);
            (0, message_1.addMessageToTracking)(conversationKey, 'assistant', result.response, { id: sentMessageId }, 'AI Assistant');
        }
        else {
            await send({ type: 'message', text: 'I received your message but I\'m not sure how to help with that. I can help with conversation summaries and message analysis.' });
        }
        await (0, message_1.saveMessagesDirectly)(conversationKey);
    }
});
(async () => {
    const port = +(process.env.PORT || 3978);
    try {
        (0, config_1.validateEnvironment)();
        (0, config_1.logModelConfigs)();
        // Initialize mock data if needed
        mockDataManager.initializeMockDataIfNeeded();
    }
    catch (error) {
        console.error('❌ Configuration error:', error);
        process.exit(1);
    }
    await app.start(port);
    console.log(`🚀 Teams Collaborator Bot started on port ${port}`);
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxzREFBNEM7QUFDNUMsb0RBQXNEO0FBQ3RELG9EQUEyRTtBQUMzRSw2Q0FBZ0Q7QUFDaEQsK0NBQWtHO0FBQ2xHLDJDQUFzRTtBQUN0RSx5Q0FBbUQ7QUFDbkQsK0NBQW1EO0FBRW5EOztHQUVHO0FBQ0gsS0FBSyxVQUFVLHNCQUFzQixDQUFDLElBQVMsRUFBRSxJQUFZLEVBQUUsU0FBZ0M7SUFDN0YsTUFBTSxlQUFlLEdBQUcsSUFBSSwyQkFBZSxDQUFDLElBQUksQ0FBQztTQUM5QyxjQUFjLEVBQUU7U0FDaEIsV0FBVyxFQUFFLENBQUM7SUFFakIsNEJBQTRCO0lBQzVCLElBQUksU0FBUyxJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDdEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLFNBQVMsQ0FBQyxNQUFNLGdDQUFnQyxDQUFDLENBQUM7UUFDeEUsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsRUFBRTtZQUNwQyxNQUFNLGNBQWMsR0FBRyxLQUFLLEdBQUcsQ0FBQyxDQUFDO1lBQ2pDLGVBQWUsQ0FBQyxXQUFXLENBQUMsY0FBYyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQ3RELHNFQUFzRTtZQUN0RSxlQUFlLENBQUMsSUFBSSxJQUFJLEtBQUssY0FBYyxHQUFHLENBQUM7UUFDakQsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO0lBQzlDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxRQUFRLEVBQUUsSUFB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