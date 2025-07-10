export interface MockMessage {
    role: 'user' | 'assistant';
    content: string;
    name?: string;
    hoursAgo: number;
}
export declare const MOCK_MESSAGES: MockMessage[];
export declare function createMockDatabase(insertMessageFn: (conversationId: string, role: string, content: string, timestamp: string, name?: string) => void, conversationId: string): void;
export declare function getMockSummary(): string;
