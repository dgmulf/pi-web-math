import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Marked } from 'marked';
import plugin from '../src/index.ts';

const { markdownExtensions: [block, inline], stylesheets } = plugin.activate().contributions;
const tex = String.raw;

// Exercise our callbacks in the Marked lexer used by PI WEB. Mirror its code
// priority check; the browser smoke fixture also exercises host sanitization.
const markdown = new Marked({ gfm: true, breaks: true });
markdown.use({ extensions: [block, inline].map(({ id, level, start, tokenize, render }) => ({
  name: id,
  level,
  start,
  tokenizer(source) {
    const { rules } = this.lexer.options.tokenizer;
    const isLiteral = level === 'block'
      ? rules.block.code.test(source) || rules.block.fences.test(source)
      : source.startsWith('\\\\') || rules.inline.code.test(source) || this.lexer.state.inRawBlock;
    if (isLiteral) return;
    const token = tokenize(source);
    return token && { ...token, type: id };
  },
  renderer: render,
})) });

const annotations = (html) => [...html.matchAll(/<annotation encoding="application\/x-tex">(.*?)<\/annotation>/gs)].map(m => m[1]);

function render(extension, raw) {
  const token = extension.tokenize(raw);
  assert.ok(token, `expected math token for ${raw}`);
  return extension.render(token);
}

test('registers portable browser v5 Markdown extensions and a module-relative stylesheet', () => {
  assert.equal(plugin.apiVersion, 5);
  assert.ok(plugin.requires.some(c => c.pluginId === 'pi-web' && c.id === 'markdown-rendering' && c.version === 1));
  assert.deepEqual([block.level, inline.level], ['block', 'inline']);
  assert.match(stylesheets[0].url, /\/math\.css$/);
});

test('inline tokenization consumes exactly the two inline delimiter forms', () => {
  for (const [raw, text] of [['$x_{1}+1$', 'x_{1}+1'], [tex`\( \frac{a}{b} \)`, tex`\frac{a}{b}`]]) {
    assert.deepEqual(inline.tokenize(`${raw} then some text`), { raw, text });
    const html = render(inline, raw);
    assert.ok(!html.includes('katex-display'));
    assert.match(html, /<math[ >]/);
    assert.match(html, /class="katex-html" aria-hidden="true"/);
  }
});

test('display math accepts single-line and multiline equations, with optional indentation', () => {
  for (const [open, close] of [['$$', '$$'], [tex`\[`, tex`\]`]]) {
    const text = tex`\begin{aligned} a&=b \\ c&=d \end{aligned}`;
    const source = `${open}\n${text}\n${close}`;
    assert.deepEqual(block.tokenize(`  ${source}\t\nProse`), { raw: `  ${source}\t\n`, text });
    assert.match(render(block, `${open}x${close}`), /^<div class="pi-web-math-display">.*<math[^>]+display="block"/s);
    assert.equal(block.tokenize(`${open}x${close} then more text`), undefined);
    assert.match(render(inline, source), /^<span class="pi-web-math-display">/);
  }
});

test('escape pairs are not openers and escaped delimiters do not terminate math', () => {
  assert.equal(inline.start(tex`Only \$x\$, \\(x\\), and \\[x\\].`), undefined);
  assert.equal(inline.start(tex`\\\(x\)`), 2);
  assert.equal(inline.start('Literal $$$x$$$.'), undefined);
  assert.equal(inline.start('Price $5; then $x$'), 15);
  const raw = tex`$\text{\$5} + x$`;
  assert.deepEqual(inline.tokenize(`${raw}.`), { raw, text: tex`\text{\$5} + x` });
  const aligned = tex`\[\begin{matrix} x \\ y \end{matrix}\]`;
  assert.equal(block.tokenize(aligned)?.raw, aligned);
});

test('currency, empty equations, and incomplete streamed equations do not tokenize', () => {
  for (const source of ['$5 and $10', '$5–$10', '$ x$', '$x $', '$x\n\ny$', '$$', '$$  $$', '$$x$', '$$$x$$$', tex`\(x`, tex`\[x`, tex`\(  \)`]) {
    assert.equal(inline.tokenize(source), undefined, source);
  }
  assert.equal(inline.tokenize(`$${'x'.repeat(8193)}$`), undefined);
  assert.deepEqual(annotations(markdown.parse(tex`Typing \(x^2`)), []);
  assert.deepEqual(annotations(markdown.parse(tex`Typing \(x^2\)`)), ['x^2']);
  assert.deepEqual(annotations(markdown.parse('Typing $$x^2$')), []);
  assert.deepEqual(annotations(markdown.parse(tex`Typing \[... then \[x\]`)), ['x']);
  assert.deepEqual(annotations(markdown.parse('($x$)')), ['x']);
});

test('math works alongside emphasis, lists, block quotes and prose', () => {
  const source = [
    tex`**$x_1$** and *(\(y\))* follow $5 and $10.`,
    '', '- List with $z$.', '', tex`> A quote with \(a\).`, '',
    'Some prose', '$$', 'x+y', '$$', 'More prose with ' + tex`\[q+r\]` + '.',
  ].join('\n');
  const html = markdown.parse(source);
  assert.deepEqual(annotations(html), ['x_1', 'y', 'z', 'a', 'x+y', 'q+r']);
  assert.match(html, /<strong><span class="katex">/);
  assert.ok(html.includes('follow $5 and $10.'));
  assert.equal(html.match(/class="pi-web-math-display"/g)?.length, 2);
});

test('native fenced, indented, inline, and multiline inline code stay literal', () => {
  const source = [
    'Price $5. `$x$` and `\\(y\\)` stay literal.', '',
    '```tex', '$$x$$', tex`\[x\]`, '```', '',
    '    $$x$$', '', 'Example `start', '$$x$$', '` followed by $y$.',
  ].join('\n');
  const html = markdown.parse(source);
  assert.deepEqual(annotations(html), ['y']);
  assert.ok(html.includes('<code>$x$</code>'));
  assert.ok(html.includes('<code>start $$x$$ </code>'));
  assert.ok(html.includes('<pre><code class="language-tex">$$x$$'));
  assert.ok(html.includes('<pre><code>$$x$$'));
});

test('invalid TeX falls back as escaped text without affecting other equations', () => {
  const raw = tex`$\noSuchCommand{<em>&</em>}$`;
  const html = markdown.parse(`${raw} then $x$.`);
  assert.match(html, /<span class="pi-web-math-source">.*&lt;em&gt;&amp;&lt;\/em&gt;/);
  assert.deepEqual(annotations(html), ['x']);
  assert.match(render(block, tex`\[\noSuchCommand\]`), /class="pi-web-math-display"><span class="pi-web-math-source">/);
});

test('TeX cannot request external resources or persist global macros across formulas', () => {
  const html = render(inline, tex`$\includegraphics{https://example.org/img.png}$`);
  assert.doesNotMatch(html, /<(?:img|a)\b|\b(?:href|src)\s*=/i);
  assert.doesNotMatch(render(inline, tex`$\gdef\custom{xy}\custom$`), /pi-web-math-source/);
  assert.match(render(inline, tex`$\custom$`), /pi-web-math-source/);
  assert.match(render(inline, tex`$\def\loop{\loop}\loop$`), /pi-web-math-source/);
});

test('the browser fixture has six valid equations with one visible source fallback', async () => {
  const fixture = await readFile(new URL('../examples/math.md', import.meta.url), 'utf8');
  const html = markdown.parse(fixture);
  assert.equal(annotations(html).length, 6);
  assert.equal(html.match(/<div class="pi-web-math-display">/g)?.length, 4);
  assert.equal(html.match(/class="pi-web-math-source"/g)?.length, 1);
});
