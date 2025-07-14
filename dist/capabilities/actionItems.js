"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionItemsCapability = void 0;
exports.getConversationParticipantsFromAPI = getConversationParticipantsFromAPI;
const teams_ai_1 = require("@microsoft/teams.ai");
const teams_openai_1 = require("@microsoft/teams.openai");
const message_1 = require("../storage/message");
const instructions_1 = require("../agent/instructions");
const capability_1 = require("./capability");
// Function schemas for the action items capability
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
 * Refactored Action Items Capability that implements the unified capability interface
 */
class ActionItemsCapability extends capability_1.BaseCapability {
    name = 'action_items';
    createPrompt(config) {
        this.logInit(config.conversationId, config.userTimezone);
        if (!config.storage) {
            throw new Error('Action Items capability requires storage configuration');
        }
        const actionItemsModelConfig = this.getModelConfig('actionItems');
        // Build additional time context if pre-calculated times are provided
        let timeContext = '';
        if (config.calculatedStartTime && config.calculatedEndTime) {
            console.log(`🕒 Action Items Capability received pre-calculated time range: ${config.timespanDescription || 'calculated timespan'} (${config.calculatedStartTime} to ${config.calculatedEndTime})`);
            timeContext = `

IMPORTANT: Pre-calculated time range available:
- Start: ${config.calculatedStartTime}
- End: ${config.calculatedEndTime}
- Description: ${config.timespanDescription || 'calculated timespan'}

When analyzing messages for action items or performing any time-based queries, use these exact timestamps instead of calculating your own. This ensures consistency with the Manager's time calculations and reduces token usage.`;
        }
        // Adjust instructions based on conversation type
        const baseInstructions = config.isPersonalChat
            ? `You are a personal action items assistant for ${config.currentUserName || 'the user'}. 
         
         Your role is to help them:
         - View their personal action items assigned to them across all conversations
         - Update the status of their action items  
         - Get summaries of their workload
         - Filter action items by status, priority, or due date
         
         This is a personal 1:1 conversation, so focus on THEIR action items only.
         Be helpful, concise, and focused on their personal productivity.`
            : instructions_1.ACTION_ITEMS_PROMPT;
        const instructions = baseInstructions + timeContext;
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
            console.log(`🔍 FUNCTION CALL: analyze_for_action_items for conversation=${config.conversationId}`);
            const { start_time, end_time } = args;
            console.log(`🔍 FUNCTION CALL: get_messages_by_time_range with start=${start_time}, end=${end_time} for conversation=${config.conversationId}`);
            const messages = (0, message_1.getMessagesByTimeRange)(config.conversationId, start_time, end_time);
            console.log(`📅 Retrieved ${messages.length} messages from time range`);
            // Get existing action items to avoid duplicates
            const existingActionItems = config.storage.getActionItemsByConversation(config.conversationId);
            return JSON.stringify({
                status: 'success',
                time_range: { start_time: start_time, end_time: end_time },
                messages: messages.map(msg => ({
                    timestamp: msg.timestamp,
                    role: msg.role,
                    name: msg.name,
                    content: msg.content
                })),
                existing_action_items: existingActionItems.map(item => ({
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    assigned_to: item.assigned_to,
                    status: item.status,
                    priority: item.priority,
                    due_date: item.due_date,
                    created_at: item.created_at
                })),
                available_members: config.availableMembers || []
            });
        })
            .function('create_action_item', 'Create a new action item and assign it to a team member', CREATE_ACTION_ITEM_SCHEMA, async (args) => {
            console.log(`✅ FUNCTION CALL: create_action_item - "${args.title}" assigned to ${args.assigned_to}`);
            try {
                // Find the user ID for the assigned person
                let assignedToId;
                if (config.isPersonalChat && config.currentUserId) {
                    // In personal chat, assign to the current user
                    assignedToId = config.currentUserId;
                }
                else {
                    // In group chat, find the user ID from available members
                    const assignedMember = (config.availableMembers || []).find(member => member.name === args.assigned_to ||
                        member.name.toLowerCase() === args.assigned_to.toLowerCase());
                    assignedToId = assignedMember?.id;
                }
                console.log(`🔍 Found user ID for "${args.assigned_to}": ${assignedToId || 'Not found'}`);
                // Parse due_date with timezone awareness if it's a relative expression
                let parsedDueDate = args.due_date;
                if (args.due_date && config.userTimezone) {
                    const timezoneParsedDate = parseDeadlineWithTimezone(args.due_date, config.userTimezone);
                    if (timezoneParsedDate) {
                        parsedDueDate = timezoneParsedDate;
                        console.log(`🕒 Parsed deadline "${args.due_date}" to ${parsedDueDate} (timezone: ${config.userTimezone})`);
                    }
                }
                const actionItem = config.storage.createActionItem({
                    conversation_id: config.conversationId,
                    title: args.title,
                    description: args.description,
                    assigned_to: args.assigned_to,
                    assigned_to_id: assignedToId,
                    assigned_by: config.currentUserName || 'AI Action Items Capability',
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
            if (config.isPersonalChat && config.currentUserId) {
                // In personal chat, only show the user's own action items across all conversations
                actionItems = config.storage.getActionItemsByUserId(config.currentUserId, args.status);
                console.log(`👤 Personal chat: Retrieved ${actionItems.length} action items for user ${config.currentUserName}`);
            }
            else {
                // In group chat, handle normal conversation-based logic
                if (args.assigned_to && args.assigned_to !== 'all') {
                    // Get action items for specific user
                    actionItems = config.storage.getActionItemsForUser(args.assigned_to, args.status);
                }
                else {
                    // Get all action items for this conversation
                    actionItems = config.storage.getActionItemsByConversation(config.conversationId);
                    if (args.status) {
                        actionItems = actionItems.filter(item => item.status === args.status);
                    }
                }
            }
            return JSON.stringify({
                status: 'success',
                conversation_type: config.isPersonalChat ? 'personal' : 'group',
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
                    conversation_id: config.isPersonalChat ? item.conversation_id : undefined // Show source conversation in personal view
                })),
                count: actionItems.length
            });
        })
            .function('update_action_item_status', 'Update the status of an existing action item', UPDATE_ACTION_ITEM_SCHEMA, async (args) => {
            console.log(`🔄 FUNCTION CALL: update_action_item_status - Item #${args.action_item_id} to ${args.new_status}`);
            const success = config.storage.updateActionItemStatus(args.action_item_id, args.new_status, 'AI Action Items Capability');
            if (success) {
                const updatedItem = config.storage.getActionItemById(args.action_item_id);
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
            console.log(`👥 FUNCTION CALL: get_chat_members for conversation=${config.conversationId}`);
            return JSON.stringify({
                status: 'success',
                available_members: config.availableMembers || [],
                member_count: (config.availableMembers || []).length,
                guidance: "These are the available members who can be assigned action items. Choose assignees based on their expertise, availability, and the nature of the task."
            });
        });
        console.log(`🎯 Action Items Capability created with unified interface`);
        return prompt;
    }
    getFunctionSchemas() {
        return [
            { name: 'analyze_for_action_items', schema: ANALYZE_FOR_ACTION_ITEMS_SCHEMA },
            { name: 'create_action_item', schema: CREATE_ACTION_ITEM_SCHEMA },
            { name: 'get_action_items', schema: GET_ACTION_ITEMS_SCHEMA },
            { name: 'update_action_item_status', schema: UPDATE_ACTION_ITEM_SCHEMA },
            { name: 'get_chat_members', schema: GET_CHAT_MEMBERS_SCHEMA }
        ];
    }
}
exports.ActionItemsCapability = ActionItemsCapability;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aW9uSXRlbXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY2FwYWJpbGl0aWVzL2FjdGlvbkl0ZW1zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQTBVQSxnRkFrQkM7QUE1VkQsa0RBQWlEO0FBQ2pELDBEQUEwRDtBQUUxRCxnREFBNEQ7QUFDNUQsd0RBQTREO0FBQzVELDZDQUFnRTtBQUVoRSxtREFBbUQ7QUFDbkQsTUFBTSwrQkFBK0IsR0FBRztJQUN0QyxJQUFJLEVBQUUsUUFBaUI7SUFDdkIsVUFBVSxFQUFFO1FBQ1YsVUFBVSxFQUFFO1lBQ1YsSUFBSSxFQUFFLFFBQWlCO1lBQ3ZCLFdBQVcsRUFBRSxrR0FBa0c7U0FDaEg7UUFDRCxRQUFRLEVBQUU7WUFDUixJQUFJLEVBQUUsUUFBaUI7WUFDdkIsV0FBVyxFQUFFLHNGQUFzRjtTQUNwRztLQUNGO0NBQ0YsQ0FBQztBQUVGLE1BQU0seUJBQXlCLEdBQUc7SUFDaEMsSUFBSSxFQUFFLFFBQWlCO0lBQ3ZCLFVBQVUsRUFBRTtRQUNWLEtBQUssRUFBRTtZQUNMLElBQUksRUFBRSxRQUFpQjtZQUN2QixXQUFXLEVBQUUsaUNBQWlDO1NBQy9DO1FBQ0QsV0FBVyxFQUFFO1lBQ1gsSUFBSSxFQUFFLFFBQWlCO1lBQ3ZCLFdBQVcsRUFBRSwrQ0FBK0M7U0FDN0Q7UUFDRCxXQUFXLEVBQUU7WUFDWCxJQUFJLEVBQUUsUUFBaUI7WUFDdkIsV0FBVyxFQUFFLG9EQUFvRDtTQUNsRTtRQUNELFFBQVEsRUFBRTtZQUNSLElBQUksRUFBRSxRQUFpQjtZQUN2QixJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUM7WUFDekMsV0FBVyxFQUFFLG1DQUFtQztTQUNqRDtRQUNELFFBQVEsRUFBRTtZQUNSLElBQUksRUFBRSxRQUFpQjtZQUN2QixXQUFXLEVBQUUsc0tBQXNLO1NBQ3BMO0tBQ0Y7SUFDRCxRQUFRLEVBQUUsQ0FBQyxP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