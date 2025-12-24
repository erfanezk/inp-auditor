import ts from "typescript";
import { HEAVY_ARRAY_OPS } from "@/constants/heavy-computation";
import { YIELDING_MECHANISMS } from "@/constants/yielding";
import type { PerformanceIssue, Rule } from "@/types";
import { PerformanceMetric, RuleName, Severity } from "@/types";
import { findFunctions, getCallExpressionName, getFunctionBody } from "@/utils/functions";
import { isLoop } from "@/utils/loop";
import { hasYieldingMechanism } from "@/utils/yielding";

// Threshold: loop body must have at least 5 operations to be flagged
const MIN_LOOP_OPERATIONS = 5;

/**
 * Count meaningful operations inside a loop body
 * Only counts function calls, not property access (more precise)
 */
function countLoopOperations(loopBody: ts.Node, sourceFile: ts.SourceFile): number {
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

    // Count array operations (they're heavier)
    if (ts.isCallExpression(n)) {
      const callName = getCallExpressionName(n, sourceFile);
      if (callName && (HEAVY_ARRAY_OPS as readonly string[]).includes(callName)) {
        count += 1; // Array operations are heavier, add 1 more
      }
    }

    ts.forEachChild(n, visit);
  }

  visit(loopBody);
  return count;
}

/**
 * Check if a loop is inside a yielding mechanism (setTimeout, requestAnimationFrame, etc.)
 */
function isLoopInsideYielding(loopNode: ts.Node, sourceFile: ts.SourceFile): boolean {
  let parent = loopNode.parent;
  while (parent && !ts.isSourceFile(parent)) {
    if (ts.isCallExpression(parent)) {
      const callName = getCallExpressionName(parent, sourceFile);
      if (callName && YIELDING_MECHANISMS.some((name) => callName.includes(name))) {
        return true;
      }
    }
    parent = parent.parent;
  }
  return false;
}

function createIssue(
  filePath: string,
  sourceFile: ts.SourceFile,
  _functionNode: ts.Node,
  loopNode: ts.Node,
  operationCount: number
): PerformanceIssue {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(loopNode.getStart());
  const codeSnippet = sourceFile.text.substring(
    loopNode.getStart(),
    Math.min(loopNode.getEnd(), loopNode.getStart() + 200)
  );

  const explanation = `Loop contains ${operationCount} operations without yielding to the main thread. Loops that process many items can block the main thread for more than 50ms, causing poor INP (Interaction to Next Paint).`;
  const fix =
    "Break up the loop using scheduler.yield() or setTimeout: async function processItems(items) { for (const item of items) { processItem(item); if (items.indexOf(item) % 10 === 0) { await scheduler.yield?.() || new Promise(r => setTimeout(r, 0)); } } }";

  return {
    metric: PerformanceMetric.Inp,
    severity: Severity.High,
    file: filePath,
    line: line + 1,
    column: character + 1,
    explanation,
    fix,
    rule: RuleName.InpLongLoop,
    codeSnippet: codeSnippet.substring(0, 200),
  };
}

export const inpLongLoopRule: Rule = {
  config: {
    name: RuleName.InpLongLoop,
    description:
      "Detects loops (for/for-of/while) with heavy operations that don't yield to the main thread",
    metric: PerformanceMetric.Inp,
    defaultSeverity: Severity.High,
  },
  detect: (filePath: string, sourceFile: ts.SourceFile): PerformanceIssue[] => {
    const issues: PerformanceIssue[] = [];
    const functions = findFunctions(sourceFile);

    for (const func of functions) {
      const body = getFunctionBody(func);
      if (!body || ts.isExpression(body)) continue;

      // Skip if function already has yielding
      if (hasYieldingMechanism(body, sourceFile, true)) {
        continue;
      }

      // Find all loops in the function
      function findLoops(node: ts.Node): ts.Node[] {
        const loops: ts.Node[] = [];

        function visit(n: ts.Node) {
          if (isLoop(n)) {
            loops.push(n);
          }
          ts.forEachChild(n, visit);
        }

        visit(node);
        return loops;
      }

      const loops = findLoops(body);

      for (const loop of loops) {
        // Skip if loop is inside a yielding mechanism
        if (isLoopInsideYielding(loop, sourceFile)) {
          continue;
        }

        // Get loop body
        const loopBody =
          ts.isForStatement(loop) ||
          ts.isForOfStatement(loop) ||
          ts.isForInStatement(loop) ||
          ts.isWhileStatement(loop) ||
          ts.isDoStatement(loop)
            ? (
                loop as
                  | ts.ForStatement
                  | ts.ForOfStatement
                  | ts.ForInStatement
                  | ts.WhileStatement
                  | ts.DoStatement
              ).statement
            : null;

        if (!loopBody) continue;

        // Count operations in loop body
        const operationCount = countLoopOperations(loopBody, sourceFile);

        // Check if loop body has yielding
        const loopBodyHasYielding = hasYieldingMechanism(loopBody, sourceFile, false);

        // Flag if loop has many operations and no yielding
        if (operationCount >= MIN_LOOP_OPERATIONS && !loopBodyHasYielding) {
          const issue = createIssue(filePath, sourceFile, func, loop, operationCount);
          issues.push(issue);
        }
      }
    }

    return issues;
  },
};
