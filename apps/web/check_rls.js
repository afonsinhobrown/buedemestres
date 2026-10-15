const { Client } = require('pg'); 
const client = new Client({ connectionString: 'postgresql://postgres.mhipgiiwcsuhtsnbpttv:pandorabox5229@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?pgbouncer=true' }); 
client.connect()
  .then(() => client.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('jobs', 'service_requests')"))
  .then(res => { console.log(res.rows); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
