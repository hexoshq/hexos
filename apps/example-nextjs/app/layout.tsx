import './globals.css';
import '@hexos/react-ui/styles.css';

import Head from 'next/head';
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
      <Head>
        <script
          src="https://cdn.databuddy.cc/databuddy.js"
          data-client-id="%DATABUDDY_CLIENT_ID%"
          async
        ></script>
      </Head>
      <body>
        {children}
      </body>
    </html>
  );
}
