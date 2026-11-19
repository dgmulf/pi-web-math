import katex from "katex";
import type {
  MarkdownExtensionContribution,
  MarkdownRenderingCapability,
  PiWebPluginV5,
  PluginCapability,
} from "@jmfederico/pi-web/plugin-api";
import {
  isDisplayMath, startBlockMath, startInlineMath, tokenizeBlockMath, tokenizeInlineMath,
} from "./delimiters.ts";

const markdownRendering: PluginCapability<MarkdownRenderingCapability> = {
  pluginId: "pi-web",
  id: "markdown-rendering",
  version: 1,
  parse(value) {
    if (typeof value !== "object" || value === null || !("render" in value) || typeof value.render !== "function") {
      throw new Error("LaTeX Math needs PI WEB's Markdown rendering v1 capability");
    }
    return value as MarkdownRenderingCapability;
  },
};

function mathExtension(
  level: MarkdownExtensionContribution["level"],
  start: MarkdownExtensionContribution["start"],
  tokenize: MarkdownExtensionContribution["tokenize"],
): MarkdownExtensionContribution {
  return {
    id: `latex-${level}`,
    level,
    start,
    tokenize,
    render({ raw, text }) {
      const displayMode = isDisplayMath(raw);
      let html: string;
      try {
        html = katex.renderToString(text, {
          displayMode,
          output: "htmlAndMathml",
          trust: false,
          strict: "ignore",
          maxExpand: 500,
          maxSize: 25,
          macros: {}, // Definitions in a formula cannot affect later formulas.
        });
      } catch (error) {
        if (!(error instanceof katex.ParseError || error instanceof RangeError)) throw error;
        const escaped = raw.trim().replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
        html = `<span class="pi-web-math-source">${escaped}</span>`;
      }
      if (!displayMode) return html;
      // A span is valid phrasing content when a display equation is in a
      // paragraph. CSS gives it a block layout in either context.
      const tag = level === "block" ? "div" : "span";
      return `<${tag} class="pi-web-math-display">${html}</${tag}>`;
    },
  };
}

export default {
  apiVersion: 5,
  name: "LaTeX Math",
  requires: [markdownRendering],
  activate: () => ({
    contributions: {
      markdownExtensions: [
        mathExtension("block", startBlockMath, tokenizeBlockMath),
        mathExtension("inline", startInlineMath, tokenizeInlineMath),
      ],
      stylesheets: [{ id: "katex", url: new URL("./math.css", import.meta.url).href }],
    },
  }),
} satisfies PiWebPluginV5;
