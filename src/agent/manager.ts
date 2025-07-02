import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { SqliteKVStore } from '../storage/storage';

// Manager prompt that coordinates all sub-tasks
export class ManagerPrompt {
    private prompt: ChatPrompt;
    private storage: SqliteKVStore;

    constructor(storage: SqliteKVStore) {
        this.storage = storage;
        this.prompt = this.initializePrompt();
    }

    private initializePrompt(): ChatPrompt {
        const managerInstructions = `
You are a Manager Agent that coordinates different specialized sub-agents for a Microsoft Teams collaboration bot.
Your role is to analyze user requests and delegate tasks to the appropriate specialized agent.

Current Date: ${new Date().toISOString().split('T')[0]}

<AVAILABLE AGENTS>
1. **Summarizer Agent**: Handles conversation summaries, message analysis, and historical data queries
   - Use for: "summarize", "what did we discuss", "recent messages", "conversation analysis"
   - Capabilities: conversation summaries, message retrieval, participant analysis

<INSTRUCTIONS>
1. Analyze the user's request carefully
2. Determine which specialized agent should handle the task
3. Call the appropriate function to delegate the work
4. Return the result from the specialized agent to the user
5. If the request doesn't match any agent, provide a helpful response about available capabilities

<DELEGATION RULES>
- Any request about summarizing, analyzing conversation history, or retrieving messages → Summarizer Agent
- If uncertain, default to Summarizer Agent for conversation-related queries
`;

        const prompt = new ChatPrompt({
            instructions: managerInstructions,
            model: new OpenAIChatModel({
                model: process.env.AOAI_MODEL!,
                apiKey: process.env.AOAI_API_KEY!,
                endpoint: process.env.AOAI_ENDPOINT!,
                apiVersion: '2025-04-01-preview',
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

            console.log(`🎯 Manager response: ${response.content}`);
            return response.content || 'No response generated';

        } catch (error) {
            console.error('❌ Error in Manager Agent:', error);
            return `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }

    private async delegateToSummarizer(userRequest: string, conversationId: string): Promise<string> {
        try {
            console.log(`📋 Delegating to Summarizer Agent: "${userRequest}" for conversation: ${conversationId}`);

            // Import and use the router to get the appropriate prompt
            const { routeToPrompt } = require('./router');
            const summarizerPrompt = await routeToPrompt('summarizer', conversationId, this.storage);

            // Send the request to the summarizer
            const response = await summarizerPrompt.send(userRequest);

            console.log(`📋 Summarizer Agent completed task`);
            return response.content;

        } catch (error) {
            console.error('❌ Error delegating to Summarizer Agent:', error);
            return JSON.stringify({
                status: 'error',
                message: `Error in Summarizer Agent: ${error instanceof Error ? error.message : 'Unknown error'}`
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
