import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CodeBlock } from "@repo/cms/components/code-block";

// BaseHub's CodeBlock (every Shiki language and theme) is replaced by Shiki
// with a blog's usual languages on its JavaScript regex engine, to keep the
// Worker under Workers Free's limit. Same theme, same output shape.
describe("@repo/cms CodeBlock", () => {
  it("highlights a listed language in the vesper theme", async () => {
    const html = renderToString(
      await CodeBlock({ snippets: [{ code: "const answer: number = 42;", language: "ts" }] })
    );
    expect(html).toContain('class="shiki vesper"');
    expect(html).toContain("answer");
    expect(html).toMatch(/style="color:#[0-9A-Fa-f]{6}/);
  });

  it("renders a language it does not carry as plain text, escaped", async () => {
    const html = renderToString(
      await CodeBlock({ snippets: [{ code: "<cobol> & more", language: "cobol" }] })
    );
    expect(html).not.toContain("<cobol>");
    // Shiki's own escaping: `<` and `&` as numeric references.
    expect(html).toContain("&#x3C;cobol> &#x26; more");
  });
});
