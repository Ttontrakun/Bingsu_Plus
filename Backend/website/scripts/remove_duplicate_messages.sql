-- Remove duplicate messages from ChatMessage table
-- This script removes duplicate messages that have the same:
-- - chatId
-- - userId
-- - message content
-- - createdAt within 1 second
-- Keeps only the first message (lowest id)

-- Step 1: View duplicate messages (for verification)
-- Uncomment to see duplicates before deleting:
-- SELECT 
--   chatId,
--   userId,
--   message,
--   COUNT(*) as duplicate_count,
--   MIN(id) as keep_id,
--   ARRAY_AGG(id ORDER BY id) as all_ids
-- FROM "ChatMessage"
-- GROUP BY chatId, userId, message, DATE_TRUNC('second', "createdAt")
-- HAVING COUNT(*) > 1
-- ORDER BY chatId, MIN(id);

-- Step 2: Delete duplicate messages (keeps the one with lowest id)
DELETE FROM "ChatMessage"
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY chatId, userId, message, DATE_TRUNC('second', "createdAt")
        ORDER BY id ASC
      ) as row_num
    FROM "ChatMessage"
  ) t
  WHERE row_num > 1
);

-- Step 3: Verify deletion (should return 0 rows)
-- SELECT 
--   chatId,
--   userId,
--   message,
--   COUNT(*) as duplicate_count
-- FROM "ChatMessage"
-- GROUP BY chatId, userId, message, DATE_TRUNC('second', "createdAt")
-- HAVING COUNT(*) > 1;
