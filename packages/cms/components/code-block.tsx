import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

// Upstream renders code with BaseHub's CodeBlock, which loads Shiki with every
// language and every theme — 1.7 MB compressed in the Worker, past Workers
// Free's 3 MiB for the whole site. This is the same highlighter (Shiki, the
// `vesper` theme the blog asks for) with the languages a blog post usually
// shows and Shiki's JavaScript regex engine instead of its WebAssembly one.
// A language not listed renders as plain text; add it here to highlight it.
const LANGUAGES = {
  bash: () => import("shiki/langs/bash.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  diff: () => import("shiki/langs/diff.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  shellscript: () => import("shiki/langs/shellscript.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
} as const;

const ALIASES: Record<string, keyof typeof LANGUAGES> = {
  js: "javascript",
  md: "markdown",
  sh: "shellscript",
  shell: "shellscript",
  ts: "typescript",
  yml: "yaml",
  zsh: "shellscript",
};

let highlighter: Promise<HighlighterCore> | undefined;

const getHighlighter = () => {
  highlighter ??= createHighlighterCore({
    themes: [import("shiki/themes/vesper.mjs")],
    langs: Object.values(LANGUAGES).map((load) => load()),
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
};

const languageOf = (language: string | undefined) => {
  const name = (language ?? "").toLowerCase();
  if (name in LANGUAGES) {
    return name;
  }
  return ALIASES[name] ?? "text";
};

interface CodeBlockProps {
  readonly snippets: { code: string; language?: string }[];
  readonly theme?: "vesper";
}

export const CodeBlock = async ({ snippets }: CodeBlockProps) => {
  const shiki = await getHighlighter();
  return (
    <div className="my-6 overflow-hidden rounded-lg text-sm">
      {snippets.map((snippet, index) => (
        <div
          dangerouslySetInnerHTML={{
            __html: shiki.codeToHtml(snippet.code, {
              lang: languageOf(snippet.language),
              theme: "vesper",
            }),
          }}
          key={`${index}-${snippet.language ?? "text"}`}
        />
      ))}
    </div>
  );
};
