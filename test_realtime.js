require('dotenv').config({ path: 'apps/pro/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

console.log('A iniciar escuta do Supabase Realtime...');

const channel = supabase
  .channel('test_pro_requests')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'service_requests' },
    (payload) => {
      console.log('🚨 RECEBIDO EVENTO REALTIME!', payload.new);
    }
  )
  .subscribe((status) => {
    console.log('Estado da subscrição:', status);
    
    if (status === 'SUBSCRIBED') {
      console.log('A simular o pedido do cliente...');
      // Agora insere um pedido para ver se nós mesmos o recebemos
      setTimeout(async () => {
         const { error } = await supabase.from('service_requests').insert({
            client_id: '11111111-1111-1111-1111-111111111111',
            title: 'Teste Realtime',
            description: 'Teste',
            category_id: 1,
            mode: 'on_demand',
            search_radius_m: 5000
         });
         if (error) console.error('Erro a inserir:', error);
         else console.log('Pedido inserido com sucesso na base de dados! Aguardando o eco Realtime...');
      }, 1500);
    }
  });

// Fechar após 10 segundos
setTimeout(() => {
  console.log('Fim do teste.');
  process.exit(0);
}, 10000);
