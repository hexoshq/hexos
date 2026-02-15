import type { Metadata } from 'next';
import './globals.css';
import '@hexos/react-ui/styles.css';

export const metadata: Metadata = {
  title: 'Hexos - AI Agent Chat Framework',
  description: 'Interactive demo of the Hexos framework with an AI assistant that explains the project architecture and guides developers',
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
