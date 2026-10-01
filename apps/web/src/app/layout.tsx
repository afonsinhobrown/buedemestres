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
      <body className="antialiased font-sans text-tinta bg-bg">{children}</body>
    </html>
  );
}
