import React from 'react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { registerProviderAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function RegistoPage() {
  const catsRes = await db.query('SELECT id, name FROM categories WHERE parent_id IS NOT NULL ORDER BY name');
  const distsRes = await db.query('SELECT id, name FROM districts ORDER BY name');

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center py-12 px-4">
      <Link href="/" className="placa pb mb-8" style={{ transform: 'rotate(-2deg)' }}>
        Bué de Mestres
      </Link>
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-xl">
        <h1 className="h2 mb-2">Criar a minha placa</h1>
        <p className="mb-6 mut">Preencha os dados reais para se registar na base de dados Neon e aparecer no mapa.</p>
        
        <form action={registerProviderAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="lbl font-bold" htmlFor="fullName">Nome Completo</label>
            <input className="inp" id="fullName" name="fullName" required placeholder="Ex: João Silva" />
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col gap-2 flex-1">
              <label className="lbl font-bold" htmlFor="email">E-mail</label>
              <input className="inp" id="email" name="email" type="email" required placeholder="joao@email.com" />
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <label className="lbl font-bold" htmlFor="phone">Telemóvel (WhatsApp)</label>
              <input className="inp" id="phone" name="phone" required placeholder="84..." />
            </div>
          </div>

          <hr className="my-4" />

          <div className="flex flex-col gap-2">
            <label className="lbl font-bold" htmlFor="businessName">Nome do Negócio (A sua "Placa")</label>
            <input className="inp" id="businessName" name="businessName" required placeholder="Ex: Oficina João Silva" />
          </div>

          <div className="flex flex-col gap-2">
            <label className="lbl font-bold" htmlFor="headline">Especialidade / Título Breve</label>
            <input className="inp" id="headline" name="headline" required placeholder="Ex: Pintura auto e bate-chapa" />
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col gap-2 flex-1">
              <label className="lbl font-bold" htmlFor="categoryId">Categoria Principal</label>
              <select className="inp" id="categoryId" name="categoryId" required>
                <option value="">-- Selecione --</option>
                {catsRes.rows.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <label className="lbl font-bold" htmlFor="districtId">Distrito / Cidade</label>
              <select className="inp" id="districtId" name="districtId" required>
                <option value="">-- Selecione --</option>
                {distsRes.rows.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="lbl font-bold" htmlFor="address">Bairro / Rua</label>
            <input className="inp" id="address" name="address" required placeholder="Ex: Bairro Central, Av. Agostinho Neto" />
          </div>

          <button type="submit" className="btn b1 mt-4 text-center">
            Registar e Aparecer no Mapa
          </button>
        </form>
      </div>
    </div>
  );
}
