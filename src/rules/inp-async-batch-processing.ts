import ts from "typescript";
import { HEAVY_ARRAY_OPS } from "@/constants/heavy-computation";
import type { PerformanceIssue, Rule } from "@/types";
import { PerformanceMetric, RuleName, Severity } from "@/types";
import { findFunctions, getCallExpressionName, getFunctionBody } from "@/utils/functions";
import { isInsideLoop } from "@/utils/loop";
import { hasYieldingInAsyncFunction } from "@/utils/yielding";

/**
 * Check if a function is async
 */
function isAsyncFunction(node: ts.Node): boolean {
  if (ts.isArrowFunction(node)) {
    return !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
  }
  if (ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) {
    return !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
  }
  return false;
}

/**
 * Check if function processes arrays/collections (for-of, forEach, map, etc.)
 */
function processesCollections(body: ts.Node, sourceFile: ts.SourceFile): boolean {
  let hasBatchProcessing = false;

  function visit(node: ts.Node) {
    // Check for for-of loops (async iteration)
    if (ts.isForOfStatement(node)) {
      hasBatchProcessing = true;
      return;
    }

    // Check for array methods (forEach, map, filter, reduce, etc.)
    const callName = getCallExpressionName(node, sourceFile);
    if (callName && (HEAVY_ARRAY_OPS as readonly string[]).includes(callName)) {
      // Only flag if not inside another loop (to avoid double-counting)
      if (!isInsideLoop(node)) {
        hasBatchProcessing = true;
        return;
      }
    }

    if (!hasBatchProcessing) {
      ts.forEachChild(node, visit);
    }
  }

  visit(body);
  return hasBatchProcessing;
}

function createIssue(
  filePath: string,
  sourceFile: ts.SourceFile,
  functionNode: ts.Node
): PerformanceIssue {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(functionNode.getStart());
  const codeSnippet = sourceFile.text.substring(
    functionNode.getStart(),
    Math.min(functionNode.getEnd(), functionNode.getStart() + 200)
  );

  const explanation =
    "Async function processes collections/arrays without yielding to the main thread. This can create long tasks (>50ms) that block user interactions.";
  const fix =
    "Use scheduler.yield() to break up the work: async function runJobs(jobQueue) { for (const job of jobQueue) { job(); await scheduler.yield?.() || new Promise(r => setTimeout(r, 0)); } } For better performance, batch and yield periodically: if (performance.now() - lastYield > 50) { await scheduler.yield?.(); lastYield = performance.now(); }";

  return {
    metric: PerformanceMetric.Inp,
    severity: Severity.High,
    file: filePath,
    line: line + 1,
    column: character + 1,
    explanation,
    fix,
    rule: RuleName.InpAsyncBatchProcessing,
    codeSnippet: codeSnippet.substring(0, 200),
  };
}

export const inpAsyncBatchProcessingRule: Rule = {
  config: {
    name: RuleName.InpAsyncBatchProcessing,
    description:
      "Detects async functions that process arrays/collections without yielding to the main thread",
    metric: PerformanceMetric.Inp,
    defaultSeverity: Severity.High,
  },
  detect: (filePath: string, sourceFile: ts.SourceFile): PerformanceIssue[] => {
    const issues: PerformanceIssue[] = [];
    const functions = findFunctions(sourceFile);

    for (const func of functions) {
      // Only check async functions
      if (!isAsyncFunction(func)) {
        continue;
      }

      const body = getFunctionBody(func);
      if (!body || ts.isExpression(body)) continue;

      // Check if function processes collections
      if (!processesCollections(body, sourceFile)) {
        continue;
      }

      // Check if function has yielding in async context
      if (!hasYieldingInAsyncFunction(body, sourceFile)) {
        const issue = createIssue(filePath, sourceFile, func);
        issues.push(issue);
      }
    }

    return issues;
  },
};
