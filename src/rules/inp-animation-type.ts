import ts from "typescript";
import { CSS_ANIMATION_PATTERNS, JAVASCRIPT_ANIMATION_PATTERNS } from "@/constants/animations";
import type { PerformanceIssue, Rule } from "@/types";
import { PerformanceMetric, RuleName, Severity } from "@/types";
import { findEventHandlers } from "@/utils/event-handler";
import { getCallExpressionName, getFunctionBody, matchesPattern } from "@/utils/functions";

function detectAnimationPatterns(
  body: ts.Node,
  sourceFile: ts.SourceFile
): {
  hasJavaScriptAnimation: boolean;
  hasCssAnimation: boolean;
} {
  const patterns = {
    hasJavaScriptAnimation: false,
    hasCssAnimation: false,
  };

  function visit(node: ts.Node) {
    // Detect JavaScript animations
    const callName = getCallExpressionName(node, sourceFile);
    if (callName && matchesPattern(callName, JAVASCRIPT_ANIMATION_PATTERNS)) {
      patterns.hasJavaScriptAnimation = true;
    }

    // Detect CSS animations in template strings and variables
    if (ts.isTemplateLiteral(node) || ts.isStringLiteral(node)) {
      const text = node.getText(sourceFile);
      CSS_ANIMATION_PATTERNS.forEach((pattern) => {
        if (text.includes(pattern)) {
          patterns.hasCssAnimation = true;
        }
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(body);
  return patterns;
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

      // Check if function contains animation-related patterns
      const animationKeywords = [...JAVASCRIPT_ANIMATION_PATTERNS, ...CSS_ANIMATION_PATTERNS];
      const hasAnimationCode = animationKeywords.some((keyword) => functionText.includes(keyword));

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
  handler: ts.Node
): PerformanceIssue {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(handler.getStart());
  const codeSnippet = sourceFile.text.substring(handler.getStart(), handler.getEnd());

  return {
    metric: PerformanceMetric.Inp,
    severity: Severity.Medium,
    file: filePath,
    line: line + 1,
    column: character + 1,
    explanation:
      "JavaScript animations instead of CSS animations detected. CSS animations run on the compositor thread and don't block the main thread, providing better performance and lower input delay.",
    fix: "Use CSS animations whenever possible. Replace JavaScript animation loops with CSS transitions or animations. For complex animations, consider using CSS @keyframes or the Web Animations API.",
    rule: RuleName.InpAnimationType,
    codeSnippet: codeSnippet.substring(0, 200),
  };
}

export const inpAnimationTypeRule: Rule = {
  config: {
    name: RuleName.InpAnimationType,
    description:
      "Detects JavaScript animations that should be replaced with CSS animations for better performance",
    metric: PerformanceMetric.Inp,
    defaultSeverity: Severity.Medium,
  },
  detect: (filePath: string, sourceFile: ts.SourceFile): PerformanceIssue[] => {
    const issues: PerformanceIssue[] = [];
    const eventHandlers = findEventHandlers(sourceFile);
    const animationFunctions = findAnimationFunctions(sourceFile);

    for (const handler of [...eventHandlers, ...animationFunctions]) {
      const body = getFunctionBody(handler);
      if (!body) continue;

      const patterns = detectAnimationPatterns(body, sourceFile);

      // Only flag if JS animation AND no CSS animation present
      if (patterns.hasJavaScriptAnimation && !patterns.hasCssAnimation) {
        const issue = createIssue(filePath, sourceFile, handler);
        issues.push(issue);
      }
    }

    return issues;
  },
};
