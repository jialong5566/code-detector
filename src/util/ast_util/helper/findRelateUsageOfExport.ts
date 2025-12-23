import {findImportUsageInExport} from "./findImportUsageInExport";
import getAstKitByFilePath from "../getAstKitByFilePath";

export type RelateUsageOfExport = {
  filePath: string;
  importMemberAndFile: { fromFile: string, localName: string }[];
  exportMember: string;
};

export default function findRelateUsageOfExport(effectedImportUsage: [string, string][], import2export: Record<string, string>, indirectExportMembers: Record<string, string>, absPathPrefix: string){
  const result: RelateUsageOfExport[] = [];
  const ignoreList: string[] = [];
  findRelateUsageOfExportHelper(effectedImportUsage, import2export, indirectExportMembers, absPathPrefix, result, ignoreList);
  return result;
}

function findRelateUsageOfExportHelper(effectedImportUsage: [string, string][], import2export: Record<string, string>, indirectExportMembers: Record<string, string>, absPathPrefix: string, result: RelateUsageOfExport[], ignoreList: string[], count = 0){
  const mapFileToImportMembers = effectedImportUsage.reduce((acc, [file, member]) => {
    acc[file] = acc[file] || [];
    acc[file].push(member);
    return acc;
  }, {} as  Record<string, string[]>);
  const effectedExportUsage = Object.entries(mapFileToImportMembers).map(([filePath, members]) => {
    const astKit = getAstKitByFilePath(filePath, absPathPrefix);
    const programNode = astKit.mapUuidToNode.get("Program");
    if (!programNode) return [];
    const list = findImportUsageInExport(programNode, members).map(([, exportMembers]) => exportMembers).flat();
    result.push(...list.map(exportMember => {
      const importMemberAndFile = members.map(member => {
        const fromFile = import2export[`${filePath}#${member}`]?.split("#")[0];
        return { fromFile, localName: member }
      });
      return { filePath, importMemberAndFile, exportMember }
    }));
    return list.map(item => [filePath, item] as const)
  }).flat();
  const effectedExportUsageFileAndMember = effectedExportUsage.map(([f, m]) => `${f}#${m}`);
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