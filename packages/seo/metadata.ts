import merge from "lodash.merge";
import type { Metadata } from "next";
import { SITE_NAME } from "./site";

type MetadataGenerator = Omit<Metadata, "description" | "title"> & {
  title: string;
  description: string;
  image?: string;
};

// The product is the author and the publisher (upstream: Vercel, @vercel).
const applicationName = SITE_NAME;
const author: Metadata["authors"] = { name: SITE_NAME };
const publisher = SITE_NAME;
// The app's own origin, which the build sets per environment (upstream read
// Vercel's VERCEL_PROJECT_PRODUCTION_URL).
const productionUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const createMetadata = ({
  title,
  description,
  image,
  ...properties
}: MetadataGenerator): Metadata => {
  const parsedTitle = `${title} | ${applicationName}`;
  const defaultMetadata: Metadata = {
    title: parsedTitle,
    description,
    applicationName,
    metadataBase: productionUrl ? new URL(productionUrl) : undefined,
    authors: [author],
    creator: author.name,
    formatDetection: {
      telephone: false,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: parsedTitle,
    },
    openGraph: {
      title: parsedTitle,
      description,
      type: "website",
      siteName: applicationName,
      locale: "en_US",
    },
    publisher,
    twitter: {
      card: "summary_large_image",
    },
  };

  const metadata: Metadata = merge(defaultMetadata, properties);

  if (image && metadata.openGraph) {
    metadata.openGraph.images = [
      {
        url: image,
        width: 1200,
        height: 630,
        alt: title,
      },
    ];
  }

  return metadata;
};
