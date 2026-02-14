import { DocsThemeConfig, ThemeSwitch, useConfig } from "nextra-theme-docs";
/* eslint-disable react-hooks/rules-of-hooks */
import { useRouter } from "next/router";

const Head = () => {
  const { asPath, defaultLocale, locale } = useRouter();
  const { frontMatter, title } = useConfig();

  const siteUrl = "https://hexos.iludolf.com.br";
  const url =
    siteUrl + (defaultLocale === locale ? asPath : `/${locale}${asPath}`);

  const defaultTitle = `The Agentic Application Platform: framework services for building AI-powered agentic applications.`;
  const description =
    frontMatter.description ||
    `Framework for building agent-native applications with Generative UI, shared state, and human-in-the-loop workflows`;

  return (
    <>
      <link rel="canonical" href={`${siteUrl}${asPath}`} />
      <meta property="og:url" content={url} />
      <meta property="description" content={description} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={`${siteUrl}/social.png`} />
      <meta property="og:image:height" content="675" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:alt" content="Hexos" />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:locale" content="en" />
      <meta property="og:site_name" content={defaultTitle} />
      <meta name="image" content={`${siteUrl}/social.png`} />
      <meta itemProp="image" content={`${siteUrl}/social.png`} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content={`${siteUrl}/social.png`} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image:alt" content="Hexos" />
      <meta name="twitter:image:height" content="675" />
      <meta name="twitter:image:type" content="image/png" />
      <meta name="twitter:image:width" content="1200" />
      <meta name="twitter:site" content="@puckeditor" />
      <meta
        name="twitter:title"
        content={title !== defaultTitle ? `${title} - Hexos` : defaultTitle}
      />
      <title>{title !== defaultTitle ? `${title} - Hexos` : defaultTitle}</title>

      <link rel="icon" href="/favicon.ico" sizes="48x48" />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <link rel="manifest" href="/manifest.webmanifest" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: `{
      "@context" : "https://schema.org",
      "@type" : "WebSite",
      "name" : "Hexos",
      "url" : "https://hexos.iludolf.com.br/"
    }`,
        }}
      />
      {asPath == "/" && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: `${JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Hexos",
              url: siteUrl,
            })}`,
          }}
        />
      )}
    </>
  );
};

const theme: DocsThemeConfig = {
  head: Head,
  logo: (
    <span
      style={{
        fontWeight: 700,
        fontSize: "1.25rem",
        letterSpacing: "-0.02em",
      }}
    >
      Hexos
    </span>
  ),
  navbar: {
    extraContent: (
      <div className="flex items-center">
        <ThemeSwitch lite />
      </div>
    ),
  },
  project: {
    link: "https://github.com/iLudolf/mcp-adapter",
  },
  footer: {
    content: (
      <div className="flex w-full flex-col items-center sm:items-start">
        <p className="mt-6 text-xs">
          MIT © {new Date().getFullYear()}{" "}
          <a
            style={{ textDecoration: "underline" }}
            href="https://github.com/iLudolf/mcp-adapter/graphs/contributors"
          >
            The Contributors
          </a>
        </p>
      </div>
    ),
  },
};


export default theme;
