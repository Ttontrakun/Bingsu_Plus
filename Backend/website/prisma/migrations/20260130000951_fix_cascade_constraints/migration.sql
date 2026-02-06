-- Fix CASCADE constraints for foreign keys
-- This ensures that when a User is deleted, related records are also deleted

-- Drop existing foreign key constraints
ALTER TABLE "Credential" DROP CONSTRAINT IF EXISTS "Credential_userId_fkey";
ALTER TABLE "ChatUser" DROP CONSTRAINT IF EXISTS "ChatUser_userId_fkey";
ALTER TABLE "ChatMessage" DROP CONSTRAINT IF EXISTS "ChatMessage_userId_fkey";

-- Recreate with CASCADE
ALTER TABLE "Credential" 
  ADD CONSTRAINT "Credential_userId_fkey" 
  FOREIGN KEY ("userId") 
  REFERENCES "User"("id") 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

ALTER TABLE "ChatUser" 
  ADD CONSTRAINT "ChatUser_userId_fkey" 
  FOREIGN KEY ("userId") 
  REFERENCES "User"("id") 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

ALTER TABLE "ChatMessage" 
  ADD CONSTRAINT "ChatMessage_userId_fkey" 
  FOREIGN KEY ("userId") 
  REFERENCES "User"("id") 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;
