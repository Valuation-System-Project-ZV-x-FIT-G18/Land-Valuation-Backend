-- Admin MVP: safe account lifecycle and an immutable administrative audit trail.
ALTER TABLE users
  ADD COLUMN account_status VARCHAR(20) NOT NULL DEFAULT 'Active',
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN last_login_at TIMESTAMPTZ;

ALTER TABLE users ADD CONSTRAINT users_account_status_valid
  CHECK (account_status IN ('Active', 'Suspended', 'Deactivated'));

CREATE INDEX users_status_role_idx ON users (account_status, role);

CREATE TABLE admin_audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
  action VARCHAR(60) NOT NULL,
  target_user_id VARCHAR(20),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_logs_created_idx ON admin_audit_logs (created_at DESC);
CREATE INDEX admin_audit_logs_target_idx ON admin_audit_logs (target_user_id, created_at DESC);

COMMENT ON COLUMN users.account_status IS 'Active, Suspended, or Deactivated; non-active accounts cannot authenticate.';
COMMENT ON TABLE admin_audit_logs IS 'Append-only record of security-sensitive administrator actions.';
