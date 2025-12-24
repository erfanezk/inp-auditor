import ts from "typescript";
import { YIELDING_MECHANISMS } from "@/constants/yielding";
import { getCallExpressionName, matchesPattern } from "./functions";

/**
 * Checks if a node or its context contains yielding mechanisms
 */
export function hasYieldingMechanism(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  checkContext: boolean = false
): boolean {
  let hasYield = false;

  function visit(n: ts.Node) {
    const callName = getCallExpressionName(n, sourceFile);

    // Check for standard yielding mechanisms
    if (callName && matchesPattern(callName, YIELDING_MECHANISMS)) {
      hasYield = true;
      return;
    }

    // Check for scheduler.yield() specifically
    if (ts.isPropertyAccessExpression(n)) {
      const name = n.name.getText(sourceFile);
      if (name === "yield") {
        // Check if it's scheduler.yield or globalThis.scheduler.yield
        if (ts.isIdentifier(n.expression)) {
          const objName = n.expression.getText(sourceFile);
          if (objName === "scheduler") {
            hasYield = true;
            return;
          }
        } else if (ts.isPropertyAccessExpression(n.expression)) {
          const propAccess = n.expression;
          if (propAccess.name.getText(sourceFile) === "scheduler") {
            const objName = propAccess.expression.getText(sourceFile);
            if (objName === "globalThis" || objName === "window") {
              hasYield = true;
              return;
            }
          }
        }
      }
    }

    if (!hasYield) {
      ts.forEachChild(n, visit);
    }
  }

  visit(node);

  // Also check parent context if requested
  if (!hasYield && checkContext) {
    let parent = node.parent;
    while (parent && !ts.isSourceFile(parent)) {
      if (ts.isCallExpression(parent)) {
        const parentCallName = getCallExpressionName(parent, sourceFile);
        if (parentCallName && matchesPattern(parentCallName, YIELDING_MECHANISMS)) {
          hasYield = true;
          break;
        }
      }
      parent = parent.parent;
    }
  }

  return hasYield;
}

/**
 * Checks if an async function has yielding mechanisms (await scheduler.yield(), etc.)
 */
export function hasYieldingInAsyncFunction(body: ts.Node, sourceFile: ts.SourceFile): boolean {
  let hasYield = false;

  function visit(node: ts.Node) {
    // Check for await with yielding mechanisms
    if (ts.isAwaitExpression(node) && ts.isCallExpression(node.expression)) {
      const awaitCallName = getCallExpressionName(node.expression, sourceFile);
      if (awaitCallName && matchesPattern(awaitCallName, YIELDING_MECHANISMS)) {
        hasYield = true;
        return;
      }

      // Check for scheduler.yield()
      if (ts.isPropertyAccessExpression(node.expression.expression)) {
        const propAccess = node.expression.expression as ts.PropertyAccessExpression;
        const propName = propAccess.name.getText(sourceFile);
        if (propName === "yield") {
          hasYield = true;
          return;
        }
      }
    }

    // Check for scheduler.yield() directly
    if (ts.isPropertyAccessExpression(node)) {
      const name = node.name.getText(sourceFile);
      if (name === "yield") {
        hasYield = true;
        return;
      }
    }

    if (!hasYield) {
      ts.forEachChild(node, visit);
    }
  }

  visit(body);
  return hasYield;
}
