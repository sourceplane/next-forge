"use client";

import { BaseHubImage } from "basehub/next-image";
import NextImage from "next/image";
import type { ComponentProps } from "react";

type ImageProps = ComponentProps<typeof BaseHubImage>;

const isBaseHubAsset = (src: ImageProps["src"]) =>
  typeof src === "string" &&
  (src.startsWith("https://assets.basehub.com") ||
    src.startsWith("https://basehub.earth"));

// BaseHub's image (its own loader, on BaseHub's image CDN) for BaseHub's
// assets; anything else — the sample content's inline images — is served as
// it is, since BaseHub's loader rewrites every URL to its CDN.
export const Image = (props: ImageProps) =>
  isBaseHubAsset(props.src) ? (
    <BaseHubImage {...props} />
  ) : (
    <NextImage
      {...(props as ComponentProps<typeof NextImage>)}
      unoptimized
    />
  );
