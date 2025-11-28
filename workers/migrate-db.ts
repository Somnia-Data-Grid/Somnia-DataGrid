/**
 * Database Migration Script
 * 
 * Runs schema.sql to create any missing tables.
 * Uses DATABASE_PATH from .env
 * 
 * Run: npx tsx migrate-db.ts
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.DATABASE_PATH || "./data/alerts.db";
console.log(`Database path: ${dbPath}`);

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Read and execute schema
const schemaPath = join(__dirname, "src/db/schema.sql");
const schema = readFileSync(schemaPath, "utf-8");

console.log("Running migrations...\n");

try {
  db.exec(schema);
  console.log("✓ Schema applied successfully");
  
  // Show table counts
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all() as { name: string }[];
  
  console.log(`\nTables (${tables.length}):`);
  for (const t of tables) {
    const count = (db.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get() as any).c;
    console.log(`  - ${t.name}: ${count} rows`);
  }
  
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
} finally {
  db.close();
}

console.log("\n✓ Migration complete");
