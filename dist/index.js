"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const teams_apps_1 = require("@microsoft/teams.apps");
const teams_dev_1 = require("@microsoft/teams.dev");
const core_1 = require("./agent/core");
const app = new teams_apps_1.App({
    plugins: [new teams_dev_1.DevtoolsPlugin()],
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
    const prompt = core_1.promptManager.getOrCreatePrompt(conversationKey);
    // Send message to AI (which can now call functions automatically)
    const res = await prompt.send(activity.text);
    // Log the full response for debugging
    console.log('🔍 Full AI response structure:', JSON.stringify(res, null, 2));
    // Check if the AI made function calls and handle the response
    if (res.content) {
        await send({ type: 'message', text: res.content });
        console.log('🤖 LLM Response:', res.content);
    }
    else {
        // Check if there were function calls without final content
        console.log('⚠️ No content in response - checking for function calls or other response data');
        console.log('🔍 Response keys:', Object.keys(res));
        // Still try to save the conversation even if no content was returned
        // The function calls and user message should still be preserved
        await send({ type: 'message', text: 'I processed your request and called the necessary functions to gather the information.' });
    }
    // Always save conversation to preserve the interaction, including function calls
    console.log('💾 Saving conversation after response...');
    await core_1.promptManager.saveConversation(conversationKey, prompt);
});
(async () => {
    await app.start(+(process.env.PORT || 3978));
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxzREFBNEM7QUFDNUMsb0RBQXNEO0FBQ3RELHVDQUE2QztBQUU3QyxNQUFNLEdBQUcsR0FBRyxJQUFJLGdCQUFHLENBQUM7SUFDbEIsT0FBTyxFQUFFLENBQUMsSUFBSSwwQkFBYyxFQUFFLENBQUM7Q0FDaEMsQ0FBQyxDQUFDO0FBR0gsR0FBRyxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRTtJQUVqRSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDaEIsTUFBTSxNQUFNLENBQUM7WUFDWCxzRUFBc0U7WUFDdEUsYUFBYSxFQUFFLHlCQUF5QjtZQUN4QyxnQkFBZ0IsRUFBRSxTQUFTO1NBQzVCLENBQUMsQ0FBQyxDQUFDLDBDQUEwQztRQUM5QyxPQUFPO0lBQ1QsQ0FBQztJQUVELDRDQUE0QztJQUM1QyxNQUFNLGVBQWUsR0FBRyxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFFLENBQUM7SUFDdEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyx3QkFBd0IsZUFBZSxFQUFFLENBQUMsQ0FBQztJQUV2RCw2QkFBNkI7SUFDN0IsNERBQTREO0lBQzVELHNEQUFzRDtJQUN0RCw2RkFBNkY7SUFDN0YsWUFBWTtJQUNaLElBQUk7SUFFSix3Q0FBd0M7SUFDeEMsMERBQTBEO0lBQzFELGdGQUFnRjtJQUNoRixtREFBbUQ7SUFDbkQsa0ZBQWtGO0lBQ2xGLGtCQUFrQjtJQUVsQixrQkFBa0I7SUFDbEIsd0JBQXdCO0lBQ3hCLDBGQUEwRjtJQUMxRixRQUFRO0lBQ1IsWUFBWTtJQUNaLElBQUk7SUFFSix5REFBeUQ7SUFDekQsa0ZBQWtGO0lBQ2xGLGdEQUFnRDtJQUNoRCxzR0FBc0c7SUFDdEcsa0JBQWtCO0lBRWxCLGtCQUFrQjtJQUNsQix3QkFBd0I7SUFDeEIsdUdBQXVHO0lBQ3ZHLFFBQVE7SUFDUixZQUFZO0lBQ1osSUFBSTtJQUVKLDhFQUE4RTtJQUM5RSxNQUFNLE1BQU0sR0FBRyxvQkFBYSxDQUFDLGlCQUFpQixDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBRWhFLGtFQUFrRTtJQUNsRSxNQUFNLEdBQUcsR0FBRyxNQUFNLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRTdDLHNDQUFzQztJQUN0QyxPQUFPLENBQUMsR0FBRyxDQUFDLGdDQUFnQyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTVFLDhEQUE4RDtJQUM5RCxJQUFJLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNoQixNQUFNLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ25ELE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLEVBQUUsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQy9DLENBQUM7U0FBTSxDQUFDO1FBQ04sMkRBQTJEO1FBQzNELE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0ZBQWdGLENBQUMsQ0FBQztRQUM5RixPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUVuRCxxRUFBcUU7UUFDckUsZ0VBQWdFO1FBQ2hFLE1BQU0sSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsd0ZBQXdGLEVBQUUsQ0FBQyxDQUFDO0lBQ2xJLENBQUM7SUFFRCxpRkFBaUY7SUFDakYsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO0lBQ3hELE1BQU0sb0JBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDaEUsQ0FBQyxDQUFDLENBQUM7QUFFSCxDQUFDLEtBQUssSUFBSSxFQUFFO0lBQ1YsTUFBTSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQy9DLENBQUMsQ0FBQyxFQUFFLENBQUMifQ==