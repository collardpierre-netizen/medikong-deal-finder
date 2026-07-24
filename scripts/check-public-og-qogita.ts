#!/usr/bin/env bun
/**
 * Scan built HTML + source Helmet blocks for any OG/Twitter/head-meta
 * tag whose content mentions "qogita" (case-insensitive).
 *
 * Covers:
 *  1. dist/**\/*.html — <title>, <meta name=description>, og:*, twitter:*
 *  2. src/**\/*.{ts,tsx} — <Helmet> blocks with the same tags set at runtime
 *
 * Exits non-zero on any hit, listing every occurrence.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const NEEDLE = /qogita/i;

const TRACKED_META = new Set([
  "og:title",
  "og:description",
  "og:image",
  "og:image:alt",
  "og:url",
  "og:site_name",
  "og:type",
  "twitter:title",
  "twitter:description",
  "twitter:image",
  "twitter:image:alt",
  "twitter:card",
  "twitter:site",
  "twitter:creator",
  "description",
]);

type Hit = { file: string; line: number; tag: string; content: string };
const hits: Hit[] = [];

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".git") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

function lineOf(src: string, index: number): number {
  return src.slice(0, index).split("\n").length;
}

// 1. Scan built HTML
const distDir = join(ROOT, "dist");
const htmlFiles = walk(distDir, [".html"]);
if (htmlFiles.length === 0) {
  console.error("⚠️  dist/ empty or missing — run `bun run build` first.");
  process.exit(2);
}

const titleRe = /<title\b[^>]*>([\s\S]*?)<\/title>/gi;
const metaRe = /<meta\b[^>]*>/gi;
const attrRe = /(name|property)\s*=\s*"([^"]+)"[^>]*content\s*=\s*"([^"]*)"|content\s*=\s*"([^"]*)"[^>]*(name|property)\s*=\s*"([^"]+)"/i;

for (const file of htmlFiles) {
  const src = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);

  for (const m of src.matchAll(titleRe)) {
    if (NEEDLE.test(m[1])) {
      hits.push({ file: rel, line: lineOf(src, m.index!), tag: "<title>", content: m[1].trim() });
    }
  }
  for (const m of src.matchAll(metaRe)) {
    const tag = m[0];
    const parsed = attrRe.exec(tag);
    if (!parsed) continue;
    const key = (parsed[2] || parsed[6] || "").toLowerCase();
    const content = parsed[3] ?? parsed[4] ?? "";
    if (!TRACKED_META.has(key)) continue;
    if (NEEDLE.test(content)) {
      hits.push({ file: rel, line: lineOf(src, m.index!), tag: key, content });
    }
  }
}

// 2. Scan source Helmet blocks
const srcDir = join(ROOT, "src");
const srcFiles = walk(srcDir, [".ts", ".tsx"]);

const helmetBlockRe = /<Helmet\b[\s\S]*?<\/Helmet>/g;
const jsxMetaRe = /<(?:meta|title)\b[^/>]*\/?>|<title\b[^>]*>[\s\S]*?<\/title>/g;
const jsxAttrRe = /(name|property)\s*=\s*["']([^"']+)["'][^>]*content\s*=\s*\{?["']([^"'}]+)["']\}?|content\s*=\s*\{?["']([^"'}]+)["']\}?[^>]*(name|property)\s*=\s*["']([^"']+)["']/i;
const jsxTitleInnerRe = /<title\b[^>]*>([\s\S]*?)<\/title>/i;

for (const file of srcFiles) {
  const src = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);
  for (const block of src.matchAll(helmetBlockRe)) {
    const blockText = block[0];
    const blockOffset = block.index!;
    for (const tagMatch of blockText.matchAll(jsxMetaRe)) {
      const tag = tagMatch[0];
      if (tag.startsWith("<title")) {
        const inner = jsxTitleInnerRe.exec(tag);
        if (inner && NEEDLE.test(inner[1])) {
          hits.push({
            file: rel,
            line: lineOf(src, blockOffset + tagMatch.index!),
            tag: "<title> (Helmet)",
            content: inner[1].trim(),
          });
        }
        continue;
      }
      const parsed = jsxAttrRe.exec(tag);
      if (!parsed) continue;
      const key = (parsed[2] || parsed[6] || "").toLowerCase();
      const content = parsed[3] ?? parsed[4] ?? "";
      if (!TRACKED_META.has(key)) continue;
      if (NEEDLE.test(content)) {
        hits.push({
          file: rel,
          line: lineOf(src, blockOffset + tagMatch.index!),
          tag: `${key} (Helmet)`,
          content,
        });
      }
    }
  }
}

if (hits.length > 0) {
  console.error(`❌ Found ${hits.length} public head-metadata mention(s) of "Qogita":\n`);
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  [${h.tag}]  ${h.content}`);
  }
  console.error(`\nRemove these before shipping — public OG/Twitter tags must not reference Qogita.`);
  process.exit(1);
}

console.log(`✅ No public "Qogita" mention in OG/Twitter/title/description tags (${htmlFiles.length} HTML files, ${srcFiles.length} source files scanned).`);
