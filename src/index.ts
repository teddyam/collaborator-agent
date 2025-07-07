import { App } from '@microsoft/teams.apps';
import { DevtoolsPlugin } from '@microsoft/teams.dev';
import { promptManager } from './agent/core';

const app = new App({
  plugins: [new DevtoolsPlugin()],
});

app.on('message', async ({ send, activity, api }) => {

  // Use conversation ID as key
  const conversationKey = `${activity.conversation.id}`;

  const members = await api.conversations.members(activity.conversation.id).get();
  console.log(members);

  // Check for debug commands
  if (activity.text?.trim() === 'msg.db') {
    const debugOutput = promptManager.getStorage().debugPrintDatabase(conversationKey);
    await send({
      type: 'message',
      text: `🔍 **Database Debug Info:**\n\`\`\`json\n${debugOutput}\n\`\`\``
    });
    return;
  }

  // Check for clear conversation command
  if (activity.text?.trim() === 'clear.convo') {
    promptManager.clearConversation(conversationKey);
    await send({
      type: 'message',
      text: `🧹 **Conversation Cleared!**\n\nAll conversation history for this chat has been cleared from the database.\n\n💡 This includes:\n- Message history\n- Timestamps\n- Context data\n\nYou can start fresh now!`
    });
    return;
  }

  // Track user message
  const userName = activity.from.name || 'user';
  promptManager.addMessageToTracking(conversationKey, 'user', activity.text, activity, userName);

  // Let the manager agent decide if this requires AI processing
  if (activity.text && activity.text.trim() !== '') {
    console.log('🔍 Processing user query with manager agent');

    // Use the manager to process the request
    const response = await promptManager.processUserRequest(conversationKey, activity.text);

    // Check if manager wants to stay silent
    if (response && response.trim() !== 'STAY_SILENT') {
      await send({ type: 'message', text: response });
      console.log('🤖 AI Response sent:', response);

      // Track AI response
      promptManager.addMessageToTracking(conversationKey, 'assistant', response, undefined, 'AI Assistant');
    } else {
      console.log('🤫 Manager chose to stay silent - no response sent');
    }
  } else {
    // Empty message - just log it without AI response
    console.log('💬 Empty message logged (no AI response)');
  }

  // Save messages to database
  await promptManager.saveMessagesDirectly(conversationKey);
  console.log('💾 Messages saved to database');
});

(async () => {
  const port = +(process.env.PORT || 3978);

  await app.start(port);

  console.log(`🚀 Teams Collaborator Bot started on port ${port}`);
})();
