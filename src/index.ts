import { App } from '@microsoft/teams.apps';
import { DevtoolsPlugin } from '@microsoft/teams.dev';
import { promptManager } from './agent/core';
import { USE_MOCK_DATA, DEFAULT_MOCK_CONVERSATION } from './utils/constants';

const app = new App({
  plugins: [new DevtoolsPlugin()],
});

app.on('message', async ({ send, activity }) => {

  // Use conversation ID as key
  const conversationKey = USE_MOCK_DATA ? DEFAULT_MOCK_CONVERSATION : `${activity.conversation.id}`;
  
  console.log(`🔑 Conversation Key: ${conversationKey}, Mock Mode: ${USE_MOCK_DATA}`);
  
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
  
  // Check if the message contains "summarize" keyword
  if (activity.text?.toLowerCase().includes('summarize')) {
    console.log('🔍 Summarize keyword detected - engaging AI assistant');
    
    // Use the manager to process the request
    const response = await promptManager.processUserRequest(conversationKey, activity.text);
    await send({ type: 'message', text: response });
    console.log('🤖 AI Response sent:', response);
    
    // Track AI response
    if (response) {
      promptManager.addMessageToTracking(conversationKey, 'assistant', response, undefined, 'AI Assistant');
    }
  } else {
    // Regular message - just log it without AI response
    console.log('💬 Regular message logged (no AI response):', activity.text);
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
