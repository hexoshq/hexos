import type { Metadata } from 'next';
import './globals.css';
import '@hexos/react-ui/styles.css';

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
      </body>
    </html>
  );
}
