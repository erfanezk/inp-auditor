import ts from "typescript";
import type { PerformanceIssue, Rule } from "@/types";
import { PerformanceMetric, RuleName, Severity } from "@/types";

const EVENT_HANDLER_NAMES = [
  "onClick",
  "onChange",
  "onSubmit",
  "onFocus",
  "onBlur",
  "onMouseEnter",
  "onMouseLeave",
  "onKeyDown",
  "onKeyUp",
  "onInput",
];

function isEventHandler(name: string): boolean {
  return EVENT_HANDLER_NAMES.some((handler) => name.startsWith(handler));
}

function isLoop(node: ts.Node): boolean {
  return (
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node)
  );
}

function countLoopIterations(node: ts.ForStatement | ts.WhileStatement): number {
  if (ts.isForStatement(node)) {
    const condition = node.condition;
    if (condition && ts.isBinaryExpression(condition)) {
      if (ts.isIdentifier(condition.left) && ts.isNumericLiteral(condition.right)) {
        const max = parseInt(condition.right.text, 10);
        if (condition.operatorToken.kind === ts.SyntaxKind.LessThanToken) {
          return max;
        }
        if (condition.operatorToken.kind === ts.SyntaxKind.LessThanEqualsToken) {
          return max + 1;
        }
      }
    }
  }
  return 0;
}

function hasNestedLoops(node: ts.Node): boolean {
  let foundLoop = false;
  ts.forEachChild(node, (child) => {
    if (isLoop(child)) {
      if (foundLoop) return true;
      foundLoop = true;
      if (hasNestedLoops(child)) return true;
    }
  });
  return false;
}

function findLoopsInNode(node: ts.Node): ts.Node[] {
  const loops: ts.Node[] = [];
  ts.forEachChild(node, (child) => {
    if (isLoop(child)) {
      loops.push(child);
    }
    loops.push(...findLoopsInNode(child));
  });
  return loops;
}

function findFunctionDefinition(
  identifier: ts.Identifier,
  sourceFile: ts.SourceFile
): ts.Node | null {
  const identifierName = identifier.getText(sourceFile);
  let foundDefinition: ts.Node | null = null;

  function visit(node: ts.Node) {
    // Variable declaration: const handleClick = () => { ... }
    if (ts.isVariableDeclaration(node)) {
      if (
        ts.isIdentifier(node.name) &&
        node.name.getText(sourceFile) === identifierName &&
        node.initializer
      ) {
        // Check if initializer is a function expression or arrow function
        if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
          foundDefinition = node.initializer;
          return;
        }
      }
    }

    // Function declaration: function handleClick() { ... }
    if (ts.isFunctionDeclaration(node)) {
      if (node.name && node.name.getText(sourceFile) === identifierName) {
        foundDefinition = node;
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return foundDefinition;
}

function findEventHandlers(sourceFile: ts.SourceFile): ts.Node[] {
  const handlers: ts.Node[] = [];

  function visit(node: ts.Node) {
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (isEventHandler(name) && node.initializer) {
        // Handle JSXExpressionContainer: onClick={handleClick} or onClick={() => {}}
        if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          const expr = node.initializer.expression;

          // If it's an arrow function or function expression directly
          if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
            handlers.push(expr);
          }
          // If it's an identifier, find the function definition
          else if (ts.isIdentifier(expr)) {
            const definition = findFunctionDefinition(expr, sourceFile);
            if (definition) {
              handlers.push(definition);
            }
          }
        }
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(sourceFile);
      if (isEventHandler(name) && node.initializer) {
        // If it's an arrow function or function expression directly
        if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
          handlers.push(node.initializer);
        }
        // If it's an identifier, find the function definition
        else if (ts.isIdentifier(node.initializer)) {
          const definition = findFunctionDefinition(node.initializer, sourceFile);
          if (definition) {
            handlers.push(definition);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return handlers;
}

export const inpHeavyLoopsRule: Rule = {
  config: {
    name: RuleName.InpHeavyLoops,
    description: "Detects heavy loops inside event handlers that can cause INP issues",
    metric: PerformanceMetric.Inp,
    defaultSeverity: Severity.High,
  },
  detect: (filePath: string, sourceFile: ts.SourceFile): PerformanceIssue[] => {
    const issues: PerformanceIssue[] = [];

    const eventHandlers = findEventHandlers(sourceFile);

    for (const handler of eventHandlers) {
      // Get the body of the function to check
      let bodyToCheck: ts.Node | null = null;

      if (ts.isArrowFunction(handler)) {
        bodyToCheck = handler.body || null;
      } else if (ts.isFunctionExpression(handler) || ts.isFunctionDeclaration(handler)) {
        bodyToCheck = handler.body || null;
      } else {
        bodyToCheck = handler;
      }

      if (!bodyToCheck) continue;

      const loops = findLoopsInNode(bodyToCheck);

      for (const loop of loops) {
        const iterations = ts.isForStatement(loop) ? countLoopIterations(loop) : 0;
        const hasNested = hasNestedLoops(loop);

        if (iterations > 10 || hasNested) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(loop.getStart());
          const codeSnippet = sourceFile.text.substring(loop.getStart(), loop.getEnd());

          issues.push({
            metric: PerformanceMetric.Inp,
            severity: Severity.High,
            file: filePath,
            line: line + 1,
            column: sourceFile.getLineAndCharacterOfPosition(loop.getStart()).character + 1,
            explanation: `Heavy loop detected in event handler. ${
              iterations > 10 ? `Loop iterates ${iterations} times. ` : ""
            }${
              hasNested ? "Nested loops detected. " : ""
            }This can block the main thread and cause poor INP (Interaction to Next Paint).`,
            fix: "Move heavy computation outside the event handler. Use requestIdleCallback, Web Workers, or debounce/throttle the handler.",
            rule: RuleName.InpHeavyLoops,
            codeSnippet: codeSnippet.substring(0, 200),
          });
        }
      }
    }

    return issues;
  },
};
