interface DebugResponse {
    isDebugCommand: boolean;
    response?: string;
}
/**
 * Centralized debug command handler
 * Processes debug commands and returns appropriate responses
 */
export declare function handleDebugCommand(text: string, conversationKey: string): Promise<DebugResponse>;
/**
 * Get list of all available debug commands
 */
export declare function getDebugCommands(): string[];
/**
 * Check if a text string is a debug command
 */
export declare function isDebugCommand(text: string): boolean;
export {};
