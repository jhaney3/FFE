import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Church Inventory Manager',
  description: 'Manage church inventory during transition via interactive floor plans.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} h-screen overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100`}>
        {children}
      </body>
    </html>
  );
}
