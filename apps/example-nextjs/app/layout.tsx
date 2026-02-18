import './globals.css';
import '@hexos/react-ui/styles.css';

import { Databuddy } from '@databuddy/sdk/react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hexos Demo',
  description: 'Demo application for Hexos React agent library',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Databuddy clientId={process.env.NEXT_PUBLIC_DATABUDDY_CLIENT_ID} />
      </body>
    </html>
  );
}
