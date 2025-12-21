#!/usr/bin/env node

import { analyze } from "@/engine/analyzer";
import { generateMarkdownReport } from "@/report/markdown";
import type { AnalyzerOptions } from "@/types";
import { Severity } from "@/types";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

function parseArgs(): AnalyzerOptions {
  const args = process.argv.slice(2);
  const options: AnalyzerOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--diff" && args[i + 1]) {
      options.diff = args[i + 1];
      i++;
    } else if (arg === "--files" && args[i + 1]) {
      const files = args[i + 1].split(",").map((f) => f.trim());
      options.files = files;
      i++;
    } else if (arg === "--fail-on-high") {
      options.failOnHighSeverity = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg === "--version" || arg === "-v") {
      console.log("1.0.0");
      process.exit(0);
    }
  }

  return options;
}

async function createMarkdownDocument(markdown: string): Promise<string> {
  try {
    // Create results directory if it doesn't exist
    const resultsDir = join(process.cwd(), "results");
    await mkdir(resultsDir, { recursive: true });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const filename = `performance-audit-${timestamp}.md`;
    const filePath = join(resultsDir, filename);

    // Ensure markdown ends with a newline
    const content = markdown.endsWith("\n") ? markdown : `${markdown}\n`;

    // Write markdown to file with UTF-8 encoding
    await writeFile(filePath, content, { encoding: "utf-8" });

    return filePath;
  } catch (error) {
    throw new Error(
      `Failed to create markdown document: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function printHelp(): void {
  console.log(`
Frontend Performance Auditor

Usage:
  fpa analyze [options]

Options:
  --diff <spec>          Git diff specification (e.g., "main..HEAD")
  --files <paths>        Comma-separated list of file paths to analyze
  --fail-on-high         Exit with code 1 if high-severity issues are found
  --help, -h             Show this help message
  --version, -v          Show version number

Examples:
  fpa analyze --diff main..HEAD
  fpa analyze --files src/App.tsx,src/Button.tsx
  fpa analyze --diff HEAD~1..HEAD --fail-on-high
`);
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (!options.diff && !options.files) {
    console.error("Error: Either --diff or --files must be provided");
    printHelp();
    process.exit(1);
  }

  try {
    const result = await analyze(options);
    const markdown = generateMarkdownReport(result);
    const filePath = await createMarkdownDocument(markdown);

    console.log(`\n✅ Performance audit completed!`);
    console.log(`📄 Report saved to: ${filePath}\n`);

    if (options.failOnHighSeverity && result.summary.bySeverity[Severity.High] > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
