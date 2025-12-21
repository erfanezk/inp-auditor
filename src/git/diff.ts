import { type DiffResultTextFile, simpleGit } from "simple-git";
import type { ChangedFile, GitDiffResult } from "@/types";
import { ChangedFileStatus } from "@/types";

const TS_FILE_EXTENSIONS = [".ts", ".tsx"];

function isTypeScriptFile(filePath: string): boolean {
  return TS_FILE_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}

function getFileStatus(file: { insertions?: number; deletions?: number }): ChangedFileStatus {
  const insertions = file.insertions ?? 0;
  const deletions = file.deletions ?? 0;

  if (insertions === 0 && deletions > 0) return ChangedFileStatus.Deleted;
  if (insertions > 0 && deletions === 0) return ChangedFileStatus.Added;
  return ChangedFileStatus.Modified;
}

function parseDiffSpec(diffSpec: string): { from: string; to: string } {
  if (diffSpec.includes("..")) {
    const [from, to] = diffSpec.split("..", 2);
    return { from: from.trim(), to: to.trim() || "HEAD" };
  }
  return { from: diffSpec, to: "HEAD" };
}

export async function getChangedFiles(
  diffSpec: string,
  repoPath: string = process.cwd()
): Promise<GitDiffResult> {
  try {
    const git = simpleGit(repoPath);
    const { from, to } = parseDiffSpec(diffSpec);
    const diffSummary = await git.diffSummary([from, to]);

    const changedFiles: ChangedFile[] = diffSummary.files
      .filter((file) => isTypeScriptFile(file.file) && !file.binary)
      .map((file) => ({
        path: file.file,
        status: getFileStatus(file as DiffResultTextFile),
      }));

    return { changedFiles };
  } catch (error) {
    return {
      changedFiles: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
