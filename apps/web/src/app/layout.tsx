import { Archivo, Atkinson_Hyperlegible_Next } from 'next/font/google';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-archivo',
  axes: ['wdth'], // Habilita eixos variáveis (width)
});

const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-atkinson',
});

export const metadata = {
  title: 'Bué de Mestres',
  description: 'Precisas de um mestre? Bué deles, no teu bairro.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-PT" className={`${archivo.variable} ${atkinson.variable}`}>
      <body className="antialiased font-sans text-tinta bg-bg relative">
        
        {/* Publicidade Esquerda */}
        <aside className="hidden 2xl:flex flex-col gap-6 fixed left-4 top-24 bottom-4 w-[240px] z-10 overflow-hidden">
          <div className="rounded-lg h-1/2 overflow-hidden shadow-md group cursor-pointer relative">
            <img src="/ads/1.jpeg" alt="Publicidade 1" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute top-2 left-2 text-[9px] uppercase tracking-widest bg-black/60 backdrop-blur-sm text-white font-bold py-1 px-2 rounded">Anúncio</div>
          </div>
          
          <div className="rounded-lg h-1/2 overflow-hidden shadow-md group cursor-pointer relative">
            <img src="/ads/2.jpeg" alt="Publicidade 2" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute top-2 left-2 text-[9px] uppercase tracking-widest bg-black/60 backdrop-blur-sm text-white font-bold py-1 px-2 rounded">Patrocinado</div>
          </div>
        </aside>

        {/* Conteúdo Principal */}
        <div className="relative z-20">
          {children}
        </div>

        {/* Publicidade Direita */}
        <aside className="hidden 2xl:flex flex-col gap-6 fixed right-4 top-24 bottom-4 w-[240px] z-10 overflow-hidden">
          <div className="rounded-lg h-1/2 overflow-hidden shadow-md group cursor-pointer relative">
            <img src="/ads/3.jpeg" alt="Publicidade 3" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute top-2 right-2 text-[9px] uppercase tracking-widest bg-black/60 backdrop-blur-sm text-white font-bold py-1 px-2 rounded">Anúncio</div>
          </div>
          
          <div className="rounded-lg h-1/2 overflow-hidden shadow-md group cursor-pointer relative">
            <img src="/ads/5.jpeg" alt="Publicidade 4" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute top-2 right-2 text-[9px] uppercase tracking-widest bg-black/60 backdrop-blur-sm text-white font-bold py-1 px-2 rounded">Publicidade</div>
          </div>
        </aside>

      </body>
    </html>
  );
}
