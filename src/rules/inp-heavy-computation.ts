import ts from "typescript";
import { YIELDING_MECHANISMS } from "@/constants/yielding";
import type { PerformanceIssue, Rule } from "@/types";
import { PerformanceMetric, RuleName, Severity } from "@/types";
import { findEventHandlers } from "@/utils/event-handler";
import { findFunctions, getCallExpressionName, getFunctionBody } from "@/utils/functions";
import { isLoop } from "@/utils/loop";
import { hasYieldingMechanism } from "@/utils/yielding";

// Threshold: function must have at least 20 operations to be flagged
const MIN_OPERATIONS = 20;

/**
 * Count meaningful operations in a function (only function calls, not property access)
 */
function countOperations(node: ts.Node, sourceFile: ts.SourceFile): number {
  let count = 0;

  function visit(n: ts.Node) {
    // Count function calls (excluding yielding mechanisms)
    if (ts.isCallExpression(n)) {
      const callName = getCallExpressionName(n, sourceFile);
      if (callName) {
        // Skip yielding mechanisms
        const isYielding =
          YIELDING_MECHANISMS.some((name) => callName.includes(name)) ||
          (ts.isPropertyAccessExpression(n.expression) &&
            n.expression.name.getText(sourceFile) === "yield");

        if (!isYielding) {
          count++;
        }
      }
    }

    ts.forEachChild(n, visit);
  }

  visit(node);
  return count;
}

/**
 * Check if function contains loops
 */
function containsLoops(body: ts.Node): boolean {
  let hasLoop = false;

  function visit(n: ts.Node) {
    if (isLoop(n)) {
      hasLoop = true;
      return;
    }
    if (!hasLoop) {
      ts.forEachChild(n, visit);
    }
  }

  visit(body);
  return hasLoop;
}

/**
 * Check if function is an event handler
 */
function isEventHandler(func: ts.Node, sourceFile: ts.SourceFile): boolean {
  const eventHandlers = findEventHandlers(sourceFile);
  return eventHandlers.some((handler) => handler === func);
}

function createIssue(
  filePath: string,
  sourceFile: ts.SourceFile,
  functionNode: ts.Node,
  operationCount: number
): PerformanceIssue {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(functionNode.getStart());
  const codeSnippet = sourceFile.text.substring(
    functionNode.getStart(),
    Math.min(functionNode.getEnd(), functionNode.getStart() + 200)
  );

  const severity = operationCount > 30 ? Severity.High : Severity.Medium;
  const explanation = `Function performs ${operationCount} sequential operations which could exceed 50ms and create a long task, blocking the main thread and causing poor INP.`;
  const fix =
    "Break up the work into smaller chunks using scheduler.yield() or setTimeout. For async functions, use: await scheduler.yield?.() || new Promise(r => setTimeout(r, 0)); For synchronous functions, use setTimeout or requestAnimationFrame to defer non-critical work.";

  return {
    metric: PerformanceMetric.Inp,
    severity,
    file: filePath,
    line: line + 1,
    column: character + 1,
    explanation,
    fix,
    rule: RuleName.InpHeavyComputation,
    codeSnippet: codeSnippet.substring(0, 200),
  };
}

export const inpHeavyComputationRule: Rule = {
  config: {
    name: RuleName.InpHeavyComputation,
    description:
      "Detects functions with many sequential operations that could create long tasks (>50ms)",
    metric: PerformanceMetric.Inp,
    defaultSeverity: Severity.Medium,
  },
  detect: (filePath: string, sourceFile: ts.SourceFile): PerformanceIssue[] => {
    const issues: PerformanceIssue[] = [];
    const functions = findFunctions(sourceFile);

    for (const func of functions) {
      const body = getFunctionBody(func);
      if (!body || ts.isExpression(body)) continue;

      // Skip event handlers (handled by event-handler-specific rules)
      if (isEventHandler(func, sourceFile)) {
        continue;
      }

      // Skip if function contains loops (handled by long-loop rule)
      if (containsLoops(body)) {
        continue;
      }

      // Skip if function already has yielding
      if (hasYieldingMechanism(body, sourceFile, true)) {
        continue;
      }

      // Count operations
      const operationCount = countOperations(body, sourceFile);

      // Flag if function has many operations
      if (operationCount >= MIN_OPERATIONS) {
        const issue = createIssue(filePath, sourceFile, func, operationCount);
        issues.push(issue);
      }
    }

    return issues;
  },
};
