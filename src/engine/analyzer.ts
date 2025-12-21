import type { AnalysisResult, AnalyzerOptions, PerformanceIssue } from "@/types";
import { PerformanceMetric, Severity } from "@/types";
import { getChangedFiles } from "@/git/diff";
import { parseFiles } from "@/ast/parser";
import { rules } from "@/rules";

export async function analyze(
  options: AnalyzerOptions,
  repoPath: string = process.cwd()
): Promise<AnalysisResult> {
  let filePaths: string[] = [];

  if (options.files && options.files.length > 0) {
    filePaths = options.files;
  } else if (options.diff) {
    const diffResult = await getChangedFiles(options.diff, repoPath);
    if (diffResult.error) {
      throw new Error(`Git diff failed: ${diffResult.error}`);
    }
    filePaths = diffResult.changedFiles
      .filter((file) => file.status !== "deleted")
      .map((file) => file.path);
  } else {
    throw new Error("Either 'diff' or 'files' option must be provided");
  }

  if (filePaths.length === 0) {
    return {
      issues: [],
      summary: {
        total: 0,
        bySeverity: {
          [Severity.High]: 0,
          [Severity.Medium]: 0,
          [Severity.Low]: 0,
        },
        byMetric: {
          [PerformanceMetric.Inp]: 0,
          [PerformanceMetric.Memory]: 0,
        },
        filesAnalyzed: 0,
      },
    };
  }

  const sourceFiles = await parseFiles(filePaths);
  const allIssues: PerformanceIssue[] = [];

  for (const [filePath, sourceFile] of sourceFiles) {
    for (const rule of rules) {
      const issues = rule.detect(filePath, sourceFile);
      allIssues.push(...issues);
    }
  }

  const summary = {
    total: allIssues.length,
    bySeverity: {
      [Severity.High]: allIssues.filter((i) => i.severity === Severity.High).length,
      [Severity.Medium]: allIssues.filter((i) => i.severity === Severity.Medium).length,
      [Severity.Low]: allIssues.filter((i) => i.severity === Severity.Low).length,
    },
    byMetric: {
      [PerformanceMetric.Inp]: allIssues.filter((i) => i.metric === PerformanceMetric.Inp).length,
      [PerformanceMetric.Memory]: allIssues.filter((i) => i.metric === PerformanceMetric.Memory)
        .length,
    },
    filesAnalyzed: sourceFiles.size,
  };

  return {
    issues: allIssues,
    summary,
  };
}
