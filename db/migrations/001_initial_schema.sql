-- Canonical PostgreSQL schema for the Land Valuation System.
-- All DDL belongs in versioned migrations; application services must not create tables.

CREATE SEQUENCE project_seq START WITH 1;

CREATE TABLE contact_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  user_id VARCHAR(20) PRIMARY KEY,
  first_name VARCHAR(60) NOT NULL,
  last_name VARCHAR(60) NOT NULL,
  initials VARCHAR(40) NOT NULL DEFAULT '',
  nic VARCHAR(20) NOT NULL,
  role VARCHAR(40) NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(20) NOT NULL DEFAULT '',
  date_of_birth DATE,
  province VARCHAR(60) NOT NULL DEFAULT '',
  district VARCHAR(60) NOT NULL DEFAULT '',
  city VARCHAR(80) NOT NULL DEFAULT '',
  postal_code VARCHAR(20) NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  photo_path VARCHAR(255) NOT NULL DEFAULT '',
  photo_data BYTEA,
  photo_mime VARCHAR(100) NOT NULL DEFAULT '',
  photo_object_key VARCHAR(1024) NOT NULL DEFAULT '',
  branch_name TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL DEFAULT '',
  designation TEXT NOT NULL DEFAULT '',
  applicant_business_name VARCHAR(150) NOT NULL DEFAULT '',
  CONSTRAINT users_email_required CHECK (btrim(email) <> ''),
  CONSTRAINT users_role_valid CHECK (role IN (
    'Admin', 'Coordinator', 'Technical Officer', 'Manager L1',
    'Manager L2', 'Manager L3', 'Loan Applicant', 'Bank'
  ))
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
CREATE UNIQUE INDEX users_nic_unique ON users (nic);
CREATE INDEX users_role_idx ON users (role);

CREATE TABLE projects (
  project_id VARCHAR(20) PRIMARY KEY DEFAULT ('pro' || lpad(nextval('project_seq')::text, 3, '0')),
  applicant_nic VARCHAR(20) NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  property_type VARCHAR(60) NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(40) NOT NULL DEFAULT 'Submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  property_number TEXT NOT NULL DEFAULT '', street_name TEXT NOT NULL DEFAULT '',
  village_town TEXT NOT NULL DEFAULT '', property_city TEXT NOT NULL DEFAULT '',
  gn_division TEXT NOT NULL DEFAULT '', ds_division TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '', province TEXT NOT NULL DEFAULT '', postal_code TEXT NOT NULL DEFAULT '',
  latitude TEXT NOT NULL DEFAULT '', longitude TEXT NOT NULL DEFAULT '',
  land_traditional_name TEXT NOT NULL DEFAULT '', local_authority_type TEXT NOT NULL DEFAULT '',
  local_authority_name TEXT NOT NULL DEFAULT '', pattu TEXT NOT NULL DEFAULT '', korale TEXT NOT NULL DEFAULT '',
  survey_plan_number TEXT NOT NULL DEFAULT '', survey_plan_date TEXT NOT NULL DEFAULT '',
  surveyor_name TEXT NOT NULL DEFAULT '', surveyor_license_no TEXT NOT NULL DEFAULT '',
  lot_number TEXT NOT NULL DEFAULT '', plan_older_than_10 TEXT NOT NULL DEFAULT '', plan_action_if_old TEXT NOT NULL DEFAULT '',
  extent_acres TEXT NOT NULL DEFAULT '', extent_roods TEXT NOT NULL DEFAULT '', extent_perches TEXT NOT NULL DEFAULT '',
  extent_hectares TEXT NOT NULL DEFAULT '', deed_extent_acres TEXT NOT NULL DEFAULT '',
  deed_extent_roods TEXT NOT NULL DEFAULT '', deed_extent_perches TEXT NOT NULL DEFAULT '',
  deed_extent_hectares TEXT NOT NULL DEFAULT '', extent_as_per_plan TEXT NOT NULL DEFAULT '',
  extent_as_per_deed TEXT NOT NULL DEFAULT '', extents_tally TEXT NOT NULL DEFAULT '',
  deed_type TEXT NOT NULL DEFAULT '', deed_number TEXT NOT NULL DEFAULT '', deed_date TEXT NOT NULL DEFAULT '',
  bank_request_date TEXT NOT NULL DEFAULT '', attorney_name TEXT NOT NULL DEFAULT '',
  notary_no_location TEXT NOT NULL DEFAULT '', owner_name_as_per_deed TEXT NOT NULL DEFAULT '',
  ownership_type TEXT NOT NULL DEFAULT '', land_registry_search_done TEXT NOT NULL DEFAULT '',
  previous_owner_name TEXT NOT NULL DEFAULT '', boundary_north TEXT NOT NULL DEFAULT '',
  boundary_east TEXT NOT NULL DEFAULT '', boundary_south TEXT NOT NULL DEFAULT '', boundary_west TEXT NOT NULL DEFAULT '',
  right_of_way_available TEXT NOT NULL DEFAULT '', right_of_way_from TEXT NOT NULL DEFAULT '',
  assessment_number TEXT NOT NULL DEFAULT '', assessment_letter_date TEXT NOT NULL DEFAULT '',
  assessment_authority TEXT NOT NULL DEFAULT '', street_line_cert_date TEXT NOT NULL DEFAULT '',
  affected_by_street_lines TEXT NOT NULL DEFAULT '', affected_by_building_limits TEXT NOT NULL DEFAULT '',
  dist_from_main_road TEXT NOT NULL DEFAULT '', dist_from_by_road TEXT NOT NULL DEFAULT '',
  plan_approved_by_la TEXT NOT NULL DEFAULT '', plan_approval_ref TEXT NOT NULL DEFAULT '',
  plan_approval_date TEXT NOT NULL DEFAULT '', plan_approval_purpose TEXT NOT NULL DEFAULT '',
  building_plan_approval_no TEXT NOT NULL DEFAULT '', building_plan_approval_date TEXT NOT NULL DEFAULT '',
  coc_provided TEXT NOT NULL DEFAULT '', planning_authority TEXT NOT NULL DEFAULT '',
  rent_control_affected TEXT NOT NULL DEFAULT '', max_plot_coverage TEXT NOT NULL DEFAULT '',
  plot_coverage_property TEXT NOT NULL DEFAULT '', bank_name TEXT NOT NULL DEFAULT '', bank_email TEXT NOT NULL DEFAULT ''
);
CREATE INDEX projects_applicant_idx ON projects (applicant_nic);
CREATE INDEX projects_status_created_idx ON projects (status, created_at DESC);

CREATE TABLE project_files (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id VARCHAR(20) NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  file_type VARCHAR(60) NOT NULL, file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(255) NOT NULL DEFAULT '', mime VARCHAR(100) NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0 CHECK (size >= 0), file_data BYTEA,
  object_key VARCHAR(1024) NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX project_files_project_idx ON project_files (project_id);

CREATE TABLE valuations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  valuation_id INTEGER NOT NULL CHECK (valuation_id > 0),
  project_id VARCHAR(20) NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  applicant_nic VARCHAR(20) NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_letter_path VARCHAR(255) NOT NULL DEFAULT '', request_letter_name VARCHAR(255) NOT NULL DEFAULT '',
  request_letter_mime VARCHAR(100) NOT NULL DEFAULT '', request_letter_data BYTEA,
  request_letter_object_key VARCHAR(1024) NOT NULL DEFAULT '', status VARCHAR(40) NOT NULL DEFAULT 'Created',
  technical_officer_id VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
  assigned_date DATE, assigned_time TIME, rejection_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valuations_project_no_unique UNIQUE (project_id, valuation_id)
);
CREATE INDEX valuations_project_created_idx ON valuations (project_id, created_at DESC);
CREATE INDEX valuations_officer_status_idx ON valuations (technical_officer_id, status);

CREATE TABLE to_leaves (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  to_id VARCHAR(20) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '', leave_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'Approved', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT to_leaves_status_valid CHECK (status IN ('Pending', 'Approved', 'Rejected'))
);
CREATE INDEX to_leaves_to_id_idx ON to_leaves (to_id);
CREATE UNIQUE INDEX to_leaves_officer_date_unique ON to_leaves (to_id, leave_date) WHERE leave_date IS NOT NULL;

CREATE TABLE messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender_id VARCHAR(20) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  recipient_id VARCHAR(20) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '', file_name VARCHAR(255) NOT NULL DEFAULT '',
  file_path VARCHAR(255) NOT NULL DEFAULT '', file_mime VARCHAR(100) NOT NULL DEFAULT '',
  file_data BYTEA, object_key VARCHAR(1024) NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_pair_idx ON messages (sender_id, recipient_id, created_at DESC);

CREATE TABLE notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  message TEXT NOT NULL, read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE applicant_project_details (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  applicant_nic VARCHAR(20) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL DEFAULT '', status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX applicant_project_details_nic_idx ON applicant_project_details (applicant_nic, created_at DESC);

CREATE TABLE applicant_project_detail_files (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  draft_id BIGINT NOT NULL REFERENCES applicant_project_details(id) ON DELETE CASCADE,
  doc_type VARCHAR(60) NOT NULL, file_name VARCHAR(255) NOT NULL DEFAULT '',
  file_path VARCHAR(255) NOT NULL DEFAULT '', file_mime VARCHAR(100) NOT NULL DEFAULT '',
  file_data BYTEA, object_key VARCHAR(1024) NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (draft_id, doc_type)
);

CREATE TABLE applicant_documents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  applicant_nic VARCHAR(20) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  project_id VARCHAR(20) NOT NULL DEFAULT '', doc_type VARCHAR(60) NOT NULL,
  file_name VARCHAR(255) NOT NULL DEFAULT '', file_path VARCHAR(255) NOT NULL DEFAULT '',
  file_mime VARCHAR(100) NOT NULL DEFAULT '', file_data BYTEA, object_key VARCHAR(1024) NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'Submitted', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT applicant_documents_nic_project_doc_key UNIQUE (applicant_nic, project_id, doc_type)
);

CREATE TABLE inspections (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id VARCHAR(20) NOT NULL UNIQUE REFERENCES projects(project_id) ON DELETE CASCADE,
  to_id VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb, status VARCHAR(30) NOT NULL DEFAULT 'Completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE inspection_files (
  project_id VARCHAR(20) PRIMARY KEY REFERENCES projects(project_id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL, file_mime VARCHAR(100) NOT NULL DEFAULT '',
  file_data BYTEA, object_key VARCHAR(1024) NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE site_photos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id VARCHAR(20) NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  to_id VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
  photo_type VARCHAR(60) NOT NULL, file_name VARCHAR(255) NOT NULL DEFAULT '',
  file_path VARCHAR(255) NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
  file_mime VARCHAR(100) NOT NULL DEFAULT '', file_data BYTEA, object_key VARCHAR(1024) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (project_id, photo_type)
);

CREATE TABLE map_analyses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id VARCHAR(20) NOT NULL UNIQUE REFERENCES projects(project_id) ON DELETE CASCADE,
  lat DOUBLE PRECISION CHECK (lat BETWEEN -90 AND 90), lng DOUBLE PRECISION CHECK (lng BETWEEN -180 AND 180),
  access_description TEXT, locality_description TEXT,
  access_sources JSONB NOT NULL DEFAULT '[]'::jsonb, locality_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE land_analyses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id VARCHAR(20) NOT NULL UNIQUE REFERENCES projects(project_id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE descriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id VARCHAR(20) NOT NULL UNIQUE REFERENCES projects(project_id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE drafts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id VARCHAR(20) NOT NULL UNIQUE REFERENCES projects(project_id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb, review_status VARCHAR(40) NOT NULL DEFAULT 'draft',
  reject_reason TEXT NOT NULL DEFAULT '', paid BOOLEAN NOT NULL DEFAULT false, paid_at TIMESTAMPTZ,
  payment_ref VARCHAR(60) NOT NULL DEFAULT '', payment_method VARCHAR(20) NOT NULL DEFAULT '',
  slip_path VARCHAR(255) NOT NULL DEFAULT '', slip_name VARCHAR(255) NOT NULL DEFAULT '',
  slip_mime VARCHAR(100) NOT NULL DEFAULT '', slip_data BYTEA, slip_object_key VARCHAR(1024) NOT NULL DEFAULT '',
  slip_pending BOOLEAN NOT NULL DEFAULT false, report_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (report_price >= 0),
  final_report_object_key VARCHAR(1024) NOT NULL DEFAULT '', final_report_name VARCHAR(255) NOT NULL DEFAULT '',
  final_report_mime VARCHAR(100) NOT NULL DEFAULT '', final_report_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE manager_review_activities (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id VARCHAR(20) NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL DEFAULT '', from_status VARCHAR(40) NOT NULL DEFAULT '',
  to_status VARCHAR(40) NOT NULL, actor_user_id VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
  actor_role VARCHAR(40) NOT NULL, reason TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX manager_review_activities_project_idx ON manager_review_activities (project_id, created_at DESC);
CREATE INDEX manager_review_activities_created_idx ON manager_review_activities (created_at DESC);

CREATE TABLE valuer_profiles (
  user_id VARCHAR(20) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  valuer_name VARCHAR(150) NOT NULL, conflict_of_interest VARCHAR(30) NOT NULL,
  conflict_details TEXT NOT NULL DEFAULT '', professional_qualifications VARCHAR(500) NOT NULL,
  ivsl_registration_number VARCHAR(50) NOT NULL, rics_registration_number VARCHAR(50) NOT NULL DEFAULT '',
  rics_membership VARCHAR(30) NOT NULL DEFAULT '', relevant_experience VARCHAR(30) NOT NULL,
  indemnity_status VARCHAR(30) NOT NULL, indemnity_policy_number VARCHAR(100) NOT NULL DEFAULT '',
  indemnity_expiry_date DATE, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
