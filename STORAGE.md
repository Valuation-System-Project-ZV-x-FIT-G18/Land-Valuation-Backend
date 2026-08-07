# Upload storage

All new PDFs, images, and uploaded documents use hybrid object storage:

- The original file is stored in Cloudflare R2 when the four `R2_*` environment variables are configured.
- With no R2 configuration, development uploads are stored under `uploads/objects/`.
- PostgreSQL stores the object key and metadata; it does not store new file bytes.
- Existing `BYTEA` and legacy disk-path records remain readable during migration.

Create a private R2 bucket and an Object Read & Write API token, then set:

```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=land-valuation-private
```

Do not commit real credentials. Restart the backend after changing `.env`.
