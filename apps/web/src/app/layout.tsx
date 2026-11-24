import { Archivo, Atkinson_Hyperlegible_Next } from 'next/font/google';
import './globals.css';
import { PushRegister } from '@/components/PushRegister';
import { SiteHeader } from '@/components/layout/SiteHeader';

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
  title: 'BuAc de Mestres',
  description: 'Precisas de um mestre? BuAc deles, no teu bairro.',
  manifest: '/manifest.webmanifest',
};

export const viewport = {
  themeColor: '#12163A',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-PT" className={`${archivo.variable} ${atkinson.variable}`}>
      <body className="antialiased font-sans text-tinta bg-bg">
        <SiteHeader />
        <div className="site-main relative z-20">{children}</div>
        <PushRegister />
      </body>
    </html>
  );
}
