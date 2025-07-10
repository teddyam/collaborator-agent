"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageManager = exports.MessageManager = void 0;
exports.getMessagesWithTimestamps = getMessagesWithTimestamps;
exports.getMessagesByTimeRange = getMessagesByTimeRange;
exports.getRecentMessages = getRecentMessages;
exports.getMessageStorage = getMessageStorage;
const storage_1 = require("./storage");
/**
 * Universal message retrieval functions used by all capabilities
 * These functions provide a centralized interface for accessing conversation messages
 */
class MessageManager {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    /**
     * Get all messages with timestamps for a conversation
     */
    getMessagesWithTimestamps(conversationKey) {
        return this.getMessagesByTimeRange(conversationKey);
    }
    /**
     * Get messages within a specific time range
     */
    getMessagesByTimeRange(conversationId, startTime, endTime) {
        try {
            let sql = 'SELECT * FROM messages WHERE conversation_id = ?';
            const params = [conversationId];
            console.log(`🔍 SQL Query Debug - Conversation: ${conversationId}`);
            console.log(`🔍 SQL Query Debug - Start time: ${startTime}`);
            console.log(`🔍 SQL Query Debug - End time: ${endTime}`);
            if (startTime) {
                sql += ' AND timestamp >= ?';
                params.push(startTime);
            }
            if (endTime) {
                sql += ' AND timestamp <= ?';
                params.push(endTime);
            }
            sql += ' ORDER BY timestamp ASC';
            console.log(`🔍 SQL Query Debug - Final SQL: ${sql}`);
            console.log(`🔍 SQL Query Debug - Parameters:`, params);
            const stmt = this.storage.getDb().prepare(sql);
            const rows = stmt.all(...params);
            console.log(`🔍 Retrieved ${rows.length} messages from time range for conversation: ${conversationId}`);
            // Additional debugging - show first few timestamps if available
            if (rows.length > 0) {
                console.log(`🔍 SQL Query Debug - First message timestamp: ${rows[0].timestamp}`);
                console.log(`🔍 SQL Query Debug - Last message timestamp: ${rows[rows.length - 1].timestamp}`);
            }
            // If no results but we expected some, let's debug further
            if (rows.length === 0 && (startTime || endTime)) {
                // Get all messages to compare timestamps
                const allRows = this.storage.getDb().prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC').all(conversationId);
                console.log(`🔍 SQL Query Debug - Total messages in conversation: ${allRows.length}`);
                if (allRows.length > 0) {
                    console.log(`🔍 SQL Query Debug - Actual first timestamp: ${allRows[0].timestamp}`);
                    console.log(`🔍 SQL Query Debug - Actual last timestamp: ${allRows[allRows.length - 1].timestamp}`);
                    console.log(`🔍 SQL Query Debug - String comparison test:`, {
                        firstVsStart: startTime ? `"${allRows[0].timestamp}" >= "${startTime}" = ${allRows[0].timestamp >= startTime}` : 'N/A',
                        lastVsEnd: endTime ? `"${allRows[allRows.length - 1].timestamp}" <= "${endTime}" = ${allRows[allRows.length - 1].timestamp <= endTime}` : 'N/A'
                    });
                }
            }
            return rows;
        }
        catch (error) {
            console.error(`❌ Error getting messages by time range for conversation ${conversationId}:`, error);
            return [];
        }
    }
    /**
     * Get recent messages with a limit
     */
    getRecentMessages(conversationId, limit = 10) {
        try {
            const stmt = this.storage.getDb().prepare(`
        SELECT * FROM messages 
        WHERE conversation_id = ? 
        ORDER BY id DESC 
        LIMIT ?
      `);
            const rows = stmt.all(conversationId, limit);
            console.log(`🔍 Retrieved ${rows.length} recent messages for conversation: ${conversationId}`);
            // Log the timestamps for debugging
            if (rows.length > 0) {
                console.log(`🕐 Recent message timestamps:`, rows.map(row => ({
                    id: row.id,
                    timestamp: row.timestamp,
                    role: row.role,
                    preview: row.content.substring(0, 30) + '...'
                })));
            }
            return rows.reverse(); // Return in chronological order (oldest first)
        }
        catch (error) {
            console.error(`❌ Error getting recent messages for conversation ${conversationId}:`, error);
            return [];
        }
    }
    /**
     * Get the underlying storage instance for advanced operations
     */
    getStorage() {
        return this.storage;
    }
}
exports.MessageManager = MessageManager;
// Create a singleton instance that can be imported by capabilities
const storage = new storage_1.SqliteKVStore();
exports.messageManager = new MessageManager(storage);
// Export individual functions for easy import - these are the primary interface
function getMessagesWithTimestamps(conversationKey) {
    return exports.messageManager.getMessagesWithTimestamps(conversationKey);
}
function getMessagesByTimeRange(conversationKey, startTime, endTime) {
    return exports.messageManager.getMessagesByTimeRange(conversationKey, startTime, endTime);
}
function getRecentMessages(conversationKey, limit = 10) {
    return exports.messageManager.getRecentMessages(conversationKey, limit);
}
function getMessageStorage() {
    return exports.messageManager.getStorage();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdG9yYWdlL21lc3NhZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBNkhBLDhEQUVDO0FBRUQsd0RBRUM7QUFFRCw4Q0FFQztBQUVELDhDQUVDO0FBM0lELHVDQUF5RDtBQUV6RDs7O0dBR0c7QUFDSCxNQUFhLGNBQWM7SUFDakIsT0FBTyxDQUFnQjtJQUUvQixZQUFZLE9BQXNCO1FBQ2hDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO0lBQ3pCLENBQUM7SUFFRDs7T0FFRztJQUNILHlCQUF5QixDQUFDLGVBQXVCO1FBQy9DLE9BQU8sSUFBSSxDQUFDLHNCQUFzQixDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFRDs7T0FFRztJQUNILHNCQUFzQixDQUFDLGNBQXNCLEVBQUUsU0FBa0IsRUFBRSxPQUFnQjtRQUNqRixJQUFJLENBQUM7WUFDSCxJQUFJLEdBQUcsR0FBRyxrREFBa0QsQ0FBQztZQUM3RCxNQUFNLE1BQU0sR0FBVSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBRXZDLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0NBQXNDLGNBQWMsRUFBRSxDQUFDLENBQUM7WUFDcEUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQ0FBb0MsU0FBUyxFQUFFLENBQUMsQ0FBQztZQUM3RCxPQUFPLENBQUMsR0FBRyxDQUFDLGtDQUFrQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBRXpELElBQUksU0FBUyxFQUFFLENBQUM7Z0JBQ2QsR0FBRyxJQUFJLHFCQUFxQixDQUFDO2dCQUM3QixNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3pCLENBQUM7WUFFRCxJQUFJLE9BQU8sRUFBRSxDQUFDO2dCQUNaLEdBQUcsSUFBSSxxQkFBcUIsQ0FBQztnQkFDN0IsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUN2QixDQUFDO1lBRUQs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