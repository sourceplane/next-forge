import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

// Vercel Blob, upstream, is an R2 bucket here: the app Worker's STORAGE
// binding (apps/app/wrangler.template.jsonc), one bucket per environment from
// Terraform (infra/terraform/cloudflare-r2). The verbs keep Vercel Blob's
// names — put, head, list, del — and add get, because the bucket is private:
// a file is served by a route the product writes (it reads `get`), not by a
// public blob URL.

// The slice of Workers' R2Bucket this package uses, declared here so the
// package type-checks beside the DOM types the apps compile with.
interface R2Object {
  key: string;
  size: number;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: { contentType?: string };
}
interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}
interface R2Bucket {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<R2Object>;
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2Object | null>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    objects: R2Object[];
    truncated: boolean;
    cursor?: string;
  }>;
  delete(keys: string | string[]): Promise<void>;
}

interface StorageEnv {
  STORAGE?: R2Bucket;
}

const bucket = async (): Promise<R2Bucket> => {
  const { env } = await getCloudflareContext({ async: true });
  const storage = (env as StorageEnv).STORAGE;
  if (!storage) {
    throw new Error("No STORAGE binding: this Worker has no R2 bucket bound");
  }
  return storage;
};

export interface PutBlobResult {
  pathname: string;
  contentType: string | undefined;
  size: number;
  etag: string;
  uploadedAt: Date;
}

export interface PutOptions {
  contentType?: string;
  // Vercel Blob appends a random suffix unless told not to; so does this.
  addRandomSuffix?: boolean;
}

const suffixed = (pathname: string) => {
  const dot = pathname.lastIndexOf(".");
  const suffix = crypto.randomUUID().slice(0, 8);
  return dot > pathname.lastIndexOf("/")
    ? `${pathname.slice(0, dot)}-${suffix}${pathname.slice(dot)}`
    : `${pathname}-${suffix}`;
};

export const put = async (
  pathname: string,
  body: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
  options: PutOptions = {}
): Promise<PutBlobResult> => {
  const key =
    options.addRandomSuffix === false ? pathname : suffixed(pathname);
  const object = await (await bucket()).put(key, body, {
    httpMetadata: options.contentType
      ? { contentType: options.contentType }
      : undefined,
  });
  return {
    pathname: object.key,
    contentType: object.httpMetadata?.contentType,
    size: object.size,
    etag: object.httpEtag,
    uploadedAt: object.uploaded,
  };
};

export const get = async (pathname: string) => (await bucket()).get(pathname);

export const head = async (pathname: string) =>
  (await bucket()).head(pathname);

export const list = async (
  options: { prefix?: string; limit?: number; cursor?: string } = {}
) => {
  const result = await (await bucket()).list(options);
  return {
    blobs: result.objects.map((object) => ({
      pathname: object.key,
      size: object.size,
      uploadedAt: object.uploaded,
    })),
    cursor: result.truncated ? result.cursor : undefined,
    hasMore: result.truncated,
  };
};

export const del = async (pathname: string | string[]) =>
  (await bucket()).delete(pathname);
