import type { AnalysisResult, PerformanceIssue, PerformanceMetric, Severity } from "@/types";
import { PerformanceMetric as PM, Severity as S } from "@/types";

function getSeverityBadge(severity: Severity): string {
  switch (severity) {
    case S.High:
      return "🔴 **HIGH**";
    case S.Medium:
      return "🟡 **MEDIUM**";
    case S.Low:
      return "🟢 **LOW**";
  }
}

function getMetricBadge(metric: PerformanceMetric): string {
  switch (metric) {
    case PM.Inp:
      return "⚡ INP";
    case PM.Memory:
      return "💾 MEMORY";
  }
}

function formatIssue(issue: PerformanceIssue, index: number): string {
  const location = issue.column
    ? `${issue.file}:${issue.line}:${issue.column}`
    : `${issue.file}:${issue.line}`;

  let markdown = `### ${index + 1}. ${getSeverityBadge(issue.severity)} ${getMetricBadge(issue.metric)} - ${issue.rule}\n\n`;
  markdown += `**Location:** \`${location}\`\n\n`;
  markdown += `**Explanation:** ${issue.explanation}\n\n`;
  markdown += `**Fix:** ${issue.fix}\n\n`;

  if (issue.codeSnippet) {
    markdown += `**Code:**\n\n\`\`\`typescript\n${issue.codeSnippet}\n\`\`\`\n\n`;
  }

  return markdown;
}

export function generateMarkdownReport(result: AnalysisResult): string {
  let markdown = "# Frontend Performance Audit Report\n\n";

  markdown += "## Summary\n\n";
  markdown += `- **Total Issues:** ${result.summary.total}\n`;
  markdown += `- **Files Analyzed:** ${result.summary.filesAnalyzed}\n\n`;

  markdown += "### By Severity\n\n";
  markdown += `- 🔴 High: ${result.summary.bySeverity[S.High]}\n`;
  markdown += `- 🟡 Medium: ${result.summary.bySeverity[S.Medium]}\n`;
  markdown += `- 🟢 Low: ${result.summary.bySeverity[S.Low]}\n\n`;

  markdown += "### By Metric\n\n";
  markdown += `- ⚡ INP: ${result.summary.byMetric[PM.Inp]}\n`;
  markdown += `- 💾 MEMORY: ${result.summary.byMetric[PM.Memory]}\n\n`;

  if (result.issues.length === 0) {
    markdown += "✅ **No performance issues found!**\n";
    return markdown;
  }

  markdown += "---\n\n";
  markdown += "## Issues\n\n";

  result.issues.forEach((issue, index) => {
    markdown += formatIssue(issue, index);
    markdown += "---\n\n";
  });

  return markdown;
}
