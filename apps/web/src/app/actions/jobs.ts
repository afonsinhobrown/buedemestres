'use server';

import { db } from '@/lib/db';
import { notify } from '@/lib/pusher';
import { getOptionalSession } from '@/lib/session';
import { canTransitionJob } from '@/lib/job-flow';
import { redirect } from 'next/navigation';

// Ponto por omissão (Maputo) enquanto o formulário web não recolhe GPS.
const DEFAULT_LAT = -25.9666;
const DEFAULT_LNG = 32.5833;

export async function requestServiceAction(formData: FormData) {
  const providerId = formData.get('providerId') as string;
  const clientName = formData.get('clientName') as string;
  const clientPhone = formData.get('clientPhone') as string;
  const problemDescription = formData.get('problem') as string;

  const session = await getOptionalSession();

  let requestId = '';

  try {
    await db.transaction(async (client) => {
      // 1. Resolver o cliente: sessão web ou perfil pelo telefone.
      let clientId = session?.userId;

      if (!clientId) {
        const profileRes = await client.query(
          `SELECT id FROM profiles WHERE phone = $1 LIMIT 1`,
          [clientPhone]
        );

        if (profileRes.rows.length > 0) {
          clientId = profileRes.rows[0].id;
        } else {
          const newProfile = await client.query(
            `INSERT INTO profiles (full_name, phone, role) VALUES ($1, $2, 'client') RETURNING id`,
            [clientName, clientPhone]
          );
          clientId = newProfile.rows[0].id;
        }
      }

      // 2. Descobrir a categoria do mestre para o pedido.
      const providerRes = await client.query(
        `SELECT pp.primary_category_id, c.name AS category_name
           FROM provider_profiles pp
           LEFT JOIN categories c ON c.id = pp.primary_category_id
          WHERE pp.profile_id = $1`,
        [providerId]
      );
      const provider = providerRes.rows[0];

      if (!provider?.primary_category_id) {
        throw new Error('Mestre sem categoria definida.');
      }

      const title = `${provider.category_name || 'Serviço'} - pedido direto`.slice(0, 100);

      // 3. Criar o pedido no fluxo atual (service_requests), que as apps
      //    cliente/mestre e o tracker web já consomem.
      const requestRes = await client.query(
        `INSERT INTO service_requests
           (client_id, category_id, title, description, status, target_provider_id, location)
         VALUES ($1, $2, $3, $4, 'open', $5,
                 ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography)
         RETURNING id`,
        [
          clientId,
          provider.primary_category_id,
          title,
          problemDescription || 'Pedido de serviço',
          providerId,
          DEFAULT_LNG,
          DEFAULT_LAT,
        ]
      );

      requestId = requestRes.rows[0].id;

      // 4. Notificação persistente para o mestre.
      await client.query(
        `INSERT INTO notifications (profile_id, type, title, body, data)
         VALUES ($1, 'new_request', 'Novo pedido de serviço', $2, $3::jsonb)`,
        [
          providerId,
          `${clientName} pediu: ${problemDescription || 'serviço directo'}`,
          JSON.stringify({ requestId, clientName, clientPhone }),
        ]
      );
    });
  } catch (error) {
    console.error('Error creating service request:', error);
    throw new Error('Falha ao pedir o serviço.');
  }

  // Aviso em tempo real fica fora da transacção: se o Pusher falhar,
  // o pedido já está criado na base de dados.
  await notify(`provider-${providerId}`, 'new-job-request', {
    requestId,
    clientName,
    problemDescription,
    lat: DEFAULT_LAT,
    lng: DEFAULT_LNG,
  });

  redirect(`/pedidos/${requestId}`);
}

export async function updateJobStatus(jobId: string, status: string) {
  const session = await getOptionalSession();

  if (!session?.userId) {
    return { error: 'Não autenticado.' };
  }

  // O mestre termina o trabalho; a confirmação final é do cliente para
  // libertar o pagamento em escrow.
  const nextStatus = status === 'completed' ? 'awaiting_confirmation' : status;

  try {
    return await db.transaction(async (client) => {
      const { rows } = await client.query(
        `SELECT status, request_id, client_id
           FROM jobs
          WHERE id = $1 AND provider_id = $2
          FOR UPDATE`,
        [jobId, session.userId]
      );
      const job = rows[0];

      if (!job) {
        return { error: 'Trabalho não encontrado.' };
      }

      if (!canTransitionJob(job.status, nextStatus)) {
        return { error: 'Transição de estado inválida.' };
      }

      await client.query(
        `UPDATE jobs
            SET status = $1::job_status,
                completed_at = CASE WHEN $1 = 'completed' THEN now() ELSE completed_at END,
                updated_at = now()
          WHERE id = $2`,
        [nextStatus, jobId]
      );

      if (job.request_id && ['awaiting_confirmation', 'completed'].includes(nextStatus)) {
        await client.query(
          `UPDATE service_requests
              SET status = $1::request_status, updated_at = now()
            WHERE id = $2`,
          [nextStatus === 'completed' ? 'completed' : 'in_progress', job.request_id]
        );
      }

      if (nextStatus === 'awaiting_confirmation' && job.client_id) {
        await client.query(
          `INSERT INTO notifications (profile_id, type, title, body, data)
           VALUES ($1, 'service_finished', 'Serviço concluído', $2, $3::jsonb)`,
          [
            job.client_id,
            'O mestre terminou o serviço. Confirma a conclusão para libertar o pagamento.',
            JSON.stringify({ jobId, requestId: job.request_id }),
          ]
        );
      }

      return { success: true };
    });
  } catch (error) {
    console.error('Error updating job status:', error);
    return { error: 'Falha ao atualizar o estado do trabalho.' };
  }
}
