"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchCapability = void 0;
exports.createCitationFromRecord = createCitationFromRecord;
const teams_ai_1 = require("@microsoft/teams.ai");
const teams_openai_1 = require("@microsoft/teams.openai");
const message_1 = require("../storage/message");
const instructions_1 = require("../agent/instructions");
const capability_1 = require("./capability");
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
 * Create a Citation object from a message record for display in Teams
 */
function createCitationFromRecord(message, conversationId) {
    if (!message.activity_id) {
        throw new Error("Message record missing activity_id for deep linking");
    }
    const messageText = message.content ?? "<no message text>";
    const senderName = message.name ?? "Unknown";
    // Format timestamp for context
    const messageDate = new Date(message.timestamp);
    const formattedDate = messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    // Build deep link with chat context
    const chatId = conversationId;
    const messageId = message.activity_id;
    const contextParam = encodeURIComponent(JSON.stringify({ contextType: "chat" }));
    const deepLink = `https://teams.microsoft.com/l/message/${encodeURIComponent(chatId)}/${messageId}?context=${contextParam}`;
    // Create citation with message content and timestamp context
    const maxContentLength = 120; // Leave room for timestamp info
    const truncatedContent = messageText.length > maxContentLength ?
        messageText.substring(0, maxContentLength) + '...' :
        messageText;
    const abstractText = `${formattedDate}: "${truncatedContent}"`;
    const titleText = `Message from ${senderName}`.length > 80 ? `${senderName}` : `Message from ${senderName}`;
    return {
        name: titleText,
        url: deepLink,
        abstract: abstractText,
        keywords: senderName ? [senderName] : undefined
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
 * Refactored Search Capability that implements the unified capability interface
 */
class SearchCapability extends capability_1.BaseCapability {
    name = 'search';
    createPrompt(config) {
        this.logInit(config.conversationId, config.userTimezone);
        const searchModelConfig = this.getModelConfig('search');
        // Build additional time context if pre-calculated times are provided
        let timeContext = '';
        if (config.calculatedStartTime && config.calculatedEndTime) {
            console.log(`🕒 Search Capability received pre-calculated time range: ${config.timespanDescription || 'calculated timespan'} (${config.calculatedStartTime} to ${config.calculatedEndTime})`);
            timeContext = `

IMPORTANT: Pre-calculated time range available:
- Start: ${config.calculatedStartTime}
- End: ${config.calculatedEndTime}
- Description: ${config.timespanDescription || 'calculated timespan'}

When searching messages, use these exact timestamps instead of calculating your own. This ensures consistency with the Manager's time calculations and reduces token usage.`;
        }
        // Get current date and timezone info for the LLM
        const currentDate = new Date().toISOString();
        const timezone = config.userTimezone || 'UTC';
        const instructions = `${instructions_1.SEARCH_PROMPT}

CURRENT CONTEXT:
- Current date/time: ${currentDate}
- User timezone: ${timezone}
- When calculating time ranges like "earlier today", "yesterday", use the current time and timezone above
- Always provide start_time and end_time in ISO format when searching for time-based queries${timeContext}`;
        const prompt = new teams_ai_1.ChatPrompt({
            instructions,
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
            const matchingMessages = searchMessages(config.conversationId, keywords, participants, start_time, end_time, max_results);
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
            // Create citations for the first few results (limit to 5 to avoid overwhelming the user)
            const messagesToCite = matchingMessages.slice(0, 5);
            const citations = messagesToCite.map(msg => createCitationFromRecord(msg, config.conversationId));
            // If we have an array to store citations, add them there for the manager to access
            if (config.citationsArray) {
                config.citationsArray.push(...citations);
            }
            // Return just the summary text (citations are handled via the shared array)
            return response;
        });
        console.log(`🔍 Search Capability created with unified interface`);
        return prompt;
    }
    getFunctionSchemas() {
        return [
            { name: 'search_messages', schema: SEARCH_MESSAGES_SCHEMA }
        ];
    }
}
exports.SearchCapability = SearchCapability;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VhcmNoLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NhcGFiaWxpdGllcy9zZWFyY2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBMENBLDREQXVDQztBQWpGRCxrREFBaUQ7QUFDakQsMERBQTBEO0FBRzFELGdEQUE0RDtBQUM1RCx3REFBc0Q7QUFDdEQsNkNBQWdFO0FBRWhFLHlDQUF5QztBQUN6QyxNQUFNLHNCQUFzQixHQUFHO0lBQzdCLElBQUksRUFBRSxRQUFpQjtJQUN2QixVQUFVLEVBQUU7UUFDVixRQUFRLEVBQUU7WUFDUixJQUFJLEVBQUUsT0FBZ0I7WUFDdEIsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQWlCLEVBQUU7WUFDbEMsV0FBVyxFQUFFLHdFQUF3RTtTQUN0RjtRQUNELFlBQVksRUFBRTtZQUNaLElBQUksRUFBRSxPQUFnQjtZQUN0QixLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBaUIsRUFBRTtZQUNsQyxXQUFXLEVBQUUsNERBQTREO1NBQzFFO1FBQ0QsVUFBVSxFQUFFO1lBQ1YsSUFBSSxFQUFFLFFBQWlCO1lBQ3ZCLFdBQVcsRUFBRSx3SEFBd0g7U0FDdEk7UUFDRCxRQUFRLEVBQUU7WUFDUixJQUFJLEVBQUUsUUFBaUI7WUFDdkIsV0FBVyxFQUFFLG9IQUFvSDtTQUNsSTtRQUNELFdBQVcsRUFBRTtZQUNYLElBQUksRUFBRSxRQUFpQjtZQUN2QixXQUFXLEVBQUUsa0RBQWtEO1lBQy9ELE9BQU8sRUFBRSxFQUFFO1NBQ1o7S0FDRjtJQUNELFFBQVEsRUFBRSxDQUFDLFVBQVUsQ0FBQztDQUN2QixDQUFDO0FBRUY7O0dBRUc7QUFDSCxTQUFnQix3QkFBd0IsQ0FBQyxPQUFzQixFQUFFLGNBQXNCO0lBQ3JGLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDekIsTUFBTSxJQUFJLEtBQUssQ0FBQyxxREFBcUQsQ0FBQyxDQUFDO0lBQ3pFLENBQUM7SUFFRCxN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