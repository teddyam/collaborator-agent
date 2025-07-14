"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SummarizerCapability = void 0;
const teams_ai_1 = require("@microsoft/teams.ai");
const teams_openai_1 = require("@microsoft/teams.openai");
const message_1 = require("../storage/message");
const instructions_1 = require("../agent/instructions");
const capability_1 = require("./capability");
// Function schemas for the summarizer
const GET_RECENT_MESSAGES_SCHEMA = {
    type: 'object',
    properties: {
        limit: {
            type: 'number',
            description: 'Number of recent messages to retrieve (default: 5, max: 20)',
            minimum: 1,
            maximum: 20
        }
    }
};
const GET_MESSAGES_BY_TIME_RANGE_SCHEMA = {
    type: 'object',
    properties: {
        start_time: {
            type: 'string',
            description: 'Start time in ISO format (e.g., 2024-01-01T00:00:00.000Z). Optional.'
        },
        end_time: {
            type: 'string',
            description: 'End time in ISO format (e.g., 2024-01-01T23:59:59.999Z). Optional.'
        }
    }
};
const SHOW_RECENT_MESSAGES_SCHEMA = {
    type: 'object',
    properties: {
        count: {
            type: 'number',
            description: 'Number of recent messages to display (default: 5)',
            minimum: 1,
            maximum: 20
        }
    }
};
const EMPTY_SCHEMA = {
    type: 'object',
    properties: {}
};
/**
 * Refactored Summarizer Capability that implements the unified capability interface
 */
class SummarizerCapability extends capability_1.BaseCapability {
    name = 'summarizer';
    createPrompt(config) {
        this.logInit(config.conversationId, config.userTimezone);
        const summarizerModelConfig = this.getModelConfig('summarizer');
        // Build additional time context if pre-calculated times are provided
        let timeContext = '';
        if (config.calculatedStartTime && config.calculatedEndTime) {
            console.log(`🕒 Summarizer Capability received pre-calculated time range: ${config.timespanDescription || 'calculated timespan'} (${config.calculatedStartTime} to ${config.calculatedEndTime})`);
            timeContext = `

IMPORTANT: Pre-calculated time range available:
- Start: ${config.calculatedStartTime}
- End: ${config.calculatedEndTime}
- Description: ${config.timespanDescription || 'calculated timespan'}

When retrieving messages for summarization, use these exact timestamps instead of calculating your own. This ensures consistency with the Manager's time calculations and reduces token usage.`;
        }
        const instructions = instructions_1.SUMMARY_PROMPT + timeContext;
        const prompt = new teams_ai_1.ChatPrompt({
            instructions,
            model: new teams_openai_1.OpenAIChatModel({
                model: summarizerModelConfig.model,
                apiKey: summarizerModelConfig.apiKey,
                endpoint: summarizerModelConfig.endpoint,
                apiVersion: summarizerModelConfig.apiVersion,
            }),
        })
            .function('get_recent_messages', 'Retrieve recent messages from the conversation history with timestamps', GET_RECENT_MESSAGES_SCHEMA, async (args) => {
            const limit = args.limit || 5;
            console.log(`🔍 FUNCTION CALL: get_recent_messages with limit=${limit} for conversation=${config.conversationId}`);
            const recentMessages = (0, message_1.getRecentMessages)(config.conversationId, limit);
            console.log(`📨 Retrieved ${recentMessages.length} recent messages`);
            return JSON.stringify({
                status: 'success',
                messages: recentMessages.map((msg) => ({
                    timestamp: msg.timestamp,
                    role: msg.role,
                    name: msg.name,
                    content: msg.content
                })),
                count: recentMessages.length
            });
        })
            .function('get_messages_by_time_range', 'Retrieve messages from a specific time range', GET_MESSAGES_BY_TIME_RANGE_SCHEMA, async (args) => {
            const { start_time, end_time } = args;
            console.log(`🔍 FUNCTION CALL: get_messages_by_time_range with start=${start_time}, end=${end_time} for conversation=${config.conversationId}`);
            const rangeMessages = (0, message_1.getMessagesByTimeRange)(config.conversationId, start_time, end_time);
            console.log(`📅 Retrieved ${rangeMessages.length} messages from time range`);
            return JSON.stringify({
                status: 'success',
                messages: rangeMessages.map((msg) => ({
                    timestamp: msg.timestamp,
                    role: msg.role,
                    name: msg.name,
                    content: msg.content
                })),
                count: rangeMessages.length,
                timeRange: { start: start_time, end: end_time }
            });
        })
            .function('show_recent_messages', 'Display recent messages in a formatted way for the user', SHOW_RECENT_MESSAGES_SCHEMA, async (args) => {
            const displayCount = args.count || 5;
            console.log(`🔍 FUNCTION CALL: show_recent_messages with count=${displayCount} for conversation=${config.conversationId}`);
            const messagesToShow = (0, message_1.getRecentMessages)(config.conversationId, displayCount);
            console.log(`📋 Formatting ${messagesToShow.length} messages for display`);
            const messageList = messagesToShow.map((msg) => `[${new Date(msg.timestamp).toLocaleString()}] ${msg.name} (${msg.role}): ${msg.content}`).join('\n');
            return JSON.stringify({
                status: 'success',
                formatted_messages: messageList || 'No messages found',
                count: messagesToShow.length,
                display_text: `📅 Recent messages (${messagesToShow.length}):\n${messageList || 'No messages found'}`
            });
        })
            .function('summarize_conversation', 'Get a summary of the conversation with message counts and time span', EMPTY_SCHEMA, async (_args) => {
            console.log(`🔍 FUNCTION CALL: summarize_conversation for conversation=${config.conversationId}`);
            const allMessages = (0, message_1.getMessagesWithTimestamps)(config.conversationId);
            console.log(`📊 Retrieved ${allMessages.length} total messages for conversation summary`);
            return JSON.stringify({
                status: 'success',
                totalMessages: allMessages.length,
                conversationId: config.conversationId,
                oldestMessage: allMessages.length > 0 ? allMessages[0].timestamp : null,
                newestMessage: allMessages.length > 0 ? allMessages[allMessages.length - 1].timestamp : null,
                messagesByRole: allMessages.reduce((acc, msg) => {
                    acc[msg.role] = (acc[msg.role] || 0) + 1;
                    return acc;
                }, {}),
                messagesByName: allMessages.reduce((acc, msg) => {
                    acc[msg.name] = (acc[msg.name] || 0) + 1;
                    return acc;
                }, {}),
                participants: [...new Set(allMessages.map((msg) => msg.name))],
                messages: allMessages.map((msg) => ({
                    timestamp: msg.timestamp,
                    role: msg.role,
                    name: msg.name,
                    content: msg.content
                }))
            });
        });
        console.log(`📋 Summarizer Capability created with unified interface`);
        return prompt;
    }
    getFunctionSchemas() {
        return [
            { name: 'get_recent_messages', schema: GET_RECENT_MESSAGES_SCHEMA },
            { name: 'get_messages_by_time_range', schema: GET_MESSAGES_BY_TIME_RANGE_SCHEMA },
            { name: 'show_recent_messages', schema: SHOW_RECENT_MESSAGES_SCHEMA },
            { name: 'summarize_conversation', schema: EMPTY_SCHEMA }
        ];
    }
}
exports.SummarizerCapability = SummarizerCapability;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3VtbWFyaXplLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NhcGFiaWxpdGllcy9zdW1tYXJpemUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsa0RBQWlEO0FBQ2pELDBEQUEwRDtBQUMxRCxnREFBMEc7QUFDMUcsd0RBQXVEO0FBQ3ZELDZDQUFnRTtBQUVoRSxzQ0FBc0M7QUFDdEMsTUFBTSwwQkFBMEIsR0FBRztJQUNqQyxJQUFJLEVBQUUsUUFBaUI7SUFDdkIsVUFBVSxFQUFFO1FBQ1YsS0FBSyxFQUFFO1lBQ0wsSUFBSSxFQUFFLFFBQWlCO1lBQ3ZCLFdBQVcsRUFBRSw2REFBNkQ7WUFDMUUsT0FBTyxFQUFFLENBQUM7WUFDVixPQUFPLEVBQUUsRUFBRTtTQUNaO0tBQ0Y7Q0FDRixDQUFDO0FBRUYsTUFBTSxpQ0FBaUMsR0FBRztJQUN4QyxJQUFJLEVBQUUsUUFBaUI7SUFDdkIsVUFBVSxFQUFFO1FBQ1YsVUFBVSxFQUFFO1lBQ1YsSUFBSSxFQUFFLFFBQWlCO1lBQ3ZCLFdBQVcsRUFBRSxzRUFBc0U7U0FDcEY7UUFDRCxRQUFRLEVBQUU7WUFDUixJQUFJLEVBQUUsUUFBaUI7WUFDdkIsV0FBVyxFQUFFLG9FQUFvRTtTQUNsRjtLQUNGO0NBQ0YsQ0FBQztBQUVGLE1BQU0sMkJBQTJCLEdBQUc7SUFDbEMsSUFBSSxFQUFFLFFBQWlCO0lBQ3ZCLFVBQVUsRUFBRTtRQUNWLEtBQUssRUFBRTtZQUNMLElBQUksRUFBRSxRQUFpQjtZQUN2QixXQUFXLEVBQUUsbURBQW1EO1lBQ2hFLE9BQU8sRUFBRSxDQUFDO1lBQ1YsT0FBTyxFQUFFLEVBQUU7U0FDWjtLQUNGO0NBQ0YsQ0FBQztBQUVGLE1BQU0sWUFBWSxHQUFHO0lBQ25CLElBQUksRUFBRSxRQUFpQjtJQUN2QixVQUFVLEVBQUUsRUFBRTtDQUNmLENBQUM7QUFFRjs7R0FFRztBQUNILE1BQWEsb0JBQXFCLFNBQVEsMkJBQWM7SUFDN0MsSUFBSSxHQUFHLFlB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