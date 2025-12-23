import ts from "typescript";
import { EVENT_HANDLER_NAMES } from "@/constants/handlers";
import { findFunctionDefinition } from "./functions";

export function isEventHandler(name: string): boolean {
  return EVENT_HANDLER_NAMES.some((handler) => name.startsWith(handler));
}

export function findEventHandlers(sourceFile: ts.SourceFile): ts.Node[] {
  const handlers: ts.Node[] = [];

  function visit(node: ts.Node) {
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (isEventHandler(name) && node.initializer) {
        if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          const expr = node.initializer.expression;

          if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
            handlers.push(expr);
          } else if (ts.isIdentifier(expr)) {
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
        if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
          handlers.push(node.initializer);
        } else if (ts.isIdentifier(node.initializer)) {
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
