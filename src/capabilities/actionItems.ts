import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { SqliteKVStore, ActionItem } from '../storage/storage';
import { ACTION_ITEMS_PROMPT } from '../agent/instructions';
import { getModelConfig } from '../utils/config';

// Function schemas for the action items agent
const ANALYZE_FOR_ACTION_ITEMS_SCHEMA = {
  type: 'object' as const,
  properties: {
    start_time: {
      type: 'string' as const,
      description: 'Start time in ISO format (e.g., 2024-01-01T00:00:00.000Z). Optional - defaults to last 24 hours.'
    },
    end_time: {
      type: 'string' as const,
      description: 'End time in ISO format (e.g., 2024-01-01T23:59:59.999Z). Optional - defaults to now.'
    }
  }
};

const CREATE_ACTION_ITEM_SCHEMA = {
  type: 'object' as const,
  properties: {
    title: {
      type: 'string' as const,
      description: 'Brief title for the action item'
    },
    description: {
      type: 'string' as const,
      description: 'Detailed description of what needs to be done'
    },
    assigned_to: {
      type: 'string' as const,
      description: 'Name of the person this action item is assigned to'
    },
    priority: {
      type: 'string' as const,
      enum: ['low', 'medium', 'high', 'urgent'],
      description: 'Priority level of the action item'
    },
    due_date: {
      type: 'string' as const,
      description: 'Optional due date in ISO format'
    }
  },
  required: ['title', 'description', 'assigned_to', 'priority']
};

const GET_ACTION_ITEMS_SCHEMA = {
  type: 'object' as const,
  properties: {
    assigned_to: {
      type: 'string' as const,
      description: 'Filter by person assigned to (optional)'
    },
    status: {
      type: 'string' as const,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      description: 'Filter by status (optional)'
    }
  }
};

const UPDATE_ACTION_ITEM_SCHEMA = {
  type: 'object' as const,
  properties: {
    action_item_id: {
      type: 'number' as const,
      description: 'ID of the action item to update'
    },
    new_status: {
      type: 'string' as const,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      description: 'New status for the action item'
    }
  },
  required: ['action_item_id', 'new_status']
};

const GET_CHAT_MEMBERS_SCHEMA = {
  type: 'object' as const,
  properties: {}
};

/**
 * Creates a specialized action items prompt with function tools for managing action items
 */
export function createActionItemsPrompt(conversationId: string, storage: SqliteKVStore, availableMembers: string[] = []): ChatPrompt {
  const actionItemsModelConfig = getModelConfig('actionItems');
  
  const prompt = new ChatPrompt({
    instructions: ACTION_ITEMS_PROMPT,
    model: new OpenAIChatModel({
      model: actionItemsModelConfig.model,
      apiKey: actionItemsModelConfig.apiKey,
      endpoint: actionItemsModelConfig.endpoint,
      apiVersion: actionItemsModelConfig.apiVersion,
    }),
  })
  .function('analyze_for_action_items', 'Analyze conversation messages in a time range to identify potential action items', ANALYZE_FOR_ACTION_ITEMS_SCHEMA, async (args: any) => {
    console.log(`🔍 FUNCTION CALL: analyze_for_action_items for conversation=${conversationId}`);
    
    const { start_time, end_time } = args;
    console.log(`🔍 FUNCTION CALL: get_messages_by_time_range with start=${start_time}, end=${end_time} for conversation=${conversationId}`);
    const messages = storage.getMessagesByTimeRange(conversationId, start_time, end_time);
    console.log(`� Retrieved ${messages.length} messages from time range`);
    
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
  
  .function('create_action_item', 'Create a new action item and assign it to a team member', CREATE_ACTION_ITEM_SCHEMA, async (args: any) => {
    console.log(`✅ FUNCTION CALL: create_action_item - "${args.title}" assigned to ${args.assigned_to}`);
    
    try {
      const actionItem = storage.createActionItem({
        conversation_id: conversationId,
        title: args.title,
        description: args.description,
        assigned_to: args.assigned_to,
        assigned_by: 'AI Action Items Agent',
        status: 'pending',
        priority: args.priority,
        due_date: args.due_date
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
    } catch (error) {
      console.error('❌ Error creating action item:', error);
      return JSON.stringify({
        status: 'error',
        message: 'Failed to create action item',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
  
  .function('get_action_items', 'Retrieve action items for this conversation, optionally filtered by assignee or status', GET_ACTION_ITEMS_SCHEMA, async (args: any) => {
    console.log(`🔍 FUNCTION CALL: get_action_items with filters:`, args);
    
    let actionItems: ActionItem[];
    
    if (args.assigned_to && args.assigned_to !== 'all') {
      // Get action items for specific user
      actionItems = storage.getActionItemsForUser(args.assigned_to, args.status);
    } else {
      // Get all action items for this conversation
      actionItems = storage.getActionItemsByConversation(conversationId);
      if (args.status) {
        actionItems = actionItems.filter(item => item.status === args.status);
      }
    }
    
    return JSON.stringify({
      status: 'success',
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
        updated_at: item.updated_at
      })),
      count: actionItems.length
    });
  })
  
  .function('update_action_item_status', 'Update the status of an existing action item', UPDATE_ACTION_ITEM_SCHEMA, async (args: any) => {
    console.log(`🔄 FUNCTION CALL: update_action_item_status - Item #${args.action_item_id} to ${args.new_status}`);
    
    const success = storage.updateActionItemStatus(args.action_item_id, args.new_status, 'AI Action Items Agent');
    
    if (success) {
      const updatedItem = storage.getActionItemById(args.action_item_id);
      return JSON.stringify({
        status: 'success',
        action_item: updatedItem,
        message: `Action item #${args.action_item_id} status updated to: ${args.new_status}`
      });
    } else {
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
export async function getConversationParticipantsFromAPI(api: any, conversationId: string): Promise<string[]> {
  try {
    console.log(`👥 Fetching conversation members from Teams API for conversation: ${conversationId}`);
    const members = await api.conversations.members(conversationId).get();
    
    const participants = members.map((member: any) => {
      // Try different name fields that might be available
      return member.name || member.givenName || member.displayName || member.userPrincipalName || 'Unknown Member';
    }).filter((name: string) => name !== 'Unknown Member');
    
    console.log(`👥 Found ${participants.length} participants from Teams API:`, participants);
    return participants;
  } catch (error) {
    console.error(`❌ Error fetching conversation members from Teams API:`, error);
    throw error;
  }
}
