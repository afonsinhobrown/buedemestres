require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function testActive() {
  const clientId = '11111111-1111-1111-1111-111111111111';
  const { data: reqs, error } = await supabase
    .from('service_requests')
    .select('id, title, category_id, status, budget_max, target_provider_id, created_at')
    .eq('client_id', clientId)
    .in('status', ['open', 'accepted', 'price_proposed', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(3);
    
  console.log('Active requests for client:', reqs, error);

  if (reqs && reqs.length > 0) {
    const req = reqs[0];
    const { data: job } = await supabase
      .from('jobs')
      .select('id, status, price_proposed, agreed_amount, provider_id')
      .or('request_id.eq.' + req.id + ',id.eq.' + req.id)
      .maybeSingle();
    console.log('Associated job:', job);

    const { data: prop } = await supabase
      .from('job_price_proposals')
      .select('*')
      .or('job_id.eq.' + (job ? job.id : req.id))
      .order('created_at', { ascending: false })
      .limit(1);
    console.log('Latest proposal:', prop);
  }
}
testActive();
