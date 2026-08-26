-- Branch codes are internal identifiers. Generate them centrally so users do
-- not invent or accidentally duplicate codes in the UI.
CREATE SEQUENCE bank_branch_code_seq START WITH 1;
ALTER TABLE bank_branches ALTER COLUMN branch_code
  SET DEFAULT ('BR' || lpad(nextval('bank_branch_code_seq')::text, 6, '0'));

COMMENT ON COLUMN bank_branches.branch_code IS 'System-generated internal code (for example BR000001).';
