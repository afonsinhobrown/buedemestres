import React from 'react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import RequestServiceModal from '@/components/RequestServiceModal';

export const dynamic = 'force-dynamic';

export default async function MestreProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const res = await db.query(`
    SELECT pp.*, 
           c.name as category_name,
           d.name as district_name
    FROM provider_profiles pp
    LEFT JOIN categories c ON pp.primary_category_id = c.id
    LEFT JOIN districts d ON pp.district_id = d.id
    WHERE pp.slug = $1
  `, [slug]);

  const provider = res.rows[0];

  if (!provider) {
    notFound();
  }

  // Determine color based on category
  let colorClass = 'pb';
  if (provider.category_name?.toLowerCase().includes('explica')) colorClass = 'py';
  if (provider.category_name?.toLowerCase().includes('carpint')) colorClass = 'po';
  if (provider.category_name?.toLowerCase().includes('pedre')) colorClass = 'pp';

  return (
    <div className="bg-bg min-h-screen pb-12">
      <nav className="nav" style={{ background: 'rgba(252,250,248,0.85)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Link href="/" className="placa pb sm" style={{ transform: 'none' }}>Bué de Mestres</Link>
        <span className="sp"></span>
        <Link href="/resultados">Procurar</Link>
        <Link href="/registo" className="btn b1 s">Criar a minha placa</Link>
      </nav>

      <div className="max-w-[800px] mx-auto mt-8 px-4">
        <Link href="/resultados" className="text-[#2444C8] hover:underline mb-4 inline-block font-bold">
          &larr; Voltar à Pesquisa
        </Link>
        
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-8">
            <div className={`placa ${colorClass} mb-6`} style={{ transform: 'rotate(-1deg)', display: 'inline-block' }}>
              {provider.category_name}
            </div>
            
            <h1 className="h1 mb-2" style={{ fontSize: '2.5rem' }}>{provider.business_name}</h1>
            <p className="text-xl text-gray-700 mb-4">{provider.headline}</p>

            <div className="flex gap-6 mb-8 text-sm text-gray-600">
              <div className="rt"><b>{provider.rating_avg}</b><span>{provider.rating_count} avaliações</span></div>
              <div className="flex items-center gap-1">📍 {provider.district_name}, {provider.address}</div>
              {provider.verification === 'approved' && (
                <div className="text-green-700 font-bold flex items-center gap-1">
                  ✓ Perfil Verificado
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <a href={`https://wa.me/${provider.whatsapp?.replace(/[^0-9]/g, '')}`} target="_blank" className="btn b2 flex-1 text-center py-3">WhatsApp</a>
              <RequestServiceModal providerId={provider.profile_id} providerName={provider.business_name} />
            </div>
          </div>
          
          <div className="border-t border-gray-100 p-8 bg-gray-50">
            <h2 className="h2 mb-4 text-xl">Sobre o Mestre</h2>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {provider.bio || "Este profissional ainda não adicionou uma descrição detalhada."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
