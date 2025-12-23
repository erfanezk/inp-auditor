import ts from "typescript";

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

export { isInsideLoop };

export function isLoop(node: ts.Node): boolean {
  return (
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node)
  );
}
