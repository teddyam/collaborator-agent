import { Message } from '@microsoft/teams.ai';
import Database from 'better-sqlite3';

// Interface for individual message records with timestamps
export interface MessageRecord {
  id: number;
  conversation_id: string;
  role: string;
  content: string;
  timestamp: string;
}

// SQLite-based KV store implementation
export class SqliteKVStore {
  private db: Database.Database;

  constructor(dbPath: string = './src/storage/conversations.db') {
    this.db = new Database(dbPath);
    this.initializeDatabase();
    console.log(`🗄️ SQLite KV store initialized at: ${dbPath}`);
  }
  private initializeDatabase(): void {
    // Create conversations table (existing functionality for Message[] arrays)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);    // Create individual messages table for timestamp tracking
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

  get(key: string): Array<Message> | undefined {
    try {
      const stmt = this.db.prepare('SELECT value FROM conversations WHERE key = ?');
      const row = stmt.get(key) as { value: string } | undefined;
      
      if (row) {
        const parsed = JSON.parse(row.value);
        console.log(`🔍 Retrieved ${parsed.length} messages from SQLite for key: ${key}`);
        return parsed;
      }
      
      console.log(`📂 No conversation found in SQLite for key: ${key}`);
      return undefined;
    } catch (error) {
      console.error(`❌ Error reading from SQLite for key ${key}:`, error);
      return undefined;
    }
  }
  set(key: string, value: Array<Message>): void {
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
      
    } catch (error) {
      console.error(`❌ Error writing to SQLite for key ${key}:`, error);
    }
  }

  delete(key: string): void {
    try {
      const stmt = this.db.prepare('DELETE FROM conversations WHERE key = ?');
      const result = stmt.run(key);
      
      if (result.changes > 0) {
        console.log(`🗑️ Deleted conversation from SQLite for key: ${key}`);
      } else {
        console.log(`📂 No conversation found to delete for key: ${key}`);
      }
    } catch (error) {
      console.error(`❌ Error deleting from SQLite for key ${key}:`, error);
    }
  }

  keys(): string[] {
    try {
      const stmt = this.db.prepare('SELECT key FROM conversations ORDER BY updated_at DESC');
      const rows = stmt.all() as { key: string }[];
      return rows.map(row => row.key);
    } catch (error) {
      console.error('❌ Error getting keys from SQLite:', error);
      return [];
    }
  }

  // Additional utility methods for SQLite
  count(): number {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM conversations');
      const result = stmt.get() as { count: number };
      return result.count;
    } catch (error) {
      console.error('❌ Error getting count from SQLite:', error);
      return 0;
    }
  }

  close(): void {
    this.db.close();
    console.log('🔒 SQLite database connection closed');
  }

  // Clear all conversations from the database
  clear(): void {
    try {
      const stmt = this.db.prepare('DELETE FROM conversations');
      const result = stmt.run();
      console.log(`🧹 Cleared all conversations from SQLite. Deleted ${result.changes} records.`);
    } catch (error) {
      console.error('❌ Error clearing SQLite database:', error);
    }
  }
  // Clear a specific conversation by key
  clearConversation(key: string): void {
    try {
      // Clear from both tables
      const stmt1 = this.db.prepare('DELETE FROM conversations WHERE key = ?');
      const stmt2 = this.db.prepare('DELETE FROM messages WHERE conversation_id = ?');
      
      const result1 = stmt1.run(key);
      const result2 = stmt2.run(key);
      
      if (result1.changes > 0 || result2.changes > 0) {
        console.log(`🧹 Cleared conversation history for key: ${key} (${result1.changes} conversation records, ${result2.changes} message records)`);
      } else {
        console.log(`📂 No conversation found to clear for key: ${key}`);
      }
    } catch (error) {
      console.error(`❌ Error clearing conversation for key ${key}:`, error);
    }
  }
  // ===== Individual Message Tracking Methods =====

  // Add individual messages to the messages table
  addMessages(conversationId: string, messages: Array<Message>): void {
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
    } catch (error) {
      console.error(`❌ Error adding messages for conversation ${conversationId}:`, error);
    }
  }

  // Get messages within a time range
  getMessagesByTimeRange(conversationId: string, startTime?: string, endTime?: string): MessageRecord[] {
    try {
      let sql = 'SELECT * FROM messages WHERE conversation_id = ?';
      const params: any[] = [conversationId];

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
      const rows = stmt.all(...params) as MessageRecord[];
      
      console.log(`🔍 Retrieved ${rows.length} messages from time range for conversation: ${conversationId}`);
      return rows;
    } catch (error) {
      console.error(`❌ Error getting messages by time range for conversation ${conversationId}:`, error);
      return [];
    }
  }

  // Get all messages for a conversation with timestamps
  getAllMessagesWithTimestamps(conversationId: string): MessageRecord[] {
    return this.getMessagesByTimeRange(conversationId);
  }

  // Get recent messages (last N messages)
  getRecentMessages(conversationId: string, limit: number = 10): MessageRecord[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM messages 
        WHERE conversation_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `);
      
      const rows = stmt.all(conversationId, limit) as MessageRecord[];
      console.log(`🔍 Retrieved ${rows.length} recent messages for conversation: ${conversationId}`);
      
      return rows.reverse(); // Return in chronological order
    } catch (error) {
      console.error(`❌ Error getting recent messages for conversation ${conversationId}:`, error);
      return [];
    }
  }
}
