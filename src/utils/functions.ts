import ts from "typescript";

export function findFunctionDefinition(
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

export function getFunctionBody(handler: ts.Node): ts.Node | null {
  if (ts.isArrowFunction(handler)) {
    return handler.body || null;
  }
  if (ts.isFunctionExpression(handler) || ts.isFunctionDeclaration(handler)) {
    return handler.body || null;
  }
  return handler;
}

export function getCallExpressionName(node: ts.Node, sourceFile: ts.SourceFile): string | null {
  if (!ts.isCallExpression(node)) return null;

  const expression = node.expression;
  if (ts.isIdentifier(expression)) {
    return expression.getText(sourceFile);
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.getText(sourceFile);
  }
  return null;
}

export function matchesPattern(name: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => name.includes(pattern));
}
