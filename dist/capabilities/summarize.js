"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSummarizerPrompt = createSummarizerPrompt;
exports.getRecentMessagesWithNames = getRecentMessagesWithNames;
exports.getMessagesByTimeRangeWithNames = getMessagesByTimeRangeWithNames;
exports.getAllMessagesWithNames = getAllMessagesWithNames;
const teams_ai_1 = require("@microsoft/teams.ai");
const teams_openai_1 = require("@microsoft/teams.openai");
const message_1 = require("../storage/message");
const instructions_1 = require("../agent/instructions");
const config_1 = require("../utils/config");
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
const GET_MESSAGES_BY_RELATIVE_TIME_SCHEMA = {
    type: 'object',
    properties: {
        time_expression: {
            type: 'string',
            description: 'Relative time expression like "today", "yesterday", "this week" - will be parsed using user timezone'
        }
    },
    required: ['time_expression']
};
/**
 * Creates a specialized summarizer prompt with function tools for dynamic message retrieval
 */
function createSummarizerPrompt(conversationId, userTimezone) {
    console.log(`📋 Creating Summarizer Agent for conversation: ${conversationId}`);
    if (userTimezone) {
        console.log(`🕒 Using timezone: ${userTimezone}`);
    }
    // Note: We don't load conversation history upfront to avoid redundancy and double execution
    // Instead, we let the AI use function tools to fetch exactly what it needs
    console.log(`🔧 Summarizer will use function tools for dynamic message retrieval`);
    const summarizerModelConfig = (0, config_1.getModelConfig)('summarizer');
    // Create the specialized summarizer prompt with function tools only
    const summarizerPrompt = new teams_ai_1.ChatPrompt({
        instructions: instructions_1.SUMMARY_PROMPT,
        // No pre-loaded messages - AI will fetch what it needs using function tools
        model: new teams_openai_1.OpenAIChatModel({
            model: summarizerModelConfig.model,
            apiKey: summarizerModelConfig.apiKey,
            endpoint: summarizerModelConfig.endpoint,
            apiVersion: summarizerModelConfig.apiVersion,
        }),
    })
        .function('get_recent_messages', 'Retrieve recent messages from the conversation history with timestamps', GET_RECENT_MESSAGES_SCHEMA, async (args) => {
        const limit = args.limit || 5;
        console.log(`🔍 FUNCTION CALL: get_recent_messages with limit=${limit} for conversation=${conversationId}`);
        const recentMessages = (0, message_1.getRecentMessages)(conversationId, limit);
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
        console.log(`🔍 FUNCTION CALL: get_messages_by_time_range with start=${start_time}, end=${end_time} for conversation=${conversationId}`);
        const rangeMessages = (0, message_1.getMessagesByTimeRange)(conversationId, start_time, end_time);
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
        console.log(`🔍 FUNCTION CALL: show_recent_messages with count=${displayCount} for conversation=${conversationId}`);
        const messagesToShow = (0, message_1.getRecentMessages)(conversationId, displayCount);
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
        console.log(`🔍 FUNCTION CALL: summarize_conversation for conversation=${conversationId}`);
        const allMessages = (0, message_1.getMessagesWithTimestamps)(conversationId);
        console.log(`📊 Retrieved ${allMessages.length} total messages for conversation summary`);
        return JSON.stringify({
            status: 'success',
            totalMessages: allMessages.length,
            conversationId: conversationId,
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
    })
        .function('get_messages_by_relative_time', 'Retrieve messages based on a relative time expression', GET_MESSAGES_BY_RELATIVE_TIME_SCHEMA, async (args) => {
        const { time_expression } = args;
        console.log(`🔍 FUNCTION CALL: get_messages_by_relative_time with expression="${time_expression}" for conversation=${conversationId}`);
        // Parse the relative time expression to get start and end times
        const { startTime, endTime } = parseRelativeTimeForSummary(time_expression, userTimezone);
        console.log(`⏳ Time range for "${time_expression}": ${startTime} to ${endTime}`);
        const rangeMessages = (0, message_1.getMessagesByTimeRange)(conversationId, startTime, endTime);
        console.log(`📅 Retrieved ${rangeMessages.length} messages for relative time range`);
        return JSON.stringify({
            status: 'success',
            messages: rangeMessages.map((msg) => ({
                timestamp: msg.timestamp,
                role: msg.role,
                name: msg.name,
                content: msg.content
            })),
            count: rangeMessages.length,
            timeRange: { start: startTime, end: endTime }
        });
    });
    console.log(`📋 Summarizer Agent created with conversation history and functions`);
    return summarizerPrompt;
}
/**
 * Helper function to get recent messages with proper attribution
 */
function getRecentMessagesWithNames(conversationId, limit = 10) {
    return (0, message_1.getRecentMessages)(conversationId, limit);
}
/**
 * Helper function to get messages by time range with proper attribution
 */
function getMessagesByTimeRangeWithNames(conversationId, startTime, endTime) {
    return (0, message_1.getMessagesByTimeRange)(conversationId, startTime, endTime);
}
/**
 * Helper function to get all messages with timestamps and names
 */
function getAllMessagesWithNames(conversationId) {
    return (0, message_1.getMessagesWithTimestamps)(conversationId);
}
/**
 * Parse relative time expressions for summaries with timezone awareness
 */
function parseRelativeTimeForSummary(timeExpression, userTimezone = 'UTC') {
    const nowUTC = new Date();
    const nowInUserTZ = new Date(nowUTC.toLocaleString("en-US", { timeZone: userTimezone }));
    const todayInUserTZ = new Date(nowInUserTZ.getFullYear(), nowInUserTZ.getMonth(), nowInUserTZ.getDate());
    timeExpression = timeExpression.toLowerCase();
    if (timeExpression.includes('today')) {
        const startOfToday = new Date(todayInUserTZ);
        const startOfTodayUTC = new Date(startOfToday.toLocaleString("en-US", { timeZone: "UTC" }));
        return {
            startTime: startOfTodayUTC.toISOString(),
            endTime: nowUTC.toISOString()
        };
    }
    if (timeExpression.includes('yesterday')) {
        const yesterday = new Date(todayInUserTZ);
        yesterday.setDate(yesterday.getDate() - 1);
        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);
        const yesterdayUTC = new Date(yesterday.toLocaleString("en-US", { timeZone: "UTC" }));
        const endOfYesterdayUTC = new Date(endOfYesterday.toLocaleString("en-US", { timeZone: "UTC" }));
        return {
            startTime: yesterdayUTC.toISOString(),
            endTime: endOfYesterdayUTC.toISOString()
        };
    }
    if (timeExpression.includes('this week')) {
        const startOfWeek = new Date(todayInUserTZ);
        startOfWeek.setDate(todayInUserTZ.getDate() - todayInUserTZ.getDay());
        const startOfWeekUTC = new Date(startOfWeek.toLocaleString("en-US", { timeZone: "UTC" }));
        return {
            startTime: startOfWeekUTC.toISOString(),
            endTime: nowUTC.toISOString()
        };
    }
    // Default to last 24 hours
    const yesterday24h = new Date(nowUTC.getTime() - 24 * 60 * 60 * 1000);
    return {
        startTime: yesterday24h.toISOString(),
        endTime: nowUTC.toISOString()
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3VtbWFyaXplLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NhcGFiaWxpdGllcy9zdW1tYXJpemUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFnRUEsd0RBNEhDO0FBS0QsZ0VBRUM7QUFLRCwwRUFFQztBQUtELDBEQUVDO0FBak5ELGtEQUFpRDtBQUNqRCwwREFBMEQ7QUFDMUQsZ0RBQTBHO0FBQzFHLHdEQUF1RDtBQUN2RCw0Q0FBaUQ7QUFFakQsc0NBQXNDO0FBQ3RDLE1BQU0sMEJBQTBCLEdBQUc7SUFDakMsSUFBSSxFQUFFLFFBQWlCO0lBQ3ZCLFVBQVUsRUFBRTtRQUNWLEtBQUssRUFBRTtZQUNMLElBQUksRUFBRSxRQUFpQjtZQUN2QixXQUFXLEVBQUUsNkRBQTZEO1lBQzFFLE9BQU8sRUFBRSxDQUFDO1lBQ1YsT0FBTyxFQUFFLEVBQUU7U0FDWjtLQUNGO0NBQ0YsQ0FBQztBQUVGLE1BQU0saUNBQWlDLEdBQUc7SUFDeEMsSUFBSSxFQUFFLFFBQWlCO0lBQ3ZCLFVBQVUsRUFBRTtRQUNWLFVBQVUsRUFBRTtZQUNWLElBQUksRUFBRSxRQUFpQjtZQUN2QixXQUFXLEVBQUUsc0VBQXNFO1NBQ3BGO1FBQ0QsUUFBUSxFQUFFO1lBQ1IsSUFBSSxFQUFFLFFBQWlCO1lBQ3ZCLFdBQVcsRUFBRSxvRUFBb0U7U0FDbEY7S0FDRjtDQUNGLENBQUM7QUFFRixNQUFNLDJCQUEyQixHQUFHO0lBQ2xDLElBQUksRUFBRSxRQUFpQjtJQUN2QixVQUFVLEVBQUU7UUFDVixLQUFLLEVBQUU7WUFDTCxJQUFJLEVBQUUsUUFBaUI7WUFDdkIsV0FBVyxFQUFFLG1EQUFtRDtZQUNoRSxPQUFPLEVBQUUsQ0FBQztZQUNWLE9BQU8sRUFBRSxFQUFFO1NBQ1o7S0FDRjtDQUNGLENBQUM7QUFFRixNQUFNLFlBQVksR0FBRztJQUNuQixJQUFJLEVBQUUsUUFBaUI7SUFDdkIsVUFBVSxFQUFFLEVBQUU7Q0FDZixDQUFDO0FBRUYsTUFBTSxvQ0FBb0MsR0FBRztJQUMzQyxJQUFJLEVBQUUsUUFBaUI7SUFDdkIsVUFBVSxFQUFFO1FBQ1YsZUFBZSxFQUFFO1lBQ2YsSUFBSSxFQUFFLFFBQWlCO1lBQ3ZCLFdBQVcsRUFBRSxzR0FBc0c7U0FDcEg7S0FDRjtJQUNELFFBQVEsRUFBRSxDQUFDLGlCQUFpQixDQUFDO0NBQzlCLENBQUM7QUFFRjs7R0FFRztBQUNILFNBQWdCLHNCQUFzQixDQUFDLGNBQXNCLEVBQUUsWUFBcUI7SUFDbEYsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrREFBa0QsY0FBYyxFQUFFLENBQUMsQ0FBQztJQUNoRixJQUFJLFlBQVksRUFBRSxDQUFDO1FBQ2pCLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLFlBQVksRUFBRSxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVELDRGQUE0RjtJQUM1RiwyRUFBMkU7SUFDM0UsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxRUFBcUUsQ0FBQyxDQUFDO0lBRW5GLE1BQU0scUJBQXFCLEdBQUcsSUFBQSx1QkFBYyxFQUFDLFlBQVksQ0FBQyxDQUFDO0lBRTNELG9FQUFvRTtJQUNwRSxNQUFNLGdCQUFnQixHQUFHLElBQUkscUJBQVUsQ0FBQztRQUN0QyxZQUFZLEVBQUUsNkJBQWM7UUFDNUIsNEVBQTRFO1FBQzVFLEtBQUssRUFBRSxJQUFJLDhCQUFlLENBQUM7WUFDekIsS0FBSyxFQUFFLHFCQUFxQixDQUFDLEtBQUs7WUFDbEMsTUFBTSxFQUFFLHFCQUFxQixDQUFDLE1BQU07WUFDcEMsUUFBUSxFQUFFLHFCQUFxQixDQUFDLFFBQVE7WUFDeEMsVUFBVSxFQUFFLHFCQUFxQixDQUFDLFVBQVU7U0FDN0MsQ0FBQztLQUNILENBQUM7U0FDRCxRQUFRLENBQUMscUJBQXFCLEVBQUUsd0VBQXdFLEVBQUUsMEJBQTBCLEVBQUUsS0FBSyxFQUFFLElBQVMsRUFBRSxFQUFFO1FBQ3pKLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDO1FBQzlCLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0RBQW9ELEtBQUsscUJBQXFCLGNBQWMsRUFBRSxDQUFDLENBQUM7UUFDNUcsTUFBTSxjQUFjLEdBQUcsSUFBQSwyQkFBaUIsRUFBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDaEUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsY0FBYyxDQUFDLE1BQU0sa0JBQWtCLENBQUMsQ0FBQztRQUNyRSxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUM7WUFDcEIsTUFBTSxFQUFFLFNBQVM7WUFDakIsUUFBUSxFQUFFLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFRLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQzFDLFNBQVMsRUFBRSxHQUFHLENBQUMsU0FBUztnQkFDeEIsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJO2dCQUNkLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSTtnQkFDZCxPQUFPLEVBQUUsR0FBRyxDQUFDLE9BQU87YUFDckIsQ0FBQyxDQUFDO1lBQ0gsS0FBSyxFQUFFLGNBQWMsQ0FBQyxNQUFNO1NBQzdCLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQztTQUNELFFBQVEsQ0FBQyw0QkFBNEIsRUFBRSw4Q0FBOEMsRUFBRSxpQ0FBaUMsRUFBRSxLQUFLLEVBQUUsSUFBUyxFQUFFLEVBQUU7UUFDN0ksTUFBTSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDdEMsT0FBTyxDQUFDLEdBQUcsQ0FBQywyREFBMkQsVUFBVSxTQUFTLFFBQVEscUJBQXFCLGNBQWMsRUFBRSxDQUFDLENBQUM7UUFDekksTUFBTSxhQUFhLEdBQUcsSUFBQSxnQ0FBc0IsRUFBQyxjQUFjLEVBQUUsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ25GLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLGFBQWEsQ0FBQyxNQUFNLDJCQUEyQixDQUFDLENBQUM7UUFDN0UsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO1lBQ3BCLE1BQU0sRUFBRSxTQUFTO1lBQ2pCLFFBQVEsRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBUSxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUN6QyxTQUFTLEVBQUUsR0FBRyxDQUFDLFNBQVM7Z0JBQ3hCLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSTtnQkFDZCxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUk7Z0JBQ2QsT0FBTyxFQUFFLEdBQUcsQ0FBQyxPQUFPO2FBQ3JCLENBQUMsQ0FBQztZQUNILEtBQUssRUFBRSxhQUFhLENBQUMsTUFBTTtZQUMzQixTQUFTLEVBQUUsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUU7U0FDaEQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDO1NBQ0QsUUFBUSxDQUFDLHNCQUFzQixFQUFFLHlEQUF5RCxFQUFFLDJCQUEyQixFQUFFLEtBQUssRUFBRSxJQUFTLEVBQUUsRUFBRTtRQUM1SSxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQztRQUNyQyxPQUFPLENBQUMsR0FBRyxDQUFDLHFEQUFxRCxZQUFZLHFCQUFxQixjQUFjLEVBQUUsQ0FBQyxDQUFDO1FBQ3BILE1BQU0sY0FBYyxHQUFHLElBQUEsMkJBQWlCLEVBQUMsY0FBYyxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ3ZFLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLGNBQWMsQ0FBQyxNQUFNLHVCQUF1QixDQUFDLENBQUM7UUFDM0UsTUFBTSxXQUFXLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQVEsRUFBRSxFQUFFLENBQ2xELElBQUksSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLGNBQWMsRUFBRSxLQUFLLEdBQUcsQ0FBQyxJQUFJLEtBQUssR0FBRyxDQUFDLElBQUksTUFBTSxHQUFHLENBQUMsT0FBTyxFQUFFLENBQzFGLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRWIsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO1lBQ3BCLE1BQU0sRUFBRSxTQUFTO1lBQ2pCLGtCQUFrQixFQUFFLFdBQVcsSUFBSSxtQkFBbUI7WUFDdEQsS0FBSyxFQUFFLGNBQWMsQ0FBQyxNQUFNO1lBQzVCLFlBQVksRUFBRSx1QkFBdUIsY0FBYyxDQUFDLE1BQU0sT0FBTyxXQUFXLElBQUksbUJBQW1CLEVBQUU7U0FDdEcsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDO1NBQ0QsUUFBUSxDQUFDLHdCQUF3QixFQUFFLHFFQUFxRSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsS0FBVSxFQUFFLEVBQUU7UUFDNUksT0FBTyxDQUFDLEdBQUcsQ0FBQyw2REFBNkQsY0FBYyxFQUFFLENBQUMsQ0FBQztRQUMzRixNQUFNLFdBQVcsR0FBRyxJQUFBLG1DQUF5QixFQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQzlELE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLFdBQVcsQ0FBQyxNQUFNLDBDQUEwQyxDQUFDLENBQUM7UUFDMUYsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO1lBQ3BCLE1BQU0sRUFBRSxTQUFTO1lBQ2pCLGFBQWEsRUFBRSxXQUFXLENBQUMsTUFBTTtZQUNqQyxjQUFjLEVBQUUsY0FBYztZQUM5QixhQUFhLEVBQUUsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUk7WUFDdkUsYUFBYSxFQUFFLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUk7WUFDNUYsY0FBYyxFQUFFLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFRLEVBQUUsR0FBUSxFQUFFLEVBQUU7Z0JBQ3hELEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDekMsT0FBTyxHQUFHLENBQUM7WUFDYixDQUFDLEVBQUUsRUFBNEIsQ0FBQztZQUNoQyxjQUFjLEVBQUUsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQVEsRUFBRSxHQUFRLEVBQUUsRUFBRTtnQkFDeEQsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN6QyxPQUFPLEdBQUcsQ0FBQztZQUNiLENBQUMsRUFBRSxFQUE0QixDQUFDO1lBQ2hDLFlBQVksRUFBRSxDQUFDLEdBQUcsSUFBSSxHQUFHLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQVEsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDbkUsUUFBUSxFQUFFLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFRLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQ3ZDLFNBQVMsRUFBRSxHQUFHLENBQUMsU0FBUztnQkFDeEIsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJO2dCQUNkLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSTtnQkFDZCxPQUFPLEVBQUUsR0FBRyxDQUFDLE9BQU87YUFDckIsQ0FBQyxDQUFDO1NBQ0osQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDO1NBQ0QsUUFBUSxDQUFDLCtCQUErQixFQUFFLHVEQUF1RCxFQUFFLG9DQUFvQyxFQUFFLEtBQUssRUFBRSxJQUFTLEVBQUUsRUFBRTtRQUM1SixNQUFNLEVBQUUsZUFBZSxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQ2pDLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0VBQW9FLGVBQWUsc0JBQXNCLGNBQWMsRUFBRSxDQUFDLENBQUM7UUFFdkksZ0VBQWdFO1FBQ2hFLE1BQU0sRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLEdBQUcsMkJBQTJCLENBQUMsZUFBZSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQzFGLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLGVBQWUsTUFBTSxTQUFTLE9BQU8sT0FBTyxFQUFFLENBQUMsQ0FBQztRQUVqRixNQUFNLGFBQWEsR0FBRyxJQUFBLGdDQUFzQixFQUFDLGNBQWMsRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDakYsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsYUFBYSxDQUFDLE1BQU0sbUNBQW1DLENBQUMsQ0FBQztRQUNyRixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUM7WUFDcEIsTUFBTSxFQUFFLFNBQVM7WUFDakIsUUFBUSxFQUFFLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFRLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQ3pDLFNBQVMsRUFBRSxHQUFHLENBQUMsU0FBUztnQkFDeEIsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJO2dCQUNkLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSTtnQkFDZCxPQUFPLEVBQUUsR0FBRyxDQUFDLE9BQU87YUFDckIsQ0FBQyxDQUFDO1lBQ0gsS0FBSyxFQUFFLGFBQWEsQ0FBQyxNQUFNO1lBQzNCLFNBQVMsRUFBRSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRTtTQUM5QyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztJQUVILE9BQU8sQ0FBQyxHQUFHLENBQUMscUVBQXFFLENBQUMsQ0FBQztJQUNuRixPQUFPLGdCQUFnQixDQUFDO0FBQzFCLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLDBCQUEwQixDQUFDLGNBQXNCLEVBQUUsUUFBZ0IsRUFBRTtJQUNuRixPQUFPLElBQUEsMkJBQWlCLEVBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ2xELENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLCtCQUErQixDQUFDLGNBQXNCLEVBQUUsU0FBa0IsRUFBRSxPQUFnQjtJQUMxRyxPQUFPLElBQUEsZ0NBQXNCLEVBQUMsY0FBYyxFQUFFLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUNwRSxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQix1QkFBdUIsQ0FBQyxjQUFzQjtJQUM1RCxPQUFPLElBQUEsbUNBQXlCLEVBQUMsY0FBYyxDQUFDLENBQUM7QUFDbkQsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUywyQkFBMkIsQ0FBQyxjQUFzQixFQUFFLGVBQXVCLEtBQUs7SUFDdkYsTUFBTSxNQUFNLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztJQUMxQixNQUFNLFdBQVcsR0FBRyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDekYsTUFBTSxhQUFhLEdBQUcsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBRSxFQUFFLFdBQVcsQ0FBQyxRQUFRLEVBQUUsRUFBRSxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUV6RyxjQUFjLEdBQUcsY0FBYyxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBRTlDLElBQUksY0FBYyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1FBQ3JDLE1BQU0sWUFBWSxHQUFHLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQzdDLE1BQU0sZUFBZSxHQUFHLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1RixPQUFPO1lBQ0wsU0FBUyxFQUFFLGVBQWUsQ0FBQyxXQUFXLEVBQUU7WUFDeEMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxXQUFXLEVBQUU7U0FDOUIsQ0FBQztJQUNKLENBQUM7SUFFRCxJQUFJLGNBQWMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQztRQUN6QyxNQUFNLFNBQVMsR0FBRyxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUMxQyxTQUFTLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUMzQyxNQUFNLGNBQWMsR0FBRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMzQyxjQUFjLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRXpDLE1BQU0sWUFBWSxHQUFHLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN0RixNQUFNLGlCQUFpQixHQUFHLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNoRyxPQUFPO1lBQ0wsU0FBUyxFQUFFLFlBQVksQ0FBQyxXQUFXLEVBQUU7WUFDckMsT0FBTyxFQUFFLGlCQUFpQixDQUFDLFdBQVcsRUFBRTtTQUN6QyxDQUFDO0lBQ0osQ0FBQztJQUVELElBQUksY0FBYyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO1FBQ3pDLE1BQU0sV0FBVyxHQUFHLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQzVDLFdBQVcsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSxHQUFHLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ3RFLE1BQU0sY0FBYyxHQUFHLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxRixPQUFPO1lBQ0wsU0FBUyxFQUFFLGNBQWMsQ0FBQyxXQUFXLEVBQUU7WUFDdkMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxXQUFXLEVBQUU7U0FDOUIsQ0FBQztJQUNKLENBQUM7SUFFRCwyQkFBMkI7SUFDM0IsTUFBTSxZQUFZLEdBQUcsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQ3RFLE9BQU87UUFDTCxTQUFTLEVBQUUsWUFBWSxDQUFDLFdBQVcsRUFBRTtRQUNyQyxPQUFPLEVBQUUsTUFBTSxDQUFDLFdBQVcsRUFBRTtLQUM5QixDQUFDO0FBQ0osQ0FBQyJ9