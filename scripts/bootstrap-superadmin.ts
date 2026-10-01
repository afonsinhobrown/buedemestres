import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const email = process.env.SUPERADMIN_EMAIL;
const password = process.env.SUPERADMIN_INITIAL_PASSWORD;
const fullName = process.env.SUPERADMIN_FULL_NAME ?? 'Superadmin';

async function main() {
  if (!email || !password) throw new Error('Defina SUPERADMIN_EMAIL e SUPERADMIN_INITIAL_PASSWORD');
  if (password.length < 12) throw new Error('A palavra-passe inicial deve ter pelo menos 12 caracteres');

  const admin = createClient(url, key, { auth: { persistSession: false } });

  // 1) obter ou criar o utilizador (nunca imprimir a palavra-passe)
  let userId: string | undefined;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  userId = list?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())?.id;

  if (!userId) {
    console.log('A criar utilizador superadmin...');
    const { data, error } = await admin.auth.admin.createUser({
      email, 
      password, 
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    userId = data.user.id;
  } else {
    console.log('Utilizador já existente. A atribuir permissões...');
  }

  // 2) registar como superadmin
  const { error: upsertError } = await admin.from('staff_profiles').upsert({
    profile_id: userId, 
    staff_role: 'superadmin',
    must_change_password: true, 
    mfa_required: true, 
    is_active: true,
  }, { onConflict: 'profile_id' });

  if (upsertError) throw upsertError;

  const { error: auditError } = await admin.from('audit_logs').insert({
    actor_id: userId, 
    action: 'superadmin.bootstrap', 
    entity: 'staff_profiles', 
    entity_id: userId,
  });

  if (auditError) throw auditError;

  console.log('Superadmin pronto. No primeiro acesso será obrigatório mudar a palavra-passe e activar MFA.');
}

main().catch(console.error);
