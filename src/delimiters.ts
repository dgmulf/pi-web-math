import type { MarkdownExtensionToken } from "@jmfederico/pi-web/plugin-api";

// Markdown callbacks are synchronous and also run during streaming. Bound the
// lookahead before passing any complete equations to KaTeX.
const MAX_TEX_LENGTH = 8192;
const WHITESPACE = /\s/u;
const DIGIT = /[0-9]/u;

type Delimiter = "$" | "$$" | "\\(" | "\\[";
const CLOSERS = { "$": "$", "$$": "$$", "\\(": "\\)", "\\[": "\\]" } as const;

export function isDisplayMath(raw: string): boolean {
  const source = raw.trimStart();
  return source.startsWith("$$") || source.startsWith("\\[");
}

function opener(source: string): Delimiter | undefined {
  if (source.startsWith("\\[")) return "\\[";
  if (source.startsWith("\\(")) return "\\(";
  if (source.startsWith("$$$")) return undefined;
  if (source.startsWith("$$")) return "$$";
  // As in Pandoc, a single opening dollar must touch its content.
  if (source[0] === "$" && !WHITESPACE.test(source[1] ?? " ")) return "$";
  return undefined;
}

export function tokenizeInlineMath(source: string): MarkdownExtensionToken | undefined {
  const open = opener(source);
  if (open === undefined) return undefined;
  const close = CLOSERS[open];
  const limit = Math.min(source.length, open.length + MAX_TEX_LENGTH + 1);
  const inline = open === "$" || open === "\\(";

  for (let i = open.length; i < limit; i++) {
    if (source.startsWith(close, i)) {
      const end = i + close.length;
      if ((open === "$" || open === "$$") && source[end] === "$") return undefined;
      // Reject likely currency, for example "$5 and $10".
      if (open === "$" && (WHITESPACE.test(source[i - 1] ?? " ") || DIGIT.test(source[end] ?? ""))) {
        return undefined;
      }
      const text = source.slice(open.length, i).trim();
      return text ? { raw: source.slice(0, end), text } : undefined;
    }
    // A dollar in a Markdown code span isn't a valid end for an earlier
    // single dollar in prose. Explicit \\(...\\) can contain TeX backticks.
    if (open === "$" && source[i] === "`") return undefined;
    if (source[i] === "\\") {
      // Don't consume a second explicit opener as part of an unclosed formula.
      if ((open === "\\(" || open === "\\[") && source.startsWith(open, i)) return undefined;
      i++; // Skip escaped punctuation and TeX's \\ line break.
    } else if (inline && source[i] === "\n") {
      let next = i + 1;
      while (next < limit && (source[next] === " " || source[next] === "\t")) next++;
      if (source[next] === "\n") return undefined;
    }
  }
  return undefined;
}

export function startInlineMath(source: string): number | undefined {
  // Consume escape pairs and dollar runs as a unit, so neither an escaped
  // delimiter nor the tail of a longer dollar run can start a formula.
  for (const match of source.matchAll(/\\[\s\S]|\$+/gu)) {
    const value = match[0];
    if ((value === "\\(" || value === "\\[" || value === "$$" || value === "$")
      && tokenizeInlineMath(source.slice(match.index))) return match.index;
  }
  return undefined;
}

export function tokenizeBlockMath(source: string): MarkdownExtensionToken | undefined {
  const indent = /^ {1,3}/u.exec(source)?.[0].length ?? 0;
  const body = source.slice(indent);
  if (!body.startsWith("$$") && !body.startsWith("\\[")) return undefined;
  const token = tokenizeInlineMath(body);
  if (!token) return undefined;
  // Only standalone display math is a Markdown block. Display delimiters in
  // prose are handled by the inline extension, which preserves the paragraph.
  const end = /^[ \t]*(?:\n|$)/u.exec(body.slice(token.raw.length));
  return end ? { raw: source.slice(0, indent + token.raw.length + end[0].length), text: token.text } : undefined;
}

export function startBlockMath(source: string): number | undefined {
  // PI WEB calls block start on the paragraph tail. Only claim display
  // equations after a blank line here so multiline code spans stay intact.
  // The block tokenizer handles actual block starts, and inline math handles
  // display equations within a paragraph with the same visual block layout.
  for (const match of source.matchAll(/\n[ \t]*\n(?= {0,3}(?:\$\$(?!\$)|\\\[))/gu)) {
    const index = match.index + match[0].length;
    if (tokenizeBlockMath(source.slice(index))) return index;
  }
  return undefined;
}
