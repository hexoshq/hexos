import "../styles.css";

import type { AppProps } from "next/app";

export default function DocsApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;  
}
