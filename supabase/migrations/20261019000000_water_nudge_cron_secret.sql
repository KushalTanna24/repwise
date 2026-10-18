-- Re-point the hourly job at a dedicated vault secret named cron_secret (same value as the function's CRON_SECRET).
-- cron.schedule with an existing name replaces that job.
select cron.schedule(
  'water-nudge-hourly',
  '0 * * * *',
  $$ select net.http_post(
    url := 'https://mvrimyshkrwsjuwyapgw.supabase.co/functions/v1/water-nudge',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    )
  ) $$
);
