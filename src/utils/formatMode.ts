export function formatMode(mode: number): string {
  const S_IFMT = 0o170000;
  const S_IFDIR = 0o040000;
  const S_IFLNK = 0o120000;

  let typeChar = "-";
  if ((mode & S_IFMT) === S_IFDIR) {
    typeChar = "d";
  } else if ((mode & S_IFMT) === S_IFLNK) {
    typeChar = "l";
  }

  // Permissions
  const perms = (mode & 0o777).toString(8).padStart(3, "0");
  const rwx = perms
    .split("")
    .map((d) => {
      const n = parseInt(d, 8);
      return `${n & 4 ? "r" : "-"}${n & 2 ? "w" : "-"}${n & 1 ? "x" : "-"}`;
    })
    .join("");

  // Placeholder for extended attribute mark
  const hasExtendedAttr = "@"; // Hardcoded as '@' for now

  return typeChar + rwx + hasExtendedAttr;
}
