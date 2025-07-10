"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManagerPrompt = void 0;
const teams_ai_1 = require("@microsoft/teams.ai");
const teams_openai_1 = require("@microsoft/teams.openai");
const instructions_1 = require("./instructions");
const config_1 = require("../utils/config");
const router_1 = require("./router");
const actionItems_1 = require("../capabilities/actionItems");
// Manager prompt that coordinates all sub-tasks
class ManagerPrompt {
    prompt;
    storage;
    currentAPI;
    currentUserId;
    currentUserName;
    currentUserTimezone;
    lastDelegatedAgent = null;
    lastSearchAdaptiveCards = [];
    constructor(storage) {
        this.storage = storage;
        this.prompt = this.initializePrompt();
    }
    initializePrompt() {
        const managerModelConfig = (0, config_1.getModelConfig)('manager');
        const prompt = new teams_ai_1.ChatPrompt({
            instructions: instructions_1.MANAGER_PROMPT,
            model: new teams_openai_1.OpenAIChatModel({
                model: managerModelConfig.model,
                apiKey: managerModelConfig.apiKey,
                endpoint: managerModelConfig.endpoint,
                apiVersion: managerModelConfig.apiVersion,
            }),
        })
            .function('delegate_to_summarizer', 'Delegate conversation analysis, summarization, or message retrieval tasks to the Summarizer Agent', {
            type: 'object',
            properties: {
                user_request: {
                    type: 'string',
                    description: 'The original user request to be processed by the Summarizer Agent'
                },
                conversation_id: {
                    type: 'string',
                    description: 'The conversation ID for context'
                }
            },
            required: ['user_request', 'conversation_id']
        }, async (args) => {
            this.lastDelegatedAgent = 'summarizer';
            return await this.delegateToSummarizer(args.user_request, args.conversation_id);
        })
            .function('delegate_to_action_items', 'Delegate task management, action item creation, or assignment tracking to the Action Items Agent', {
            type: 'object',
            properties: {
                user_request: {
                    type: 'string',
                    description: 'The original user request to be processed by the Action Items Agent'
                },
                conversation_id: {
                    type: 'string',
                    description: 'The conversation ID for context'
                }
            },
            required: ['user_request', 'conversation_id']
        }, async (args) => {
            this.lastDelegatedAgent = 'action_items';
            return await this.delegateToActionItems(args.user_request, args.conversation_id);
        })
            .function('delegate_to_search', 'Delegate conversation search, message finding, or historical conversation lookup to the Search Agent', {
            type: 'object',
            properties: {
                user_request: {
                    type: 'string',
                    description: 'The original user request to be processed by the Search Agent'
                },
                conversation_id: {
                    type: 'string',
                    description: 'The conversation ID for context'
                }
            },
            required: ['user_request', 'conversation_id']
        }, async (args) => {
            this.lastDelegatedAgent = 'search';
            return await this.delegateToSearch(args.user_request, args.conversation_id);
        });
        console.log('🎯 Manager Agent initialized with delegation capabilities');
        return prompt;
    }
    async processRequest(userRequest, conversationId, userTimezone) {
        try {
            console.log(`🎯 Manager processing request: "${userRequest}" for conversation: ${conversationId}`);
            if (userTimezone) {
                this.currentUserTimezone = userTimezone;
            }
            this.lastDelegatedAgent = null;
            this.lastSearchAdaptiveCards = [];
            const response = await this.prompt.send(`
User Request: "${userRequest}"
Conversation ID: ${conversationId}

Please analyze this request and delegate it to the appropriate specialized agent. Return ONLY the response from the delegated agent without any additional commentary.
`);
            console.log(`🎯 Delegated to agent: ${this.lastDelegatedAgent || 'direct (no delegation)'}`);
            return {
                response: response.content || 'No response generated',
                delegatedAgent: this.lastDelegatedAgent,
                adaptiveCards: this.lastSearchAdaptiveCards.length > 0 ? this.lastSearchAdaptiveCards : undefined
            };
        }
        catch (error) {
            console.error('❌ Error in Manager Agent:', error);
            return {
                response: `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
                delegatedAgent: null
            };
        }
    }
    async processRequestWithAPI(userRequest, conversationId, api, userTimezone) {
        try {
            console.log(`🎯 Manager processing request with API: "${userRequest}" for conversation: ${conversationId}`);
            if (userTimezone) {
                this.currentUserTimezone = userTimezone;
            }
            this.currentAPI = api;
            this.lastDelegatedAgent = null;
            this.lastSearchAdaptiveCards = [];
            const response = await this.prompt.send(`
User Request: "${userRequest}"
Conversation ID: ${conversationId}

Please analyze this request and delegate it to the appropriate specialized agent. Return ONLY the response from the delegated agent without any additional commentary.
`);
            console.log(`🎯 Delegated to agent: ${this.lastDelegatedAgent || 'direct (no delegation)'}`);
            return {
                response: response.content || 'No response generated',
                delegatedAgent: this.lastDelegatedAgent,
                adaptiveCards: this.lastSearchAdaptiveCards.length > 0 ? this.lastSearchAdaptiveCards : undefined
            };
        }
        catch (error) {
            console.error('❌ Error in Manager Agent:', error);
            return {
                response: `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
                delegatedAgent: null
            };
        }
        finally {
            this.currentAPI = undefined;
            this.currentUserTimezone = undefined;
        }
    }
    async processRequestWithPersonalMode(userRequest, conversationId, api, userId, userName, userTimezone) {
        try {
            console.log(`🎯 Manager processing request in personal mode: "${userRequest}" for user: ${userName} (${userId})`);
            if (userTimezone) {
                this.currentUserTimezone = userTimezone;
            }
            this.currentAPI = api;
            this.currentUserId = userId;
            this.currentUserName = userName;
            this.lastDelegatedAgent = null;
            this.lastSearchAdaptiveCards = [];
            const response = await this.prompt.send(`
User Request: "${userRequest}"
Conversation ID: ${conversationId}
User ID: ${userId}
User Name: ${userName}
Context: This is a personal (1:1) chat with the user.

Please analyze this request and delegate it to the appropriate specialized agent. Return ONLY the response from the delegated agent without any additional commentary.
For action item requests, use the user's ID for personal action item management.
`);
            console.log(`🎯 Delegated to agent: ${this.lastDelegatedAgent || 'direct (no delegation)'}`);
            return {
                response: response.content || 'No response generated',
                delegatedAgent: this.lastDelegatedAgent,
                adaptiveCards: this.lastSearchAdaptiveCards.length > 0 ? this.lastSearchAdaptiveCards : undefined
            };
        }
        catch (error) {
            console.error('❌ Error in Manager Agent (personal mode):', error);
            return {
                response: `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
                delegatedAgent: null
            };
        }
        finally {
            this.currentAPI = undefined;
            this.currentUserId = undefined;
            this.currentUserName = undefined;
            this.currentUserTimezone = undefined;
        }
    }
    async delegateToSummarizer(userRequest, conversationId) {
        try {
            console.log(`📋 DELEGATION: Delegating to Summarizer Agent: "${userRequest}" for conversation: ${conversationId}`);
            const summarizerPrompt = await (0, router_1.routeToPrompt)('summarizer', conversationId, this.storage, [], this.currentUserTimezone);
            const response = await summarizerPrompt.send(userRequest);
            console.log(`📋 DELEGATION: Summarizer Agent completed task. Response length: ${response.content?.length || 0}`);
            return response.content || 'No response from Summarizer Agent';
        }
        catch (error) {
            console.error('❌ Error delegating to Summarizer Agent:', error);
            return JSON.stringify({
                status: 'error',
                message: `Error in Summarizer Agent: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }
    async delegateToActionItems(userRequest, conversationId) {
        try {
            console.log(`📋 DELEGATION: Delegating to Action Items Agent: "${userRequest}" for conversation: ${conversationId}`);
            let participantList = [];
            let isPersonalChat = false;
            if (this.currentUserId && this.currentUserName) {
                console.log(`👤 Personal mode detected for user: ${this.currentUserName} (${this.currentUserId})`);
                isPersonalChat = true;
                participantList = [];
            }
            else {
                if (this.currentAPI) {
                    try {
                        console.log(`👥 Fetching conversation members from Teams API...`);
                        participantList = await (0, actionItems_1.getConversationParticipantsFromAPI)(this.currentAPI, conversationId);
                    }
                    catch (apiError) {
                        console.warn(`⚠️ Failed to get members from Teams API:`, apiError);
                        participantList = [];
                    }
                }
                else {
                    console.warn(`⚠️ No Teams API available for action items agent`);
                    participantList = [];
                }
            }
            const actionItemsPrompt = (0, actionItems_1.createActionItemsPrompt)(conversationId, this.storage, participantList, isPersonalChat, this.currentUserId, this.currentUserName, this.currentUserTimezone);
            const response = await actionItemsPrompt.send(userRequest);
            console.log(`📋 DELEGATION: Action Items Agent completed task. Response length: ${response.content?.length || 0}`);
            return response.content || 'No response from Action Items Agent';
        }
        catch (error) {
            console.error('❌ Error delegating to Action Items Agent:', error);
            return JSON.stringify({
                status: 'error',
                message: `Error in Action Items Agent: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }
    async delegateToSearch(userRequest, conversationId) {
        try {
            console.log(`🔍 DELEGATION: Delegating to Search Agent: "${userRequest}" for conversation: ${conversationId}`);
            // Create a shared array for adaptive cards
            const adaptiveCardsArray = [];
            const searchPrompt = await (0, router_1.routeToPrompt)('search', conversationId, this.storage, [], this.currentUserTimezone, adaptiveCardsArray);
            const response = await searchPrompt.send(userRequest);
            // Store the adaptive cards that were added during search
            this.lastSearchAdaptiveCards = adaptiveCardsArray;
            console.log(`🔍 DELEGATION: Search Agent completed task. Response length: ${response.content?.length || 0}, Cards found: ${adaptiveCardsArray.length}`);
            return response.content || 'No response from Search Agent';
        }
        catch (error) {
            console.error('❌ Error delegating to Search Agent:', error);
            return JSON.stringify({
                status: 'error',
                message: `Error in Search Agent: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }
    // Method to add new specialized agents in the future
    addAgent(agentName, _description, _functionSchema, _handler) {
        console.log(`🔧 Adding new agent: ${agentName}`);
    }
}
exports.ManagerPrompt = ManagerPrompt;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hZ2VudC9tYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLGtEQUFpRDtBQUNqRCwwREFBMEQ7QUFFMUQsaURBQWdEO0FBQ2hELDRDQUFpRDtBQUNqRCxxQ0FBeUM7QUFDekMsNkRBQTBHO0FBUzFHLGdEQUFnRDtBQUNoRCxNQUFhLGFBQWE7SUFDZCxNQUFNLENBQWE7SUFDbkIsT0FBTyxDQUFnQjtJQUN2QixVQUFVLENBQU87SUFDakIsYUFBYSxDQUFVO0lBQ3ZCLGVBQWUsQ0FBVTtJQUN6QixtQkFBbUIsQ0FBVTtJQUM3QixrQkFBa0IsR0FBa0IsSUFBSSxDQUFDO0lBQ3pDLHVCQUF1QixHQUFVLEVBQUUsQ0FBQztJQUU1QyxZQUFZLE9BQXNCO1FBQzlCLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7SUFDMUMsQ0FBQztJQUVPLGdCQUFnQjtRQUNwQixNQUFNLGtCQUFrQixHQUFHLElBQUEsdUJBQWMsRUFBQyxTQUFTLENBQUMsQ0FBQztRQUVyRCxNQUFNLE1BQU0sR0FBRyxJQUFJLHFCQUFVLENBQUM7WUFDMUIsWUFBWSxFQUFFLDZCQUFjO1lBQzVCLEtBQUssRUFBRSxJQUFJLDhCQUFlLENBQUM7Z0JBQ3ZCLEtBQUssRUFBRSxrQkFBa0IsQ0FBQyxLQUFLO2dCQUMvQixNQUFNLEVBQUUsa0JBQWtCLENBQUMsTUFBTTtnQkFDakMsUUFBUSxFQUFFLGtCQUFrQixDQUFDLFFBQVE7Z0JBQ3JDLFVBQVUsRUFBRSxrQkFBa0IsQ0FBQyxVQUFVO2FBQzVDLENBQUM7U0FDTCxDQUFDO2FBQ0csUUFBUSxDQUFDLHdCQUF3QixFQUFFLG1HQUFtRyxFQUFFO1lBQ3JJLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLFlBQVksRUFBRTtv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