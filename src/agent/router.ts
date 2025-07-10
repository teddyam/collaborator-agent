import { ChatPrompt } from '@microsoft/teams.ai';
import { SqliteKVStore } from '../storage/storage';
import { createSummarizerPrompt } from '../capabilities/summarize';
import { createActionItemsPrompt } from '../capabilities/actionItems';
import { createSearchPrompt } from '../capabilities/search';

// Router that provides specific prompts for different agent types
export async function routeToPrompt(
  agentType: string, 
  conversationId: string, 
  storage: SqliteKVStore, 
  participants: Array<{name: string, id: string}> = [], 
  userTimezone?: string,
  adaptiveCardsArray?: any[]
): Promise<ChatPrompt> {
  console.log(`🔀 Routing to ${agentType} agent for conversation: ${conversationId}`);
  
  switch (agentType.toLowerCase()) {
    case 'summarizer':
      return createSummarizerPrompt(conversationId, userTimezone);
    
    case 'actionitems':
    case 'action_items':
      return createActionItemsPrompt(conversationId, storage, participants, false, undefined, undefined, userTimezone);
    
    case 'search':
      return createSearchPrompt(conversationId, userTimezone, adaptiveCardsArray);
    
    default:
      console.warn(`⚠️ Unknown agent type: ${agentType}, defaulting to summarizer`);
      return createSummarizerPrompt(conversationId, userTimezone);
  }
}

// Factory function for creating new agent types
export function createAgentRouter(): {
  addRoute: (agentType: string, factory: (conversationId: string, userTimezone?: string) => ChatPrompt) => void;
  route: (agentType: string, conversationId: string, userTimezone?: string) => Promise<ChatPrompt>;
} {
  const routes = new Map<string, (conversationId: string, userTimezone?: string) => ChatPrompt>();
  
  routes.set('summarizer', createSummarizerPrompt);
  
  return {
    addRoute: (agentType: string, factory: (conversationId: string, userTimezone?: string) => ChatPrompt) => {
      routes.set(agentType.toLowerCase(), factory);
    },
    route: async (agentType: string, conversationId: string, userTimezone?: string) => {
      const factory = routes.get(agentType.toLowerCase()) || routes.get('summarizer')!;
      return factory(conversationId, userTimezone);
    }
  };
}

