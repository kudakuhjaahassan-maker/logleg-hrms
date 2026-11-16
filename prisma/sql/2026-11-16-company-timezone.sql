-- One-time data fix: existing companies were created before the `timezone` column
-- existed, so prisma db push backfilled them with the old default of 'UTC' and their
-- shift times kept being read on the UTC clock. Move them onto the deployment's
-- timezone (Indian/Maldives) without needing an admin to re-save Settings.
--
-- Guarded by a marker row so a company that is deliberately on 'UTC' later is never
-- flipped back on the next deploy. prisma db push leaves tables it does not manage alone.

CREATE TABLE IF NOT EXISTS app_data_migrations (
  name       text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

UPDATE companies
   SET timezone = 'Indian/Maldives',
       "updatedAt" = now()
 WHERE timezone = 'UTC'
   AND NOT EXISTS (
     SELECT 1 FROM app_data_migrations WHERE name = 'company_timezone_indian_maldives'
   );

INSERT INTO app_data_migrations (name)
VALUES ('company_timezone_indian_maldives')
ON CONFLICT (name) DO NOTHING;
