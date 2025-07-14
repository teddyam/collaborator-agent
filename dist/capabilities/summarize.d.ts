import { ChatPrompt } from '@microsoft/teams.ai';
import { BaseCapability, CapabilityConfig } from './capability';
/**
 * Refactored Summarizer Capability that implements the unified capability interface
 */
export declare class SummarizerCapability extends BaseCapability {
    readonly name = "summarizer";
    createPrompt(config: CapabilityConfig): ChatPrompt;
    getFunctionSchemas(): Array<{
        name: string;
        schema: any;
    }>;
}
