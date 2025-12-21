import * as fs from "node:fs/promises";
import type { SourceFile } from "typescript";
import ts from "typescript";

export async function parseFile(filePath: string): Promise<SourceFile | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    return sourceFile;
  } catch (error) {
    console.error(`Failed to parse ${filePath}:`, error);
    return null;
  }
}

export async function parseFiles(filePaths: string[]): Promise<Map<string, SourceFile>> {
  const sourceFiles = new Map<string, SourceFile>();

  await Promise.all(
    filePaths.map(async (filePath) => {
      const sourceFile = await parseFile(filePath);
      if (sourceFile) {
        sourceFiles.set(filePath, sourceFile);
      }
    })
  );

  return sourceFiles;
}
