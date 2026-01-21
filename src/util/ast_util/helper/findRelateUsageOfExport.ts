import {findImportUsageInExport} from "./findImportUsageInExport";
import getAstKitByFilePath from "../getAstKitByFilePath";
import {join} from "path";

export type RelateUsageOfExport = {
  filePath: string; // 当前文件
  importMemberAndFile: { fromFile: string, localName: string }[]; // 导入的成员的 本地变量名 以及 来源文件
  exportMember: string; // 影响到的 当前文件的 导出成员
};

export default function findRelateUsageOfExport(effectedImportUsage: [string, string][], import2export: Record<string, string>, indirectExportMembers: Record<string, string>, absPathPrefix: string){
  const result: RelateUsageOfExport[] = [];
  const ignoreList: string[] = [];
  findRelateUsageOfExportHelper(effectedImportUsage, import2export, indirectExportMembers, absPathPrefix, result, ignoreList);
  return result;
}

function findRelateUsageOfExportHelper(effectedImportUsage: [string, string][], import2export: Record<string, string>, indirectExportMembers: Record<string, string>, absPathPrefix: string, result: RelateUsageOfExport[], ignoreList: string[], count = 0){
  // 映射关系：文件 -> 导入成员
  const mapFileToImportMembers = effectedImportUsage.reduce((acc, [file, member]) => {
    acc[file] = acc[file] || [];
    acc[file].push(member);
    return acc;
  }, {} as  Record<string, string[]>);
  const effectedExportUsage = Object.entries(mapFileToImportMembers).map(([filePath, members]) => {
    const astKit = getAstKitByFilePath(join(absPathPrefix, filePath), absPathPrefix);
    const programNode = astKit.mapUuidToNode.get("Program");
    if (!programNode) return [];
    // 导入成员 影响到的 导出成员
    const list: string[] = findImportUsageInExport(programNode, members).map(([, exportMembers]) => exportMembers).flat();
    result.push(...list.map(exportMember => {
      const importMemberAndFile = members.map(member => {
        const fromFile = import2export[`${filePath}#${member}`]?.split("#")[0];
        return { fromFile, localName: member }
      });
      return { filePath, importMemberAndFile, exportMember }
    }));
    return list.map(item => [filePath, item] as const)
  }).flat();
  // 拼接 文件与导出成员
  const effectedExportUsageFileAndMember = effectedExportUsage.map(([f, m]) => `${f}#${m}`);
  // 通过 文件与导出成员 找出 新的 影响到的导入成员
  const effectedImportUsageList = [...Object.entries(import2export), ...Object.entries(indirectExportMembers)].filter(([, exportFileAndMember]) => {
    return effectedExportUsageFileAndMember.includes(exportFileAndMember)
  }).map(([_]) => _);
  ignoreList.push(...effectedImportUsageList);
  if (count > 10 || !effectedImportUsageList.length) {
    console.log("findRelateUsageOfExportHelper", count, effectedImportUsageList);
    return;
  };
  findRelateUsageOfExportHelper(effectedImportUsageList.map(e => e.split("#") as [string, string]), import2export, indirectExportMembers, absPathPrefix, result, ignoreList, count + 1);
}