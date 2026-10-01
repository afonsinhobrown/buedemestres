'use server';

import { db } from '@/lib/db';
import { notify } from '@/lib/pusher';

export async function processPaySuitePayment(jobId: string, phone: string, amount: number) {
  try {
    // 1. Send request to PaySuite
    const response = await fetch(process.env.PAYSUITE_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PAYSUITE_API_TOKEN}`
      },
      body: JSON.stringify({
        job_id: jobId,
        customer_phone: phone,
        amount: amount,
        currency: 'MZN',
        reference: `BM-JOB-${jobId.substring(0, 8)}`,
      })
    });

    if (!response.ok) {
      console.error("PaySuite responded with:", await response.text());
      throw new Error('Falha ao comunicar com o PaySuite.');
    }

    // 2. Update Job Status to Escrow & Travel
    await db.query(`
      UPDATE service_jobs 
      SET payment_status = 'held_in_escrow',
          status = 'em_deslocacao'
      WHERE id = $1
    `, [jobId]);

    // 3. Inform Client and Provider via Pusher
    await notify(`job-${jobId}`, 'payment-approved', {
      jobId,
      status: 'em_deslocacao'
    });

    return { success: true };
  } catch (error) {
    console.error("Error processing payment:", error);
    return { success: false, error: 'O pagamento falhou.' };
  }
}
