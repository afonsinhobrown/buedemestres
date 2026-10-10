'use server'

import { db } from '@/lib/db'

export async function createEmergencyRequest(categoryId: number, description: string) {
  const result = await db.query(`
    INSERT INTO service_requests (client_id, category_id, title, description, status, district_id)
    VALUES ('80000000-0000-0000-0000-800000000008', $1, 'Pedido de Emergência Web', $2, 'open', 1)
    RETURNING id
  `, [categoryId, description])
  
  return result.rows[0].id
}

export async function checkRequestStatus(requestId: string) {
  const result = await db.query(`
    SELECT status FROM service_requests WHERE id = $1
  `, [requestId])
  
  return result.rows[0]?.status
}
