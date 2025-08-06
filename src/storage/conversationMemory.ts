import { IMemory } from '@microsoft/teams.ai';
import { SqliteKVStore } from './storage';
import { MessageRecord } from './storage';
import { MessageContext } from '../utils/messageContext';

export class ConversationMemory implements IMemory {
    private conversationId: string;

    constructor(private store: SqliteKVStore, private context: MessageContext 
        // add conversationid as param to clarify
    ) {
        this.conversationId = context.conversationId;
    }

    async get(index: number): Promise<MessageRecord | undefined> {
        return this.store.getMessageAtIndex(this.conversationId, index);
    }

    async set(index: number, message: MessageRecord): Promise<void> {
        this.store.updateMessageAtIndex(this.conversationId, index, message);
    }

    async delete(index: number): Promise<void> {
        this.store.deleteMessageAtIndex(this.conversationId, index);
    }

    async push(message: MessageRecord): Promise<void> {
        // decorate message with context if user message

        message.timestamp = this.context.timestamp;
        message.activity_id = this.context.activityId;

        if (message.role == 'user') {
            message.name = this.context.userName; // will be 'User' if userName isn't detected
        }
        else {
            message.name = 'model';
        }

        await this.store.addMessages(this.conversationId, [message]);
    }

    async pop(): Promise<MessageRecord | undefined> {
        return this.store.popLastMessage(this.conversationId);
    }

    async values(): Promise<MessageRecord[]> {
        return this.store.get(this.conversationId) || [];
    }

    async length(): Promise<number> {
        return this.store.countMessages(this.conversationId);
    }

    where(predicate: (value: MessageRecord, index: number) => boolean): MessageRecord[] {
        throw new Error("Synchronous 'where' is not supported in this async context.");
    }

    async collapse(): Promise<MessageRecord | undefined> {
        const messages = await this.values();
        return messages.length ? messages[messages.length - 1] : undefined;
    }
}