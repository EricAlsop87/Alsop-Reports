-- Migration 00023: Add uploader tracking to upload_history
-- Allows auditing and displaying which user uploaded each data batch in the Upload History reports

ALTER TABLE upload_history 
  ADD COLUMN IF NOT EXISTS uploader_name TEXT,
  ADD COLUMN IF NOT EXISTS uploader_email TEXT;

COMMENT ON COLUMN upload_history.uploader_name IS 'Full name or agent name of the person who uploaded the data batch';
COMMENT ON COLUMN upload_history.uploader_email IS 'Email of the authenticated user who uploaded the data batch';
