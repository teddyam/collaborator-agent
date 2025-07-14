import { SqliteKVStore } from '../storage/storage';
/**
 * Mock database utilities
 */
export declare class MockDataManager {
    private storage;
    constructor(storage: SqliteKVStore);
    createMockDatabase(conversationId?: string): void;
    /**
     * Initialize mock data if USE_MOCK_DATA is true
     */
    initializeMockDataIfNeeded(): void;
}
