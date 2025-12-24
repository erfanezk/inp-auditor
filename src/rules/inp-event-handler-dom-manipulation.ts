import ts from "typescript";
import { DOM_MANIPULATION_PATTERNS } from "@/constants/dom";
import type { PerformanceIssue, Rule } from "@/types";
import { PerformanceMetric, RuleName, Severity } from "@/types";
import { findEventHandlers } from "@/utils/event-handler";
import { getFunctionBody, matchesPattern } from "@/utils/functions";
import { hasYieldingMechanism } from "@/utils/yielding";

function hasDomManipulation(body: ts.Node, sourceFile: ts.SourceFile): boolean {
  let found = false;

  function visit(node: ts.Node) {
    if (found) return;

    // Check for DOM manipulation method calls
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isPropertyAccessExpression(expression)) {
        const name = expression.name.getText(sourceFile);
        if (matchesPattern(name, DOM_MANIPULATION_PATTERNS)) {
          found = true;
          return;
        }
      }
    }

    // Check for property assignments (innerHTML, innerText, textContent)
    if (ts.isPropertyAccessExpression(node)) {
      const name = node.name.getText(sourceFile);
      if (matchesPattern(name, DOM_MANIPULATION_PATTERNS)) {
        // Check if it's a write operation (assignment)
        let parent = node.parent;
        while (parent) {
          if (
            ts.isBinaryExpression(parent) &&
            parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
          ) {
            found = true;
            return;
          }
          if (ts.isCallExpression(parent)) {
            // It's a read, not a write
            break;
          }
          parent = parent.parent;
        }
      }
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
      "Event handler performs DOM manipulation without yielding to the main thread. This can block rendering and cause poor INP (Interaction to Next Paint).",
    fix: "Defer DOM manipulation using requestAnimationFrame or setTimeout. For UI updates, update immediately, then defer heavy DOM operations: updateUI(); requestAnimationFrame(() => { setTimeout(() => { heavyDOMOperation(); }, 0); });",
    rule: RuleName.InpEventHandlerDomManipulation,
    codeSnippet: codeSnippet.substring(0, 200),
  };
}

export const inpEventHandlerDomManipulationRule: Rule = {
  config: {
    name: RuleName.InpEventHandlerDomManipulation,
    description:
      "Detects event handlers that perform DOM manipulation without yielding to the main thread",
    metric: PerformanceMetric.Inp,
    defaultSeverity: Severity.High,
  },
  detect: (filePath: string, sourceFile: ts.SourceFile): PerformanceIssue[] => {
    const issues: PerformanceIssue[] = [];
    const eventHandlers = findEventHandlers(sourceFile);

    for (const handler of eventHandlers) {
      const body = getFunctionBody(handler);
      if (!body) continue;

      // Only flag if handler has DOM manipulation
      if (!hasDomManipulation(body, sourceFile)) {
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
