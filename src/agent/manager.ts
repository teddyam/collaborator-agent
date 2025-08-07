import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { CitationAppearance } from '@microsoft/teams.api';
import { SqliteKVStore } from '../storage/storage';
import { MANAGER_PROMPT } from './prompt';
import { getModelConfig } from '../utils/config';
import { MessageContext } from '../utils/messageContext';
import { extractTimeRange } from '../utils/utils';
import { CAPABILITY_DEFINITIONS } from '../capabilities/registry';

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
    private prompt: ChatPrompt;

    constructor(private storage: SqliteKVStore, private context: MessageContext) {
        this.prompt = this.createManagerPrompt();
    }

    private createManagerPrompt(): ChatPrompt {
        const managerModelConfig = getModelConfig('manager');
        let prompt = new ChatPrompt({
            instructions: MANAGER_PROMPT,
            model: new OpenAIChatModel({
                model: managerModelConfig.model,
                apiKey: managerModelConfig.apiKey,
                endpoint: managerModelConfig.endpoint,
                apiVersion: managerModelConfig.apiVersion,
            }),
            messages: this.context.memory.values()
        }).function('calculate_time_range', 'Parse natural language time expressions and calculate exact start/end times for time-based queries', {
            type: 'object' as const,
            properties: {
                time_phrase: {
                    type: 'string' as const,
                    description: 'Natural language time expression extracted from the user request (e.g., "yesterday", "last week", "2 days ago", "past 3 hours")'
                }
            },
            required: ['time_phrase']
        }, async (args: any) => {
            console.log(`🕒 FUNCTION CALL: calculate_time_range - parsing "${args.time_phrase}"`);

            const timeRange = extractTimeRange(args.time_phrase);
            const now = new Date();

            const startTime = timeRange?.from.toString() || new Date(now.getTime() - 24 * 60 * 60 * 1000).toString();
            const endTime = timeRange?.to.toString() || now.toString;

            console.log(`📅 Parsed "${args.time_phrase}" to: ${startTime} → ${endTime}`);


        }).function('clear_conversation_history', 'Clear conversation history in the database for the current conversation',
            async () => {
                this.context.memory.clear();
            }
        );

        return prompt;
    }

    private addCapabilities(state: ManagerState) {
        for (const capability of CAPABILITY_DEFINITIONS) {
            this.prompt.function(
                capability.name,
                capability.description,
                capability.schema,
                async (args: any) => {
                    return capability.handler(args, this.context, state, this.storage);
                }
            );
        }
    }

    async processRequest(): Promise<ManagerResult> {
        try {
            const state: ManagerState = {
                delegatedCapability: null,
                searchCitations: []
            };

            this.addCapabilities(state);

            const response = await this.prompt.send(this.context.text);
            console.log(this.prompt.messages.values());

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
}
