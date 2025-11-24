/**
 * Database Migration Script
 * 
 * Run with: npm run db:migrate
 */

import "dotenv/config";
import { getDb, closeDb } from "./client.js";

async function migrate() {
  console.log("🗄️  Running database migrations...");
  
  try {
    const db = getDb();
    
    // Schema is auto-applied in getDb(), but we can add version tracking here
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as { name: string }[];
    
    console.log("✅ Tables created:");
    tables.forEach((t) => console.log(`   - ${t.name}`));
    
    // Show indexes
    const indexes = db.prepare(`
      SELECT name, tbl_name FROM sqlite_master 
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
    `).all() as { name: string; tbl_name: string }[];
    
    console.log("\n✅ Indexes created:");
    indexes.forEach((i) => console.log(`   - ${i.name} (on ${i.tbl_name})`));
    
    closeDb();
    console.log("\n🎉 Migration complete!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
