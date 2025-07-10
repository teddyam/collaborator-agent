"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeToPrompt = routeToPrompt;
exports.createAgentRouter = createAgentRouter;
const summarize_1 = require("../capabilities/summarize");
const actionItems_1 = require("../capabilities/actionItems");
const search_1 = require("../capabilities/search");
// Router that provides specific prompts for different agent types
async function routeToPrompt(agentType, conversationId, storage, participants = [], userTimezone, adaptiveCardsArray) {
    console.log(`🔀 Routing to ${agentType} agent for conversation: ${conversationId}`);
    switch (agentType.toLowerCase()) {
        case 'summarizer':
            return (0, summarize_1.createSummarizerPrompt)(conversationId, userTimezone);
        case 'actionitems':
        case 'action_items':
            return (0, actionItems_1.createActionItemsPrompt)(conversationId, storage, participants, false, undefined, undefined, userTimezone);
        case 'search':
            return (0, search_1.createSearchPrompt)(conversationId, userTimezone, adaptiveCardsArray);
        default:
            console.warn(`⚠️ Unknown agent type: ${agentType}, defaulting to summarizer`);
            return (0, summarize_1.createSummarizerPrompt)(conversationId, userTimezone);
    }
}
// Factory function for creating new agent types
function createAgentRouter() {
    const routes = new Map();
    routes.set('summarizer', summarize_1.createSummarizerPrompt);
    return {
        addRoute: (agentType, factory) => {
            routes.set(agentType.toLowerCase(), factory);
        },
        route: async (agentType, conversationId, userTimezone) => {
            const factory = routes.get(agentType.toLowerCase()) || routes.get('summarizer');
            return factory(conversationId, userTimezone);
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2FnZW50L3JvdXRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQU9BLHNDQXlCQztBQUdELDhDQWlCQztBQWxERCx5REFBbUU7QUFDbkUsNkRBQXNFO0FBQ3RFLG1EQUE0RDtBQUU1RCxrRUFBa0U7QUFDM0QsS0FBSyxVQUFVLGFBQWEsQ0FDakMsU0FBaUIsRUFDakIsY0FBc0IsRUFDdEIsT0FBc0IsRUFDdEIsZUFBa0QsRUFBRSxFQUNwRCxZQUFxQixFQUNyQixrQkFBMEI7SUFFMUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsU0FBUyw0QkFBNEIsY0FBYyxFQUFFLENBQUMsQ0FBQztJQUVwRixRQUFRLFNBQVMsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO1FBQ2hDLEtBQUssWUFBWTtZQUNmLE9BQU8sSUFBQSxrQ0FBc0IsRUFBQyxjQUFjLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFFOUQsS0FBSyxhQUFhLENBQUM7UUFDbkIsS0FBSyxjQUFjO1lBQ2pCLE9BQU8sSUFBQSxxQ0FBdUIsRUFBQyxjQUFjLEVBQUUsT0FBTyxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUVuSCxLQUFLLFFBQVE7WUFDWCxPQUFPLElBQUEsMkJBQWtCLEVBQUMsY0FBYyxFQUFFLFlBQVksRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBRTlFO1lBQ0UsT0FBTyxDQUFDLElBQUksQ0FBQywwQkFBMEIsU0FBUyw0QkFBNEIsQ0FBQyxDQUFDO1lBQzlFLE9BQU8sSUFBQSxrQ0FBc0IsRUFBQyxjQUFjLEVBQUUsWUFBWSxDQUFDLENBQUM7SUFDaEUsQ0FBQztBQUNILENBQUM7QUFFRCxnREFBZ0Q7QUFDaEQsU0FBZ0IsaUJBQWlCO0lBSS9CLE1BQU0sTUFBTSxHQUFHLElBQUksR0FBRyxFQUF5RSxDQUFDO0lBRWhHLE1BQU0sQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLGtDQUFzQixDQUFDLENBQUM7SUFFakQsT0FBTztRQUNMLFFBQVEsRUFBRSxDQUFDLFNBQWlCLEVBQUUsT0FBc0UsRUFBRSxFQUFFO1lBQ3RHLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQy9DLENBQUM7UUFDRCxLQUFLLEVBQUUsS0FBSyxFQUFFLFNBQWlCLEVBQUUsY0FBc0IsRUFBRSxZQUFxQixFQUFFLEVBQUU7WUFDaEYsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUMsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBRSxDQUFDO1lBQ2pGLE9BQU8sT0FBTyxDQUFDLGNBQWMsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUMvQyxDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUMifQ==