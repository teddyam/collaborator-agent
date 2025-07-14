import { SummarizerCapability } from '../capabilities/summarize';
import { ActionItemsCapability } from '../capabilities/actionItems';
import { SearchCapability } from '../capabilities/search';
import { CapabilityConfig, CapabilityResult } from '../capabilities/capability';

// Router that handles capability delegation and execution
export class CapabilityRouter {
  private summarizerCapability: SummarizerCapability;
  private actionItemsCapability: ActionItemsCapability;
  private searchCapability: SearchCapability;

  constructor() {
    this.summarizerCapability = new SummarizerCapability();
    this.actionItemsCapability = new ActionItemsCapability();
    this.searchCapability = new SearchCapability();
  }

  async processRequest(
    capabilityType: string,
    userRequest: string,
    config: CapabilityConfig
  ): Promise<CapabilityResult> {
    console.log(`🔀 Router processing ${capabilityType} capability for conversation: ${config.conversationId}`);

    switch (capabilityType.toLowerCase()) {
      case 'summarizer':
      case 'summary':
        return await this.summarizerCapability.processRequest(userRequest, config);

      case 'actionitems':
      case 'action_items':
      case 'action-items':
        return await this.actionItemsCapability.processRequest(userRequest, config);

      case 'search':
        return await this.searchCapability.processRequest(userRequest, config);

      default:
        console.warn(`⚠️ Unknown capability type: ${capabilityType}, defaulting to summarizer`);
        return await this.summarizerCapability.processRequest(userRequest, config);
    }
  }
}

