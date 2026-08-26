-- Basic website-enquiry workflow for the Coordinator inbox.
ALTER TABLE contact_messages
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Open',
  ADD COLUMN resolved_at TIMESTAMPTZ;

ALTER TABLE contact_messages
  ADD CONSTRAINT contact_messages_status_check
  CHECK (status IN ('Open', 'Resolved'));

CREATE INDEX contact_messages_status_created_idx
  ON contact_messages (status, created_at DESC);
