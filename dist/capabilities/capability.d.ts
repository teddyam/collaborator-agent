import { ChatPrompt } from '@microsoft/teams.ai';
import { CitationAppearance } from '@microsoft/teams.api';
import { SqliteKVStore } from '../storage/storage';
/**
 * Configuration interface for creating capabilities
 */
export interface CapabilityConfig {
    conversationId: string;
    userTimezone?: string;
    storage?: SqliteKVStore;
    availableMembers?: Array<{
        name: string;
        id: string;
    }>;
    isPersonalChat?: boolean;
    currentUserId?: string;
    currentUserName?: string;
    citationsArray?: CitationAppearance[];
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
    getFunctionSchemas(): Array<{
        name: string;
        schema: any;
    }>;
}
/**
 * Abstract base class that provides common functionality for all capabilities
 */
export declare abstract class BaseCapability implements Capability {
    abstract readonly name: string;
    abstract createPrompt(config: CapabilityConfig): ChatPrompt;
    abstract getFunctionSchemas(): Array<{
        name: string;
        schema: any;
    }>;
    /**
     * Default implementation of processRequest that creates a prompt and sends the request
     */
    processRequest(userRequest: string, config: CapabilityConfig): Promise<CapabilityResult>;
    /**
     * Helper method to get model configuration
     */
    protected getModelConfig(configKey: string): any;
    /**
     * Helper method to log capability initialization
     */
    protected logInit(conversationId: string, userTimezone?: string): void;
}
