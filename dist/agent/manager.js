"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManagerPrompt = void 0;
const teams_ai_1 = require("@microsoft/teams.ai");
const teams_openai_1 = require("@microsoft/teams.openai");
const instructions_1 = require("./instructions");
const config_1 = require("../utils/config");
const actionItems_1 = require("../capabilities/actionItems");
const summarize_1 = require("../capabilities/summarize");
const search_1 = require("../capabilities/search");
const actionItems_2 = require("../capabilities/actionItems");
// Manager prompt that coordinates all sub-tasks
class ManagerPrompt {
    prompt;
    storage;
    currentAPI;
    currentUserId;
    currentUserName;
    currentUserTimezone;
    lastDelegatedCapability = null;
    lastSearchCitations = [];
    summarizerCapability;
    searchCapability;
    actionItemsCapability;
    constructor(storage) {
        this.storage = storage;
        this.summarizerCapability = new summarize_1.SummarizerCapability();
        this.searchCapability = new search_1.SearchCapability();
        this.actionItemsCapability = new actionItems_2.ActionItemsCapability();
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
            .function('delegate_to_summarizer', 'Delegate conversation analysis, summarization, or message retrieval tasks to the Summarizer Capability', {
            type: 'object',
            properties: {
                user_request: {
                    type: 'string',
                    description: 'The original user request to be processed by the Summarizer Capability'
                },
                conversation_id: {
                    type: 'string',
                    description: 'The conversation ID for context'
                },
                calculated_start_time: {
                    type: 'string',
                    description: 'Pre-calculated start time in ISO format (optional, only if time range is specified)'
                },
                calculated_end_time: {
                    type: 'string',
                    description: 'Pre-calculated end time in ISO format (optional, only if time range is specified)'
                },
                timespan_description: {
                    type: 'string',
                    description: 'Human-readable description of the calculated time range (optional)'
                }
            },
            required: ['user_request', 'conversation_id']
        }, async (args) => {
            this.lastDelegatedCapability = 'summarizer';
            return await this.delegateToSummarizer(args.user_request, args.conversation_id, args.calculated_start_time, args.calculated_end_time, args.timespan_description);
        })
            .function('delegate_to_action_items', 'Delegate task management, action item creation, or assignment tracking to the Action Items Capability', {
            type: 'object',
            properties: {
                user_request: {
                    type: 'string',
                    description: 'The original user request to be processed by the Action Items Capability'
                },
                conversation_id: {
                    type: 'string',
                    description: 'The conversation ID for context'
                },
                calculated_start_time: {
                    type: 'string',
                    description: 'Pre-calculated start time in ISO format (optional, only if time range is specified)'
                },
                calculated_end_time: {
                    type: 'string',
                    description: 'Pre-calculated end time in ISO format (optional, only if time range is specified)'
                },
                timespan_description: {
                    type: 'string',
                    description: 'Human-readable description of the calculated time range (optional)'
                }
            },
            required: ['user_request', 'conversation_id']
        }, async (args) => {
            this.lastDelegatedCapability = 'action_items';
            return await this.delegateToActionItems(args.user_request, args.conversation_id, args.calculated_start_time, args.calculated_end_time, args.timespan_description);
        })
            .function('delegate_to_search', 'Delegate conversation search, message finding, or historical conversation lookup to the Search Capability', {
            type: 'object',
            properties: {
                user_request: {
                    type: 'string',
                    description: 'The original user request to be processed by the Search Capability'
                },
                conversation_id: {
                    type: 'string',
                    description: 'The conversation ID for context'
                },
                calculated_start_time: {
                    type: 'string',
                    description: 'Pre-calculated start time in ISO format (optional, only if time range is specified)'
                },
                calculated_end_time: {
                    type: 'string',
                    description: 'Pre-calculated end time in ISO format (optional, only if time range is specified)'
                },
                timespan_description: {
                    type: 'string',
                    description: 'Human-readable description of the calculated time range (optional)'
                }
            },
            required: ['user_request', 'conversation_id']
        }, async (args) => {
            this.lastDelegatedCapability = 'search';
            return await this.delegateToSearch(args.user_request, args.conversation_id, args.calculated_start_time, args.calculated_end_time, args.timespan_description);
        });
        console.log('🎯 Manager initialized with delegation capabilities');
        return prompt;
    }
    async processRequest(userRequest, conversationId, userTimezone) {
        try {
            console.log(`🎯 Manager processing request: "${userRequest}" for conversation: ${conversationId}`);
            if (userTimezone) {
                this.currentUserTimezone = userTimezone;
            }
            this.lastDelegatedCapability = null;
            this.lastSearchCitations = [];
            const response = await this.prompt.send(`
User Request: "${userRequest}"
Conversation ID: ${conversationId}

Please analyze this request and delegate it to the appropriate specialized capability. Return ONLY the response from the delegated capability without any additional commentary.
`);
            console.log(`🎯 Delegated to capability: ${this.lastDelegatedCapability || 'direct (no delegation)'}`);
            return {
                response: response.content || 'No response generated',
                delegatedCapability: this.lastDelegatedCapability,
                citations: this.lastSearchCitations.length > 0 ? this.lastSearchCitations : undefined
            };
        }
        catch (error) {
            console.error('❌ Error in Manager:', error);
            return {
                response: `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
                delegatedCapability: null
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
            this.lastDelegatedCapability = null;
            this.lastSearchCitations = [];
            const response = await this.prompt.send(`
User Request: "${userRequest}"
Conversation ID: ${conversationId}

Please analyze this request and delegate it to the appropriate specialized capability. Return ONLY the response from the delegated capability without any additional commentary.
`);
            console.log(`🎯 Delegated to capability: ${this.lastDelegatedCapability || 'direct (no delegation)'}`);
            return {
                response: response.content || 'No response generated',
                delegatedCapability: this.lastDelegatedCapability,
                citations: this.lastSearchCitations.length > 0 ? this.lastSearchCitations : undefined
            };
        }
        catch (error) {
            console.error('❌ Error in Manager:', error);
            return {
                response: `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
                delegatedCapability: null
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
            this.lastDelegatedCapability = null;
            this.lastSearchCitations = [];
            const response = await this.prompt.send(`
User Request: "${userRequest}"
Conversation ID: ${conversationId}
User ID: ${userId}
User Name: ${userName}
Context: This is a personal (1:1) chat with the user.

Please analyze this request and delegate it to the appropriate specialized capability. Return ONLY the response from the delegated capability without any additional commentary.
For action item requests, use the user's ID for personal action item management.
`);
            console.log(`🎯 Delegated to capability: ${this.lastDelegatedCapability || 'direct (no delegation)'}`);
            return {
                response: response.content || 'No response generated',
                delegatedCapability: this.lastDelegatedCapability,
                citations: this.lastSearchCitations.length > 0 ? this.lastSearchCitations : undefined
            };
        }
        catch (error) {
            console.error('❌ Error in Manager (personal mode):', error);
            return {
                response: `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
                delegatedCapability: null
            };
        }
        finally {
            this.currentAPI = undefined;
            this.currentUserId = undefined;
            this.currentUserName = undefined;
            this.currentUserTimezone = undefined;
        }
    }
    async delegateToSummarizer(userRequest, conversationId, calculatedStartTime, calculatedEndTime, timespanDescription) {
        try {
            console.log(`📋 DELEGATION: Delegating to Summarizer Capability: "${userRequest}" for conversation: ${conversationId}`);
            if (calculatedStartTime && calculatedEndTime) {
                console.log(`🕒 DELEGATION: Using pre-calculated time range: ${timespanDescription || 'calculated timespan'} (${calculatedStartTime} to ${calculatedEndTime})`);
            }
            // Use the new SummarizerCapability instead of routeToPrompt
            const result = await this.summarizerCapability.processRequest(userRequest, {
                conversationId,
                userTimezone: this.currentUserTimezone,
                calculatedStartTime,
                calculatedEndTime,
                timespanDescription
            });
            if (result.error) {
                console.error(`❌ Error in Summarizer Capability: ${result.error}`);
                return JSON.stringify({
                    status: 'error',
                    message: `Error in Summarizer Capability: ${result.error}`
                });
            }
            console.log(`📋 DELEGATION: Summarizer Capability completed task. Response length: ${result.response?.length || 0}`);
            return result.response || 'No response from Summarizer Capability';
        }
        catch (error) {
            console.error('❌ Error delegating to Summarizer Capability:', error);
            return JSON.stringify({
                status: 'error',
                message: `Error in Summarizer Capability: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }
    async delegateToActionItems(userRequest, conversationId, calculatedStartTime, calculatedEndTime, timespanDescription) {
        try {
            console.log(`📋 DELEGATION: Delegating to Action Items Capability: "${userRequest}" for conversation: ${conversationId}`);
            if (calculatedStartTime && calculatedEndTime) {
                console.log(`🕒 DELEGATION: Using pre-calculated time range: ${timespanDescription || 'calculated timespan'} (${calculatedStartTime} to ${calculatedEndTime})`);
            }
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
                    console.warn(`⚠️ No Teams API available for action items capability`);
                    participantList = [];
                }
            }
            // Use the new ActionItemsCapability instead of createActionItemsPrompt
            const result = await this.actionItemsCapability.processRequest(userRequest, {
                conversationId,
                userTimezone: this.currentUserTimezone,
                storage: this.storage,
                availableMembers: participantList,
                isPersonalChat,
                currentUserId: this.currentUserId,
                currentUserName: this.currentUserName,
                calculatedStartTime,
                calculatedEndTime,
                timespanDescription
            });
            if (result.error) {
                console.error(`❌ Error in Action Items Capability: ${result.error}`);
                return JSON.stringify({
                    status: 'error',
                    message: `Error in Action Items Capability: ${result.error}`
                });
            }
            console.log(`📋 DELEGATION: Action Items Capability completed task. Response length: ${result.response?.length || 0}`);
            return result.response || 'No response from Action Items Capability';
        }
        catch (error) {
            console.error('❌ Error delegating to Action Items Capability:', error);
            return JSON.stringify({
                status: 'error',
                message: `Error in Action Items Capability: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }
    async delegateToSearch(userRequest, conversationId, calculatedStartTime, calculatedEndTime, timespanDescription) {
        try {
            console.log(`🔍 DELEGATION: Delegating to Search Capability: "${userRequest}" for conversation: ${conversationId}`);
            if (calculatedStartTime && calculatedEndTime) {
                console.log(`🕒 DELEGATION: Using pre-calculated time range: ${timespanDescription || 'calculated timespan'} (${calculatedStartTime} to ${calculatedEndTime})`);
            }
            // Create a shared array for citations
            const citationsArray = [];
            // Use the new SearchCapability instead of routeToPrompt
            const result = await this.searchCapability.processRequest(userRequest, {
                conversationId,
                userTimezone: this.currentUserTimezone,
                citationsArray,
                calculatedStartTime,
                calculatedEndTime,
                timespanDescription
            });
            if (result.error) {
                console.error(`❌ Error in Search Capability: ${result.error}`);
                return JSON.stringify({
                    status: 'error',
                    message: `Error in Search Capability: ${result.error}`
                });
            }
            // Store the citations that were added during search
            this.lastSearchCitations = citationsArray;
            console.log(`🔍 DELEGATION: Search Capability completed task. Response length: ${result.response?.length || 0}, Citations found: ${citationsArray.length}`);
            return result.response || 'No response from Search Capability';
        }
        catch (error) {
            console.error('❌ Error delegating to Search Capability:', error);
            return JSON.stringify({
                status: 'error',
                message: `Error in Search Capability: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }
    // Method to add new specialized capabilitys in the future
    addCapability(capabilityName, _description, _functionSchema, _handler) {
        console.log(`🔧 Adding new capability: ${capabilityName}`);
    }
}
exports.ManagerPrompt = ManagerPrompt;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hZ2VudC9tYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLGtEQUFpRDtBQUNqRCwwREFBMEQ7QUFHMUQsaURBQWdEO0FBQ2hELDRDQUFpRDtBQUNqRCw2REFBaUY7QUFDakYseURBQWlFO0FBQ2pFLG1EQUEwRDtBQUMxRCw2REFBb0U7QUFTcEUsZ0RBQWdEO0FBQ2hELE1BQWEsYUFBYTtJQUNkLE1BQU0sQ0FBYTtJQUNuQixPQUFPLENBQWdCO0lBQ3ZCLFVBQVUsQ0FBTztJQUNqQixhQUFhLENBQVU7SUFDdkIsZUFBZSxDQUFVO0lBQ3pCLG1CQUFtQixDQUFVO0lBQzdCLHVCQUF1QixHQUFrQixJQUFJLENBQUM7SUFDOUMsbUJBQW1CLEdBQXlCLEVBQUUsQ0FBQztJQUMvQyxvQkFBb0IsQ0FBdUI7SUFDM0MsZ0JBQWdCLENBQW1CO0lBQ25DLHFCQUFxQixDQUF3QjtJQUVyRCxZQUFZLE9BQXNCO1FBQzlCLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLGdDQUFvQixFQUFFLENBQUM7UUFDdkQsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUkseUJBQWdCLEVBQUUsQ0FBQztRQUMvQyxJQUFJLENBQUMscUJBQXFCLEdBQUcsSUFBSSxtQ0FBcUIsRUFBRSxDQUFDO1FBQ3pELElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7SUFDMUMsQ0FBQztJQUVPLGdCQUFnQjtRQUNwQixNQUFNLGtCQUFrQixHQUFHLElBQUEsdUJBQWMsRUFBQyxTQUFTLENBQUMsQ0FBQztRQUVyRCxNQUFNLE1BQU0sR0FBRyxJQUFJLHFCQUFVLENBQUM7WUFDMUIsWUFBWSxFQUFFLDZCQUFjO1lBQzVCLEtBQUssRUFBRSxJQUFJLDhCQUFlLENBQUM7Z0JBQ3ZCLEtBQUssRUFB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