import ts from "typescript";
import type { PerformanceIssue, Rule } from "@/types";
import { PerformanceMetric, RuleName, Severity } from "@/types";
import { findEventHandlers } from "@/utils/event-handler";
import { getCallExpressionName, getFunctionBody } from "@/utils/functions";
import { hasYieldingMechanism } from "@/utils/yielding";

// Threshold: flag if 3+ state updates (more conservative than previous 2)
const MIN_STATE_UPDATES = 3;

function countStateUpdates(body: ts.Node, sourceFile: ts.SourceFile): number {
  let count = 0;

  function visit(node: ts.Node) {
    const callName = getCallExpressionName(node, sourceFile);

    if (callName) {
      // Check for state update patterns
      if (
        callName.startsWith("set") || // useState setters: setCount, setValue, etc.
        callName === "dispatch" || // Redux dispatch
        callName === "setState" // React class component setState
      ) {
        count++;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(body);
  return count;
}

/**
 * Check if there's yielding between state updates
 */
function hasYieldingBetweenUpdates(body: ts.Node, sourceFile: ts.SourceFile): boolean {
  // Simple check: if the function has yielding, assume it's between updates
  // More sophisticated analysis could track update positions vs yield positions
  return hasYieldingMechanism(body, sourceFile, true);
}

function createIssue(
  filePath: string,
  sourceFile: ts.SourceFile,
  handler: ts.Node,
  updateCount: number
): PerformanceIssue {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(handler.getStart());
  const codeSnippet = sourceFile.text.substring(handler.getStart(), handler.getEnd());

  return {
    metric: PerformanceMetric.Inp,
    severity: Severity.Medium,
    file: filePath,
    line: line + 1,
    column: character + 1,
    explanation: `Event handler performs ${updateCount} state updates without yielding between them. Multiple synchronous state updates can cause multiple re-renders and block the main thread, leading to poor INP (Interaction to Next Paint).`,
    fix: "Batch state updates or yield between them using requestAnimationFrame or setTimeout. For React, use React.startTransition() or batch updates: React.startTransition(() => { setState1(); setState2(); setState3(); });",
    rule: RuleName.InpEventHandlerStateUpdates,
    codeSnippet: codeSnippet.substring(0, 200),
  };
}

export const inpEventHandlerStateUpdatesRule: Rule = {
  config: {
    name: RuleName.InpEventHandlerStateUpdates,
    description:
      "Detects event handlers with excessive state updates that don't yield between updates",
    metric: PerformanceMetric.Inp,
    defaultSeverity: Severity.Medium,
  },
  detect: (filePath: string, sourceFile: ts.SourceFile): PerformanceIssue[] => {
    const issues: PerformanceIssue[] = [];
    const eventHandlers = findEventHandlers(sourceFile);

    for (const handler of eventHandlers) {
      const body = getFunctionBody(handler);
      if (!body) continue;

      const updateCount = countStateUpdates(body, sourceFile);

      // Only flag if handler has 3+ state updates
      if (updateCount < MIN_STATE_UPDATES) {
        continue;
      }

      // Only flag if handler doesn't yield between updates
      if (hasYieldingBetweenUpdates(body, sourceFile)) {
        continue;
      }

      const issue = createIssue(filePath, sourceFile, handler, updateCount);
      issues.push(issue);
    }

    return issues;
  },
};
