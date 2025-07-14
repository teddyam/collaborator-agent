import { ChatPrompt } from '@microsoft/teams.ai';
import { CitationAppearance } from '@microsoft/teams.api';
import { SqliteKVStore } from '../storage/storage';
import { SummarizerCapability } from '../capabilities/summarize';
import { ActionItemsCapability } from '../capabilities/actionItems';
import { SearchCapability } from '../capabilities/search';

// Router that provides specific prompts for different capability types
export async function routeToPrompt(
  capabilityType: string, 
  conversationId: string, 
  storage: SqliteKVStore, 
  participants: Array<{name: string, id: string}> = [], 
  userTimezone?: string,
  citationsArray?: CitationAppearance[]
): Promise<ChatPrompt> {
  console.log(`🔀 Routing to ${capabilityType} capability for conversation: ${conversationId}`);
  
  switch (capabilityType.toLowerCase()) {
    case 'summarizer':
      const summarizerCapability = new SummarizerCapability();
      return summarizerCapability.createPrompt({
        conversationId,
        userTimezone
      });
    
    case 'actionitems':
    case 'action_items':
      const actionItemsCapability = new ActionItemsCapability();
      return actionItemsCapability.createPrompt({
        conversationId,
        storage,
        availableMembers: participants,
        userTimezone
      });
    
    case 'search':
      const searchCapability = new SearchCapability();
      return searchCapability.createPrompt({
        conversationId,
        userTimezone,
        citationsArray
      });
    
    default:
      console.warn(`⚠️ Unknown capability type: ${capabilityType}, defaulting to summarizer`);
      const defaultSummarizerCapability = new SummarizerCapability();
      return defaultSummarizerCapability.createPrompt({
        conversationId,
        userTimezone
      });
  }
}

// Factory function for creating new capability types
export function createCapabilityRouter(): {
  addRoute: (capabilityType: string, factory: (conversationId: string, userTimezone?: string) => ChatPrompt) => void;
  route: (capabilityType: string, conversationId: string, userTimezone?: string) => Promise<ChatPrompt>;
} {
  const routes = new Map<string, (conversationId: string, userTimezone?: string) => ChatPrompt>();
  
  // Set default route using the new capability interface
  routes.set('summarizer', (conversationId: string, userTimezone?: string) => {
    const summarizerCapability = new SummarizerCapability();
    return summarizerCapability.createPrompt({
      conversationId,
      userTimezone
    });
  });
  
  return {
    addRoute: (capabilityType: string, factory: (conversationId: string, userTimezone?: string) => ChatPrompt) => {
      routes.set(capabilityType.toLowerCase(), factory);
    },
    route: async (capabilityType: string, conversationId: string, userTimezone?: string) => {
      const factory = routes.get(capabilityType.toLowerCase()) || routes.get('summarizer')!;
      return factory(conversationId, userTimezone);
    }
  };
}

