"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQuotedAdaptiveCard = createQuotedAdaptiveCard;
exports.createQuotedAdaptiveCardFromRecord = createQuotedAdaptiveCardFromRecord;
exports.createSearchPrompt = createSearchPrompt;
const teams_ai_1 = require("@microsoft/teams.ai");
const teams_openai_1 = require("@microsoft/teams.openai");
const message_1 = require("../storage/message");
const config_1 = require("../utils/config");
const instructions_1 = require("../agent/instructions");
// Function schemas for search operations
const SEARCH_MESSAGES_SCHEMA = {
    type: 'object',
    properties: {
        keywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Keywords to search for in message content (excluding time expressions)'
        },
        participants: {
            type: 'array',
            items: { type: 'string' },
            description: 'Names of people who should be involved in the conversation'
        },
        start_time: {
            type: 'string',
            description: 'Start time for search range (ISO format). Calculate this based on user request like "earlier today", "yesterday", etc.'
        },
        end_time: {
            type: 'string',
            description: 'End time for search range (ISO format). Usually current time for "earlier today" or end of day for specific dates.'
        },
        max_results: {
            type: 'number',
            description: 'Maximum number of results to return (default 10)',
            default: 10
        }
    },
    required: ['keywords']
};
/**
 * Create an Adaptive Card with deep link to original message
 */
function createQuotedAdaptiveCard(activity) {
    if (!activity.id || !activity.conversation?.id) {
        throw new Error("Missing activity.id or conversation.id");
    }
    const messageText = activity.text ?? "<no message text>";
    const senderName = activity.from?.name ?? "Unknown";
    const timestamp = activity.timestamp
        ? new Date(activity.timestamp).toLocaleString()
        : "";
    // Build deep link with chat context
    const chatId = activity.conversation.id;
    const messageId = activity.id;
    const contextParam = encodeURIComponent(JSON.stringify({ contextType: "chat" }));
    const deepLink = `https://teams.microsoft.com/l/message/${encodeURIComponent(chatId)}/${messageId}?context=${contextParam}`;
    // Return Adaptive Card JSON
    return {
        type: "AdaptiveCard",
        version: "1.4",
        body: [
            {
                type: "TextBlock",
                text: `"${messageText}"`,
                wrap: true,
                weight: "Bolder",
                color: "Accent",
                spacing: "Medium"
            },
            {
                type: "TextBlock",
                text: `— ${senderName}${timestamp ? `, ${timestamp}` : ""}`,
                isSubtle: true,
                wrap: true,
                spacing: "None"
            }
        ],
        actions: [
            {
                type: "Action.OpenUrl",
                title: "View Original Message",
                url: deepLink
            }
        ],
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json"
    };
}
/**
 * Create an Adaptive Card from a stored message record
 */
function createQuotedAdaptiveCardFromRecord(message, conversationId) {
    if (!message.activity_id) {
        throw new Error("Message record missing activity_id for deep linking");
    }
    const messageText = message.content ?? "<no message text>";
    const senderName = message.name ?? "Unknown";
    const timestamp = message.timestamp
        ? new Date(message.timestamp).toLocaleString()
        : "";
    // Build deep link with chat context
    const chatId = conversationId;
    const messageId = message.activity_id;
    const contextParam = encodeURIComponent(JSON.stringify({ contextType: "chat" }));
    const deepLink = `https://teams.microsoft.com/l/message/${encodeURIComponent(chatId)}/${messageId}?context=${contextParam}`;
    // Return Adaptive Card JSON
    return {
        type: "AdaptiveCard",
        version: "1.4",
        body: [
            {
                type: "TextBlock",
                text: `"${messageText}"`,
                wrap: true,
                weight: "Bolder",
                color: "Accent",
                spacing: "Medium"
            },
            {
                type: "TextBlock",
                text: `— ${senderName}${timestamp ? `, ${timestamp}` : ""}`,
                isSubtle: true,
                wrap: true,
                spacing: "None"
            }
        ],
        actions: [
            {
                type: "Action.OpenUrl",
                title: "View Original Message",
                url: deepLink
            }
        ],
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json"
    };
}
/**
 * Search for messages based on keywords and participants
 */
function searchMessages(conversationId, keywords, participants = [], startTime, endTime, maxResults = 10) {
    try {
        // Get messages in the time range using centralized function
        const messages = (0, message_1.getMessagesByTimeRange)(conversationId, startTime, endTime);
        // Filter by keywords (case-insensitive)
        let filteredMessages = messages.filter((msg) => {
            const content = msg.content.toLowerCase();
            return keywords.some(keyword => content.includes(keyword.toLowerCase()));
        });
        // Filter by participants if specified
        if (participants.length > 0) {
            filteredMessages = filteredMessages.filter((msg) => {
                const name = msg.name.toLowerCase();
                return participants.some(participant => name.includes(participant.toLowerCase()) ||
                    participant.toLowerCase().includes(name));
            });
        }
        // Sort by timestamp (most recent first) and limit results
        filteredMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return filteredMessages.slice(0, maxResults);
    }
    catch (error) {
        console.error(`❌ Error searching messages:`, error);
        return [];
    }
}
/**
 * Create the search prompt for a specific conversation
 */
function createSearchPrompt(conversationId, userTimezone, adaptiveCardsArray) {
    const searchModelConfig = (0, config_1.getModelConfig)('search');
    // Get current date and timezone info for the LLM
    const currentDate = new Date().toISOString();
    const timezone = userTimezone || 'UTC';
    const prompt = new teams_ai_1.ChatPrompt({
        instructions: `${instructions_1.SEARCH_PROMPT}

CURRENT CONTEXT:
- Current date/time: ${currentDate}
- User timezone: ${timezone}
- When calculating time ranges like "earlier today", "yesterday", use the current time and timezone above
- Always provide start_time and end_time in ISO format when searching for time-based queries`,
        model: new teams_openai_1.OpenAIChatModel({
            model: searchModelConfig.model,
            apiKey: searchModelConfig.apiKey,
            endpoint: searchModelConfig.endpoint,
            apiVersion: searchModelConfig.apiVersion,
        }),
    })
        .function('search_messages', 'Search for messages in the conversation history', SEARCH_MESSAGES_SCHEMA, async (args) => {
        const { keywords, participants = [], start_time, end_time, max_results = 10 } = args;
        // Search for matching messages
        const matchingMessages = searchMessages(conversationId, keywords, participants, start_time, end_time, max_results);
        if (matchingMessages.length === 0) {
            return 'No messages found matching your search criteria. Try different keywords or a broader time range.';
        }
        // Group messages by time periods for better context
        const groupedMessages = groupMessagesByTime(matchingMessages);
        // Create a summary response
        let response = `Found ${matchingMessages.length} messages matching your search:\n\n`;
        groupedMessages.forEach(group => {
            response += `**${group.period}** (${group.messages.length} messages)\n`;
            group.messages.slice(0, 3).forEach(msg => {
                const preview = msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content;
                response += `• ${msg.name}: "${preview}"\n`;
            });
            if (group.messages.length > 3) {
                response += `  ... and ${group.messages.length - 3} more\n`;
            }
            response += '\n';
        });
        // Create adaptive cards for the first few results (limit to 5 to avoid overwhelming the user)
        const cardsToShow = matchingMessages.slice(0, 5);
        const adaptiveCards = cardsToShow.map(msg => createQuotedAdaptiveCardFromRecord(msg, conversationId));
        // If we have an array to store cards, add them there for the manager to access
        if (adaptiveCardsArray) {
            adaptiveCardsArray.push(...adaptiveCards);
        }
        // Return just the summary text (adaptive cards are handled via the shared array)
        return response;
    });
    return prompt;
}
/**
 * Group messages by time periods for better organization
 */
function groupMessagesByTime(messages) {
    const groups = {};
    const now = new Date();
    messages.forEach(msg => {
        const msgDate = new Date(msg.timestamp);
        const diffHours = (now.getTime() - msgDate.getTime()) / (1000 * 60 * 60);
        let period;
        if (diffHours < 24) {
            period = 'Today';
        }
        else if (diffHours < 48) {
            period = 'Yesterday';
        }
        else if (diffHours < 168) { // 7 days
            period = 'This week';
        }
        else if (diffHours < 720) { // 30 days
            period = 'This month';
        }
        else {
            period = 'Older';
        }
        if (!groups[period]) {
            groups[period] = [];
        }
        groups[period].push(msg);
    });
    // Return in chronological order (most recent first)
    const orderedPeriods = ['Today', 'Yesterday', 'This week', 'This month', 'Older'];
    return orderedPeriods
        .filter(period => groups[period])
        .map(period => ({ period, messages: groups[period] }));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VhcmNoLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NhcGFiaWxpdGllcy9zZWFyY2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUEwQ0EsNERBK0NDO0FBS0QsZ0ZBK0NDO0FBZ0RELGdEQTJFQztBQXhRRCxrREFBaUQ7QUFDakQsMERBQTBEO0FBRTFELGdEQUE0RDtBQUM1RCw0Q0FBaUQ7QUFFakQsd0RBQXNEO0FBRXRELHlDQUF5QztBQUN6QyxNQUFNLHNCQUFzQixHQUFHO0lBQzdCLElBQUksRUFBRSxRQUFpQjtJQUN2QixVQUFVLEVBQUU7UUFDVixRQUFRLEVBQUU7WUFDUixJQUFJLEVBQUUsT0FBZ0I7WUFDdEIsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQWlCLEVBQUU7WUFDbEMsV0FBVyxFQUFFLHdFQUF3RTtTQUN0RjtRQUNELFlBQVksRUFBRTtZQUNaLElBQUksRUFBRSxPQUFnQjtZQUN0QixLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBaUIsRUFBRTtZQUNsQyxXQUFXLEVBQUUsNERBQTREO1NBQzFFO1FBQ0QsVUFBVSxFQUFFO1lBQ1YsSUFBSSxFQUFFLFFBQWlCO1lBQ3ZCLFdBQVcsRUFBRSx3SEFBd0g7U0FDdEk7UUFDRCxRQUFRLEVBQUU7WUFDUixJQUFJLEVBQUUsUUFBaUI7WUFDdkIsV0FBVyxFQUFFLG9IQUFvSDtTQUNsSTtRQUNELFdBQVcsRUFBRTtZQUNYLElBQUksRUFBRSxRQUFpQjtZQUN2QixXQUFXLEVBQUUsa0RBQWtEO1lBQy9ELE9BQU8sRUFBRSxFQUFFO1NBQ1o7S0FDRjtJQUNELFFBQVEsRUFBRSxDQUFDLFVBQVUsQ0FBQztDQUN2QixDQUFDO0FBRUY7O0dBRUc7QUFDSCxTQUFnQix3QkFBd0IsQ0FBQyxRQUEwQjtJQUNqRSxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLEVBQUUsRUFBRSxFQUFFLENBQUM7UUFDL0MsTUFBTSxJ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