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
Your role is to analyze user requests and intelligently delegate tasks to the appropriate specialized agent.
You should STAY SILENT for regular conversational messages that don't require any agent capabilities.

Current Date: ${new Date().toISOString().split('T')[0]}

<AVAILABLE AGENTS>
1. **Summarizer Agent**: Handles conversation summaries, message analysis, and historical data queries
   - Use for: summary requests, conversation analysis, message retrieval, participant insights
   - Capabilities: conversation summaries, message retrieval, participant analysis, time-based queries

<INSTRUCTIONS>
1. Analyze the user's request carefully to understand their intent
2. If the request requires a specialized agent, delegate the task
3. If the request is just casual conversation, greeting, or general chat, return EXACTLY: "STAY_SILENT"
4. Return the result from the specialized agent to the user when delegation occurs
5. DO NOT provide explanations about capabilities unless explicitly asked

<DELEGATION RULES FOR SUMMARIZER AGENT>
Delegate to the Summarizer Agent for ANY request that involves:
- Keywords: "summary", "summarize", "overview", "recap", "what happened", "what did we discuss"
- Message analysis: "recent messages", "show messages", "conversation history"
- Time-based queries: "yesterday", "last week", "today", "recent", "latest"
- Participant queries: "who said", "participants", "contributors"
- Topic analysis: "what topics", "main points", "key discussions"
- General conversation questions: "catch me up", "fill me in", "what's been discussed"

<STAY SILENT FOR>
- Casual conversation: "hello", "hi", "how are you", "thanks", "okay", "yes", "no"
- General chat: regular discussion between participants
- Reactions: "lol", "haha", "👍", emojis, short responses
- Unrelated topics: non-conversation analysis requests
- When uncertain if the message needs any agent assistance

<CRITICAL RULE>
When no agent capabilities are needed, return EXACTLY the phrase: "STAY_SILENT"
Do not add any other text, explanations, or responses when staying silent.
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

            console.log(`🎯 Manager delegation completed. Response content length: ${response.content?.length || 0}`);
            return response.content || 'No response generated';

        } catch (error) {
            console.error('❌ Error in Manager Agent:', error);
            return `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }

    private async delegateToSummarizer(userRequest: string, conversationId: string): Promise<string> {
        try {
            console.log(`📋 DELEGATION: Delegating to Summarizer Agent: "${userRequest}" for conversation: ${conversationId}`);

            // Import and use the router to get the appropriate prompt
            const { routeToPrompt } = require('./router');
            const summarizerPrompt = await routeToPrompt('summarizer', conversationId, this.storage);

            // Send the request to the summarizer
            console.log(`📋 DELEGATION: Sending request to Summarizer Agent...`);
            const response = await summarizerPrompt.send(userRequest);

            console.log(`📋 DELEGATION: Summarizer Agent completed task. Response length: ${response.content?.length || 0}`);
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
