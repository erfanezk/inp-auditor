import ts from "typescript";
import { YIELDING_MECHANISMS } from "@/constants/yielding";
import type { PerformanceIssue, Rule } from "@/types";
import { PerformanceMetric, RuleName, Severity } from "@/types";
import { findEventHandlers } from "@/utils/event-handler";
import { getCallExpressionName, getFunctionBody, matchesPattern } from "@/utils/functions";
import { hasYieldingMechanism } from "@/utils/yielding";

function hasIncorrectYieldingPattern(body: ts.Node, sourceFile: ts.SourceFile): boolean {
  const immediateUpdates: ts.Node[] = [];
  const deferredUpdates: ts.Node[] = [];

  function collectUpdates(node: ts.Node, isInsideYield: boolean) {
    const callName = getCallExpressionName(node, sourceFile);
    if (
      callName &&
      (callName.startsWith("set") || callName === "dispatch" || callName === "setState")
    ) {
      if (isInsideYield) {
        deferredUpdates.push(node);
      } else {
        immediateUpdates.push(node);
      }
    }

    if (matchesPattern(getCallExpressionName(node, sourceFile) || "", YIELDING_MECHANISMS)) {
      if (ts.isCallExpression(node) && node.arguments.length > 0) {
        const callback = node.arguments[0];
        if (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) {
          const callbackBody = getFunctionBody(callback);
          if (callbackBody) {
            ts.forEachChild(callbackBody, (child) => collectUpdates(child, true));
          }
        }
      }
    }

    ts.forEachChild(node, (child) => collectUpdates(child, isInsideYield));
  }

  collectUpdates(body, false);

  return deferredUpdates.length > 0 && deferredUpdates.length >= immediateUpdates.length;
}

function createIssue(
  filePath: string,
  sourceFile: ts.SourceFile,
  handler: ts.Node
): PerformanceIssue {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(handler.getStart());
  const codeSnippet = sourceFile.text.substring(handler.getStart(), handler.getEnd());

  return {
    metric: PerformanceMetric.Inp,
    severity: Severity.Medium,
    file: filePath,
    line: line + 1,
    column: character + 1,
    explanation:
      "Event handler uses yielding but defers UI updates instead of non-UI work. UI updates should happen immediately, then non-critical work should be deferred.",
    fix: "Update UI synchronously first, then defer non-critical work: updateUI(); requestAnimationFrame(() => { setTimeout(() => { /* non-UI work */ }, 0); });",
    rule: RuleName.InpCallbackYield,
    codeSnippet: codeSnippet.substring(0, 200),
  };
}

export const inpCallbackYieldRule: Rule = {
  config: {
    name: RuleName.InpCallbackYield,
    description:
      "Detects event handlers that incorrectly defer UI updates instead of non-UI work when using yielding mechanisms",
    metric: PerformanceMetric.Inp,
    defaultSeverity: Severity.Medium,
  },
  detect: (filePath: string, sourceFile: ts.SourceFile): PerformanceIssue[] => {
    const issues: PerformanceIssue[] = [];
    const eventHandlers = findEventHandlers(sourceFile);

    for (const handler of eventHandlers) {
      const body = getFunctionBody(handler);
      if (!body) continue;

      // Only check handlers that use yielding mechanisms
      if (!hasYieldingMechanism(body, sourceFile, true)) {
        continue;
      }

      // Check for incorrect yielding pattern (deferring UI updates)
      if (hasIncorrectYieldingPattern(body, sourceFile)) {
        const issue = createIssue(filePath, sourceFile, handler);
        issues.push(issue);
      }
    }

    return issues;
  },
};
