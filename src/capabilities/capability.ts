import { ChatPrompt } from '@microsoft/teams.ai';
import { CitationAppearance } from '@microsoft/teams.api';
import { SqliteKVStore } from '../storage/storage';

/**
 * Configuration interface for creating capabilities
 */
export interface CapabilityConfig {
  conversationId: string;
  userTimezone?: string;
  
  // Action Items specific
  storage?: SqliteKVStore;
  availableMembers?: Array<{name: string, id: string}>;
  isPersonalChat?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  
  // Search specific
  citationsArray?: CitationAppearance[];
  
  // Time range parameters (unified across all capabilities)
  calculatedStartTime?: string;
  calculatedEndTime?: string;
  timespanDescription?: string;
}

/**
 * Result interface for capability responses
 */
export interface CapabilityResult {
  response: string;
  citations?: CitationAppearance[];
  error?: string;
}

/**
 * Base interface that all capabilities must implement
 */
export interface Capability {
  /**
   * The name/type of this capability
   */
  readonly name: string;
  
  /**
   * Create a ChatPrompt instance for this capability
   */
  createPrompt(config: CapabilityConfig): ChatPrompt;
  
  /**
   * Process a user request using this capability
   */
  processRequest(userRequest: string, config: CapabilityConfig): Promise<CapabilityResult>;
  
  /**
   * Get the function schemas that this capability provides
   */
  getFunctionSchemas(): Array<{name: string, schema: any}>;
}

/**
 * Abstract base class that provides common functionality for all capabilities
 */
export abstract class BaseCapability implements Capability {
  abstract readonly name: string;
  
  abstract createPrompt(config: CapabilityConfig): ChatPrompt;
  
  abstract getFunctionSchemas(): Array<{name: string, schema: any}>;
  
  /**
   * Default implementation of processRequest that creates a prompt and sends the request
   */
  async processRequest(userRequest: string, config: CapabilityConfig): Promise<CapabilityResult> {
    try {
      const prompt = this.createPrompt(config);
      
      // Build enhanced request with time parameters if provided
      let enhancedRequest = userRequest;
      if (config.calculatedStartTime && config.calculatedEndTime) {
        enhancedRequest = `${userRequest}

Pre-calculated time range:
- Start: ${config.calculatedStartTime}
- End: ${config.calculatedEndTime}
- Description: ${config.timespanDescription || 'calculated timespan'}

Use these exact timestamps for any time-based queries if needed.`;
      }
      
      const response = await prompt.send(enhancedRequest);
      
      return {
        response: response.content || 'No response generated',
        citations: config.citationsArray // Return citations if they were populated during execution
      };
    } catch (error) {
      return {
        response: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Helper method to get model configuration
   */
  protected getModelConfig(configKey: string) {
    // This should import and use the actual getModelConfig function
    const { getModelConfig } = require('../utils/config');
    return getModelConfig(configKey);
  }
  
  /**
   * Helper method to log capability initialization
   */
  protected logInit(conversationId: string, userTimezone?: string) {
    console.log(`📋 Creating ${this.name} Capability for conversation: ${conversationId}`);
    if (userTimezone) {
      console.log(`🕒 Using timezone: ${userTimezone}`);
    }
  }
}