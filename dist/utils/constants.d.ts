/**
 * Configuration for mock data usage
 *
 * SETUP INSTRUCTIONS:
 * 1. To enable mock mode: Set USE_MOCK_DATA = true
 * 2. To disable mock mode: Set USE_MOCK_DATA = false
 * 3. Restart the application after changing these values
 *
 * When USE_MOCK_DATA is true:
 * - All conversations will use the mock data instead of real Teams conversations
 * - The AI can summarize and query the mock conversation history
 * - Perfect for testing and development without real conversation data
 *
 * The mock data includes sample conversations about:
 * - Recent project discussions (dashboard development)
 * - Microsoft Teams features and capabilities
 * - Azure cost optimization strategies
 */
export declare const USE_MOCK_DATA = false;
export declare const DEFAULT_MOCK_CONVERSATION = "mock-conversation";
