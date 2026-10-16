const { createClient } = require('@supabase/supabase-js');
const url = 'https://mhipgiiwcsuhtsnbpttv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oaXBnaWl3Y3N1aHRzbmJwdHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTIwODAsImV4cCI6MjEwNjc2ODA4MH0.U6hNtWFzjMc1NXndSJurHDtSTTIFhrPlnHgGswJrUQs';
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
