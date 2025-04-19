import { readlinkSync } from "fs";

export function getSymlinkTarget(path: string): string {
  try {
    const target = readlinkSync(path);
    return target;
  } catch {
    return "";
  }
}
