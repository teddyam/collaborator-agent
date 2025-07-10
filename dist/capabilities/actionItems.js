"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createActionItemsPrompt = createActionItemsPrompt;
exports.getConversationParticipantsFromAPI = getConversationParticipantsFromAPI;
const teams_ai_1 = require("@microsoft/teams.ai");
const teams_openai_1 = require("@microsoft/teams.openai");
const message_1 = require("../storage/message");
const instructions_1 = require("../agent/instructions");
const config_1 = require("../utils/config");
// Function schemas for the action items agent
const ANALYZE_FOR_ACTION_ITEMS_SCHEMA = {
    type: 'object',
    properties: {
        start_time: {
            type: 'string',
            description: 'Start time in ISO format (e.g., 2024-01-01T00:00:00.000Z). Optional - defaults to last 24 hours.'
        },
        end_time: {
            type: 'string',
            description: 'End time in ISO format (e.g., 2024-01-01T23:59:59.999Z). Optional - defaults to now.'
        }
    }
};
const CREATE_ACTION_ITEM_SCHEMA = {
    type: 'object',
    properties: {
        title: {
            type: 'string',
            description: 'Brief title for the action item'
        },
        description: {
            type: 'string',
            description: 'Detailed description of what needs to be done'
        },
        assigned_to: {
            type: 'string',
            description: 'Name of the person this action item is assigned to'
        },
        priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'Priority level of the action item'
        },
        due_date: {
            type: 'string',
            description: 'Optional due date in ISO format or relative expression (e.g., "tomorrow", "end of week", "next Monday"). Relative expressions are parsed using the user\'s timezone.'
        }
    },
    required: ['title', 'description', 'assigned_to', 'priority']
};
const GET_ACTION_ITEMS_SCHEMA = {
    type: 'object',
    properties: {
        assigned_to: {
            type: 'string',
            description: 'Filter by person assigned to (optional)'
        },
        status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed', 'cancelled'],
            description: 'Filter by status (optional)'
        }
    }
};
const UPDATE_ACTION_ITEM_SCHEMA = {
    type: 'object',
    properties: {
        action_item_id: {
            type: 'number',
            description: 'ID of the action item to update'
        },
        new_status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed', 'cancelled'],
            description: 'New status for the action item'
        }
    },
    required: ['action_item_id', 'new_status']
};
const GET_CHAT_MEMBERS_SCHEMA = {
    type: 'object',
    properties: {}
};
/**
 * Creates a specialized action items prompt with function tools for managing action items
 * Handles both group conversations and personal DMs
 */
function createActionItemsPrompt(conversationId, storage, availableMembers = [], isPersonalChat = false, currentUserId, currentUserName, userTimezone) {
    const actionItemsModelConfig = (0, config_1.getModelConfig)('actionItems');
    if (userTimezone) {
        console.log(`🕒 Action Items Agent using timezone: ${userTimezone}`);
    }
    // Adjust instructions based on conversation type
    const instructions = isPersonalChat
        ? `You are a personal action items assistant for ${currentUserName || 'the user'}. 
       
       Your role is to help them:
       - View their personal action items assigned to them across all conversations
       - Update the status of their action items  
       - Get summaries of their workload
       - Filter action items by status, priority, or due date
       
       This is a personal 1:1 conversation, so focus on THEIR action items only.
       Be helpful, concise, and focused on their personal productivity.`
        : instructions_1.ACTION_ITEMS_PROMPT;
    const prompt = new teams_ai_1.ChatPrompt({
        instructions,
        model: new teams_openai_1.OpenAIChatModel({
            model: actionItemsModelConfig.model,
            apiKey: actionItemsModelConfig.apiKey,
            endpoint: actionItemsModelConfig.endpoint,
            apiVersion: actionItemsModelConfig.apiVersion,
        }),
    })
        .function('analyze_for_action_items', 'Analyze conversation messages in a time range to identify potential action items', ANALYZE_FOR_ACTION_ITEMS_SCHEMA, async (args) => {
        console.log(`🔍 FUNCTION CALL: analyze_for_action_items for conversation=${conversationId}`);
        const { start_time, end_time } = args;
        console.log(`🔍 FUNCTION CALL: get_messages_by_time_range with start=${start_time}, end=${end_time} for conversation=${conversationId}`);
        const messages = (0, message_1.getMessagesByTimeRange)(conversationId, start_time, end_time);
        console.log(`📅 Retrieved ${messages.length} messages from time range`);
        // Get existing action items to avoid duplicates
        const existingActionItems = storage.getActionItemsByConversation(conversationId);
        return JSON.stringify({
            status: 'success',
            time_range: { start_time: start_time, end_time: end_time },
            messages: messages.map(msg => ({
                timestamp: msg.timestamp,
                role: msg.role,
                name: msg.name,
                content: msg.content
            })),
            available_members: availableMembers,
            existing_action_items: existingActionItems.map(item => ({
                id: item.id,
                title: item.title,
                assigned_to: item.assigned_to,
                status: item.status,
                priority: item.priority
            })),
            message_count: messages.length,
            guidance: "Analyze these messages to identify actionable tasks, decisions that need follow-up, or commitments made by team members. Consider who would be best suited for each task based on their expertise and current workload."
        });
    })
        .function('create_action_item', 'Create a new action item and assign it to a team member', CREATE_ACTION_ITEM_SCHEMA, async (args) => {
        console.log(`✅ FUNCTION CALL: create_action_item - "${args.title}" assigned to ${args.assigned_to}`);
        try {
            // Find the user ID for the assigned person
            let assignedToId;
            if (isPersonalChat && currentUserId) {
                // In personal chat, assign to the current user
                assignedToId = currentUserId;
            }
            else {
                // In group chat, find the user ID from available members
                const assignedMember = availableMembers.find(member => member.name === args.assigned_to ||
                    member.name.toLowerCase() === args.assigned_to.toLowerCase());
                assignedToId = assignedMember?.id;
            }
            console.log(`🔍 Found user ID for "${args.assigned_to}": ${assignedToId || 'Not found'}`);
            // Parse due_date with timezone awareness if it's a relative expression
            let parsedDueDate = args.due_date;
            if (args.due_date && userTimezone) {
                const timezoneParsedDate = parseDeadlineWithTimezone(args.due_date, userTimezone);
                if (timezoneParsedDate) {
                    parsedDueDate = timezoneParsedDate;
                    console.log(`🕒 Parsed deadline "${args.due_date}" to ${parsedDueDate} (timezone: ${userTimezone})`);
                }
            }
            const actionItem = storage.createActionItem({
                conversation_id: conversationId,
                title: args.title,
                description: args.description,
                assigned_to: args.assigned_to,
                assigned_to_id: assignedToId, // Now properly setting the user ID
                assigned_by: 'AI Action Items Agent',
                status: 'pending',
                priority: args.priority,
                due_date: parsedDueDate
            });
            return JSON.stringify({
                status: 'success',
                action_item: {
                    id: actionItem.id,
                    title: actionItem.title,
                    description: actionItem.description,
                    assigned_to: actionItem.assigned_to,
                    priority: actionItem.priority,
                    due_date: actionItem.due_date,
                    created_at: actionItem.created_at
                },
                message: `Action item "${args.title}" has been created and assigned to ${args.assigned_to}`
            });
        }
        catch (error) {
            console.error('❌ Error creating action item:', error);
            return JSON.stringify({
                status: 'error',
                message: 'Failed to create action item',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    })
        .function('get_action_items', 'Retrieve action items for this conversation, optionally filtered by assignee or status', GET_ACTION_ITEMS_SCHEMA, async (args) => {
        console.log(`🔍 FUNCTION CALL: get_action_items with filters:`, args);
        let actionItems;
        if (isPersonalChat && currentUserId) {
            // In personal chat, only show the user's own action items across all conversations
            actionItems = storage.getActionItemsByUserId(currentUserId, args.status);
            console.log(`👤 Personal chat: Retrieved ${actionItems.length} action items for user ${currentUserName}`);
        }
        else {
            // In group chat, handle normal conversation-based logic
            if (args.assigned_to && args.assigned_to !== 'all') {
                // Get action items for specific user
                actionItems = storage.getActionItemsForUser(args.assigned_to, args.status);
            }
            else {
                // Get all action items for this conversation
                actionItems = storage.getActionItemsByConversation(conversationId);
                if (args.status) {
                    actionItems = actionItems.filter(item => item.status === args.status);
                }
            }
        }
        return JSON.stringify({
            status: 'success',
            conversation_type: isPersonalChat ? 'personal' : 'group',
            filters: args,
            action_items: actionItems.map(item => ({
                id: item.id,
                title: item.title,
                description: item.description,
                assigned_to: item.assigned_to,
                assigned_by: item.assigned_by,
                status: item.status,
                priority: item.priority,
                due_date: item.due_date,
                created_at: item.created_at,
                updated_at: item.updated_at,
                conversation_id: isPersonalChat ? item.conversation_id : undefined // Show source conversation in personal view
            })),
            count: actionItems.length
        });
    })
        .function('update_action_item_status', 'Update the status of an existing action item', UPDATE_ACTION_ITEM_SCHEMA, async (args) => {
        console.log(`🔄 FUNCTION CALL: update_action_item_status - Item #${args.action_item_id} to ${args.new_status}`);
        const success = storage.updateActionItemStatus(args.action_item_id, args.new_status, 'AI Action Items Agent');
        if (success) {
            const updatedItem = storage.getActionItemById(args.action_item_id);
            return JSON.stringify({
                status: 'success',
                action_item: updatedItem,
                message: `Action item #${args.action_item_id} status updated to: ${args.new_status}`
            });
        }
        else {
            return JSON.stringify({
                status: 'error',
                message: `Failed to update action item #${args.action_item_id}. Item may not exist.`
            });
        }
    })
        .function('get_chat_members', 'Get the list of available members in this chat for action item assignment', GET_CHAT_MEMBERS_SCHEMA, async () => {
        console.log(`👥 FUNCTION CALL: get_chat_members for conversation=${conversationId}`);
        return JSON.stringify({
            status: 'success',
            available_members: availableMembers,
            member_count: availableMembers.length,
            guidance: "These are the available members who can be assigned action items. Choose assignees based on their expertise, availability, and the nature of the task."
        });
    });
    console.log('🎯 Action Items Agent initialized with action item management capabilities');
    return prompt;
}
/**
 * Helper function to get conversation participants using Teams API
 */
async function getConversationParticipantsFromAPI(api, conversationId) {
    try {
        console.log(`👥 Fetching conversation members from Teams API for conversation: ${conversationId}`);
        const members = await api.conversations.members(conversationId).get();
        const participants = members.map((member) => {
            // Try different name fields that might be available
            const name = member.name || member.givenName || member.displayName || member.userPrincipalName || 'Unknown Member';
            const id = member.id || member.aadObjectId || member.userId || 'unknown';
            return { name, id };
        }).filter((participant) => participant.name !== 'Unknown Member');
        console.log(`👥 Found ${participants.length} participants from Teams API:`, participants);
        return participants;
    }
    catch (error) {
        console.error(`❌ Error fetching conversation members from Teams API:`, error);
        throw error;
    }
}
/**
 * Parse deadline expressions like "by tomorrow", "end of week", "by Friday" with timezone awareness
 */
function parseDeadlineWithTimezone(deadlineExpression, userTimezone = 'UTC') {
    if (!deadlineExpression)
        return undefined;
    console.log(`🕒 Parsing deadline "${deadlineExpression}" in timezone: ${userTimezone}`);
    const expression = deadlineExpression.toLowerCase().trim();
    const nowUTC = new Date();
    const nowInUserTZ = new Date(nowUTC.toLocaleString("en-US", { timeZone: userTimezone }));
    const todayInUserTZ = new Date(nowInUserTZ.getFullYear(), nowInUserTZ.getMonth(), nowInUserTZ.getDate());
    // Parse common deadline expressions
    if (expression.includes('tomorrow') || expression.includes('next day')) {
        const tomorrow = new Date(todayInUserTZ);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59, 59, 999); // End of day
        const tomorrowUTC = new Date(tomorrow.toLocaleString("en-US", { timeZone: "UTC" }));
        return tomorrowUTC.toISOString();
    }
    if (expression.includes('end of week') || expression.includes('this friday') || expression.includes('friday')) {
        const endOfWeek = new Date(todayInUserTZ);
        const daysUntilFriday = (5 - todayInUserTZ.getDay() + 7) % 7; // 5 = Friday
        endOfWeek.setDate(todayInUserTZ.getDate() + (daysUntilFriday || 7)); // If today is Friday, next Friday
        endOfWeek.setHours(23, 59, 59, 999);
        const endOfWeekUTC = new Date(endOfWeek.toLocaleString("en-US", { timeZone: "UTC" }));
        return endOfWeekUTC.toISOString();
    }
    if (expression.includes('next week') || expression.includes('monday')) {
        const nextMonday = new Date(todayInUserTZ);
        const daysUntilMonday = (8 - todayInUserTZ.getDay()) % 7; // Next Monday
        nextMonday.setDate(todayInUserTZ.getDate() + (daysUntilMonday || 7));
        nextMonday.setHours(23, 59, 59, 999);
        const nextMondayUTC = new Date(nextMonday.toLocaleString("en-US", { timeZone: "UTC" }));
        return nextMondayUTC.toISOString();
    }
    if (expression.includes('end of month')) {
        const endOfMonth = new Date(todayInUserTZ.getFullYear(), todayInUserTZ.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        const endOfMonthUTC = new Date(endOfMonth.toLocaleString("en-US", { timeZone: "UTC" }));
        return endOfMonthUTC.toISOString();
    }
    // Try to parse specific dates (this is basic - could be enhanced)
    const dateMatch = expression.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if (dateMatch) {
        const month = parseInt(dateMatch[1]) - 1; // JS months are 0-indexed
        const day = parseInt(dateMatch[2]);
        const year = dateMatch[3] ? parseInt(dateMatch[3]) : todayInUserTZ.getFullYear();
        const specificDate = new Date(year, month, day, 23, 59, 59, 999);
        const specificDateUTC = new Date(specificDate.toLocaleString("en-US", { timeZone: "UTC" }));
        return specificDateUTC.toISOString();
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aW9uSXRlbXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY2FwYWJpbGl0aWVzL2FjdGlvbkl0ZW1zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBMEZBLDBEQXFOQztBQUtELGdGQWtCQztBQXRVRCxrREFBaUQ7QUFDakQsMERBQTBEO0FBRTFELGdEQUE0RDtBQUM1RCx3REFBNEQ7QUFDNUQsNENBQWlEO0FBRWpELDhDQUE4QztBQUM5QyxNQUFNLCtCQUErQixHQUFHO0lBQ3RDLElBQUksRUFBRSxRQUFpQjtJQUN2QixVQUFVLEVBQUU7UUFDVixVQUFVLEVBQUU7WUFDVixJQUFJLEVBQUUsUUFBaUI7WUFDdkIsV0FBVyxFQUFFLGtHQUFrRztTQUNoSDtRQUNELFFBQVEsRUFBRTtZQUNSLElBQUksRUFBRSxRQUFpQjtZQUN2QixXQUFXLEVBQUUsc0ZBQXNGO1NBQ3BHO0tBQ0Y7Q0FDRixDQUFDO0FBRUYsTUFBTSx5QkFBeUIsR0FBRztJQUNoQyxJQUFJLEVBQUUsUUFBaUI7SUFDdkIsVUFBVSxFQUFFO1FBQ1YsS0FBSyxFQUFFO1lBQ0wsSUFBSSxFQUFFLFFBQWlCO1lBQ3ZCLFdBQVcsRUFBRSxpQ0FBaUM7U0FDL0M7UUFDRCxXQUFXLEVBQUU7WUFDWCxJQUFJLEVBQUUsUUFBaUI7WUFDdkIsV0FBVyxFQUFFLCtDQUErQztTQUM3RDtRQUNELFdBQVcsRUFBRTtZQUNYLElBQUksRUFBRSxRQUFpQjtZQUN2QixXQUFXLEVBQUUsb0RBQW9EO1NBQ2xFO1FBQ0QsUUFBUSxFQUFFO1lBQ1IsSUFBSSxFQUFFLFFBQWlCO1lBQ3ZCLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQztZQUN6QyxXQUFXLEVBQUUsbUNBQW1DO1NBQ2pEO1FBQ0QsUUFBUSxFQUFFO1lBQ1IsSUFBSSxFQUFFLFFBQWlCO1lBQ3ZCLFdBQVcsRUFBRSxzS0FBc0s7U0FDcEw7S0FDRjtJQUNELFFBQVEs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