"use strict";
// Mock conversation data for testing and debugging
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOCK_MESSAGES = void 0;
exports.createMockDatabase = createMockDatabase;
exports.getMockSummary = getMockSummary;
// Single mock conversation with all messages combined chronologically
exports.MOCK_MESSAGES = [
    // Recent project discussion (past 2 hours)
    {
        role: 'user',
        content: 'Hey team, how is the new dashboard project coming along?',
        name: 'Sarah Johnson',
        hoursAgo: 2
    },
    {
        role: 'assistant',
        content: 'The dashboard project is progressing well! We\'ve completed the user authentication flow and are now working on the data visualization components.',
        name: 'AI Assistant',
        hoursAgo: 2
    },
    {
        role: 'user',
        content: 'Great! What about the API integration? Any blockers there?',
        name: 'Mike Chen',
        hoursAgo: 1.8
    },
    {
        role: 'assistant',
        content: 'API integration is mostly done. We had some rate limiting issues with the external service, but we\'ve implemented proper retry logic and caching.',
        name: 'AI Assistant',
        hoursAgo: 1.7
    },
    {
        role: 'user',
        content: 'Perfect. When do you think we can have a demo ready?',
        name: 'Sarah Johnson',
        hoursAgo: 1.5
    },
    {
        role: 'assistant',
        content: 'We should have a working demo by tomorrow afternoon. Just need to polish the UI and add some error handling.',
        name: 'AI Assistant',
        hoursAgo: 1.4
    },
    // Microsoft Teams features discussion (3 days ago)
    {
        role: 'user',
        content: 'Did you see the new Microsoft Teams features announced at Build?',
        name: 'Alex Rodriguez',
        hoursAgo: 72
    },
    {
        role: 'assistant',
        content: 'Yes! The AI-powered meeting summaries look really promising. It could save so much time in our daily standups.',
        hoursAgo: 71.8
    },
    {
        role: 'user',
        content: 'Totally agree. And the new collaborative canvas feature seems game-changing for brainstorming sessions.',
        hoursAgo: 71.5
    },
    {
        role: 'assistant',
        content: 'I\'m most excited about the improved integration with Office 365. Being able to edit docs directly in Teams chat will streamline our workflow significantly.',
        hoursAgo: 71.2
    },
    {
        role: 'user',
        content: 'Have you tried the new PowerBI integration yet?',
        hoursAgo: 70.8
    },
    {
        role: 'assistant',
        content: 'Not yet, but I heard it makes sharing dashboards much more intuitive. Should definitely test it out for our quarterly reports.',
        hoursAgo: 70.5
    },
    // Azure cost optimization discussion (1 week ago)
    {
        role: 'user',
        content: 'Our Azure costs are getting a bit high this quarter. Any suggestions for optimization?',
        hoursAgo: 168
    },
    {
        role: 'assistant',
        content: 'I\'d recommend starting with Azure Cost Management + Billing. We can identify unused resources and right-size our VMs.',
        hoursAgo: 167.8
    },
    {
        role: 'user',
        content: 'Good idea. What about storage costs? We have a lot of blob storage that might not be accessed frequently.',
        hoursAgo: 167.5
    },
    {
        role: 'assistant',
        content: 'For blob storage, consider implementing lifecycle management policies. Move older data to cool or archive tiers to reduce costs significantly.',
        hoursAgo: 167.2
    },
    {
        role: 'user',
        content: 'That makes sense. Should we also look into Reserved Instances for our production VMs?',
        hoursAgo: 166.8
    },
    {
        role: 'assistant',
        content: 'Absolutely! Reserved Instances can save up to 72% compared to pay-as-you-go pricing. Given our predictable workloads, it\'s a no-brainer.',
        hoursAgo: 166.5
    },
    {
        role: 'user',
        content: 'I\'ll set up a meeting with the finance team to discuss the RI commitments.',
        hoursAgo: 166.2
    },
    {
        role: 'assistant',
        content: 'Great! Also consider Azure Hybrid Benefit if we have any on-premises Windows Server licenses we can leverage.',
        hoursAgo: 166
    },
];
// Helper function to create a mock database
function createMockDatabase(insertMessageFn, conversationId) {
    console.log('🎭 Creating mock database with sample conversation...');
    // Add all messages to the single conversation
    exports.MOCK_MESSAGES.forEach(msg => {
        const timestamp = new Date(Date.now() - (msg.hoursAgo * 60 * 60 * 1000)).toISOString();
        insertMessageFn(conversationId, msg.role, msg.content, timestamp, msg.name);
    });
    console.log(`📝 Created mock conversation with ${exports.MOCK_MESSAGES.length} messages`);
    console.log('✅ Mock database created successfully!');
}
// Function to generate summary text for mock creation
function getMockSummary() {
    return `🎭 **Mock Database Created!**

A single conversation with ${exports.MOCK_MESSAGES.length} sample messages has been created, covering:

📋 **Topics discussed:**
- Recent dashboard project updates (past 2 hours)
- Microsoft Teams features from Build conference (3 days ago)  
- Azure cost optimization strategies (1 week ago)

🔧 **You can now test:**
- Ask me to summarize this conversation
- \`get_recent_messages\` - Show recent messages
- \`get_messages_by_time_range\` - Query by time range
- \`msg.db\` - Debug database contents

💡 **Try asking:** "Can you summarize our recent conversations?"`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja01lc3NhZ2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL21vY2svbW9ja01lc3NhZ2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxtREFBbUQ7OztBQThIbkQsZ0RBV0M7QUFHRCx3Q0FpQkM7QUFwSkQsc0VBQXNFO0FBQ3pELFFBQUEsYUFBYSxHQUFrQjtJQUMxQywyQ0FBMkM7SUFDM0M7UUFDRSxJQUFJLEVBQUUsTUFBTTtRQUNaLE9BQU8sRUFBRSwwREFBMEQ7UUFDbkUsSUFBSSxFQUFFLGVBQWU7UUFDckIsUUFBUSxFQUFFLENBQUM7S0FDWjtJQUNEO1FBQ0UsSUFBSSxFQUFFLFdBQVc7UUFDakIsT0FBTyxFQUFFLG9KQUFvSjtRQUM3SixJQUFJLEVBQUUsY0FBYztRQUNwQixRQUFRLEVBQUUsQ0FBQztLQUNaO0lBQ0Q7UUFDRSxJQUFJLEVBQUUsTUFBTTtRQUNaLE9BQU8sRUFBRSw0REFBNEQ7UUFDckUsSUFBSSxFQUFFLFdBQVc7UUFDakIsUUFBUSxFQUFFLEdBQUc7S0FDZDtJQUNEO1FBQ0UsSUFBSSxFQUFFLFdBQVc7UUFDakIsT0FBTyxFQUFFLG9KQUFvSjtRQUM3SixJQUFJLEVBQUUsY0FBYztRQUNwQixRQUFRLEVBQUUsR0FBRztLQUNkO0lBQ0Q7UUFDRSxJQUFJLEVBQUUsTUFBTTtRQUNaLE9BQU8sRUFBRSxzREFBc0Q7UUFDL0QsSUFBSSxFQUFFLGVBQWU7UUFDckIsUUFBUSxFQUFFLEdBQUc7S0FDZDtJQUNEO1FBQ0UsSUFBSSxFQUFFLFdBQVc7UUFDakIsT0FBTyxFQUFFLDhHQUE4RztRQUN2SCxJQUFJLEVBQUUsY0FBYztRQUNwQixRQUFRLEVBQUUsR0FBRztLQUNkO0lBRUQsbURBQW1EO0lBQ25EO1FBQ0UsSUFBSSxFQUFFLE1BQU07UUFDWixPQUFPLEVBQUUsa0VBQWtFO1FBQzNFLElBQUksRUFBRSxnQkFBZ0I7UUFDdEIsUUFBUSxFQUFFLEVBQUU7S0FDYjtJQUNEO1FBQ0UsSUFB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