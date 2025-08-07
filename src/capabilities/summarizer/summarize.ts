import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { SUMMARY_PROMPT } from './prompt';
import {
  SUMMARIZER_DELEGATION_SCHEMA
} from './schema';
import { BaseCapability, CapabilityOptions, CapabilityDefinition } from '../capability';
import { MessageContext } from '../../utils/messageContext';

/**
 * Refactored Summarizer Capability that implements the unified capability interface
 */
export class SummarizerCapability extends BaseCapability {
  readonly name = 'summarizer';

  createPrompt(context: MessageContext, options: CapabilityOptions = {}): ChatPrompt {
    if (!context) {
      throw new Error(`Message context is required for summarizer capability`);
    }

    this.logInit(context);

    const summarizerModelConfig = this.getModelConfig('summarizer');

    // Build additional time context if pre-calculated times are provided
    let timeContext = '';
    if (context.startTime && context.endTime) {
      timeContext = `

IMPORTANT: Pre-calculated time range available:
- Start: ${context.startTime}
- End: ${context.endTime}

When retrieving messages for summarization, use these exact timestamps instead of calculating your own. This ensures consistency with the Manager's time calculations and reduces token usage.`;
    }

    const instructions = SUMMARY_PROMPT + timeContext;

    const prompt = new ChatPrompt({
      instructions,
      model: new OpenAIChatModel({
        model: summarizerModelConfig.model,
        apiKey: summarizerModelConfig.apiKey,
        endpoint: summarizerModelConfig.endpoint,
        apiVersion: summarizerModelConfig.apiVersion,
      }),
    })
      .function('summarize_conversation', 'Get a summary of the conversation with message counts and time span',
        async (_args: any) => {
          const allMessages = context.memory.values();
          return JSON.stringify({
            status: 'success',
            totalMessages: allMessages.length,
            conversationId: context.conversationId,
            oldestMessage: allMessages.length > 0 ? allMessages[0].timestamp : null,
            newestMessage: allMessages.length > 0 ? allMessages[allMessages.length - 1].timestamp : null,
            messagesByRole: allMessages.reduce((acc: any, msg: any) => {
              acc[msg.role] = (acc[msg.role] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
            messagesByName: allMessages.reduce((acc: any, msg: any) => {
              acc[msg.name] = (acc[msg.name] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
            participants: [...new Set(allMessages.map((msg: any) => msg.name))],
            messages: allMessages.map((msg: any) => ({
              timestamp: msg.timestamp,
              role: msg.role,
              name: msg.name,
              content: msg.content
            }))
          });
        });

    console.log(`📋 Summarizer Capability created with unified interface`);
    return prompt;
  }

  getFunctionSchemas(): Array<{ name: string, schema: any }> {
    return []; // no function schema for this capability
  }
}

// Capability definition for manager registration
export const SUMMARIZER_CAPABILITY_DEFINITION: CapabilityDefinition = {
  name: 'delegate_to_summarizer',
  description: 'Delegate conversation analysis, summarization, or message retrieval tasks to the Summarizer Capability',
  schema: SUMMARIZER_DELEGATION_SCHEMA,
  handler: async (args: any, context: MessageContext, state: any) => {
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
  }
};
