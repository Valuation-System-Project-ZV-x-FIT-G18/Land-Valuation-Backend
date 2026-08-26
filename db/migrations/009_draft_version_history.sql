CREATE TABLE draft_versions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id VARCHAR(20) NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  report_html TEXT NOT NULL,
  event VARCHAR(40) NOT NULL,
  review_status VARCHAR(40) NOT NULL,
  actor_user_id VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
  actor_role VARCHAR(40) NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, version_number)
);

CREATE INDEX draft_versions_project_created_idx ON draft_versions (project_id, created_at DESC);
COMMENT ON TABLE draft_versions IS 'Immutable snapshots of report HTML at submission and every manager review decision.';
