# Upload storage

All new PDFs, images, and uploaded documents use one private Supabase Storage bucket.

- Supabase stores the original file.
- Neon PostgreSQL stores its object key and metadata.
- Database BLOB and local-directory storage are not used by active file flows.
- Upload and download endpoints require all three `SUPABASE_*` environment variables.

## Setup

1. Create a free project at https://supabase.com/dashboard.
2. Open **Storage**, create a bucket named `land-valuation-private`, and keep it private.
3. Open **Project Settings > API**.
4. Copy the Project URL and the service-role secret into the backend `.env`:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_your_backend_secret
SUPABASE_STORAGE_BUCKET=land-valuation-private
```

The service-role key bypasses Storage policies. It must stay in the backend and must never be committed or exposed to the browser. Restart the backend after changing `.env`.
