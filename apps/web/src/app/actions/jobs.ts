'use server';

import { db } from '@/lib/db';
import { notify } from '@/lib/pusher';
import { redirect } from 'next/navigation';

export async function requestServiceAction(formData: FormData) {
  const providerId = formData.get('providerId') as string;
  const clientName = formData.get('clientName') as string;
  const clientPhone = formData.get('clientPhone') as string;
  const problemDescription = formData.get('problem') as string;
  // Maputo default coordinates for the client
  const lat = -25.9666;
  const lng = 32.5833;

  let jobId = '';

  try {
    await db.transaction(async (client) => {
      // 1. Find or create the client profile
      const profileRes = await client.query(
        `SELECT id FROM profiles WHERE phone = $1 LIMIT 1`,
        [clientPhone]
      );
      
      let clientId;
      if (profileRes.rows.length > 0) {
        clientId = profileRes.rows[0].id;
      } else {
        const newProfile = await client.query(
          `INSERT INTO profiles (full_name, phone, role) VALUES ($1, $2, 'client') RETURNING id`,
          [clientName, clientPhone]
        );
        clientId = newProfile.rows[0].id;
      }

      // 2. Create the job in status 'pending'
      const jobRes = await client.query(
        `INSERT INTO service_jobs (client_id, provider_id, status, client_lat, client_lng) 
         VALUES ($1, $2, 'pending', $3, $4) RETURNING id`,
        [clientId, providerId, lat, lng]
      );
      
      jobId = jobRes.rows[0].id;
    });
  } catch (error) {
    console.error("Error creating job request:", error);
    throw new Error('Falha ao pedir o serviço.');
  }

  // 3. Avisar o mestre em tempo real. Fica fora da transacção: se o Pusher
  //    falhar, o pedido já está criado na base de dados.
  await notify(`provider-${providerId}`, 'new-job-request', {
    jobId,
    clientName,
    problemDescription,
    lat,
    lng
  });

  // Redirect client to their new order
  redirect(`/pedidos/${jobId}`);
}

export async function updateJobStatus(jobId: string, status: string) {
  try {
    await db.query(`UPDATE service_jobs SET status = $1 WHERE id = $2`, [status, jobId]);
    return { success: true };
  } catch (error) {
    console.error("Error updating job status:", error);
    return { error: 'Falha ao atualizar o estado do trabalho.' };
  }
}
