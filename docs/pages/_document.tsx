import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script
          src="https://cdn.databuddy.cc/databuddy.js"
          data-client-id="%DATABUDDY_CLIENT_ID%"
          async
        ></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
