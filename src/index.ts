import { App } from '@microsoft/teams.apps';
import { DevtoolsPlugin } from '@microsoft/teams.dev';
import { promptManager } from './agent/core';
import { validateEnvironment, logModelConfigs } from './utils/config';
import { handleDebugCommand } from './utils/debug';

const app = new App({
  plugins: [new DevtoolsPlugin()],
});

app.on('mention', async ({ send, activity, api }) => {
  const conversationKey = `${activity.conversation.id}`;
  console.log('🔍 Bot @mentioned - processing query with manager agent');

  if (activity.type === 'message' && activity.text && activity.text.trim() !== '') {
    // Check for debug commands first, even when @mentioned
    const debugResult = await handleDebugCommand(activity.text, conversationKey);
    
    if (debugResult.isDebugCommand) {
      if (debugResult.response) {
        await send({ type: 'message', text: debugResult.response });
        console.log('🛠️ Debug command executed via @mention:', activity.text.trim());
      }
      return;
    }

    // Track all user messages for conversation history
    const userName = activity.from.name || 'user';
    promptManager.addMessageToTracking(conversationKey, 'user', activity.text, activity, userName);

    // Use the manager to process the request (now with API access)
    const response = await promptManager.processUserRequestWithAPI(conversationKey, activity.text, api);

    // Always send a response when @mentioned
    if (response && response.trim() !== '') {
      await send({ type: 'message', text: response });
      console.log('🤖 AI Response sent:', response);

      // Track AI response
      promptManager.addMessageToTracking(conversationKey, 'assistant', response, undefined, 'AI Assistant');
    } else {
      // Fallback response if manager returns empty
      await send({ type: 'message', text: 'I received your message but I\'m not sure how to help with that. I can help with conversation summaries and message analysis.' });
      console.log('🤖 Fallback response sent');
    }

    // Save messages including AI response
    await promptManager.saveMessagesDirectly(conversationKey);
    console.log('💾 Messages saved to database after mention response');
  }
});

// Handle all messages for tracking and debug commands
app.on('message', async ({ send, activity }) => {
  const conversationKey = `${activity.conversation.id}`;

  // Check for debug commands using centralized handler
  const debugResult = await handleDebugCommand(activity.text || '', conversationKey);
  
  if (debugResult.isDebugCommand) {
    if (debugResult.response) {
      await send({
        type: 'message',
        text: debugResult.response
      });
    }
    return;
  }

  // Track all user messages for conversation history
  const userName = activity.from.name || 'user';
  promptManager.addMessageToTracking(conversationKey, 'user', activity.text, activity, userName);

  // Save messages to database
  await promptManager.saveMessagesDirectly(conversationKey);
  console.log('💾 Messages saved to database');
});

(async () => {
  const port = +(process.env.PORT || 3978);

  // Validate environment and log model configurations
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
