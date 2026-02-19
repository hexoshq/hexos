import '../styles.css';
import '@hexos/react-ui/styles.css';

import type { AppProps } from 'next/app';
import { Databuddy } from '@databuddy/sdk/react';

export default function DocsApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <Databuddy clientId={process.env.NEXT_PUBLIC_DATABUDDY_CLIENT_ID} />
    </>
  );
}
