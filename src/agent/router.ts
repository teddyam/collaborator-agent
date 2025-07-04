import { ChatPrompt } from '@microsoft/teams.ai';
import { SqliteKVStore } from '../storage/storage';
import { createSummarizerPrompt } from '../capabilities/summarize';

// Router that provides specific prompts for different agent types
export async function routeToPrompt(agentType: string, conversationId: string, storage: SqliteKVStore): Promise<ChatPrompt> {
  console.log(`🔀 Routing to ${agentType} agent for conversation: ${conversationId}`);
  
  switch (agentType.toLowerCase()) {
    case 'summarizer':
      return createSummarizerPrompt(conversationId, storage);
    
    // Future agents can be added here:
    // case 'codereviewer':
    //   return createCodeReviewerPrompt(conversationId, storage);
    // case 'meetingnotes':
    //   return createMeetingNotesPrompt(conversationId, storage);
    
    default:
      console.warn(`⚠️ Unknown agent type: ${agentType}, defaulting to summarizer`);
      return createSummarizerPrompt(conversationId, storage);
  }
}

// Factory function for creating new agent types
export function createAgentRouter(): {
  addRoute: (agentType: string, factory: (conversationId: string, storage: SqliteKVStore) => ChatPrompt) => void;
  route: (agentType: string, conversationId: string, storage: SqliteKVStore) => Promise<ChatPrompt>;
} {
  const routes = new Map<string, (conversationId: string, storage: SqliteKVStore) => ChatPrompt>();
  
  // Add default routes
  routes.set('summarizer', createSummarizerPrompt);
  
  return {
    addRoute: (agentType: string, factory: (conversationId: string, storage: SqliteKVStore) => ChatPrompt) => {
      routes.set(agentType.toLowerCase(), factory);
    },
    route: async (agentType: string, conversationId: string, storage: SqliteKVStore) => {
      const factory = routes.get(agentType.toLowerCase()) || routes.get('summarizer')!;
      return factory(conversationId, storage);
    }
  };
}
