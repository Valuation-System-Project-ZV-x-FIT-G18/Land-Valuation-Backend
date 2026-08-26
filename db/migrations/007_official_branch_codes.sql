-- A branch code is assigned by the bank, not by this system.
ALTER TABLE bank_branches ALTER COLUMN branch_code DROP DEFAULT;
DROP SEQUENCE bank_branch_code_seq;

COMMENT ON COLUMN bank_branches.branch_code IS 'Official branch code supplied by the bank.';
