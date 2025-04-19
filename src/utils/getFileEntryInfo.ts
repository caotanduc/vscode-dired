import * as fs from "fs/promises";
import * as path from "path";
import { formatMode } from "./formatMode";
import { humanFileSize } from "./humanFileSize";
import { formatDate } from "./formatDate";

export interface FileEntryInfo {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  mode: string;
  size: string;
  mtime: string;
}

export async function getFileEntryInfo(
  cwd: string,
  fileName: string
): Promise<FileEntryInfo> {
  const filePath = path.join(cwd, fileName);
  const stat = await fs.lstat(filePath);

  return {
    name: fileName,
    isFile: stat.isFile(),
    isDirectory: stat.isDirectory(),
    isSymbolicLink: stat.isSymbolicLink(),
    mode: formatMode(stat.mode),
    size: humanFileSize(stat.size),
    mtime: formatDate(stat.mtime),
  };
}
