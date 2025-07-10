import { ChatPrompt } from '@microsoft/teams.ai';
import { MessageRecord } from '../storage/storage';
import { IMessageActivity } from '@microsoft/teams.api';
/**
 * Create an Adaptive Card with deep link to original message
 */
export declare function createQuotedAdaptiveCard(activity: IMessageActivity): any;
/**
 * Create an Adaptive Card from a stored message record
 */
export declare function createQuotedAdaptiveCardFromRecord(message: MessageRecord, conversationId: string): any;
/**
 * Create the search prompt for a specific conversation
 */
export declare function createSearchPrompt(conversationId: string, userTimezone?: string, adaptiveCardsArray?: any[]): ChatPrompt;
