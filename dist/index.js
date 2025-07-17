'use strict';

var teams_apps = require('@microsoft/teams.apps');
var teams_dev = require('@microsoft/teams.dev');
var teams_api = require('@microsoft/teams.api');
var manager$1 = require('./agent/manager');
var message = require('./storage/message');
var config = require('./utils/config');
var debug = require('./utils/debug');
var mockData = require('./utils/mockData');

async function finalizePromptResponse(send, text, citations) {
  const messageActivity = new teams_api.MessageActivity(text).addAiGenerated().addFeedback();
  if (citations && citations.length > 0) {
    console.log(`Adding ${citations.length} citations to message activity`);
    citations.forEach((citation, index) => {
      const citationNumber = index + 1;
      messageActivity.addCitation(citationNumber, citation);
      messageActivity.text += ` [${citationNumber}]`;
    });
  }
  console.log("Citations in message activity:");
  console.log(JSON.stringify(messageActivity.entities?.find((e) => e.citation)?.citation, null, 2));
  const { id: sentMessageId } = await send(messageActivity);
  return sentMessageId;
}
const app = new teams_apps.App({
  plugins: [new teams_dev.DevtoolsPlugin()]
});
const storage = message.getMessageStorage();
const manager = new manager$1.ManagerPrompt(storage);
const mockDataManager = new mockData.MockDataManager(storage);
const feedbackStorage = storage;
app.on("message.submit.feedback", async ({ activity, log }) => {
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
      console.log(`\u2705 Successfully recorded feedback for message ${activity.replyToId}`);
    } else {
      log.warn(`Failed to record feedback for message ${activity.replyToId}`);
    }
  } catch (error) {
    log.error(`Error processing feedback: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});
app.on("message", async ({ send, activity, next }) => {
  const conversationKey = `${activity.conversation.id}`;
  const isPersonalChat = activity.conversation.conversationType === "personal";
  const debugResult = await debug.handleDebugCommand(activity.text || "", conversationKey);
  console.log((/* @__PURE__ */ new Date()).toISOString().split("T")[0]);
  console.log(activity);
  if (debugResult.isDebugCommand) {
    if (debugResult.response) {
      await send({
        type: "message",
        text: debugResult.response
      });
    }
    return;
  }
  if (isPersonalChat && activity.text && activity.text.trim() !== "") {
    await send({ type: "typing" });
    const userId = activity.from.id;
    const userName2 = activity.from.name || "User";
    const userTimezone = activity.localTimezone;
    message.addMessageToTracking(conversationKey, "user", activity.text, activity, userName2);
    const result = await manager.processRequestWithPersonalMode(
      activity.text,
      conversationKey,
      null,
      userId,
      userName2,
      userTimezone
    );
    if (result.response && result.response.trim() !== "") {
      const sentMessageId = await finalizePromptResponse(send, result.response, result.citations);
      feedbackStorage.storeDelegatedCapability(sentMessageId, result.delegatedCapability);
      message.addMessageToTracking(conversationKey, "assistant", result.response, { id: sentMessageId }, "AI Assistant");
    } else {
      await send({ type: "message", text: "Hello! I can help you with conversation summaries, action item management, and general assistance. What would you like help with?" });
    }
    await message.saveMessagesDirectly(conversationKey);
    return;
  }
  const userName = activity.from.name || "user";
  message.addMessageToTracking(conversationKey, "user", activity.text, activity, userName);
  await message.saveMessagesDirectly(conversationKey);
  await next();
});
app.on("mention", async ({ send, activity, api }) => {
  await send({ type: "typing" });
  const conversationKey = `${activity.conversation.id}`;
  if (activity.type === "message" && activity.text && activity.text.trim() !== "") {
    const debugResult = await debug.handleDebugCommand(activity.text, conversationKey);
    if (debugResult.isDebugCommand) {
      if (debugResult.response) {
        await send({ type: "message", text: debugResult.response });
      }
      return;
    }
    const userTimezone = activity.localTimezone;
    const result = await manager.processRequestWithAPI(activity.text, conversationKey, api, userTimezone);
    if (result.response && result.response.trim() !== "") {
      const sentMessageId = await finalizePromptResponse(send, result.response, result.citations);
      feedbackStorage.storeDelegatedCapability(sentMessageId, result.delegatedCapability);
      message.addMessageToTracking(conversationKey, "assistant", result.response, { id: sentMessageId }, "AI Assistant");
    } else {
      await send({ type: "message", text: "I received your message but I'm not sure how to help with that. I can help with conversation summaries and message analysis." });
    }
    await message.saveMessagesDirectly(conversationKey);
  }
});
(async () => {
  const port = +(process.env.PORT || 3978);
  try {
    config.validateEnvironment();
    config.logModelConfigs();
    mockDataManager.initializeMockDataIfNeeded();
  } catch (error) {
    console.error("\u274C Configuration error:", error);
    process.exit(1);
  }
  await app.start(port);
  console.log(`\u{1F680} Teams Collaborator Bot started on port ${port}`);
})();
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map