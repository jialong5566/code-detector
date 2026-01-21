import getAstKitByFilePath from "../ast_util/getAstKitByFilePath";
import {join} from "path";
import resolveImportPath from "./resolveImportPath";


export function createExportedNameToReferenceLocalSet(upstreamFileFullPaths: string[], parsedAlias: Record<string, string>, absPathPrefix: string, projectFilePaths: string[]) {
  const cwd = process.cwd();
  const systemAbsPathPrefix = absPathPrefix.startsWith(cwd) ? absPathPrefix : join(cwd, absPathPrefix);
  const localAlias = Object.fromEntries(Object.entries(parsedAlias).map(([k, v]) => [k, v.startsWith(systemAbsPathPrefix) ? v.replace(systemAbsPathPrefix, "") : v] ));
  const import2export: Record<string, string> = {};
  const export2export: Record<string, string> = {};
  const mapFilePathToExportAllSources: Record<string, string[]> = {};
  // 过滤 有效后缀，排除 .d.ts
  const validFiles = upstreamFileFullPaths.filter(e => ['.ts', '.tsx', '.js', '.jsx', '.vue'].some(ext => e.endsWith(ext) && !e.endsWith('.d.ts')));
  // 遍历 文件集合的 绝对路径
  for(const absFilePath of validFiles){
    const { mapUuidToNode } = getAstKitByFilePath(absFilePath, absPathPrefix, travelNode => ["ImportDeclaration", "ExportAllDeclaration", "ExportNamedDeclaration", "ExportDefaultDeclaration"].includes(travelNode.type));
    // 获取 每个文件的 Program 节点
    const programNode = mapUuidToNode.get("Program");
    if(!programNode){
      console.log("no program node in file: " + absFilePath.replace(absPathPrefix, ""))
      continue;
    }
    // 获取 每个文件的 导入导出 信息
    const { importedMember, exportedMember } = programNode._util;
    // 拿到 文件 想对路径
    const relativeFilePath = absFilePath.replace(absPathPrefix, "");
    // 遍历 所有导入信息
    for(const { sourcePath, members } of importedMember){
      const { fullPath, isExternal } = resolveImportPath(localAlias, sourcePath, relativeFilePath );
      // 获取 导入成员的 真实路径信息
      const finalSourcePath = createRealSourcePath(sourcePath, isExternal, projectFilePaths, fullPath);
      // 遍历导入成员
      for(const { importedName: imported, localName: local } of members){
        const importLocal = `${relativeFilePath}#${local}`; // 必定唯一
        const exportedName = `${finalSourcePath}#${imported}`; // 可能重复
        import2export[importLocal] = exportedName;
      }
      // 没有导入成员，则认为是导入整个文件
      if (members.length === 0){
        import2export[relativeFilePath] = finalSourcePath;
      }
    }
    // 遍历 所有导出信息
    for(const { sourcePath, members, ExportAllDeclaration } of exportedMember){
      const { fullPath, isExternal } = resolveImportPath(localAlias, sourcePath, relativeFilePath );
      // 获取 导出成员的 真实路径信息
      const finalSourcePath = createRealSourcePath(sourcePath, isExternal, projectFilePaths, fullPath);
      // 遍历导出成员
      for(const { exportedName: exported, localName: local } of members){
        const exportedName = `${relativeFilePath}#${exported}`; // 必定唯一
        const importLocal = `${finalSourcePath}#${local}`; // 可能重复
        export2export[exportedName] = importLocal;
      }
      if(ExportAllDeclaration){
        // 导出所有成员，记录导出源文件路径
        mapFilePathToExportAllSources[relativeFilePath] = [...(mapFilePathToExportAllSources[relativeFilePath] || []), finalSourcePath];
      }
    }
  };

  const indirectExportMembers = genIndirectExportMembers(mapFilePathToExportAllSources, export2export, import2export);
  return {
    import2export,
    export2export,
    mapFilePathToExportAllSources,
    indirectExportMembers
  };
}


function createRealSourcePath(sourcePath: string, isExternal: boolean, projectFilePaths: string[], fullPath: string[]|null){
  return isExternal ? sourcePath : (fullPath?.find(p => projectFilePaths.includes(p)) || sourcePath);
}

function genIndirectExportMembers(mapFilePathToExportAllSources: Record<string, string[]>, export2export: Record<string, string>, import2export: Record<string, string>){
  const export2exportEntries = Object.entries(export2export);
  const potentialExportMap: Record<string, string> = {};
  for (const exportAllSourcesKey in mapFilePathToExportAllSources) {
    const exportAllSources = mapFilePathToExportAllSources[exportAllSourcesKey];
    deepIterExportAllSources(exportAllSources, mapFilePathToExportAllSources, export2exportEntries, exportAllSourcesKey, potentialExportMap,[exportAllSourcesKey]);
  }
  const import2exportEntries = Object.entries(import2export);
  return import2exportEntries.reduce((acc, [importMemberPath, exportMemberPath]) => {
    const realExportPath = potentialExportMap[exportMemberPath];
    if(realExportPath){
      acc[importMemberPath] = realExportPath;
    }
    return acc;
  }, {} as Record<string, string>);
}

function deepIterExportAllSources(exportAllSources: string[], mapFilePathToExportAllSources: Record<string, string[]>, export2exportEntries: [string, string][], exportAllSourcesKey: string,  potentialExportMap: Record<string, string>, travelledPaths: string[]){
  for (const exportAllSource of exportAllSources) {
    const existingExportMembers = export2exportEntries.filter(([exportPath]) => exportPath.startsWith(exportAllSource));
    for (const [exportPath, exportRealSource] of existingExportMembers) {
      const memberName = exportPath.split("#")[1];
      if (memberName) {
        potentialExportMap[`${exportAllSourcesKey}#${memberName}`] = exportRealSource;
      }
    }
    travelledPaths.push(exportAllSource);
    const tmpList = mapFilePathToExportAllSources[exportAllSource]?.filter(e => !travelledPaths.includes(e));
    if(Array.isArray(tmpList) && tmpList.length > 0){
      deepIterExportAllSources(tmpList, mapFilePathToExportAllSources, export2exportEntries, exportAllSource, potentialExportMap, travelledPaths);
    }
  }
}