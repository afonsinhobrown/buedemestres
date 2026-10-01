'use server';

import { db } from '@/lib/db';
import { redirect } from 'next/navigation';

export async function registerProviderAction(formData: FormData) {
  const fullName = formData.get('fullName') as string;
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string;
  const businessName = formData.get('businessName') as string;
  const headline = formData.get('headline') as string;
  const categoryId = parseInt(formData.get('categoryId') as string, 10);
  const districtId = parseInt(formData.get('districtId') as string, 10);
  const address = formData.get('address') as string;
  // Fallback maputo coords for demo
  const lat = -25.9666; 
  const lng = 32.5833;

  // Generate a basic slug
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Math.floor(Math.random() * 1000);

  try {
    await db.transaction(async (client) => {
      // 1. Create profile
      const profileRes = await client.query(
        `INSERT INTO profiles (full_name, email, phone, role) VALUES ($1, $2, $3, 'provider') RETURNING id`,
        [fullName, email, phone]
      );
      const profileId = profileRes.rows[0].id;

      // 2. Create provider profile
      await client.query(
        `INSERT INTO provider_profiles (profile_id, slug, business_name, headline, primary_category_id, district_id, address, lat, lng, is_published, verification)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, 'approved')`,
        [profileId, slug, businessName, headline, categoryId, districtId, address, lat, lng]
      );

      // 3. Create wallet
      await client.query(
        `INSERT INTO wallets (profile_id, balance) VALUES ($1, 0)`,
        [profileId]
      );
    });
  } catch (error) {
    console.error("Error registering provider:", error);
    // Normally we'd return an error to the UI here, but for simplicity let's just log and redirect back or throw
    throw new Error('Falha no registo. Verifique se o email já existe.');
  }

  // Redirect to the new profile page!
  redirect(`/mestre/${slug}`);
}
