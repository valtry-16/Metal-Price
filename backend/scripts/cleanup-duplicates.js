import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase credentials in .env file");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function cleanupDuplicates() {
  console.log("Starting duplicate cleanup...");

  // Step 1: Check for duplicates
  console.log("\n1. Checking for duplicates...");
  const { data: allData, error: fetchError } = await supabase
    .from("metal_prices")
    .select("id, metal_name, carat, date, created_at")
    .order("date", { ascending: false });

  if (fetchError) {
    console.error("Error fetching data:", fetchError);
    process.exit(1);
  }

  console.log(`Total records: ${allData.length}`);

  // Group by metal_name, carat, date
  const groups = new Map();
  for (const row of allData) {
    const key = `${row.metal_name}|${row.carat || "null"}|${row.date}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }

  // Find duplicates
  const duplicates = [];
  let totalDuplicates = 0;
  for (const [key, records] of groups.entries()) {
    if (records.length > 1) {
      duplicates.push({ key, records });
      totalDuplicates += records.length - 1;
    }
  }

  console.log(`Found ${duplicates.length} groups with duplicates`);
  console.log(`Total duplicate records to delete: ${totalDuplicates}`);

  if (duplicates.length === 0) {
    console.log("\nNo duplicates found! Database is clean.");
    return;
  }

  // Show sample duplicates
  console.log("\nSample duplicates (showing first 5):");
  for (let i = 0; i < Math.min(5, duplicates.length); i++) {
    const { key, records } = duplicates[i];
    const [metal, carat, date] = key.split("|");
    console.log(`  - ${metal} (${carat}) on ${date}: ${records.length} entries`);
  }

  // Step 2: Delete duplicates (keep most recent by created_at)
  console.log("\n2. Deleting duplicates...");
  const idsToDelete = [];
  
  for (const { records } of duplicates) {
    // Sort by created_at descending (most recent first)
    records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Keep the first (most recent), delete the rest
    for (let i = 1; i < records.length; i++) {
      idsToDelete.push(records[i].id);
    }
  }

  console.log(`Deleting ${idsToDelete.length} duplicate records...`);

  // Delete in batches of 100 to avoid API limits
  const batchSize = 100;
  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const batch = idsToDelete.slice(i, i + batchSize);
    const { error: deleteError } = await supabase
      .from("metal_prices")
      .delete()
      .in("id", batch);

    if (deleteError) {
      console.error(`Error deleting batch ${i / batchSize + 1}:`, deleteError);
    } else {
      console.log(`Deleted batch ${i / batchSize + 1} (${batch.length} records)`);
    }
  }

  // Step 3: Verify
  console.log("\n3. Verifying cleanup...");
  const { data: verifyData } = await supabase
    .from("metal_prices")
    .select("metal_name, carat, date")
    .order("date", { ascending: false });

  const verifyGroups = new Map();
  for (const row of verifyData) {
    const key = `${row.metal_name}|${row.carat || "null"}|${row.date}`;
    verifyGroups.set(key, (verifyGroups.get(key) || 0) + 1);
  }

  const remainingDuplicates = Array.from(verifyGroups.values()).filter(count => count > 1).length;
  
  if (remainingDuplicates === 0) {
    console.log("✅ Success! No duplicates remaining.");
    console.log(`Total records after cleanup: ${verifyData.length}`);
  } else {
    console.log(`⚠️ Warning: ${remainingDuplicates} duplicate groups still exist.`);
  }
}

cleanupDuplicates()
  .then(() => {
    console.log("\nCleanup completed!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  });
