"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteKVStore = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
// SQLite-based KV store implementation
class SqliteKVStore {
    db;
    constructor(dbPath = './src/storage/conversations.db') {
        this.db = new better_sqlite3_1.default(dbPath);
        this.initializeDatabase();
        console.log(`🗄️ SQLite KV store initialized at: ${dbPath}`);
    }
    initializeDatabase() {
        // Create conversations table (existing functionality for Message[] arrays)
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `); // Create individual messages table for timestamp tracking
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Create indexes for better query performance
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)
    `);
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)
    `);
        // Create trigger to update conversation timestamp
        this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_timestamp 
      AFTER UPDATE ON conversations 
      BEGIN 
        UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
      END
    `);
    }
    get(key) {
        try {
            const stmt = this.db.prepare('SELECT value FROM conversations WHERE key = ?');
            const row = stmt.get(key);
            if (row) {
                const parsed = JSON.parse(row.value);
                console.log(`🔍 Retrieved ${parsed.length} messages from SQLite for key: ${key}`);
                return parsed;
            }
            console.log(`📂 No conversation found in SQLite for key: ${key}`);
            return undefined;
        }
        catch (error) {
            console.error(`❌ Error reading from SQLite for key ${key}:`, error);
            return undefined;
        }
    }
    set(key, value) {
        try {
            // Save to conversations table (existing functionality)
            const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO conversations (key, value, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);
            stmt.run(key, JSON.stringify(value));
            console.log(`💾 Saved ${value.length} messages to conversations table for key: ${key}`);
            // Also save individual messages to messages table for timestamp tracking
            // First, clear existing messages for this conversation
            const deleteStmt = this.db.prepare('DELETE FROM messages WHERE conversation_id = ?');
            deleteStmt.run(key);
            // Then insert all current messages with current timestamp
            const insertStmt = this.db.prepare(`
        INSERT INTO messages (conversation_id, role, content, timestamp)
        VALUES (?, ?, ?, ?)
      `);
            const now = new Date().toISOString();
            for (const message of value) {
                insertStmt.run(key, message.role, message.content, now);
            }
            console.log(`📝 Also saved ${value.length} individual messages with timestamps`);
        }
        catch (error) {
            console.error(`❌ Error writing to SQLite for key ${key}:`, error);
        }
    }
    delete(key) {
        try {
            const stmt = this.db.prepare('DELETE FROM conversations WHERE key = ?');
            const result = stmt.run(key);
            if (result.changes > 0) {
                console.log(`🗑️ Deleted conversation from SQLite for key: ${key}`);
            }
            else {
                console.log(`📂 No conversation found to delete for key: ${key}`);
            }
        }
        catch (error) {
            console.error(`❌ Error deleting from SQLite for key ${key}:`, error);
        }
    }
    keys() {
        try {
            const stmt = this.db.prepare('SELECT key FROM conversations ORDER BY updated_at DESC');
            const rows = stmt.all();
            return rows.map(row => row.key);
        }
        catch (error) {
            console.error('❌ Error getting keys from SQLite:', error);
            return [];
        }
    }
    // Additional utility methods for SQLite
    count() {
        try {
            const stmt = this.db.prepare('SELECT COUNT(*) as count FROM conversations');
            const result = stmt.get();
            return result.count;
        }
        catch (error) {
            console.error('❌ Error getting count from SQLite:', error);
            return 0;
        }
    }
    close() {
        this.db.close();
        console.log('🔒 SQLite database connection closed');
    }
    // Clear all conversations from the database
    clear() {
        try {
            const stmt = this.db.prepare('DELETE FROM conversations');
            const result = stmt.run();
            console.log(`🧹 Cleared all conversations from SQLite. Deleted ${result.changes} records.`);
        }
        catch (error) {
            console.error('❌ Error clearing SQLite database:', error);
        }
    }
    // Clear a specific conversation by key
    clearConversation(key) {
        try {
            // Clear from both tables
            const stmt1 = this.db.prepare('DELETE FROM conversations WHERE key = ?');
            const stmt2 = this.db.prepare('DELETE FROM messages WHERE conversation_id = ?');
            const result1 = stmt1.run(key);
            const result2 = stmt2.run(key);
            if (result1.changes > 0 || result2.changes > 0) {
                console.log(`🧹 Cleared conversation history for key: ${key} (${result1.changes} conversation records, ${result2.changes} message records)`);
            }
            else {
                console.log(`📂 No conversation found to clear for key: ${key}`);
            }
        }
        catch (error) {
            console.error(`❌ Error clearing conversation for key ${key}:`, error);
        }
    }
    // ===== Individual Message Tracking Methods =====
    // Add individual messages to the messages table
    addMessages(conversationId, messages) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO messages (conversation_id, role, content, timestamp)
        VALUES (?, ?, ?, ?)
      `);
            const now = new Date().toISOString();
            for (const message of messages) {
                stmt.run(conversationId, message.role, message.content, now);
            }
            console.log(`📝 Added ${messages.length} individual messages to timestamp table for conversation: ${conversationId}`);
        }
        catch (error) {
            console.error(`❌ Error adding messages for conversation ${conversationId}:`, error);
        }
    }
    // Get messages within a time range
    getMessagesByTimeRange(conversationId, startTime, endTime) {
        try {
            let sql = 'SELECT * FROM messages WHERE conversation_id = ?';
            const params = [conversationId];
            if (startTime) {
                sql += ' AND timestamp >= ?';
                params.push(startTime);
            }
            if (endTime) {
                sql += ' AND timestamp <= ?';
                params.push(endTime);
            }
            sql += ' ORDER BY timestamp ASC';
            const stmt = this.db.prepare(sql);
            const rows = stmt.all(...params);
            console.log(`🔍 Retrieved ${rows.length} messages from time range for conversation: ${conversationId}`);
            return rows;
        }
        catch (error) {
            console.error(`❌ Error getting messages by time range for conversation ${conversationId}:`, error);
            return [];
        }
    }
    // Get all messages for a conversation with timestamps
    getAllMessagesWithTimestamps(conversationId) {
        return this.getMessagesByTimeRange(conversationId);
    }
    // Get recent messages (last N messages)
    getRecentMessages(conversationId, limit = 10) {
        try {
            const stmt = this.db.prepare(`
        SELECT * FROM messages 
        WHERE conversation_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `);
            const rows = stmt.all(conversationId, limit);
            console.log(`🔍 Retrieved ${rows.length} recent messages for conversation: ${conversationId}`);
            return rows.reverse(); // Return in chronological order
        }
        catch (error) {
            console.error(`❌ Error getting recent messages for conversation ${conversationId}:`, error);
            return [];
        }
    }
}
exports.SqliteKVStore = SqliteKVStore;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdG9yYWdlL3N0b3JhZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQ0Esb0VBQXNDO0FBV3RDLHVDQUF1QztBQUN2QyxNQUFhLGFBQWE7SUFDaEIsRUFBRSxDQUFvQjtJQUU5QixZQUFZLFNBQWlCLGdDQUFnQztRQUMzRCxJQUFJLENBQUMsRUFBRSxHQUFHLElBQUksd0JBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMvQixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUMxQixPQUFPLENBQUMsR0FBRyxDQUFDLHVDQUF1QyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQy9ELENBQUM7SUFDTyxrQkFBa0I7UUFDeEIsMkVBQTJFO1FBQzNFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDOzs7Ozs7O0tBT1osQ0FBQyxDQUFDLENBQUksMERBQTBEO1FBQ2pFLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDOzs7Ozs7OztLQVFaLENBQUMsQ0FBQztRQUVILDhDQUE4QztRQUM5QyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQzs7S0FFWixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQzs7S0FFWixDQUFDLENBQUM7UUFFSCxrREFBa0Q7UUFDbEQsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUM7Ozs7OztLQU1aLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxHQUFHLENBQUMsR0FBVztRQUNiLElBQUksQ0FBQztZQUNILE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLCtDQUErQyxDQUFDLENBQUM7WUFDOUUsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQWtDLENBQUM7WUFFM0QsSUFBSSxHQUFHLEVBQUUsQ0FBQztnQkFDUixNQUFNLE1B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