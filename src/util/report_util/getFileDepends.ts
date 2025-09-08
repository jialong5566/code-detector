export default function getFileDepends(filePath: string, tree: Record<string, string[]>): string[][]{
  const res: string[][] = [];
  getFileDependsRecursive(res, [filePath], Object.entries(tree), 2);
  return res;
}

function getFileDependsRecursive(res: string[][], filePaths: string[], treeEntries: [string, string[]][], maxTry: number) {
  const depends = filePaths.map(f => treeEntries.filter((entry) => entry[1].includes(f)).map(e => e[0])).flat();
  if (depends.length > 0) {
    res.push(depends);
    if (maxTry === 0) return;
    getFileDependsRecursive(res, depends, treeEntries, maxTry - 1);
  }
}