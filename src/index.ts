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
  
  // // Check for clear command
  // if (activity.text?.trim() === 'CLEAR PREVIOUS HISTORY') {
  //   promptManager.clearConversation(conversationKey);
  //   await send({ type: 'message', text: '🧹 This conversation history has been cleared.' });
  //   return;
  // }
  
  // // Check for timestamp query commands
  // if (activity.text?.trim() === 'SHOW RECENT MESSAGES') {
  //   const recentMessages = promptManager.getRecentMessages(conversationKey, 5);
  //   const messageList = recentMessages.map(msg => 
  //     `[${new Date(msg.timestamp).toLocaleString()}] ${msg.role}: ${msg.content}`
  //   ).join('\n');
    
  //   await send({ 
  //     type: 'message', 
  //     text: `📅 Recent messages:\n\`\`\`\n${messageList || 'No messages found'}\n\`\`\`` 
  //   });
  //   return;
  // }
  
  // if (activity.text?.trim() === 'SHOW ALL TIMESTAMPS') {
  //   const allMessages = promptManager.getMessagesWithTimestamps(conversationKey);
  //   const messageList = allMessages.map(msg => 
  //     `[${new Date(msg.timestamp).toLocaleString()}] ${msg.role}: ${msg.content.substring(0, 50)}...`
  //   ).join('\n');
    
  //   await send({ 
  //     type: 'message', 
  //     text: `📋 All messages with timestamps:\n\`\`\`\n${messageList || 'No messages found'}\n\`\`\`` 
  //   });
  //   return;
  // }
  
  // Get or create prompt with conversation history and function calling support
  const prompt = promptManager.getOrCreatePrompt(conversationKey);

  // Send message to AI (which can now call functions automatically)
  const res = await prompt.send(activity.text);
  
  // Log the full response for debugging
  console.log('🔍 Full AI response structure:', JSON.stringify(res, null, 2));
  
  // Check if the AI made function calls and handle the response
  if (res.content) {
    await send({ type: 'message', text: res.content });
    console.log('🤖 LLM Response:', res.content);
  } else {
    // Check if there were function calls without final content
    console.log('⚠️ No content in response - checking for function calls or other response data');
    console.log('🔍 Response keys:', Object.keys(res));
    
    // Still try to save the conversation even if no content was returned
    // The function calls and user message should still be preserved
    await send({ type: 'message', text: 'I processed your request and called the necessary functions to gather the information.' });
  }
  
  // Always save conversation to preserve the interaction, including function calls
  console.log('💾 Saving conversation after response...');
  await promptManager.saveConversation(conversationKey, prompt);
});

(async () => {
  await app.start(+(process.env.PORT || 3978));
})();
