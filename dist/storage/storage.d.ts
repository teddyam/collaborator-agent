import { Message } from '@microsoft/teams.ai';
import Database from 'better-sqlite3';
export interface MessageRecord {
    id: number;
    conversation_id: string;
    role: string;
    content: string;
    name: string;
    timestamp: string;
    activity_id?: string;
}
export interface ActionItem {
    id: number;
    conversation_id: string;
    title: string;
    description: string;
    assigned_to: string;
    assigned_to_id?: string;
    assigned_by: string;
    assigned_by_id?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    due_date?: string;
    created_at: string;
    updated_at: string;
    source_message_ids?: string;
}
export interface FeedbackRecord {
    id: number;
    message_id: string;
    likes: number;
    dislikes: number;
    feedbacks: string;
    delegated_capability?: string;
    created_at: string;
    updated_at: string;
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
    clearAllMessages(): void;
    debugPrintDatabase(conversationId: string): string;
    insertMessageWithTimestamp(conversationId: string, role: string, content: string, timestamp: string, name?: string, activityId?: string): void;
    createActionItem(actionItem: Omit<ActionItem, 'id' | 'created_at' | 'updated_at'>): ActionItem;
    getActionItemById(id: number): ActionItem | undefined;
    getActionItemsByConversation(conversationId: string): ActionItem[];
    getActionItemsForUser(assignedTo: string, status?: string): ActionItem[];
    getActionItemsByUserId(userId: string, status?: string): ActionItem[];
    updateActionItemStatus(id: number, status: ActionItem['status'], updatedBy?: string): boolean;
    clearActionItems(conversationId: string): number;
    clearAllActionItems(): number;
    getActionItemsSummary(): any;
    getAllActionItems(): ActionItem[];
    initializeFeedbackRecord(messageId: string, delegatedCapability?: string): FeedbackRecord;
    storeDelegatedCapability(messageId: string, delegatedCapability: string | null): void;
    getFeedbackByMessageId(messageId: string): FeedbackRecord | undefined;
    updateFeedback(messageId: string, reaction: 'like' | 'dislike', feedbackJson?: any): boolean;
    getAllFeedback(): FeedbackRecord[];
    clearAllFeedback(): number;
    getFeedbackSummary(): any;
    /**
     * Get the underlying database instance for direct SQL operations
     */
    getDb(): Database.Database;
}
