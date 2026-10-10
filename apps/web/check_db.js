const { Client } = require('pg'); 
const client = new Client({ connectionString: 'postgresql://postgres.mhipgiiwcsuhtsnbpttv:pandorabox5229@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?pgbouncer=true' }); 
client.connect()
  .then(() => client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
  .then(res => { console.log('Tables:', res.rows.map(r => r.table_name)); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
