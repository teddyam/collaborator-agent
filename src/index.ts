import { App } from '@microsoft/teams.apps';
import { DevtoolsPlugin } from '@microsoft/teams.dev';
import { promptManager } from './agent/core';

const app = new App({
  plugins: [new DevtoolsPlugin()],
});


app.on('message', async ({ send, activity, userGraph, isSignedIn, signin }) => {

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
  
  // Check for clear command
  if (activity.text?.trim() === 'CLEAR PREVIOUS HISTORY') {
    promptManager.clearConversation(conversationKey);
    await send({ type: 'message', text: '🧹 This conversation history has been cleared.' });
    return;
  }
  
  // Check for timestamp query commands
  if (activity.text?.trim() === 'SHOW RECENT MESSAGES') {
    const recentMessages = promptManager.getRecentMessages(conversationKey, 5);
    const messageList = recentMessages.map(msg => 
      `[${new Date(msg.timestamp).toLocaleString()}] ${msg.role}: ${msg.content}`
    ).join('\n');
    
    await send({ 
      type: 'message', 
      text: `📅 Recent messages:\n\`\`\`\n${messageList || 'No messages found'}\n\`\`\`` 
    });
    return;
  }
  
  if (activity.text?.trim() === 'SHOW ALL TIMESTAMPS') {
    const allMessages = promptManager.getMessagesWithTimestamps(conversationKey);
    const messageList = allMessages.map(msg => 
      `[${new Date(msg.timestamp).toLocaleString()}] ${msg.role}: ${msg.content.substring(0, 50)}...`
    ).join('\n');
    
    await send({ 
      type: 'message', 
      text: `📋 All messages with timestamps:\n\`\`\`\n${messageList || 'No messages found'}\n\`\`\`` 
    });
    return;
  }
  
  // Get or create prompt with conversation history
  const prompt = promptManager.getOrCreatePrompt(conversationKey);

  const res = await prompt.send(activity.text);
  await send({ type: 'message', text: res.content });
  console.log('🤖 LLM Response:', res.content);
  
  // Save conversation using prompt.messages.values()
  await promptManager.saveConversation(conversationKey, prompt);
});

(async () => {
  await app.start(+(process.env.PORT || 3978));
})();
