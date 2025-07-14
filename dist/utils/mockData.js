"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockDataManager = void 0;
const mockMessages_1 = require("../mock/mockMessages");
const constants_1 = require("../utils/constants");
/**
 * Mock database utilities
 */
class MockDataManager {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    createMockDatabase(conversationId = 'mock-conversation') {
        const insertMessageFn = (convId, role, content, timestamp, name, activityId) => {
            this.storage.insertMessageWithTimestamp(convId, role, content, timestamp, name, activityId);
        };
        (0, mockMessages_1.createMockDatabase)(insertMessageFn, conversationId);
    }
    /**
     * Initialize mock data if USE_MOCK_DATA is true
     */
    initializeMockDataIfNeeded() {
        if (constants_1.USE_MOCK_DATA) {
            console.log('🎭 Mock mode is enabled - initializing mock database...');
            this.createMockDatabase(constants_1.DEFAULT_MOCK_CONVERSATION);
            console.log(`✅ Mock database initialized with conversation: ${constants_1.DEFAULT_MOCK_CONVERSATION}`);
        }
    }
}
exports.MockDataManager = MockDataManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja0RhdGEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMvbW9ja0RhdGEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsdURBQTBEO0FBQzFELGtEQUE4RTtBQUU5RTs7R0FFRztBQUNILE1BQWEsZUFBZTtJQUNsQixPQUFPLENBQWdCO0lBRS9CLFlBQVksT0FBc0I7UUFDaEMsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7SUFDekIsQ0FBQztJQUVELGtCQUFrQixDQUFDLGlCQUF5QixtQkFBbUI7UUFDN0QsTUFBTSxlQUFlLEdBQUcsQ0FBQyxNQUFjLEVBQUUsSUFBWSxFQUFFLE9BQWUsRUFBRSxTQUFpQixFQUFFLElBQWEsRUFBRSxVQUFtQixFQUFFLEVBQUU7WUFDL0gsSUFBSSxDQUFDLE9BQU8sQ0FBQywwQkFBMEIsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzlGLENBQUMsQ0FBQztRQUVGLElBQUEsaUNBQWtCLEVBQUMsZUFBZSxFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFRDs7T0FFRztJQUNILDBCQUEwQjtRQUN4QixJQUFJLHlCQUFhLEVBQUUsQ0FBQztZQUNsQixPQUFPLENBQUMsR0FBRyxDQUFDLHlEQUF5RCxDQUFDLENBQUM7WUFDdkUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLHFDQUF5QixDQUFDLENBQUM7WUFDbkQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrREFBa0QscUNBQXlCLEVBQUUsQ0FBQyxDQUFDO1FBQzdGLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUF6QkQsMENBeUJDIn0=