import ts from "typescript";
import { API_CALL_PATTERNS } from "@/constants/api-call";
import type { PerformanceIssue, Rule } from "@/types";
import { PerformanceMetric, RuleName, Severity } from "@/types";
import { findEventHandlers } from "@/utils/event-handler";
import { getCallExpressionName, getFunctionBody, matchesPattern } from "@/utils/functions";
import { hasYieldingMechanism } from "@/utils/yielding";

function hasApiCall(body: ts.Node, sourceFile: ts.SourceFile): boolean {
  let found = false;

  function visit(node: ts.Node) {
    if (found) return;

    const callName = getCallExpressionName(node, sourceFile);
    if (callName && matchesPattern(callName, API_CALL_PATTERNS)) {
      found = true;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(body);
  return found;
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
    severity: Severity.High,
    file: filePath,
    line: line + 1,
    column: character + 1,
    explanation:
      "Event handler performs API calls without yielding to the main thread. This can block rendering and cause poor INP (Interaction to Next Paint).",
    fix: "Defer API calls using setTimeout or requestIdleCallback. For UI updates, update immediately, then defer API calls: updateUI(); requestAnimationFrame(() => { setTimeout(() => { fetchData(); }, 0); });",
    rule: RuleName.InpEventHandlerApiCalls,
    codeSnippet: codeSnippet.substring(0, 200),
  };
}

export const inpEventHandlerApiCallsRule: Rule = {
  config: {
    name: RuleName.InpEventHandlerApiCalls,
    description:
      "Detects event handlers that perform API calls without yielding to the main thread",
    metric: PerformanceMetric.Inp,
    defaultSeverity: Severity.High,
  },
  detect: (filePath: string, sourceFile: ts.SourceFile): PerformanceIssue[] => {
    const issues: PerformanceIssue[] = [];
    const eventHandlers = findEventHandlers(sourceFile);

    for (const handler of eventHandlers) {
      const body = getFunctionBody(handler);
      if (!body) continue;

      // Only flag if handler has API calls
      if (!hasApiCall(body, sourceFile)) {
        continue;
      }

      // Only flag if handler doesn't yield
      if (hasYieldingMechanism(body, sourceFile, true)) {
        continue;
      }

      const issue = createIssue(filePath, sourceFile, handler);
      issues.push(issue);
    }

    return issues;
  },
};
