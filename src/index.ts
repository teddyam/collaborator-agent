import { App } from '@microsoft/teams.apps';
import { DevtoolsPlugin } from '@microsoft/teams.dev';
import { promptManager } from './agent/core';

const app = new App({
  plugins: [new DevtoolsPlugin()],
});


app.on('message', async ({ send, activity, isSignedIn, signin }) => {

  if (!isSignedIn) {
    await signin({
      // Customize the OAuth card text (only applies to OAuth flow, not SSO)
      oauthCardText: 'Sign in to your account',
      signInButtonText: 'Sign in' 
    }); // call signin for your auth connection...
    return;
  }

  // Create a unique key for this conversation
  const conversationKey = `${activity.conversation.id}`;
  console.log(`🔑 Conversation Key: ${conversationKey}`);
  
  // Check for debug commands
  if (activity.text?.trim() === 'msg.db') {
    const debugOutput = promptManager.getStorage().debugPrintDatabase(conversationKey);
    await send({ 
      type: 'message', 
      text: `🔍 **Database Debug Info:**\n\`\`\`json\n${debugOutput}\n\`\`\`` 
    });
    return;
  }
  
  // Get or create prompt with conversation history and function calling support
  const prompt = promptManager.getOrCreatePrompt(conversationKey);
  
  // Track the user message in our own array
  promptManager.addMessageToTracking(conversationKey, 'user', activity.text, activity);

  const res = await prompt.send(activity.text);
  await send({ type: 'message', text: res.content });
  console.log('🤖 LLM Response:', res.content);
  
  // Track the AI response in our own array (ensure content is not undefined)
  if (res.content) {
    promptManager.addMessageToTracking(conversationKey, 'model', res.content);
  }
  
  // Save conversation using our own message tracking (efficient, filtered)
  await promptManager.saveConversation(conversationKey, prompt);
});

(async () => {
  await app.start(+(process.env.PORT || 3978));
})();
