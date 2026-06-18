import type { ReactElement } from "react";
import type { PageMetadata } from "@/client/lib/pageMetadata";

export function usePageMetadata(metadata: PageMetadata): ReactElement {
  return (
    <>
      <title>{metadata.title}</title>
      <meta name="description" content={metadata.description} />

      <meta property="og:title" content={metadata.ogTitle} />
      <meta property="og:description" content={metadata.ogDescription} />
      <meta property="og:type" content={metadata.ogType} />
      <meta property="og:site_name" content={metadata.ogSiteName} />
      {metadata.ogUrl ? <meta property="og:url" content={metadata.ogUrl} /> : null}
      {metadata.ogImage ? <meta property="og:image" content={metadata.ogImage} /> : null}

      <meta name="twitter:card" content={metadata.twitterCard} />
      <meta name="twitter:title" content={metadata.twitterTitle} />
      <meta name="twitter:description" content={metadata.twitterDescription} />
      {metadata.twitterImage ? <meta name="twitter:image" content={metadata.twitterImage} /> : null}

      {metadata.canonicalUrl ? <link rel="canonical" href={metadata.canonicalUrl} /> : null}
    </>
  );
}