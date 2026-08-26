# Database architecture

PostgreSQL schema changes are managed only through immutable, versioned files in
`db/migrations`. Application services read and write data; they must not be used
as the source of truth for table creation.

## Commands

```bash
npm run db:migrate  # apply pending migrations transactionally
npm run db:check    # verify migrations, constraints and key foreign keys
npm run db:seed     # create the development admin account (optional)
npm run db:wipe     # remove application data; preserve schema and migration history
npm run db:reset    # destructive: rebuild public schema and apply all migrations
```

Destructive commands require the explicit `--confirm` flag internally. Migration
checksums prevent an already-applied migration from being edited silently. Add a
new numbered SQL file for every future schema change.

## Core relationships

```text
users
├── projects
│   ├── project_files
│   ├── valuations
│   ├── inspections ── inspection_files
│   ├── site_photos
│   ├── map_analyses
│   ├── land_analyses
│   ├── descriptions
│   └── drafts ── manager_review_activities
├── applicant_project_details ── applicant_project_detail_files
├── applicant_documents
├── messages
├── notifications
├── to_leaves
└── valuer_profiles
```

`users.user_id` is the stable account identifier. A loan applicant currently uses
their NIC as `user_id`, so project and valuation applicant IDs are enforced as
foreign keys. Project IDs come from `project_seq`; valuations use an identity key
plus a unique per-project valuation number.

Workflow data uses typed relational columns and foreign keys. Evolving form
payloads remain in JSONB or compatibility text columns so optional empty frontend
values continue to work. Convert those raw answers to stricter domain types in a
later migration after request DTOs normalize empty strings to `NULL`.

`applicant_documents.project_id` intentionally permits the empty pre-project
bucket used immediately after applicant registration. Once that workflow is
changed to create a project first, migrate this column to a nullable foreign key.

## Simple table guide

| Area | Tables | Purpose |
|---|---|---|
| Accounts | `users`, `valuer_profiles` | Login accounts and valuer-specific profiles |
| Project | `projects`, `project_files` | Land/project form and its documents |
| Valuation | `valuations`, `to_leaves` | Requests, officer assignment and availability |
| Field work | `inspections`, `inspection_files`, `site_photos`, `map_analyses`, `land_analyses` | Technical evidence collected for the land |
| Report | `descriptions`, `drafts`, `manager_review_activities` | Report content, approval and payment workflow |
| Applicant | `applicant_project_details`, `applicant_project_detail_files`, `applicant_documents` | Applicant drafts and uploads |
| Communication | `messages`, `notifications`, `contact_messages` | User and public communication |
| System | `schema_migrations` | Applied migration history and checksums |

Frequently edited business tables have automatic `updated_at` timestamps. Table
and important-column descriptions are also stored in PostgreSQL through `COMMENT`
statements, so database tools can display their purpose without reading the code.
