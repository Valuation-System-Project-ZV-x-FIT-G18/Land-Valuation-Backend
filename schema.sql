-- Database schema for the Land Valuation System.
-- Run this ONCE on your PostgreSQL database (local or cloud) to create the tables.
--
-- How to run it:
--   psql "<your DATABASE_URL>" -f db/schema.sql
-- or paste the contents into the Neon / Supabase SQL editor and run.

-- Messages from the homepage "Any inquiries" contact form.
CREATE TABLE IF NOT EXISTS contact_messages (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  email       VARCHAR(160) NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  message     TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Submissions from the "Request a Land Valuation" form.
CREATE TABLE IF NOT EXISTS valuation_requests (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  email       VARCHAR(160) NOT NULL,
  nic         VARCHAR(20)  NOT NULL DEFAULT '',
  message     TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Migration: add the NIC column to existing valuation_requests tables.
ALTER TABLE valuation_requests
  ADD COLUMN IF NOT EXISTS nic VARCHAR(20) NOT NULL DEFAULT '';

-- Internal staff users. In future these are added by an admin (not built yet),
-- so for now the table is seeded with a few sample rows below.
-- The user_id is the login ID (e.g. Cor001, TO001, ML1001) and the primary key.
CREATE TABLE IF NOT EXISTS users (
  user_id       VARCHAR(20)  PRIMARY KEY,
  first_name    VARCHAR(60)  NOT NULL,
  last_name     VARCHAR(60)  NOT NULL,
  initials      VARCHAR(40)  NOT NULL DEFAULT '',
  nic           VARCHAR(20)  NOT NULL,
  role          VARCHAR(40)  NOT NULL,
  email         VARCHAR(160) NOT NULL DEFAULT '',
  phone         VARCHAR(20)  NOT NULL DEFAULT '',
  date_of_birth DATE,
  province      VARCHAR(60)  NOT NULL DEFAULT '',
  district      VARCHAR(60)  NOT NULL DEFAULT '',
  city          VARCHAR(80)  NOT NULL DEFAULT '',
  postal_code   VARCHAR(20)  NOT NULL DEFAULT '',
  address       TEXT         NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL DEFAULT ''
);

-- Migration: add the newer columns to existing users tables.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS initials      VARCHAR(40)  NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email         VARCHAR(160) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone         VARCHAR(20)  NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS province      VARCHAR(60)  NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS district      VARCHAR(60)  NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code   VARCHAR(20)  NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS address       TEXT         NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city          VARCHAR(80)  NOT NULL DEFAULT '';
-- Loan applicants get a temporary password by email; they must change it on
-- first login. true = force the change-password screen before the dashboard.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
-- Profile picture, stored in the database (not on disk): photo_data holds the
-- raw image bytes, photo_mime its content type, and photo_path is repurposed
-- as a cache-busting version token (a plain string, not a file path).
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_path VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_data BYTEA;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_mime VARCHAR(100) NOT NULL DEFAULT '';

-- No two accounts (of any role) may share a NIC or email. Blank values are
-- excluded so accounts without one (e.g. a Bank login with no email) don't
-- collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS users_nic_unique ON users (nic) WHERE nic <> '';
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (LOWER(email)) WHERE email <> '';

-- Sample staff rows (ON CONFLICT keeps this safe to run more than once).
-- The password_hash below is bcrypt('Test@123') — FOR TESTING ONLY.
INSERT INTO users (user_id, first_name, last_name, nic, role, password_hash) VALUES
  ('Cor001', 'Nimal',  'Perera',     '199012345678', 'Coordinator',       '$2b$10$fTwlHtzwitWDGxL8nr9vxOozjzlpL5mhPKmeaFH4YNH2PUzlcuV7O'),
  ('TO001',  'Kasun',  'Silva',      '199523456789', 'Technical Officer',  '$2b$10$fTwlHtzwitWDGxL8nr9vxOozjzlpL5mhPKmeaFH4YNH2PUzlcuV7O'),
  ('ML1001', 'Sunil',  'Fernando',   '198534567V',   'Manager L1',         '$2b$10$fTwlHtzwitWDGxL8nr9vxOozjzlpL5mhPKmeaFH4YNH2PUzlcuV7O'),
  ('ML2001', 'Dilani', 'Jayasinghe', '199245678V',   'Manager L2',         '$2b$10$fTwlHtzwitWDGxL8nr9vxOozjzlpL5mhPKmeaFH4YNH2PUzlcuV7O'),
  ('ML3001', 'Roshan', 'Bandara',    '198812345678', 'Manager L3',         '$2b$10$fTwlHtzwitWDGxL8nr9vxOozjzlpL5mhPKmeaFH4YNH2PUzlcuV7O')
ON CONFLICT (user_id) DO NOTHING;

-- Backfill the password for rows created before this column existed.
UPDATE users
  SET password_hash = '$2b$10$fTwlHtzwitWDGxL8nr9vxOozjzlpL5mhPKmeaFH4YNH2PUzlcuV7O'
  WHERE password_hash = '';

-- Land valuation projects. The primary key is a human-readable id like 'pro001',
-- generated automatically from a sequence. All form sections (5-13) are stored
-- in the `details` JSONB column.
CREATE SEQUENCE IF NOT EXISTS project_seq;
CREATE TABLE IF NOT EXISTS projects (
  project_id    VARCHAR(20)  PRIMARY KEY
                  DEFAULT ('pro' || lpad(nextval('project_seq')::text, 3, '0')),
  applicant_nic VARCHAR(20)  NOT NULL,
  property_type VARCHAR(60)  NOT NULL DEFAULT '',
  details       JSONB        NOT NULL DEFAULT '{}',
  status        VARCHAR(40)  NOT NULL DEFAULT 'Submitted',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Every Create Project form field is ALSO stored in its own column for clear,
-- queryable data (the JSONB `details` above is kept as a full backup). The
-- backend auto-creates these on startup too; they are listed here so a database
-- built from this file alone has them.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS property_number             TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS street_name                 TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS village_town                TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gn_division                 TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ds_division                 TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS district                    TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS province                    TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS postal_code                 TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS latitude                    TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS longitude                   TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS land_traditional_name       TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS local_authority_type        TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS local_authority_name        TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pattu                       TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS korale                      TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS survey_plan_number          TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS survey_plan_date            TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS surveyor_name               TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS surveyor_license_no         TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lot_number                  TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan_older_than_10          TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan_action_if_old          TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS extent_acres                TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS extent_roods                TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS extent_perches              TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS extent_hectares             TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS extent_as_per_plan          TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS extent_as_per_deed          TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS extents_tally               TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deed_type                   TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deed_number                 TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deed_date                   TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS attorney_name               TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notary_no_location          TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_name_as_per_deed      TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS land_registry_search_done   TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS previous_owner_name         TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS boundary_north              TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS boundary_east               TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS boundary_south              TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS boundary_west               TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS right_of_way_available      TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS right_of_way_from           TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS assessment_number           TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS assessment_letter_date      TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS assessment_authority        TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS street_line_cert_date       TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS affected_by_street_lines    TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS affected_by_building_limits TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS dist_from_main_road         TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS dist_from_by_road           TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan_approved_by_la         TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan_approval_ref           TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan_approval_date          TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan_approval_purpose       TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS building_plan_approval_no   TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS building_plan_approval_date TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS coc_provided                TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS planning_authority          TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS rent_control_affected       TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS max_plot_coverage           TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS plot_coverage_property      TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS bank_name                   TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS bank_email                  TEXT NOT NULL DEFAULT '';

-- Uploaded documents for a project (one row per file).
CREATE TABLE IF NOT EXISTS project_files (
  id          SERIAL PRIMARY KEY,
  project_id  VARCHAR(20)  NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  file_type   VARCHAR(60)  NOT NULL, -- e.g. surveyPlan, titleDeed
  file_name   VARCHAR(255) NOT NULL,
  file_path   VARCHAR(255) NOT NULL,
  mime        VARCHAR(100) NOT NULL DEFAULT '',
  size        INTEGER      NOT NULL DEFAULT 0,
  file_data   BYTEA,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Migration: project documents are stored in PostgreSQL rather than relying
-- on the server's local filesystem.
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS file_data BYTEA;

-- Valuations raised against a project.
--   id           = surrogate PRIMARY KEY (one row per valuation).
--   valuation_id = the per-project valuation NUMBER: 1 for the first valuation
--                  of a land, 2 for the second, and so on. It shows how many
--                  times a land/project has been valued, so it is NOT globally
--                  unique (only unique within one project).
-- The technical_officer_id references a staff user (users.user_id) once a
-- coordinator assigns the valuation; assigned_date/time hold the site-visit slot
-- and rejection_reason is filled when an officer rejects the assignment.
CREATE TABLE IF NOT EXISTS valuations (
  id                   BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  valuation_id         INTEGER      NOT NULL DEFAULT 0,
  project_id           VARCHAR(20)  NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  applicant_nic        VARCHAR(20)  NOT NULL DEFAULT '',
  details              JSONB        NOT NULL DEFAULT '{}',
  request_letter_path  VARCHAR(255) NOT NULL DEFAULT '',
  status               VARCHAR(40)  NOT NULL DEFAULT 'Created',
  technical_officer_id VARCHAR(20)  NOT NULL DEFAULT '', -- users.user_id of the assigned TO
  assigned_date        VARCHAR(20)  NOT NULL DEFAULT '', -- scheduled site-visit date
  assigned_time        VARCHAR(20)  NOT NULL DEFAULT '', -- scheduled site-visit time
  rejection_reason     TEXT         NOT NULL DEFAULT '', -- set if the TO rejects
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Migration: add the technical-officer columns to an existing valuations table.
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS technical_officer_id VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS assigned_date        VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS assigned_time        VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS rejection_reason     TEXT        NOT NULL DEFAULT '';

-- Migration: upgrade an OLD valuations table (where valuation_id was a 'val001'
-- text primary key) to the new shape above. Safe to run repeatedly.
DO $$
BEGIN
  -- 1) Add the surrogate primary key `id` if it is missing.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'valuations' AND column_name = 'id'
  ) THEN
    ALTER TABLE valuations DROP CONSTRAINT IF EXISTS valuations_pkey;
    ALTER TABLE valuations ADD COLUMN id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY;
  END IF;

  -- 2) Convert valuation_id into a per-project integer counter.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'valuations' AND column_name = 'valuation_id'
      AND data_type <> 'integer'
  ) THEN
    ALTER TABLE valuations ALTER COLUMN valuation_id DROP DEFAULT;
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at, id) AS rn
        FROM valuations
    )
    UPDATE valuations v SET valuation_id = ranked.rn::text
      FROM ranked WHERE ranked.id = v.id;
    ALTER TABLE valuations ALTER COLUMN valuation_id TYPE INTEGER USING valuation_id::integer;
    ALTER TABLE valuations ALTER COLUMN valuation_id SET DEFAULT 0;
  END IF;

  -- 3) One valuation number per project.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valuations_project_no_unique'
  ) THEN
    ALTER TABLE valuations
      ADD CONSTRAINT valuations_project_no_unique UNIQUE (project_id, valuation_id);
  END IF;
END $$;

-- Technical officer leave records (one row per active leave). A technical
-- officer is "on leave" while they have a row here. to_id is the officer's
-- login id (users.user_id, role 'Technical Officer').
CREATE TABLE IF NOT EXISTS to_leaves (
  id         SERIAL PRIMARY KEY,
  to_id      VARCHAR(20) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  reason     TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS to_leaves_to_id_idx ON to_leaves (to_id);

-- Note: technical officers are stored in the shared `users` table with
-- role = 'Technical Officer' (so they can log in). Their fleet/operational data
-- lives in the assignment columns on `valuations` and in `to_leaves` above.
