"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseCapability = void 0;
/**
 * Abstract base class that provides common functionality for all capabilities
 */
class BaseCapability {
    /**
     * Default implementation of processRequest that creates a prompt and sends the request
     */
    async processRequest(userRequest, config) {
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
        }
        catch (error) {
            return {
                response: '',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Helper method to get model configuration
     */
    getModelConfig(configKey) {
        // This should import and use the actual getModelConfig function
        const { getModelConfig } = require('../utils/config');
        return getModelConfig(configKey);
    }
    /**
     * Helper method to log capability initialization
     */
    logInit(conversationId, userTimezone) {
        console.log(`📋 Creating ${this.name} Capability for conversation: ${conversationId}`);
        if (userTimezone) {
            console.log(`🕒 Using timezone: ${userTimezone}`);
        }
    }
}
exports.BaseCapability = BaseCapability;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FwYWJpbGl0eS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jYXBhYmlsaXRpZXMvY2FwYWJpbGl0eS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUE2REE7O0dBRUc7QUFDSCxNQUFzQixjQUFjO0lBT2xDOztPQUVHO0lBQ0gsS0FBSyxDQUFDLGNBQWMsQ0FBQyxXQUFtQixFQUFFLE1BQXdCO1FBQ2hFLElBQUksQ0FBQztZQUNILE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7WUFFekMsMERBQTBEO1lBQzFELElBQUksZUFBZSxHQUFHLFdBQVcsQ0FBQztZQUNsQyxJQUFJLE1BQU0sQ0FBQyxtQkFBbUIsSUFBSSxNQUFNLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztnQkFDM0QsZUFBZSxHQUFHLEdBQUcsV0FBVzs7O1dBRzdCLE1BQU0sQ0FBQyxtQkFBbUI7U0FDNUIsTUFBTSxDQUFDLGlCQUFpQjtpQkFDaEIsTUFBTSxDQUFDLG1CQUFtQixJQUFJLHFCQUFxQjs7aUVBRUgsQ0FBQztZQUM1RCxDQUFDO1lBRUQsTUFBTSxRQUFRLEdBQUcsTUFBTSxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBRXBELE9BQU87Z0JBQ0wsUUFBUSxFQUFFLFFBQVEsQ0FBQyxPQUFPLElBQUksdUJBQXVCO2dCQUNyRCxTQUFTLEVBQUUsTUFBTSxDQUFDLGNBQWMsQ0FBQywyREFBMkQ7YUFDN0YsQ0FBQztRQUNKLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTztnQkFDTCxRQUFRLEVBQUUsRUFBRTtnQkFDWixLQUFLLEVBQUUsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsZUFBZTthQUNoRSxDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNPLGNBQWMsQ0FBQyxTQUFpQjtRQUN4QyxnRUFBZ0U7UUFDaEUsTUFBTSxFQUFFLGNBQWMsRUFBRSxHQUFHLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ3RELE9BQU8sY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFRDs7T0FFRztJQUNPLE9BQU8sQ0FBQyxjQUFzQixFQUFFLFlBQXFCO1FBQzdELE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxJQUFJLENBQUMsSUFBSSxpQ0FBaUMsY0FBYyxFQUFFLENBQUMsQ0FBQztRQUN2RixJQUFJLFlBQVksRUFBRSxDQUFDO1lBQ2pCLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLFlBQVksRUFBRSxDQUFDLENBQUM7UUFDcEQsQ0FBQztJQUNILENBQUM7Q0FDRjtBQTNERCx3Q0EyREMifQ==