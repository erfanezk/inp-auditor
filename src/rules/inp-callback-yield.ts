import ts from "typescript";
import { API_CALL_PATTERNS } from "@/constants/api-call";
import { DOM_MANIPULATION_PATTERNS } from "@/constants/dom";
import { HEAVY_ARRAY_OPS } from "@/constants/heavy-computation";
import { YIELDING_MECHANISMS } from "@/constants/yielding";
import type { PerformanceIssue, Rule } from "@/types";
import { PerformanceMetric, RuleName, Severity } from "@/types";
import { findEventHandlers } from "@/utils/event-handler";
import { getCallExpressionName, getFunctionBody, matchesPattern } from "@/utils/functions";
import { isInsideLoop } from "@/utils/loop";

const MAX_STATE_UPDATES = 2;

interface HandlerPatterns {
  hasApiCall: boolean;
  hasDomManipulation: boolean;
  stateUpdateCount: number;
  hasHeavyComputation: boolean;
  hasYielding: boolean;
}

function detectPatterns(body: ts.Node, sourceFile: ts.SourceFile): HandlerPatterns {
  const patterns: HandlerPatterns = {
    hasApiCall: false,
    hasDomManipulation: false,
    stateUpdateCount: 0,
    hasHeavyComputation: false,
    hasYielding: false,
  };

  function visit(node: ts.Node) {
    const callName = getCallExpressionName(node, sourceFile);

    if (callName) {
      if (matchesPattern(callName, API_CALL_PATTERNS)) {
        patterns.hasApiCall = true;
      }
      if (matchesPattern(callName, YIELDING_MECHANISMS)) {
        patterns.hasYielding = true;
      }
      if (callName.startsWith("set") || callName === "dispatch" || callName === "setState") {
        patterns.stateUpdateCount++;
      }
      // Only flag array operations if they're NOT inside a loop
      // (array operations in loops are less problematic than standalone heavy operations)
      if ((HEAVY_ARRAY_OPS as readonly string[]).includes(callName) && !isInsideLoop(node)) {
        patterns.hasHeavyComputation = true;
      }
    }

    if (ts.isPropertyAccessExpression(node)) {
      const name = node.name.getText(sourceFile);
      if (matchesPattern(name, DOM_MANIPULATION_PATTERNS)) {
        patterns.hasDomManipulation = true;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(body);
  return patterns;
}

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
  handler: ts.Node,
  patterns: HandlerPatterns,
  isIncorrectYielding: boolean
): PerformanceIssue | null {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(handler.getStart());
  const codeSnippet = sourceFile.text.substring(handler.getStart(), handler.getEnd());

  if (isIncorrectYielding) {
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

  const reasons: string[] = [];
  if (patterns.hasApiCall) reasons.push("API calls");
  if (patterns.hasDomManipulation) reasons.push("DOM manipulations");
  if (patterns.stateUpdateCount > MAX_STATE_UPDATES) {
    reasons.push(`${patterns.stateUpdateCount} state updates`);
  }
  if (patterns.hasHeavyComputation) reasons.push("heavy computations");

  if (reasons.length === 0) return null;

  return {
    metric: PerformanceMetric.Inp,
    severity: Severity.High,
    file: filePath,
    line: line + 1,
    column: character + 1,
    explanation: `Event handler performs ${reasons.join(", ")} without yielding to the main thread. This can block rendering and cause poor INP (Interaction to Next Paint).`,
    fix: "Break up the work using setTimeout, requestAnimationFrame, or requestIdleCallback. For UI updates, update immediately, then defer non-critical work using requestAnimationFrame(() => { setTimeout(() => { /* non-UI work */ }, 0); }).",
    rule: RuleName.InpCallbackYield,
    codeSnippet: codeSnippet.substring(0, 200),
  };
}

export const inpCallbackYieldRule: Rule = {
  config: {
    name: RuleName.InpCallbackYield,
    description:
      "Detects event handlers that don't properly yield to the main thread or follow best practices for callback optimization",
    metric: PerformanceMetric.Inp,
    defaultSeverity: Severity.High,
  },
  detect: (filePath: string, sourceFile: ts.SourceFile): PerformanceIssue[] => {
    const issues: PerformanceIssue[] = [];
    const eventHandlers = findEventHandlers(sourceFile);

    for (const handler of eventHandlers) {
      const body = getFunctionBody(handler);
      if (!body) continue;

      const patterns = detectPatterns(body, sourceFile);
      const hasNoYielding = !patterns.hasYielding;
      const incorrectYielding = patterns.hasYielding
        ? hasIncorrectYieldingPattern(body, sourceFile)
        : false;

      if (incorrectYielding) {
        const issue = createIssue(filePath, sourceFile, handler, patterns, true);
        if (issue) issues.push(issue);
      } else if (
        hasNoYielding &&
        (patterns.hasApiCall ||
          patterns.hasDomManipulation ||
          patterns.stateUpdateCount > MAX_STATE_UPDATES ||
          patterns.hasHeavyComputation)
      ) {
        const issue = createIssue(filePath, sourceFile, handler, patterns, false);
        if (issue) issues.push(issue);
      }
    }

    return issues;
  },
};
