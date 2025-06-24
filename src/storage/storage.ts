import { Message } from '@microsoft/teams.ai';
import Database from 'better-sqlite3';

// SQLite-based KV store implementation
export class SqliteKVStore {
  private db: Database.Database;

  constructor(dbPath: string = './src/storage/conversations.db') {
    this.db = new Database(dbPath);
    this.initializeDatabase();
    console.log(`🗄️ SQLite KV store initialized at: ${dbPath}`);
  }

  private initializeDatabase(): void {
    // Create table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create trigger to update timestamp
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
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO conversations (key, value, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run(key, JSON.stringify(value));
      console.log(`💾 Saved ${value.length} messages to SQLite for key: ${key}`);
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
      const stmt = this.db.prepare('DELETE FROM conversations WHERE key = ?');
      const result = stmt.run(key);
      
      if (result.changes > 0) {
        console.log(`🧹 Cleared conversation history for key: ${key}`);
      } else {
        console.log(`📂 No conversation found to clear for key: ${key}`);
      }
    } catch (error) {
      console.error(`❌ Error clearing conversation for key ${key}:`, error);
    }
  }
}
