import type { SourceFile } from "typescript";

export enum PerformanceMetric {
  Inp = "INP",
}

export enum Severity {
  High = "high",
  Medium = "medium",
  Low = "low",
}

export enum RuleName {
  InpHeavyLoops = "inp-heavy-loops",
}

export interface PerformanceIssue {
  metric: PerformanceMetric;
  severity: Severity;
  file: string;
  line: number;
  column?: number;
  explanation: string;
  fix: string;
  rule: RuleName;
  codeSnippet?: string;
}

export interface AnalysisResult {
  issues: PerformanceIssue[];
  summary: {
    total: number;
    bySeverity: Record<Severity, number>;
    byMetric: Record<PerformanceMetric, number>;
    filesAnalyzed: number;
  };
}

export interface RuleConfig {
  name: RuleName;
  description: string;
  metric: PerformanceMetric;
  defaultSeverity: Severity;
}

export type RuleDetector = (filePath: string, sourceFile: SourceFile) => PerformanceIssue[];

export interface Rule {
  config: RuleConfig;
  detect: RuleDetector;
}

export enum ChangedFileStatus {
  Added = "added",
  Modified = "modified",
  Deleted = "deleted",
}

export interface ChangedFile {
  path: string;
  status: ChangedFileStatus;
}

export interface AnalyzerOptions {
  diff?: string;
  files?: string[];
  failOnHighSeverity?: boolean;
  outputFormat?: "markdown";
}

export interface GitDiffResult {
  changedFiles: ChangedFile[];
  error?: string;
}
