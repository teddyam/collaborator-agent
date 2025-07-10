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
        name TEXT NOT NULL DEFAULT 'Unknown',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        activity_id TEXT NULL
      )
    `);
        // Create action items table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS action_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        assigned_to TEXT NOT NULL,
        assigned_to_id TEXT NULL,
        assigned_by TEXT NOT NULL,
        assigned_by_id TEXT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
        priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        due_date DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        source_message_ids TEXT NULL
      )
    `);
        // Create feedback table for AI response feedback
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL UNIQUE,
        likes INTEGER NOT NULL DEFAULT 0,
        dislikes INTEGER NOT NULL DEFAULT 0,
        feedbacks TEXT NOT NULL DEFAULT '[]',
        delegated_agent TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Create indexes for better query performance
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)
    `);
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)
    `);
        // Action items indexes
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_action_items_conversation_id ON action_items(conversation_id)
    `);
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_action_items_assigned_to ON action_items(assigned_to)
    `);
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_action_items_assigned_to_id ON action_items(assigned_to_id)
    `);
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status)
    `);
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_action_items_due_date ON action_items(due_date)
    `);
        // Feedback indexes
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_feedback_message_id ON feedback(message_id)
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
            // For messages table, we need to be smarter about timestamps
            // Only add new messages that don't exist yet, preserving original timestamps
            // Get existing message contents to avoid duplicates
            const existingStmt = this.db.prepare('SELECT content, timestamp FROM messages WHERE conversation_id = ? ORDER BY id ASC');
            const existingMessages = existingStmt.all(key);
            const existingContents = new Set(existingMessages.map(msg => msg.content));
            // Helper function to convert content to string for comparison
            const getContentString = (content) => {
                if (typeof content === 'string')
                    return content;
                if (Array.isArray(content))
                    return JSON.stringify(content);
                return content ? String(content) : '';
            };
            // Find truly new messages (not in existing set)
            const newMessages = value.filter(msg => {
                const contentStr = getContentString(msg.content);
                return contentStr && !existingContents.has(contentStr);
            });
            if (newMessages.length > 0) {
                // Insert only new messages with individual timestamps
                const insertStmt = this.db.prepare(`
          INSERT INTO messages (conversation_id, role, content, name, timestamp, activity_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
                for (const message of newMessages) {
                    const messageTimestamp = new Date().toISOString();
                    const contentStr = getContentString(message.content);
                    const messageName = message.name || 'Unknown';
                    const activityId = message.activity_id || null;
                    insertStmt.run(key, message.role, contentStr, messageName, messageTimestamp, activityId);
                    const preview = contentStr.length > 50 ? contentStr.substring(0, 50) + '...' : contentStr;
                    console.log(`📝 Added new message with timestamp ${messageTimestamp}: ${message.role} (${messageName}) - ${preview}`);
                }
                console.log(`📝 Added ${newMessages.length} new individual messages with unique timestamps`);
            }
            else {
                console.log(`📝 No new messages to add to messages table (${value.length} messages already exist)`);
            }
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
        INSERT INTO messages (conversation_id, role, content, timestamp, activity_id)
        VALUES (?, ?, ?, ?, ?)
      `);
            const now = new Date().toISOString();
            for (const message of messages) {
                const activityId = message.activity_id || null;
                stmt.run(conversationId, message.role, message.content, now, activityId);
            }
            console.log(`📝 Added ${messages.length} individual messages to timestamp table for conversation: ${conversationId}`);
        }
        catch (error) {
            console.error(`❌ Error adding messages for conversation ${conversationId}:`, error);
        }
    }
    // Clear all messages for debugging (optional utility method)
    clearAllMessages() {
        try {
            const stmt = this.db.prepare('DELETE FROM messages');
            const result = stmt.run();
            console.log(`🧹 Cleared all messages from database. Deleted ${result.changes} records.`);
        }
        catch (error) {
            console.error('❌ Error clearing all messages:', error);
        }
    }
    // Debug function to print all database contents for a conversation
    debugPrintDatabase(conversationId) {
        try {
            console.log(`🔍 DEBUG: Printing database contents for conversation: ${conversationId}`);
            // Get conversation data from conversations table
            const conversationStmt = this.db.prepare('SELECT * FROM conversations WHERE key = ?');
            const conversationData = conversationStmt.get(conversationId);
            // Get individual messages from messages table
            const messagesStmt = this.db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC');
            const messageData = messagesStmt.all(conversationId);
            // Get total counts
            const totalConversations = this.db.prepare('SELECT COUNT(*) as count FROM conversations').get();
            const totalMessages = this.db.prepare('SELECT COUNT(*) as count FROM messages').get();
            const debugInfo = {
                conversationId,
                timestamp: new Date().toISOString(),
                database_stats: {
                    total_conversations: totalConversations.count,
                    total_messages: totalMessages.count
                },
                conversation_table: {
                    exists: !!conversationData,
                    data: conversationData ? {
                        key: conversationData.key,
                        created_at: conversationData.created_at,
                        updated_at: conversationData.updated_at,
                        message_count: conversationData.value ? JSON.parse(conversationData.value).length : 0
                    } : null
                },
                messages_table: {
                    count: messageData.length,
                    messages: messageData.map(msg => ({
                        id: msg.id,
                        role: msg.role,
                        name: msg.name,
                        timestamp: msg.timestamp,
                        activity_id: msg.activity_id || null, // Include Teams activity ID for deep linking
                        content_preview: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
                        content_length: msg.content.length
                    }))
                }
            };
            console.log(`🔍 DEBUG INFO:`, JSON.stringify(debugInfo, null, 2));
            return JSON.stringify(debugInfo, null, 2);
        }
        catch (error) {
            console.error(`❌ Error debugging database for conversation ${conversationId}:`, error);
            return JSON.stringify({
                error: `Database debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                conversationId,
                timestamp: new Date().toISOString()
            });
        }
    }
    // Method to insert a message with custom timestamp (for mock data)
    insertMessageWithTimestamp(conversationId, role, content, timestamp, name, activityId) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO messages (conversation_id, role, content, name, timestamp, activity_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            stmt.run(conversationId, role, content, name || 'Unknown', timestamp, activityId || null);
        }
        catch (error) {
            console.error(`❌ Error inserting message with custom timestamp:`, error);
        }
    }
    // ===== ACTION ITEMS MANAGEMENT =====
    // Create a new action item
    createActionItem(actionItem) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO action_items (
          conversation_id, title, description, assigned_to, assigned_to_id, assigned_by, assigned_by_id,
          status, priority, due_date, source_message_ids
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            const result = stmt.run(actionItem.conversation_id, actionItem.title, actionItem.description, actionItem.assigned_to, actionItem.assigned_to_id || null, actionItem.assigned_by, actionItem.assigned_by_id || null, actionItem.status, actionItem.priority, actionItem.due_date || null, actionItem.source_message_ids || null);
            const newActionItem = this.getActionItemById(result.lastInsertRowid);
            console.log(`✅ Created action item #${result.lastInsertRowid}: "${actionItem.title}" for ${actionItem.assigned_to}${actionItem.assigned_to_id ? ` (ID: ${actionItem.assigned_to_id})` : ''}`);
            return newActionItem;
        }
        catch (error) {
            console.error(`❌ Error creating action item:`, error);
            throw error;
        }
    }
    // Get action item by ID
    getActionItemById(id) {
        try {
            const stmt = this.db.prepare('SELECT * FROM action_items WHERE id = ?');
            const row = stmt.get(id);
            return row;
        }
        catch (error) {
            console.error(`❌ Error getting action item ${id}:`, error);
            return undefined;
        }
    }
    // Get all action items for a conversation
    getActionItemsByConversation(conversationId) {
        try {
            const stmt = this.db.prepare(`
        SELECT * FROM action_items 
        WHERE conversation_id = ? 
        ORDER BY created_at DESC
      `);
            const rows = stmt.all(conversationId);
            console.log(`🔍 Retrieved ${rows.length} action items for conversation: ${conversationId}`);
            return rows;
        }
        catch (error) {
            console.error(`❌ Error getting action items for conversation ${conversationId}:`, error);
            return [];
        }
    }
    // Get action items assigned to a specific person
    getActionItemsForUser(assignedTo, status) {
        try {
            let sql = 'SELECT * FROM action_items WHERE assigned_to = ?';
            const params = [assignedTo];
            if (status) {
                sql += ' AND status = ?';
                params.push(status);
            }
            sql += ' ORDER BY priority DESC, due_date ASC, created_at DESC';
            const stmt = this.db.prepare(sql);
            const rows = stmt.all(...params);
            console.log(`🔍 Retrieved ${rows.length} action items for user: ${assignedTo}${status ? ` (status: ${status})` : ''}`);
            return rows;
        }
        catch (error) {
            console.error(`❌ Error getting action items for user ${assignedTo}:`, error);
            return [];
        }
    }
    // Get action items assigned to a specific user by ID (for personal DMs)
    getActionItemsByUserId(userId, status) {
        try {
            let sql = 'SELECT * FROM action_items WHERE assigned_to_id = ?';
            const params = [userId];
            if (status) {
                sql += ' AND status = ?';
                params.push(status);
            }
            sql += ' ORDER BY priority DESC, due_date ASC, created_at DESC';
            const stmt = this.db.prepare(sql);
            const rows = stmt.all(...params);
            console.log(`🔍 Retrieved ${rows.length} action items for user ID: ${userId}${status ? ` (status: ${status})` : ''}`);
            return rows;
        }
        catch (error) {
            console.error(`❌ Error getting action items for user ID ${userId}:`, error);
            return [];
        }
    }
    // Update action item status
    updateActionItemStatus(id, status, updatedBy) {
        try {
            const stmt = this.db.prepare(`
        UPDATE action_items 
        SET status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
            const result = stmt.run(status, id);
            if (result.changes > 0) {
                console.log(`✅ Updated action item #${id} status to: ${status}${updatedBy ? ` by ${updatedBy}` : ''}`);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error(`❌ Error updating action item ${id} status:`, error);
            return false;
        }
    }
    // Clear all action items for a conversation
    clearActionItems(conversationId) {
        try {
            const stmt = this.db.prepare('DELETE FROM action_items WHERE conversation_id = ?');
            const result = stmt.run(conversationId);
            console.log(`🧹 Cleared ${result.changes} action items for conversation: ${conversationId}`);
            return result.changes;
        }
        catch (error) {
            console.error(`❌ Error clearing action items for conversation ${conversationId}:`, error);
            return 0;
        }
    }
    // Clear ALL action items (for complete database reset)
    clearAllActionItems() {
        try {
            const stmt = this.db.prepare('DELETE FROM action_items');
            const result = stmt.run();
            console.log(`🧹 Cleared ALL action items from database: ${result.changes} items removed`);
            return result.changes;
        }
        catch (error) {
            console.error(`❌ Error clearing all action items:`, error);
            return 0;
        }
    }
    // Get action items summary for debugging
    getActionItemsSummary() {
        try {
            const totalItems = this.db.prepare('SELECT COUNT(*) as count FROM action_items').get();
            const statusCounts = this.db.prepare(`
        SELECT status, COUNT(*) as count 
        FROM action_items 
        GROUP BY status
      `).all();
            const priorityCounts = this.db.prepare(`
        SELECT priority, COUNT(*) as count 
        FROM action_items 
        GROUP BY priority
      `).all();
            return {
                total_action_items: totalItems.count,
                by_status: statusCounts,
                by_priority: priorityCounts
            };
        }
        catch (error) {
            console.error(`❌ Error getting action items summary:`, error);
            return { error: 'Failed to get summary' };
        }
    }
    // Get all action items across all conversations (for debugging)
    getAllActionItems() {
        try {
            const sql = 'SELECT * FROM action_items ORDER BY created_at DESC';
            const stmt = this.db.prepare(sql);
            const rows = stmt.all();
            console.log(`🔍 Retrieved ${rows.length} action items across all conversations`);
            return rows;
        }
        catch (error) {
            console.error(`❌ Error getting all action items:`, error);
            return [];
        }
    }
    // ===== FEEDBACK MANAGEMENT =====
    // Initialize feedback record for a message with optional delegated agent
    initializeFeedbackRecord(messageId, delegatedAgent) {
        try {
            const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO feedback (message_id, likes, dislikes, feedbacks, delegated_agent)
        VALUES (?, 0, 0, '[]', ?)
      `);
            stmt.run(messageId, delegatedAgent || null);
            const selectStmt = this.db.prepare('SELECT * FROM feedback WHERE message_id = ?');
            const record = selectStmt.get(messageId);
            console.log(`📝 Initialized feedback record for message: ${messageId}${delegatedAgent ? ` (agent: ${delegatedAgent})` : ''}`);
            return record;
        }
        catch (error) {
            console.error(`❌ Error initializing feedback record for message ${messageId}:`, error);
            throw error;
        }
    }
    // Store delegated agent info for a message (for later feedback initialization)
    storeDelegatedAgent(messageId, delegatedAgent) {
        try {
            const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO feedback (message_id, likes, dislikes, feedbacks, delegated_agent)
        VALUES (?, 0, 0, '[]', ?)
      `);
            stmt.run(messageId, delegatedAgent);
            console.log(`📝 Stored delegated agent info for message ${messageId}: ${delegatedAgent || 'direct'}`);
        }
        catch (error) {
            console.error(`❌ Error storing delegated agent for message ${messageId}:`, error);
        }
    }
    // Get feedback record by message ID
    getFeedbackByMessageId(messageId) {
        try {
            const stmt = this.db.prepare('SELECT * FROM feedback WHERE message_id = ?');
            const record = stmt.get(messageId);
            return record;
        }
        catch (error) {
            console.error(`❌ Error getting feedback for message ${messageId}:`, error);
            return undefined;
        }
    }
    // Update feedback record with new reaction and feedback text
    updateFeedback(messageId, reaction, feedbackJson) {
        try {
            // Get existing feedback or create new one
            let existingFeedback = this.getFeedbackByMessageId(messageId);
            if (!existingFeedback) {
                existingFeedback = this.initializeFeedbackRecord(messageId);
            }
            // Parse existing feedbacks array
            let feedbacks = [];
            try {
                feedbacks = JSON.parse(existingFeedback.feedbacks);
            }
            catch (e) {
                feedbacks = [];
            }
            // Add new feedback if provided
            if (feedbackJson) {
                feedbacks.push(feedbackJson);
            }
            // Update counts
            const newLikes = existingFeedback.likes + (reaction === 'like' ? 1 : 0);
            const newDislikes = existingFeedback.dislikes + (reaction === 'dislike' ? 1 : 0);
            // Update database
            const stmt = this.db.prepare(`
        UPDATE feedback 
        SET likes = ?, dislikes = ?, feedbacks = ?, updated_at = CURRENT_TIMESTAMP
        WHERE message_id = ?
      `);
            const result = stmt.run(newLikes, newDislikes, JSON.stringify(feedbacks), messageId);
            console.log(`👍 Updated feedback for message ${messageId}: ${reaction} (likes: ${newLikes}, dislikes: ${newDislikes})`);
            return result.changes > 0;
        }
        catch (error) {
            console.error(`❌ Error updating feedback for message ${messageId}:`, error);
            return false;
        }
    }
    // Get all feedback records (for debugging)
    getAllFeedback() {
        try {
            const stmt = this.db.prepare('SELECT * FROM feedback ORDER BY created_at DESC');
            const records = stmt.all();
            console.log(`🔍 Retrieved ${records.length} feedback records`);
            return records;
        }
        catch (error) {
            console.error(`❌ Error getting all feedback records:`, error);
            return [];
        }
    }
    // Clear all feedback records
    clearAllFeedback() {
        try {
            const stmt = this.db.prepare('DELETE FROM feedback');
            const result = stmt.run();
            console.log(`🧹 Cleared ALL feedback records: ${result.changes} records removed`);
            return result.changes;
        }
        catch (error) {
            console.error(`❌ Error clearing all feedback:`, error);
            return 0;
        }
    }
    // Get feedback summary for analytics
    getFeedbackSummary() {
        try {
            const totalFeedback = this.db.prepare('SELECT COUNT(*) as count FROM feedback').get();
            const totalLikes = this.db.prepare('SELECT SUM(likes) as total FROM feedback').get();
            const totalDislikes = this.db.prepare('SELECT SUM(dislikes) as total FROM feedback').get();
            return {
                total_feedback_records: totalFeedback.count,
                total_likes: totalLikes.total || 0,
                total_dislikes: totalDislikes.total || 0,
                like_ratio: totalLikes.total && totalDislikes.total ?
                    (totalLikes.total / (totalLikes.total + totalDislikes.total) * 100).toFixed(1) + '%' :
                    'N/A'
            };
        }
        catch (error) {
            console.error(`❌ Error getting feedback summary:`, error);
            return { error: 'Failed to get feedback summary' };
        }
    }
    /**
     * Get the underlying database instance for direct SQL operations
     */
    getDb() {
        return this.db;
    }
}
exports.SqliteKVStore = SqliteKVStore;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdG9yYWdlL3N0b3JhZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQ0Esb0VBQXNDO0FBMkN0Qyx1Q0FBdUM7QUFDdkMsTUFBYSxhQUFhO0lBQ2hCLEVBQUUsQ0FBb0I7SUFFOUIsWUFBWSxTQUFpQixnQ0FBZ0M7UUFDM0QsSUFBSSxDQUFDLEVBQUUsR0FBRyxJQUFJLHdCQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDL0IsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDMUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1Q0FBdUMsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUMvRCxDQUFDO0lBQ08sa0JBQWtCO1FBQ3hCLDJFQUEyRTtRQUMzRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQzs7Ozs7OztLQU9aLENBQUMsQ0FBQyxDQUFJLDBEQUEwRDtRQUNqRSxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQzs7Ozs7Ozs7OztLQVVaLENBQUMsQ0FBQztRQUVILDRCQUE0QjtRQUM1QixJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7S0FpQlosQ0FBQyxDQUFDO1FBRUgsaURBQWlEO1FBQ2pELElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDOzs7Ozs7Ozs7OztLQVdaLENBQUMsQ0FBQztRQUlILDhDQUE4QztRQUM5QyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQzs7S0FFWixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQzs7S0FFWixDQUFDLENBQUM7UUFFSCx1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUM7O0tBRVosQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUM7O0tBRVosQ0FBQyxDQUFDO1FBRUgs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