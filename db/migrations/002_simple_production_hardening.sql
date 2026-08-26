-- Small production hardening: automatic audit timestamps and in-database docs.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE projects ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE valuations ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE inspections ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE map_analyses ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE land_analyses ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE descriptions ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE drafts ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER projects_set_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER valuations_set_updated_at BEFORE UPDATE ON valuations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER inspections_set_updated_at BEFORE UPDATE ON inspections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER map_analyses_set_updated_at BEFORE UPDATE ON map_analyses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER land_analyses_set_updated_at BEFORE UPDATE ON land_analyses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER descriptions_set_updated_at BEFORE UPDATE ON descriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER drafts_set_updated_at BEFORE UPDATE ON drafts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE users IS 'All login accounts and their shared profile fields.';
COMMENT ON TABLE projects IS 'One land valuation project owned by a loan applicant.';
COMMENT ON TABLE valuations IS 'Valuation requests; valuation_id is sequential within each project.';
COMMENT ON TABLE project_files IS 'Documents uploaded for a project.';
COMMENT ON TABLE inspections IS 'Latest technical inspection data for a project.';
COMMENT ON TABLE inspection_files IS 'Original inspection form file for a project.';
COMMENT ON TABLE site_photos IS 'Categorised technical-officer site photographs.';
COMMENT ON TABLE map_analyses IS 'Saved map coordinates and locality/access analysis.';
COMMENT ON TABLE land_analyses IS 'Nearby-land evidence and calculated valuation analysis.';
COMMENT ON TABLE descriptions IS 'Generated and edited report descriptions.';
COMMENT ON TABLE drafts IS 'Valuation report draft, approval state and payment state.';
COMMENT ON TABLE manager_review_activities IS 'Immutable manager approval/rejection history.';
COMMENT ON TABLE messages IS 'Direct messages between registered users.';
COMMENT ON TABLE notifications IS 'In-application notifications for registered users.';
COMMENT ON TABLE to_leaves IS 'Technical-officer leave requests and decisions.';
COMMENT ON COLUMN projects.details IS 'Compatibility copy of the submitted project form as JSON.';
COMMENT ON COLUMN valuations.id IS 'Stable database identity used by the API.';
COMMENT ON COLUMN valuations.valuation_id IS 'Human-facing valuation number, unique within a project.';
COMMENT ON COLUMN valuations.technical_officer_id IS 'Assigned officer; NULL until assigned.';
