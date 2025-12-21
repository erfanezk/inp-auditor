import type { AnalysisResult, PerformanceIssue, PerformanceMetric, Severity } from "@/types";
import { PerformanceMetric as PM, Severity as S } from "@/types";

function getSeverityIcon(severity: Severity): string {
  switch (severity) {
    case S.High:
      return "🔴";
    case S.Medium:
      return "🟡";
    case S.Low:
      return "🟢";
  }
}

function getMetricIcon(metric: PerformanceMetric): string {
  switch (metric) {
    case PM.Inp:
      return "⚡";
    case PM.Memory:
      return "💾";
  }
}

function formatIssue(issue: PerformanceIssue, index: number): string {
  const location = issue.column
    ? `${issue.file}:${issue.line}:${issue.column}`
    : `${issue.file}:${issue.line}`;

  const severityIcon = getSeverityIcon(issue.severity);
  const metricIcon = getMetricIcon(issue.metric);

  let markdown = `### ${index + 1}. ${severityIcon} ${issue.severity} - ${metricIcon} ${issue.metric}\n\n`;
  markdown += `**File:** \`${location}\`  \n`;
  markdown += `**Rule:** ${issue.rule}\n\n`;
  markdown += `${issue.explanation}\n\n`;
  markdown += `**💡 Fix:** ${issue.fix}\n\n`;

  if (issue.codeSnippet) {
    // Clean up code snippet - remove excessive indentation
    const lines = issue.codeSnippet.split("\n");
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0);

    if (nonEmptyLines.length > 0) {
      const minIndent = Math.min(
        ...nonEmptyLines.map((line) => line.length - line.trimStart().length)
      );
      const cleanedSnippet = lines
        .map((line) => (line.trim().length > 0 ? line.slice(minIndent) : line))
        .join("\n")
        .trim();

      markdown += `\`\`\`typescript\n${cleanedSnippet}\n\`\`\`\n\n`;
    } else {
      markdown += `\`\`\`typescript\n${issue.codeSnippet}\n\`\`\`\n\n`;
    }
  }

  return markdown;
}

export function generateMarkdownReport(result: AnalysisResult): string {
  let markdown = "# Performance Audit Report\n\n";

  // Compact summary
  const { total, filesAnalyzed, bySeverity, byMetric } = result.summary;
  markdown += `${total} issue${total !== 1 ? "s" : ""} found in ${filesAnalyzed} file${filesAnalyzed !== 1 ? "s" : ""}\n\n`;
  markdown += `**Severity:** 🔴 ${bySeverity[S.High]} high  |  🟡 ${bySeverity[S.Medium]} medium  |  🟢 ${bySeverity[S.Low]} low  \n`;
  markdown += `**Metrics:** ⚡ ${byMetric[PM.Inp]} INP  |  💾 ${byMetric[PM.Memory]} Memory\n\n`;

  if (result.issues.length === 0) {
    markdown += "✅ No performance issues found!\n";
    return markdown;
  }

  markdown += "---\n\n";

  result.issues.forEach((issue, index) => {
    markdown += formatIssue(issue, index);
    if (index < result.issues.length - 1) {
      markdown += "\n";
    }
  });

  return markdown;
}
