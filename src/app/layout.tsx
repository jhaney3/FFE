import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { ProjectProvider } from '@/lib/ProjectContext';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FFE Transition Registry',
  description: 'Manage church inventory during transition via interactive floor plans.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      <body className={`${ibmPlexSans.className} h-screen overflow-hidden flex flex-col bg-gray-950 text-gray-100`}>
        {/* 2px top accent — signature corporate stripe */}
        <div className="no-print h-[2px] w-full bg-blue-500 shrink-0" />
        <ProjectProvider>{children}</ProjectProvider>
      </body>
    </html>
  );
}
