import {createDetectReport} from "../report_util";
import {createExportedNameToReferenceLocalSet} from "./createDependenceMap";

export default function filterEffectedCode(reports: ReturnType<typeof createDetectReport>, depMemberInfo: ReturnType<typeof createExportedNameToReferenceLocalSet>){
  const { import2export, export2export } = depMemberInfo;
  const import2exportEntries = Object.entries(import2export);
  const export2exportEntries = Object.entries(export2export);
  return reports.map(report => {
    const { filePath, type, topEffectedExportsRemoved, topEffectedExportsAdded } = report;
    /** 所有影响到的 导出成员 */
    if(type === 'add'){
      const directUsages = getDirectUsages(filePath, import2exportEntries);
      const effectedExports1 = getEffectedExportsOfAddedFile(filePath, import2exportEntries);
      const effectedExports2 = getExportMembersOfFile(filePath, export2exportEntries).map(exportedName => `${filePath}#${exportedName}`);
      const effectedExports = [...new Set([...effectedExports1, ...effectedExports2])];
      const inDirectUsages = getIndirectUsages(filePath, import2exportEntries, export2exportEntries, effectedExports);
      return {
        filePath,
        type,
        effectedExports: [...new Set(effectedExports.map(e => e.split('#')[1]))],
        usages: [...new Set([...directUsages, ...inDirectUsages])],
      };
    }
    const effectedExports = [...new Set([...topEffectedExportsRemoved, ...topEffectedExportsAdded])];
    const directUsages = getDirectUsages(filePath, import2exportEntries, effectedExports);
    const inDirectUsages = getIndirectUsages(filePath, import2exportEntries, export2exportEntries, effectedExports.map(exportedName => `${filePath}#${exportedName}`));
    return {
      filePath,
      type,
      effectedExports,
      usages: [...new Set([...directUsages, ...inDirectUsages])],
    };
  });
};

function getEffectedExportsOfAddedFile(filePath: string, import2exportEntries: [string, string][]) {
  const exportedMembersUsing = import2exportEntries.filter(item => item[1].startsWith(`${filePath}#`)).map(item => item[1]);
  return exportedMembersUsing;
}


function getDirectUsages(filePath: string, import2exportEntries: [string, string][], givenExports?: string[]) {
  if(givenExports){
    // 修改的文件
    const currentExportPaths = givenExports.map(exportedName => `${filePath}#${exportedName}`);
    return import2exportEntries.filter(item => currentExportPaths.includes(item[1])).map(item => item[0]);
  }
  // 新增的文件
  return import2exportEntries.filter(item => item[1].startsWith(`${filePath}#`)).map(item => item[0]);
}

function getIndirectUsages(filePath: string, import2exportEntries: [string, string][], export2exportEntries: [string, string][], givenExports: string[]) {
  const indirectlyExportedMembers = export2exportEntries.filter(item => givenExports.includes(item[1])).map(item => item[0]);
  return import2exportEntries.filter(item => indirectlyExportedMembers.includes(item[1])).map(item => item[0]);
}

function getExportMembersOfFile(filePath: string, export2exportEntries: [string, string][]) {
  return export2exportEntries.filter(item => item[0].startsWith(`${filePath}#`)).map(item => item[0].split('#')[1]);
}