import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { CitationAppearance } from '@microsoft/teams.api';
import { SqliteKVStore } from '../storage/storage';
import { MANAGER_PROMPT } from './prompt';
import { getModelConfig } from '../utils/config';
import { MessageContext } from '../utils/messageContext';
import { extractTimeRange } from '../utils/utils';
import { SummarizerCapability } from '../capabilities/summarizer/summarize';
import { ActionItemsCapability } from '../capabilities/actionItems/actionItems';
import { SearchCapability } from '../capabilities/search/search';

// Result interface for manager responses
export interface ManagerResult {
    response: string;
    delegatedCapability: string | null;
    citations?: CitationAppearance[];
}

// State that gets created per request
interface ManagerState {
    delegatedCapability: string | null;
    searchCitations: CitationAppearance[];
}

// Manager prompt that coordinates all sub-tasks
export class ManagerPrompt {
    private storage: SqliteKVStore;
    private basePrompt: ChatPrompt;

    constructor(storage: SqliteKVStore) {
        this.storage = storage;
        this.basePrompt = this.createBasePrompt();
    }

    // Create the base prompt structure (defined once)
    private createBasePrompt(): ChatPrompt {
        const managerModelConfig = getModelConfig('manager');

        return new ChatPrompt({
            instructions: MANAGER_PROMPT,
            model: new OpenAIChatModel({
                model: managerModelConfig.model,
                apiKey: managerModelConfig.apiKey,
                endpoint: managerModelConfig.endpoint,
                apiVersion: managerModelConfig.apiVersion,
            }),
        });
    }

    // Create a prompt with context-specific handlers
    private createPromptWithHandlers(context: MessageContext, state: ManagerState): ChatPrompt {
        let prompt = this.basePrompt
            .function('calculate_time_range', 'Parse natural language time expressions and calculate exact start/end times for time-based queries', {
                type: 'object',
                properties: {
                    time_phrase: {
                        type: 'string',
                        description: 'Natural language time expression extracted from the user request (e.g., "yesterday", "last week", "2 days ago", "past 3 hours")'
                    }
                },
                required: ['time_phrase']
            }, async (args: any) => {
                console.log(`🕒 FUNCTION CALL: calculate_time_range - parsing "${args.time_phrase}"`);
                
                const timeRange = extractTimeRange(args.time_phrase);
                
                if (!timeRange) {
                    console.warn(`⚠️ Could not parse time phrase: "${args.time_phrase}"`);
                    return JSON.stringify({
                        status: 'error',
                        message: `Could not parse time expression: "${args.time_phrase}"`
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
                    timespan_description: description
                });
            })
            .function('delegate_to_summarizer', 'Delegate conversation analysis, summarization, or message retrieval tasks to the Summarizer Capability', {
                type: 'object',
                properties: {
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
                required: []
            }, async (args: any) => {
                state.delegatedCapability = 'summarizer';

                const summarizerCapability = new SummarizerCapability();
                const result = await summarizerCapability.processRequest(context, {
                    calculatedStartTime: args.calculated_start_time,
                    calculatedEndTime: args.calculated_end_time,
                    timespanDescription: args.timespan_description
                });

                if (result.error) {
                    console.error(`❌ Error in Summarizer Capability: ${result.error}`);
                    return `Error in Summarizer Capability: ${result.error}`;
                }
                return result.response || 'No response from Summarizer Capability';
            })
            .function('delegate_to_action_items', 'Delegate task management, action item creation, or assignment tracking to the Action Items Capability', {
                type: 'object',
                properties: {
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
                required: []
            }, async (args: any) => {
                state.delegatedCapability = 'action_items';

                const actionItemsCapability = new ActionItemsCapability();
                const result = await actionItemsCapability.processRequest(context, {
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
                required: []
            }, async (args: any) => {
                state.delegatedCapability = 'search';

                const citationsArray: CitationAppearance[] = [];
                const searchCapability = new SearchCapability();
                const result = await searchCapability.processRequest(context, {
                    citationsArray,
                    calculatedStartTime: args.calculated_start_time,
                    calculatedEndTime: args.calculated_end_time,
                    timespanDescription: args.timespan_description
                });

                // Store citations in state
                state.searchCitations = citationsArray;

                return result.response || 'No response from Search Capability';
            });

        return prompt;
    }

    async processRequest(context: MessageContext): Promise<ManagerResult> {
        try {
            // Create state for this request
            const state: ManagerState = {
                delegatedCapability: null,
                searchCitations: []
            };

            // Create a prompt with context-specific handlers
            const prompt = this.createPromptWithHandlers(context, state);
            
            const contextInfo = context.isPersonalChat 
                ? `Context: This is a personal (1:1) chat with ${context.userName} (${context.userId}).`
                : `Context: This is a group conversation.`;

            const response = await prompt.send(`
User Request: "${context.text}"
Conversation ID: ${context.conversationKey}
Current Date/Time: ${context.currentDateTime}
${contextInfo}

IMPORTANT: If the user's request mentions any time periods, extract the time-related phrase and use the calculate_time_range function FIRST to convert it to exact timestamps, then pass those calculated times to the delegation functions.

Please analyze this request and delegate it to the appropriate specialized capability. Return ONLY the response from the delegated capability without any additional commentary.
For action item requests in personal chats, use the user's ID for personal action item management.
`);

            return {
                response: response.content || 'No response generated',
                delegatedCapability: state.delegatedCapability,
                citations: state.searchCitations.length > 0 ? state.searchCitations : undefined
            };

        } catch (error) {
            console.error('❌ Error in Manager:', error);
            return {
                response: `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
                delegatedCapability: null
            };
        }
    }

    // Method to add new specialized capabilities in the future
    addCapability(capabilityName: string, _description: string, _functionSchema: any, _handler: Function): void {
        console.log(`🔧 Adding new capability: ${capabilityName}`);
    }
}
