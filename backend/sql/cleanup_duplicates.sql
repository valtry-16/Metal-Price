-- Clean up duplicate entries in metal_prices table
-- This keeps only the most recent entry (by created_at) for each (metal_name, carat, date) combination

-- Step 1: Review duplicates (optional - run this first to see what will be deleted)
SELECT 
  metal_name, 
  carat, 
  date, 
  COUNT(*) as duplicate_count
FROM metal_prices
GROUP BY metal_name, carat, date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, date DESC;

-- Step 2: Delete duplicates, keeping the most recent entry by created_at
DELETE FROM metal_prices
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY metal_name, carat, date 
        ORDER BY created_at DESC
      ) as row_num
    FROM metal_prices
  ) t
  WHERE row_num > 1
);

-- Step 3: Verify cleanup (should return no rows)
SELECT 
  metal_name, 
  carat, 
  date, 
  COUNT(*) as duplicate_count
FROM metal_prices
GROUP BY metal_name, carat, date
HAVING COUNT(*) > 1;
