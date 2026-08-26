-- One counter per account keeps refresh-token revocation simple.
ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
COMMENT ON COLUMN users.session_version IS 'Incremented on logout to revoke existing refresh tokens.';
