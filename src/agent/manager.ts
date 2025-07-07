import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { SqliteKVStore } from '../storage/storage';
import { MANAGER_PROMPT } from './instructions';
import { getModelConfig } from '../utils/config';
import { routeToPrompt } from './router';
import { createActionItemsPrompt, getConversationParticipantsFromAPI } from '../capabilities/actionItems';

// Manager prompt that coordinates all sub-tasks
export class ManagerPrompt {
    private prompt: ChatPrompt;
    private storage: SqliteKVStore;
    private currentAPI?: any; // Teams API instance for current request

    constructor(storage: SqliteKVStore) {
        this.storage = storage;
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
            }, async (args: any) => {
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
            }, async (args: any) => {
                return await this.delegateToActionItems(args.user_request, args.conversation_id);
            });

        console.log('🎯 Manager Agent initialized with delegation capabilities');
        return prompt;
    }

    async processRequest(userRequest: string, conversationId: string): Promise<string> {
        try {
            console.log(`🎯 Manager processing request: "${userRequest}" for conversation: ${conversationId}`);

            // Send the user request to the manager for analysis and delegation
            const response = await this.prompt.send(`
User Request: "${userRequest}"
Conversation ID: ${conversationId}

Please analyze this request and delegate it to the appropriate specialized agent.
`);

            console.log(`🎯 Manager delegation completed. Response content length: ${response.content?.length || 0}`);
            return response.content || 'No response generated';

        } catch (error) {
            console.error('❌ Error in Manager Agent:', error);
            return `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }

    async processRequestWithAPI(userRequest: string, conversationId: string, api: any): Promise<string> {
        try {
            console.log(`🎯 Manager processing request with API: "${userRequest}" for conversation: ${conversationId}`);

            // Store API for use in delegation methods
            this.currentAPI = api;

            // Send the user request to the manager for analysis and delegation
            const response = await this.prompt.send(`
User Request: "${userRequest}"
Conversation ID: ${conversationId}

Please analyze this request and delegate it to the appropriate specialized agent.
`);

            console.log(`🎯 Manager delegation completed. Response content length: ${response.content?.length || 0}`);
            return response.content || 'No response generated';

        } catch (error) {
            console.error('❌ Error in Manager Agent:', error);
            return `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`;
        } finally {
            // Clean up API reference
            this.currentAPI = undefined;
        }
    }

    private async delegateToSummarizer(userRequest: string, conversationId: string): Promise<string> {
        try {
            console.log(`📋 DELEGATION: Delegating to Summarizer Agent: "${userRequest}" for conversation: ${conversationId}`);

            // Import and use the router to get the appropriate prompt
            
            const summarizerPrompt = await routeToPrompt('summarizer', conversationId, this.storage, []);

            // Send the request to the summarizer
            console.log(`📋 DELEGATION: Sending request to Summarizer Agent...`);
            const response = await summarizerPrompt.send(userRequest);

            console.log(`📋 DELEGATION: Summarizer Agent completed task. Response length: ${response.content?.length || 0}`);
            return response.content || 'No response from Summarizer Agent';

        } catch (error) {
            console.error('❌ Error delegating to Summarizer Agent:', error);
            return JSON.stringify({
                status: 'error',
                message: `Error in Summarizer Agent: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    private async delegateToActionItems(userRequest: string, conversationId: string): Promise<string> {
        try {
            console.log(`📋 DELEGATION: Delegating to Action Items Agent: "${userRequest}" for conversation: ${conversationId}`);

            let participants: string[] = [];

            // Try to get participants from Teams API if available
            if (this.currentAPI) {
                try {
                    console.log(`👥 Fetching conversation members from Teams API...`);
                    participants = await getConversationParticipantsFromAPI(this.currentAPI, conversationId);
                } catch (apiError) {
                    console.warn(`⚠️ Failed to get members from Teams API:`, apiError);
                    participants = []; // Empty array if API fails
                }
            } else {
                console.warn(`⚠️ No Teams API available for action items agent`);
                participants = []; // Empty array when API not available
            }

            // Create action items prompt for this specific conversation
            const actionItemsPrompt = createActionItemsPrompt(conversationId, this.storage, participants);

            // Send the request to the action items agent
            console.log(`📋 DELEGATION: Sending request to Action Items Agent...`);
            const response = await actionItemsPrompt.send(userRequest);

            console.log(`📋 DELEGATION: Action Items Agent completed task. Response length: ${response.content?.length || 0}`);
            return response.content || 'No response from Action Items Agent';

        } catch (error) {
            console.error('❌ Error delegating to Action Items Agent:', error);
            return JSON.stringify({
                status: 'error',
                message: `Error in Action Items Agent: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    // Method to add new specialized agents in the future
    addAgent(agentName: string, _description: string, _functionSchema: any, _handler: Function): void {
        // This can be used to dynamically add new agents
        console.log(`🔧 Adding new agent: ${agentName}`);
        // Implementation would add new function to the prompt
    }
}
