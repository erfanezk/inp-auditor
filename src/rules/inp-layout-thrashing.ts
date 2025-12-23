import ts from "typescript";
import {
  LAYOUT_READ_PROPERTIES,
  LAYOUT_READ_DOCUMENT,
  LAYOUT_READ_MOUSE_EVENT,
  LAYOUT_READ_RANGE,
  LAYOUT_READ_VISUAL_VIEWPORT,
  LAYOUT_WRITE_DOM_METHODS,
  LAYOUT_WRITE_FOCUS_METHODS,
  LAYOUT_WRITE_SCROLL_METHODS,
  LAYOUT_WRITE_SCROLL_PROPERTIES,
  LAYOUT_WRITE_STYLE_PROPERTIES,
} from "@/constants/layout";
import type { PerformanceIssue, Rule } from "@/types";
import { PerformanceMetric, RuleName, Severity } from "@/types";
import { findEventHandlers } from "@/utils/event-handler";
import { getCallExpressionName, getFunctionBody } from "@/utils/functions";
import { isLoop } from "@/utils/loop";

interface LayoutOperation {
  node: ts.Node;
  type: "read" | "write";
  isInLoop: boolean;
}

function isLayoutRead(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  // Check property access: element.offsetWidth, window.scrollX, etc.
  if (ts.isPropertyAccessExpression(node)) {
    const name = node.name.getText(sourceFile);
    const allReadProps = [
      ...LAYOUT_READ_PROPERTIES,
      ...LAYOUT_READ_DOCUMENT,
      ...LAYOUT_READ_MOUSE_EVENT,
      ...LAYOUT_READ_RANGE,
    ] as readonly string[];

    if (allReadProps.includes(name)) {
      return true;
    }

    // Check for window.visualViewport.height, window.visualViewport.width, etc.
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.getText(sourceFile) === "visualViewport"
    ) {
      return (LAYOUT_READ_VISUAL_VIEWPORT as readonly string[]).includes(name);
    }
  }

  // Check method calls: element.getBoundingClientRect(), window.getComputedStyle(), etc.
  if (ts.isCallExpression(node)) {
    const callName = getCallExpressionName(node, sourceFile);
    const allReadMethods = [
      ...LAYOUT_READ_PROPERTIES,
      ...LAYOUT_READ_DOCUMENT,
      ...LAYOUT_READ_RANGE,
    ] as readonly string[];

    if (callName && allReadMethods.includes(callName)) {
      return true;
    }
  }

  return false;
}

function isLayoutWrite(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  // Check style property assignments: element.style.width = '100px'
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    const left = node.left;

    if (ts.isPropertyAccessExpression(left)) {
      const propertyName = left.name.getText(sourceFile);

      // Check style properties: element.style.width, element.style.height, etc.
      if ((LAYOUT_WRITE_STYLE_PROPERTIES as readonly string[]).includes(propertyName)) {
        // Verify it's a style property access (element.style.width)
        const expression = left.expression;
        if (
          ts.isPropertyAccessExpression(expression) &&
          expression.name.getText(sourceFile) === "style"
        ) {
          return true;
        }
      }

      // Check scroll properties: element.scrollTop = 0, element.scrollLeft = 0
      if ((LAYOUT_WRITE_SCROLL_PROPERTIES as readonly string[]).includes(propertyName)) {
        return true;
      }

      // Check DOM property assignments: element.innerHTML = '...', element.textContent = '...'
      if ((LAYOUT_WRITE_DOM_METHODS as readonly string[]).includes(propertyName)) {
        return true;
      }
    }
  }

  // Check method calls: element.appendChild(), element.scrollIntoView(), element.focus(), etc.
  if (ts.isCallExpression(node)) {
    const callName = getCallExpressionName(node, sourceFile);
    const allWriteMethods = [
      ...LAYOUT_WRITE_DOM_METHODS,
      ...LAYOUT_WRITE_SCROLL_METHODS,
      ...LAYOUT_WRITE_FOCUS_METHODS,
    ] as readonly string[];

    if (callName && allWriteMethods.includes(callName)) {
      return true;
    }
  }

  return false;
}

function isInsideLoop(node: ts.Node): boolean {
  let parent = node.parent;
  while (parent) {
    if (isLoop(parent)) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

function isInsideYieldingMechanism(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  let parent = node.parent;
  while (parent) {
    const callName = getCallExpressionName(parent, sourceFile);
    if (
      callName &&
      ["setTimeout", "requestAnimationFrame", "requestIdleCallback", "queueMicrotask"].includes(
        callName
      )
    ) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

function collectLayoutOperations(body: ts.Node, sourceFile: ts.SourceFile): LayoutOperation[] {
  const operations: LayoutOperation[] = [];

  function visit(node: ts.Node) {
    const isInLoop = isInsideLoop(node);
    const isInYield = isInsideYieldingMechanism(node, sourceFile);

    // Skip operations inside yielding mechanisms (deferred reads are OK)
    if (!isInYield) {
      if (isLayoutRead(node, sourceFile)) {
        operations.push({ node, type: "read", isInLoop });
      }
      if (isLayoutWrite(node, sourceFile)) {
        operations.push({ node, type: "write", isInLoop });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(body);
  return operations;
}

function detectReadAfterWrite(operations: LayoutOperation[]): LayoutOperation[][] {
  const sequences: LayoutOperation[][] = [];
  let currentSequence: LayoutOperation[] = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];

    if (op.type === "write") {
      currentSequence = [op];
    } else if (op.type === "read" && currentSequence.length > 0) {
      currentSequence.push(op);
      sequences.push([...currentSequence]);
      currentSequence = [];
    }
  }

  return sequences.filter((seq) => seq.length >= 2);
}

function detectReadWriteLoop(operations: LayoutOperation[]): boolean {
  // Check if there are reads inside loops that also contain writes
  const writesInLoops = new Set<ts.Node>();
  const readsInLoops: LayoutOperation[] = [];

  for (const op of operations) {
    if (op.type === "write" && op.isInLoop) {
      // Find the loop node
      let parent = op.node.parent;
      while (parent) {
        if (isLoop(parent)) {
          writesInLoops.add(parent);
          break;
        }
        parent = parent.parent;
      }
    }
    if (op.type === "read" && op.isInLoop) {
      readsInLoops.push(op);
    }
  }

  // Check if any read in a loop is in the same loop as a write
  for (const readOp of readsInLoops) {
    let parent = readOp.node.parent;
    while (parent) {
      if (isLoop(parent) && writesInLoops.has(parent)) {
        return true;
      }
      parent = parent.parent;
    }
  }

  return false;
}

function detectAlternatingPattern(operations: LayoutOperation[]): boolean {
  // Check for multiple alternating read/write patterns (more than 2 alternations)
  let alternations = 0;
  let lastType: "read" | "write" | null = null;

  for (const op of operations) {
    if (lastType !== null && lastType !== op.type) {
      alternations++;
    }
    lastType = op.type;
  }

  return alternations > 2;
}

function createIssue(
  filePath: string,
  sourceFile: ts.SourceFile,
  handler: ts.Node,
  patternType: "read-after-write" | "read-write-loop" | "alternating",
  _operations: LayoutOperation[]
): PerformanceIssue {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(handler.getStart());
  const codeSnippet = sourceFile.text.substring(handler.getStart(), handler.getEnd());

  let explanation: string;
  let severity: Severity;

  switch (patternType) {
    case "read-write-loop":
      explanation =
        "Layout thrashing detected: layout reads inside loops that contain DOM writes. This forces multiple synchronous layout recalculations, blocking the main thread and causing poor INP (Interaction to Next Paint).";
      severity = Severity.High;
      break;
    case "alternating":
      explanation =
        "Layout thrashing detected: multiple alternating read/write operations without batching. This forces repeated synchronous layout recalculations, blocking the main thread and causing poor INP.";
      severity = Severity.High;
      break;
    case "read-after-write":
    default:
      explanation =
        "Layout thrashing detected: DOM write followed by synchronous layout read. This forces a synchronous layout recalculation, blocking the main thread and causing poor INP (Interaction to Next Paint).";
      severity = Severity.Medium;
      break;
  }

  const fix =
    "Batch all layout reads before any writes, or defer reads using requestAnimationFrame. Example: const width = element.offsetWidth; const height = element.offsetHeight; element.style.width = width + 'px'; element.style.height = height + 'px';";

  return {
    metric: PerformanceMetric.Inp,
    severity,
    file: filePath,
    line: line + 1,
    column: character + 1,
    explanation,
    fix,
    rule: RuleName.InpLayoutThrashing,
    codeSnippet: codeSnippet.substring(0, 200),
  };
}

export const inpLayoutThrashingRule: Rule = {
  config: {
    name: RuleName.InpLayoutThrashing,
    description:
      "Detects layout thrashing patterns where DOM writes are followed by synchronous layout reads, causing forced reflows",
    metric: PerformanceMetric.Inp,
    defaultSeverity: Severity.Medium,
  },
  detect: (filePath: string, sourceFile: ts.SourceFile): PerformanceIssue[] => {
    const issues: PerformanceIssue[] = [];
    const eventHandlers = findEventHandlers(sourceFile);

    for (const handler of eventHandlers) {
      const body = getFunctionBody(handler);
      if (!body) continue;

      const operations = collectLayoutOperations(body, sourceFile);

      if (operations.length === 0) continue;

      // Check for read-write loop pattern (highest priority)
      if (detectReadWriteLoop(operations)) {
        issues.push(createIssue(filePath, sourceFile, handler, "read-write-loop", operations));
        continue;
      }

      // Check for alternating pattern
      if (detectAlternatingPattern(operations)) {
        issues.push(createIssue(filePath, sourceFile, handler, "alternating", operations));
        continue;
      }

      // Check for read-after-write patterns
      const readAfterWriteSequences = detectReadAfterWrite(operations);
      if (readAfterWriteSequences.length > 0) {
        issues.push(createIssue(filePath, sourceFile, handler, "read-after-write", operations));
      }
    }

    return issues;
  },
};
