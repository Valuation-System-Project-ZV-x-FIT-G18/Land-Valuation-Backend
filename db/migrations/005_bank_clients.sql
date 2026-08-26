-- Banks are client organizations, not user roles. Branches and contacts have
-- their own lifecycle and can be reused by many valuation jobs.
CREATE TABLE bank_organizations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bank_organizations_name_unique ON bank_organizations (lower(name));

CREATE TABLE bank_branches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bank_id BIGINT NOT NULL REFERENCES bank_organizations(id) ON DELETE RESTRICT,
  branch_code VARCHAR(30) NOT NULL,
  branch_name VARCHAR(120) NOT NULL,
  city VARCHAR(80) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bank_branches_code_unique ON bank_branches (bank_id, lower(branch_code));

CREATE TABLE bank_contacts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES bank_branches(id) ON DELETE CASCADE,
  full_name VARCHAR(120) NOT NULL,
  designation VARCHAR(100) NOT NULL DEFAULT '',
  email VARCHAR(254) NOT NULL DEFAULT '',
  phone VARCHAR(20) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bank_contacts_branch_idx ON bank_contacts (branch_id);

COMMENT ON TABLE bank_organizations IS 'Bank client organizations; independent from portal user accounts.';
COMMENT ON TABLE bank_branches IS 'Reusable branches belonging to a bank client.';
COMMENT ON TABLE bank_contacts IS 'Operational contacts; portal access can be provisioned separately.';
