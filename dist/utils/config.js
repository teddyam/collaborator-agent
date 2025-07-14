"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_MODELS = void 0;
exports.getModelConfig = getModelConfig;
exports.validateEnvironment = validateEnvironment;
exports.logModelConfigs = logModelConfigs;
// Model configurations for different agents
exports.AI_MODELS = {
    // Manager Agent - Uses lighter, faster model for routing decisions
    MANAGER: {
        model: 'gpt-4o-mini',
        apiKey: process.env.AOAI_API_KEY,
        endpoint: process.env.AOAI_ENDPOINT,
        apiVersion: '2025-04-01-preview',
    },
    // Summarizer Agent - Uses more capable model for complex analysis
    SUMMARIZER: {
        model: process.env.AOAI_MODEL || 'gpt-4o',
        apiKey: process.env.AOAI_API_KEY,
        endpoint: process.env.AOAI_ENDPOINT,
        apiVersion: '2025-04-01-preview',
    },
    // Action Items Agent - Uses capable model for analysis and task management
    ACTION_ITEMS: {
        model: process.env.AOAI_MODEL || 'gpt-4o',
        apiKey: process.env.AOAI_API_KEY,
        endpoint: process.env.AOAI_ENDPOINT,
        apiVersion: '2025-04-01-preview',
    },
    // Search Agent - Uses capable model for semantic search and deep linking
    SEARCH: {
        model: process.env.AOAI_MODEL || 'gpt-4o',
        apiKey: process.env.AOAI_API_KEY,
        endpoint: process.env.AOAI_ENDPOINT,
        apiVersion: '2025-04-01-preview',
    },
    // Default model configuration (fallback)
    DEFAULT: {
        model: process.env.AOAI_MODEL || 'gpt-4o',
        apiKey: process.env.AOAI_API_KEY,
        endpoint: process.env.AOAI_ENDPOINT,
        apiVersion: '2025-04-01-preview',
    },
};
// Helper function to get model config for a specific agent
function getModelConfig(capabilityType = 'default') {
    switch (capabilityType.toLowerCase()) {
        case 'manager':
            return exports.AI_MODELS.MANAGER;
        case 'summarizer':
            return exports.AI_MODELS.SUMMARIZER;
        case 'actionitems':
            return exports.AI_MODELS.ACTION_ITEMS;
        case 'search':
            return exports.AI_MODELS.SEARCH;
        default:
            return exports.AI_MODELS.DEFAULT;
    }
}
// Environment validation
function validateEnvironment() {
    const requiredEnvVars = ['AOAI_API_KEY', 'AOAI_ENDPOINT'];
    const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    console.log('✅ Environment validation passed');
}
// Model configuration logging
function logModelConfigs() {
    console.log('🔧 AI Model Configuration:');
    console.log(`  Manager Agent: ${exports.AI_MODELS.MANAGER.model}`);
    console.log(`  Summarizer Agent: ${exports.AI_MODELS.SUMMARIZER.model}`);
    console.log(`  Action Items Agent: ${exports.AI_MODELS.ACTION_ITEMS.model}`);
    console.log(`  Search Agent: ${exports.AI_MODELS.SEARCH.model}`);
    console.log(`  Default Model: ${exports.AI_MODELS.DEFAULT.model}`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWxzL2NvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFvREEsd0NBYUM7QUFHRCxrREFTQztBQUdELDBDQU9DO0FBL0VELDRDQUE0QztBQUMvQixRQUFBLFNBQVMsR0FBRztJQUN2QixtRUFBbUU7SUFDbkUsT0FBTyxFQUFFO1FBQ1AsS0FBSyxFQUFFLGFBQWE7UUFDcEIsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBYTtRQUNqQyxRQUFRLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFjO1FBQ3BDLFVBQVUsRUFBRSxvQkFBb0I7S0FDbEI7SUFFaEIsa0VBQWtFO0lBQ2xFLFVBQVUsRUFBRTtRQUNWLEtBQUssRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsSUFBSSxRQUFRO1FBQ3pDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQWE7UUFDakMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYztRQUNwQyxVQUFVLEVBQUUsb0JBQW9CO0tBQ2xCO0lBRWhCLDJFQUEyRTtJQUMzRSxZQUFZLEVBQUU7UUFDWixLQUFLLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLElBQUksUUFBUTtRQUN6QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFhO1FBQ2pDLFFBQVEsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWM7UUFDcEMsVUFBVSxFQUFFLG9CQUFvQjtLQUNsQjtJQUVoQix5RUFBeUU7SUFDekUsTUFBTSxFQUFFO1FBQ04sS0FBSyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxJQUFJLFFBQVE7UUFDekMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBYTtRQUNqQyxRQUFRLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFjO1FBQ3BDLFVBQVUsRUFBRSxvQkFBb0I7S0FDbEI7SUFFaEIseUNBQXlDO0lBQ3pDLE9BQU8sRUFBRTtRQUNQLEtBQUssRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsSUFBSSxRQUFRO1FBQ3pDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQWE7UUFDakMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYztRQUNwQyxVQUFVLEVBQUUsb0JBQW9CO0tBQ2xCO0NBQ2pCLENBQUM7QUFFRiwyREFBMkQ7QUFDM0QsU0FBZ0IsY0FBYyxDQUFDLGlCQUFrRixTQUFTO0lBQ3hILFFBQVEsY0FBYyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUM7UUFDckMsS0FBSyxTQUFTO1lBQ1osT0FBTyxpQkFBUyxDQUFDLE9BQU8sQ0FBQztRQUMzQixLQUFLLFlBQVk7WUFDZixPQUFPLGlCQUFTLENBQUMsVUFBVSxDQUFDO1FBQzlCLEtBQUssYUFBYTtZQUNoQixPQUFPLGlCQUFTLENBQUMsWUFBWSxDQUFDO1FBQ2hDLEtBQUssUUFBUTtZQUNYLE9BQU8saUJBQVMsQ0FBQyxNQUFNLENBQUM7UUFDMUI7WUFDRSxPQUFPLGlCQUFTLENBQUMsT0FBTyxDQUFDO0lBQzdCLENBQUM7QUFDSCxDQUFDO0FBRUQseUJBQXlCO0FBQ3pCLFNBQWdCLG1CQUFtQjtJQUNqQyxNQUFNLGVBQWUsR0FBRyxDQUFDLGNBQWMsRUFBRSxlQUFlLENBQUMsQ0FBQztJQUMxRCxNQUFNLE9BQU8sR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFFdkUsSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQ3ZCLE1BQU0sSUFBSSxLQUFLLENBQUMsMkNBQTJDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ25GLENBQUM7SUFFRCxPQUFPLENBQUMsR0FBRyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7QUFDakQsQ0FBQztBQUVELDhCQUE4QjtBQUM5QixTQUFnQixlQUFlO0lBQzdCLE9BQU8sQ0FBQyxHQUFHLENBQUMsNEJBQTRCLENBQUMsQ0FBQztJQUMxQyxPQUFPLENBQUMsR0FBRyxDQUFDLG9CQUFvQixpQkFBUyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQzNELE9BQU8sQ0FBQyxHQUFHLENBQUMsdUJBQXVCLGlCQUFTLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDakUsT0FBTyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsaUJBQVMsQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUNyRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixpQkFBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ3pELE9BQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLGlCQUFTLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7QUFDN0QsQ0FBQyJ9