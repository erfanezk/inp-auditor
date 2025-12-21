#!/usr/bin/env node

import { analyze } from "@/engine/analyzer";
import { generateMarkdownReport } from "@/report/markdown";
import type { AnalyzerOptions } from "@/types";
import { Severity } from "@/types";

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
    console.log(markdown);

    if (options.failOnHighSeverity && result.summary.bySeverity[Severity.High] > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
