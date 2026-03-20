-- Fix: Ensure IncomingPhotos realtime events carry full row data for all clients.
-- REPLICA IDENTITY FULL is required so Supabase Realtime can filter/deliver
-- UPDATE and DELETE events (and ensure INSERT payloads are complete).

ALTER TABLE "IncomingPhotos" REPLICA IDENTITY FULL;

-- If you haven't already run migration_02_realtime.sql, include this too:
-- ALTER PUBLICATION supabase_realtime ADD TABLE "IncomingPhotos";
