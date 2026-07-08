import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';


export const metadata: Metadata = {
  title: 'Trusted Introductions',
  description: 'Private, invite-only community job help through warm introductions.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
