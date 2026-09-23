import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KPR PR Request & Agreement Management',
  description: 'Automasi Pembuatan PR Request dan Agreement Agen KPR 99 Group',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
