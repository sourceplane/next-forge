import { createOpenAI } from "@ai-sdk/openai";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { EmbeddingModel, LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { keys } from "../keys";

// Workers AI through the Worker's own AI binding (apps/app/wrangler.jsonc):
// no key, the binding is the credential. Upstream's OpenAI models stay, used
// when OPENAI_API_KEY is set. The binding lives on the request's Cloudflare
// context, so each model is resolved when it is read, never at module scope.
const workersAi = () => {
  const { env } = getCloudflareContext();
  const binding = (env as { AI?: Parameters<typeof createWorkersAI>[0]["binding"] }).AI;
  if (!binding) {
    throw new Error(
      'No AI binding: the Worker\'s wrangler.jsonc must declare "ai": { "binding": "AI" }'
    );
  }
  return createWorkersAI({ binding });
};

const openai = () =>
  createOpenAI({
    apiKey: keys().OPENAI_API_KEY,
  });

export const WORKERS_AI_CHAT_MODEL = "@cf/zai-org/glm-4.7-flash";
export const WORKERS_AI_EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

export const models: {
  readonly chat: LanguageModel;
  readonly embeddings: EmbeddingModel;
} = {
  get chat() {
    return keys().OPENAI_API_KEY
      ? openai()("gpt-4o-mini")
      : workersAi()(WORKERS_AI_CHAT_MODEL);
  },
  get embeddings() {
    return keys().OPENAI_API_KEY
      ? openai().textEmbeddingModel("text-embedding-3-small")
      : workersAi().textEmbedding(WORKERS_AI_EMBEDDING_MODEL);
  },
};
