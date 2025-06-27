import { Message } from '@microsoft/teams.ai';
export interface MessageRecord {
    id: number;
    conversation_id: string;
    role: string;
    content: string;
    timestamp: string;
}
export declare class SqliteKVStore {
    private db;
    constructor(dbPath?: string);
    private initializeDatabase;
    get(key: string): Array<Message> | undefined;
    set(key: string, value: Array<Message>): void;
    delete(key: string): void;
    keys(): string[];
    count(): number;
    close(): void;
    clear(): void;
    clearConversation(key: string): void;
    addMessages(conversationId: string, messages: Array<Message>): void;
    getMessagesByTimeRange(conversationId: string, startTime?: string, endTime?: string): MessageRecord[];
    getAllMessagesWithTimestamps(conversationId: string): MessageRecord[];
    getRecentMessages(conversationId: string, limit?: number): MessageRecord[];
}
