import { App } from '@microsoft/teams.apps';
import { DevtoolsPlugin } from '@microsoft/teams.dev';
import { ManagerPrompt } from './agent/manager';
import { getMessageStorage } from './storage/message';
import { validateEnvironment, logModelConfigs } from './utils/config';
import { handleDebugCommand } from './utils/debug';
import { finalizePromptResponse, createMessageRecord } from './utils/utils';
import { createMessageContext } from './utils/messageContext';

const app = new App({
  plugins: [new DevtoolsPlugin()],
});

// Initialize storage and manager (reuse the singleton from message.ts)
const storage = getMessageStorage();

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
    } else {
      log.warn(`Failed to record feedback for message ${activity.replyToId}`);
    }

  } catch (error) {
    log.error(`Error processing feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

app.on('message', async ({ send, activity, api }) => {
  const { context, conversationHistory } = await createMessageContext(storage, activity, api);

  if (!activity.conversation.isGroup || activity.entities?.some((e) => e.type === 'mention')) { // process request if One-on-One chat or if @mentioned in Groupchat
    await send({ type: 'typing' });

    const manager = new ManagerPrompt(storage, conversationHistory);
    const result = await manager.processRequest(context); // make common function

    await send(finalizePromptResponse(result.response, result.citations));
    // feedbackStorage.storeDelegatedCapability(sentMessageId, result.delegatedCapability);
  } else {
    conversationHistory.push(createMessageRecord(activity));
  }
});

(async () => {
  const port = +(process.env.PORT || 3978);
  try {
    validateEnvironment();
    logModelConfigs();
  } catch (error) {
    console.error('❌ Configuration error:', error);
    process.exit(1);
  }

  await app.start(port);

  console.log(`🚀 Teams Collaborator Bot started on port ${port}`);
})();
