import { Archivo, Atkinson_Hyperlegible_Next } from 'next/font/google';
import './globals.css';
import { AdColumn } from '@/components/ads/AdColumn';
import { ads } from '@/lib/ads';

const adsLeft = ads.slice(0, 4);
const adsRight = ads.slice(4, 8);

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
      <body className="antialiased font-sans text-tinta bg-bg">
        <AdColumn items={adsLeft} side="left" />

        <div className="relative z-20">{children}</div>

        <AdColumn items={adsRight} side="right" />
      </body>
    </html>
  );
}
