/**
 * Migrate tracked_tokens table to new schema
 * Run: npx tsx migrate-tracked-tokens.ts
 */

import "dotenv/config";
import { getDb } from "./src/db/client.js";

const db = getDb();

console.log("Migrating tracked_tokens table...");

// Drop old table and recreate with new schema
db.exec(`
  DROP TABLE IF EXISTS tracked_tokens;
  
  CREATE TABLE tracked_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coin_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    added_by TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    UNIQUE(coin_id, added_by)
  );
  
  CREATE INDEX idx_tracked_tokens_symbol ON tracked_tokens(symbol);
  CREATE INDEX idx_tracked_tokens_active ON tracked_tokens(is_active) WHERE is_active = 1;
  CREATE INDEX idx_tracked_tokens_user ON tracked_tokens(added_by);
`);

console.log("✓ Migration complete");
console.log("\nRun the workers to seed default tokens:");
console.log("  npm run dev");
