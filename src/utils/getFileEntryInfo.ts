import * as fs from "fs/promises";
import * as path from "path";
import { formatMode } from "./formatMode";
import { humanFileSize } from "./humanFileSize";
import { formatDate } from "./formatDate"; // you’ll need to create this
import { FileType } from "vscode";

export interface FileEntryInfo {
  name: string;
  type: FileType;
  mode: string;
  size: string;
  mtime: string;
}

export async function getFileEntryInfo(
  cwd: string,
  entry: [string, FileType]
): Promise<FileEntryInfo> {
  const [name, type] = entry;
  const filePath = path.join(cwd, name);
  const stat = await fs.stat(filePath);
  return {
    name,
    type,
    mode: formatMode(stat.mode),
    size: humanFileSize(stat.size),
    mtime: formatDate(stat.mtime),
  };
}
