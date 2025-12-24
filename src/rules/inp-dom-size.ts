import ts from "typescript";
import { MAX_NESTING_DEPTH } from "@/constants/dom-size";
import type { PerformanceIssue, Rule } from "@/types";
import { PerformanceMetric, RuleName, Severity } from "@/types";

interface DomSizeMetrics {
  maxDepth: number;
  elementName: string;
  location: { line: number; column: number };
}

function getElementName(node: ts.JsxOpeningLikeElement): string {
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
    if (ts.isIdentifier(node.tagName)) {
      return node.tagName.text;
    } else if (ts.isPropertyAccessExpression(node.tagName)) {
      return node.tagName.name.text;
    }
  }
  return "unknown";
}

function analyzeDomStructure(
  node: ts.JsxElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  currentDepth = 0
): DomSizeMetrics[] {
  const results: DomSizeMetrics[] = [];
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

  // Analyze current element
  const openingElement = ts.isJsxElement(node) ? node.openingElement : node;
  const elementName = getElementName(openingElement);

  const metrics: DomSizeMetrics = {
    maxDepth: currentDepth,
    elementName,
    location: { line: line + 1, column: character + 1 },
  };

  // Recursively analyze child JSX elements
  if (ts.isJsxElement(node)) {
    node.children.forEach((child) => {
      if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
        const childResults = analyzeDomStructure(child, sourceFile, currentDepth + 1);
        results.push(...childResults);

        // Update max depth based on children
        if (childResults.length > 0) {
          const childMaxDepth = Math.max(0, ...childResults.map((r) => r.maxDepth));
          metrics.maxDepth = Math.max(metrics.maxDepth, childMaxDepth);
        }
      }
    });
  }

  results.push(metrics);
  return results;
}

function createIssue(filePath: string, metrics: DomSizeMetrics): PerformanceIssue {
  const { line, column } = metrics.location;

  const explanation = `JSX element "${metrics.elementName}" has excessive nesting depth of ${metrics.maxDepth} levels. Deep component trees increase rendering time and memory usage, negatively impacting INP (Interaction to Next Paint).`;
  const severity = Severity.Medium;
  const fix = `Break down the component into smaller, reusable pieces. Extract deeply nested sections into separate components to flatten the component tree.`;

  return {
    metric: PerformanceMetric.Inp,
    severity,
    file: filePath,
    line,
    column,
    explanation,
    fix,
    rule: RuleName.InpDomSize,
    codeSnippet: `<${metrics.elementName} ... />`,
  };
}

function findJsxElements(sourceFile: ts.SourceFile): (ts.JsxElement | ts.JsxSelfClosingElement)[] {
  const elements: (ts.JsxElement | ts.JsxSelfClosingElement)[] = [];

  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      elements.push(node);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return elements;
}

export const inpDomSizeRule: Rule = {
  config: {
    name: RuleName.InpDomSize,
    description: "Detects excessive DOM size patterns that can negatively impact INP performance",
    metric: PerformanceMetric.Inp,
    defaultSeverity: Severity.Medium,
  },
  detect: (filePath: string, sourceFile: ts.SourceFile): PerformanceIssue[] => {
    const issues: PerformanceIssue[] = [];
    const jsxElements = findJsxElements(sourceFile);

    for (const element of jsxElements) {
      const metricsList = analyzeDomStructure(element, sourceFile);

      for (const metrics of metricsList) {
        // Check for excessive nesting only
        if (metrics.maxDepth > MAX_NESTING_DEPTH) {
          issues.push(createIssue(filePath, metrics));
        }
      }
    }

    return issues;
  },
};
