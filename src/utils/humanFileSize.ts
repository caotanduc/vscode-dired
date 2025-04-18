export function humanFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`.padStart(10, " ");
  }

  const units = ["K", "M", "G", "T"];
  let size = bytes;
  let unitIndex = -1;

  do {
    size /= 1024;
    unitIndex++;
  } while (size >= 1024 && unitIndex < units.length - 1);

  return `${size.toFixed(1)}${units[unitIndex]}`.padStart(10, " ");
}
