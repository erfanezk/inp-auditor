import ts from "typescript";
import { NON_COMPOSITED_CSS_PROPERTIES } from "@/constants/animations";
import type { PerformanceIssue, Rule } from "@/types";
import { PerformanceMetric, RuleName, Severity } from "@/types";
import { findEventHandlers } from "@/utils/event-handler";
import { getFunctionBody } from "@/utils/functions";

function detectNonCompositedProperties(body: ts.Node, sourceFile: ts.SourceFile): string[] {
  const cssProperties = new Set<string>();

  function visit(node: ts.Node) {
    // Detect non-composited CSS properties in template strings and variables
    if (ts.isTemplateLiteral(node) || ts.isStringLiteral(node)) {
      const text = node.getText(sourceFile);
      NON_COMPOSITED_CSS_PROPERTIES.forEach((property) => {
        if (
          text.includes(`"${property}"`) ||
          text.includes(`'${property}'`) ||
          text.includes(`${property}:`)
        ) {
          cssProperties.add(property);
        }
      });
    }

    // Detect object literals that might contain CSS properties
    if (ts.isObjectLiteralExpression(node)) {
      node.properties.forEach((property) => {
        if (ts.isPropertyAssignment(property)) {
          const propertyName = property.name.getText(sourceFile);
          const cleanName = propertyName.replace(/['"]/g, "");
          if (NON_COMPOSITED_CSS_PROPERTIES.includes(cleanName)) {
            cssProperties.add(cleanName);
          }
        }
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(body);
  return Array.from(cssProperties);
}

function findAnimationFunctions(sourceFile: ts.SourceFile): ts.Node[] {
  const functions: ts.Node[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node)
    ) {
      const functionText = node.getText(sourceFile);

      // Check if function contains animation-related patterns or CSS properties
      const hasAnimationCode =
        NON_COMPOSITED_CSS_PROPERTIES.some((prop) => functionText.includes(prop)) ||
        functionText.includes("animation") ||
        functionText.includes("transition") ||
        functionText.includes("style");

      if (hasAnimationCode) {
        functions.push(node);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return functions;
}

function createIssue(
  filePath: string,
  sourceFile: ts.SourceFile,
  handler: ts.Node,
  properties: string[]
): PerformanceIssue {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(handler.getStart());
  const codeSnippet = sourceFile.text.substring(handler.getStart(), handler.getEnd());

  return {
    metric: PerformanceMetric.Inp,
    severity: Severity.High,
    file: filePath,
    line: line + 1,
    column: character + 1,
    explanation: `Non-composited CSS properties (${properties.join(", ")}) detected in animations. Non-composited CSS animations run on the main thread, causing layout thrashing and blocking interactions, leading to poor INP (Interaction to Next Paint).`,
    fix: `Replace non-composited properties (${properties.join(", ")}) with composited alternatives like transform, opacity, or filter. Example: Instead of animating 'width' and 'height', use 'transform: scale()'. Instead of animating 'left' and 'top', use 'transform: translate()'.`,
    rule: RuleName.InpAnimationCompositing,
    codeSnippet: codeSnippet.substring(0, 200),
  };
}

export const inpAnimationCompositingRule: Rule = {
  config: {
    name: RuleName.InpAnimationCompositing,
    description:
      "Detects non-composited CSS properties in animations that cause layout thrashing and block the main thread",
    metric: PerformanceMetric.Inp,
    defaultSeverity: Severity.High,
  },
  detect: (filePath: string, sourceFile: ts.SourceFile): PerformanceIssue[] => {
    const issues: PerformanceIssue[] = [];
    const eventHandlers = findEventHandlers(sourceFile);
    const animationFunctions = findAnimationFunctions(sourceFile);

    for (const handler of [...eventHandlers, ...animationFunctions]) {
      const body = getFunctionBody(handler);
      if (!body) continue;

      const nonCompositedProperties = detectNonCompositedProperties(body, sourceFile);

      if (nonCompositedProperties.length > 0) {
        const issue = createIssue(filePath, sourceFile, handler, nonCompositedProperties);
        issues.push(issue);
      }
    }

    return issues;
  },
};
