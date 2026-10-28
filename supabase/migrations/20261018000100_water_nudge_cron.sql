create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Hourly on the hour. Needs a vault secret named service_role_key (see deploy steps).
select cron.schedule(
  'water-nudge-hourly',
  '0 * * * *',
  $$ select net.http_post(
    url := 'https://mvrimyshkrwsjuwyapgw.supabase.co/functions/v1/water-nudge',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'Content-Type', 'application/json'
    )
  ) $$
);
