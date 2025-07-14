"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeToPrompt = routeToPrompt;
const summarize_1 = require("../capabilities/summarize");
const actionItems_1 = require("../capabilities/actionItems");
const search_1 = require("../capabilities/search");
// Router that provides specific prompts for different capability types
async function routeToPrompt(capabilityType, conversationId, storage, participants = [], userTimezone, citationsArray) {
    console.log(`🔀 Routing to ${capabilityType} capability for conversation: ${conversationId}`);
    switch (capabilityType.toLowerCase()) {
        case 'summarizer':
            const summarizerCapability = new summarize_1.SummarizerCapability();
            return summarizerCapability.createPrompt({
                conversationId,
                userTimezone
            });
        case 'actionitems':
        case 'action_items':
            const actionItemsCapability = new actionItems_1.ActionItemsCapability();
            return actionItemsCapability.createPrompt({
                conversationId,
                storage,
                availableMembers: participants,
                userTimezone
            });
        case 'search':
            const searchCapability = new search_1.SearchCapability();
            return searchCapability.createPrompt({
                conversationId,
                userTimezone,
                citationsArray
            });
        default:
            console.warn(`⚠️ Unknown capability type: ${capabilityType}, defaulting to summarizer`);
            const defaultSummarizerCapability = new summarize_1.SummarizerCapability();
            return defaultSummarizerCapability.createPrompt({
                conversationId,
                userTimezone
            });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2FnZW50L3JvdXRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVFBLHNDQTRDQztBQWpERCx5REFBaUU7QUFDakUsNkRBQW9FO0FBQ3BFLG1EQUEwRDtBQUUxRCx1RUFBdUU7QUFDaEUsS0FBSyxVQUFVLGFBQWEsQ0FDakMsY0FBc0IsRUFDdEIsY0FBc0IsRUFDdEIsT0FBc0IsRUFDdEIsZUFBa0QsRUFBRSxFQUNwRCxZQUFxQixFQUNyQixjQUFxQztJQUVyQyxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixjQUFjLGlDQUFpQyxjQUFjLEVBQUUsQ0FBQyxDQUFDO0lBRTlGLFFBQVEsY0FBYyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUM7UUFDckMsS0FBSyxZQUFZO1lBQ2YsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLGdDQUFvQixFQUFFLENBQUM7WUFDeEQsT0FBTyxvQkFBb0IsQ0FBQyxZQUFZLENBQUM7Z0JBQ3ZDLGNBQWM7Z0JBQ2QsWUFBWTthQUNiLENBQUMsQ0FBQztRQUVMLEtBQUssYUFBYSxDQUFDO1FBQ25CLEtBQUssY0FBYztZQUNqQixNQUFNLHFCQUFxQixHQUFHLElBQUksbUNBQXFCLEVBQUUsQ0FBQztZQUMxRCxPQUFPLHFCQUFxQixDQUFDLFlBQVksQ0FBQztnQkFDeEMsY0FBYztnQkFDZCxPQUFPO2dCQUNQLGdCQUFnQixFQUFFLFlBQVk7Z0JBQzlCLFlBQVk7YUFDYixDQUFDLENBQUM7UUFFTCxLQUFLLFFBQVE7WUFDWCxNQUFNLGdCQUFnQixHQUFHLElBQUkseUJBQWdCLEVBQUUsQ0FBQztZQUNoRCxPQUFPLGdCQUFnQixDQUFDLFlBQVksQ0FBQztnQkFDbkMsY0FBYztnQkFDZCxZQUFZO2dCQUNaLGNBQWM7YUFDZixDQUFDLENBQUM7UUFFTDtZQUNFLE9BQU8sQ0FBQyxJQUFJLENBQUMsK0JBQStCLGNBQWMsNEJBQTRCLENBQUMsQ0FBQztZQUN4RixNQUFNLDJCQUEyQixHQUFHLElBQUksZ0NBQW9CLEVBQUUsQ0FBQztZQUMvRCxPQUFPLDJCQUEyQixDQUFDLFlBQVksQ0FBQztnQkFDOUMsY0FBYztnQkFDZCxZQUFZO2FBQ2IsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztBQUNILENBQUMifQ==