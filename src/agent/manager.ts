import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { CitationAppearance } from '@microsoft/teams.api';
import { SqliteKVStore } from '../storage/storage';
import { MANAGER_PROMPT } from './prompt';
import { getModelConfig } from '../utils/config';
import { CapabilityRouter } from './router';
import { getContextById } from '../utils/messageContext';
import { extractTimeRange } from '../utils/utils';

// Result interface for manager responses
export interface ManagerResult {
    response: string;
    delegatedCapability: string | null; // 'summarizer', 'action_items', 'search', or null for direct response
    citations?: CitationAppearance[]; // Optional citations for search results
}

// Manager prompt that coordinates all sub-tasks
export class ManagerPrompt {
    private prompt: ChatPrompt;
    private storage: SqliteKVStore;
    private lastDelegatedCapability: string | null = null;
    private lastSearchCitations: CitationAppearance[] = [];
    private router: CapabilityRouter;

    constructor(storage: SqliteKVStore) {
        this.storage = storage;
        this.router = new CapabilityRouter();
        this.prompt = this.initializePrompt();
    }

    private initializePrompt(): ChatPrompt {
        const managerModelConfig = getModelConfig('manager');

        const prompt = new ChatPrompt({
            instructions: MANAGER_PROMPT,
            model: new OpenAIChatModel({
                model: managerModelConfig.model,
                apiKey: managerModelConfig.apiKey,
                endpoint: managerModelConfig.endpoint,
                apiVersion: managerModelConfig.apiVersion,
            }),
        })
            .function('calculate_time_range', 'Parse natural language time expressions and calculate exact start/end times for time-based queries', {
                type: 'object',
                properties: {
                    contextID: {
                        type: 'string',
                        description: 'The activity ID for looking up the message context'
                    },
                    time_phrase: {
                        type: 'string',
                        description: 'Natural language time expression extracted from the user request (e.g., "yesterday", "last week", "2 days ago", "past 3 hours")'
                    }
                },
                required: ['contextID', 'time_phrase']
            }, async (args: any) => {
                console.log(`🕒 FUNCTION CALL: calculate_time_range - parsing "${args.time_phrase}"`);
                
                const timeRange = extractTimeRange(args.time_phrase);
                
                if (!timeRange) {
                    console.warn(`⚠️ Could not parse time phrase: "${args.time_phrase}"`);
                    return JSON.stringify({
                        status: 'error',
                        message: `Could not parse time expression: "${args.time_phrase}"`,
                        context_id: args.contextID
                    });
                }
                
                const startTime = timeRange.from.toISOString();
                const endTime = timeRange.to.toISOString();
                const description = `${args.time_phrase} (${timeRange.from.toLocaleDateString()} to ${timeRange.to.toLocaleDateString()})`;
                
                console.log(`📅 Parsed "${args.time_phrase}" to: ${startTime} → ${endTime}`);
                
                return JSON.stringify({
                    status: 'success',
                    calculated_start_time: startTime,
                    calculated_end_time: endTime,
                    timespan_description: description,
                    context_id: args.contextID
                });
            })
            .function('delegate_to_summarizer', 'Delegate conversation analysis, summarization, or message retrieval tasks to the Summarizer Capability', {
                type: 'object',
                properties: {
                    contextID: {
                        type: 'string',
                        description: 'The activity ID for looking up the message context'
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
                required: ['contextID']
            }, async (args: any) => {
                this.lastDelegatedCapability = 'summarizer';
                console.log(`📋 DELEGATION: Delegating to Summarizer Capability via Router for contextID: ${args.contextID}`);

                const result = await this.router.processRequest('summarizer', args.contextID, {
                    calculatedStartTime: args.calculated_start_time,
                    calculatedEndTime: args.calculated_end_time,
                    timespanDescription: args.timespan_description
                });

                if (result.error) {
                    console.error(`❌ Error in Summarizer Capability: ${result.error}`);
                    return `Error in Summarizer Capability: ${result.error}`;
                }

                console.log(`📋 DELEGATION: Summarizer Capability completed. Response length: ${result.response?.length || 0}`);
                return result.response || 'No response from Summarizer Capability';
            })
            .function('delegate_to_action_items', 'Delegate task management, action item creation, or assignment tracking to the Action Items Capability', {
                type: 'object',
                properties: {
                    contextID: {
                        type: 'string',
                        description: 'The activity ID for looking up the message context'
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
                required: ['contextID']
            }, async (args: any) => {
                this.lastDelegatedCapability = 'action_items';
                console.log(`📋 DELEGATION: Delegating to Action Items Capability via Router for contextID: ${args.contextID}`);

                const result = await this.router.processRequest('actionitems', args.contextID, {
                    storage: this.storage,
                    calculatedStartTime: args.calculated_start_time,
                    calculatedEndTime: args.calculated_end_time,
                    timespanDescription: args.timespan_description
                });

                return result.response || 'No response from Action Items Capability';
            })
            .function('delegate_to_search', 'Delegate conversation search, message finding, or historical conversation lookup to the Search Capability', {
                type: 'object',
                properties: {
                    contextID: {
                        type: 'string',
                        description: 'The activity ID for looking up the message context'
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
                required: ['contextID']
            }, async (args: any) => {
                this.lastDelegatedCapability = 'search';
                console.log(`🔍 DELEGATION: Delegating to Search Capability via Router for contextID: ${args.contextID}`);

                // Create a shared array for citations
                const citationsArray: CitationAppearance[] = [];

                const result = await this.router.processRequest('search', args.contextID, {
                    citationsArray,
                    calculatedStartTime: args.calculated_start_time,
                    calculatedEndTime: args.calculated_end_time,
                    timespanDescription: args.timespan_description
                });

                // Store the citations that were added during search
                this.lastSearchCitations = citationsArray;

                return result.response || 'No response from Search Capability';
            });

        console.log('🎯 Manager initialized with delegation capabilities');
        return prompt;
    }

    async processRequest(contextID: string): Promise<ManagerResult> {
        const context = getContextById(contextID);
        if (!context) {
            throw new Error(`Context not found for activity ID: ${contextID}`);
        }
        
        try {
            console.log(`🎯 Manager processing request: "${context.text}" for conversation: ${context.conversationKey}`);
            
            // Reset delegation state
            this.lastDelegatedCapability = null;
            this.lastSearchCitations = [];

            const contextInfo = context.isPersonalChat 
                ? `Context: This is a personal (1:1) chat with ${context.userName} (${context.userId}).`
                : `Context: This is a group conversation.`;

            const response = await this.prompt.send(`
User Request: "${context.text}"
Conversation ID: ${context.conversationKey}
Current Date/Time: ${context.currentDateTime}
${contextInfo}

CONTEXT_ID: ${contextID}

IMPORTANT: If the user's request mentions any time periods, extract the time-related phrase and use the calculate_time_range function FIRST to convert it to exact timestamps, then pass those calculated times to the delegation functions.

Please analyze this request and delegate it to the appropriate specialized capability. Use the CONTEXT_ID in your function call. Return ONLY the response from the delegated capability without any additional commentary.
For action item requests in personal chats, use the user's ID for personal action item management.
`);

            console.log(`🎯 Delegated to capability: ${this.lastDelegatedCapability || 'direct (no delegation)'}`);

            return {
                response: response.content || 'No response generated',
                delegatedCapability: this.lastDelegatedCapability,
                citations: this.lastSearchCitations.length > 0 ? this.lastSearchCitations : undefined
            };

        } catch (error) {
            console.error('❌ Error in Manager:', error);
            return {
                response: `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
                delegatedCapability: null
            };
        } finally {
            // Clean up delegation state
            this.lastDelegatedCapability = null;
            this.lastSearchCitations = [];
        }
    }

    // Method to add new specialized capabilities in the future
    addCapability(capabilityName: string, _description: string, _functionSchema: any, _handler: Function): void {
        console.log(`🔧 Adding new capability: ${capabilityName}`);
    }
}
