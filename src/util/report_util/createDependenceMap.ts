import getAstKitByFilePath from "../ast_util/getAstKitByFilePath";
import {resolveImportPath} from "../ast_util/filePathResolver";

type DependenceDetail = {
  importedMap: Map<string, { imported: string, local: string}[]>,
  exportedMap: Map<string, { exported: string, local: string}[]>,
}

export function createDependenceMap(usingFilePaths: string[], parsedAlias: Record<string, string>, absPathPrefix: string){
  const usingFileNoPrefix = usingFilePaths.map(item => item.replace(absPathPrefix, ""));
  const localAlias = Object.fromEntries(Object.entries(parsedAlias).map(([k, v]) => [k, v.startsWith(absPathPrefix) ? v.replace(absPathPrefix, "") : v] ));
  const mapFilePathToDependenceDetail = new Map<string, DependenceDetail>();
  usingFilePaths.map((absFilePath, index) => {
    // console.log("createDependenceMap " + (index + 1) + "/" + usingFilePaths.length, absFilePath.replace(absPathPrefix, ""));
    const { mapUuidToNode } = getAstKitByFilePath(absFilePath, absPathPrefix, travelNode => ["ImportDeclaration", "ExportAllDeclaration", "ExportNamedDeclaration", "ExportDefaultDeclaration"].includes(travelNode.type));
    const programNode = mapUuidToNode.get("Program");
    if(!programNode){
      return;
    }
    const { importedMember, exportedMember } = programNode._util;
    const currentFilePath = absFilePath.replace(absPathPrefix, "");
    const { importedMap, exportedMap }  = mapFilePathToDependenceDetail.set(currentFilePath, mapFilePathToDependenceDetail.get(currentFilePath) || {
      importedMap: new Map(),
      exportedMap: new Map()
    }).get(currentFilePath)!;
    for(const { sourcePath, members } of importedMember){
      const { fullPath, isExternal } = resolveImportPath(localAlias, sourcePath, currentFilePath );
      const finalSourcePath = isExternal ? sourcePath : (fullPath?.find(p => usingFileNoPrefix.includes(p)) || sourcePath);
      const importedMemberDetail = importedMap.set(finalSourcePath, importedMap.get(finalSourcePath) || []).get(finalSourcePath)!;
      for(const { importedName: imported, localName: local } of members){
        importedMemberDetail.push({ imported, local });
      }
    }
    for(const { sourcePath, members, ExportAllDeclaration } of exportedMember){
      const { fullPath, isExternal } = resolveImportPath(localAlias, sourcePath, currentFilePath );
      const finalSourcePath = isExternal ? sourcePath : (fullPath?.find(p => usingFileNoPrefix.includes(p)) || sourcePath);
      const exportedMemberDetail = exportedMap.set(finalSourcePath, exportedMap.get(finalSourcePath) || []).get(finalSourcePath)!;
      for(const { exportedName: exported, localName: local } of members){
        exportedMemberDetail.push({ exported, local });
      }
      if(ExportAllDeclaration){
        exportedMemberDetail.push({ exported: "*", local: "*" });
      }
    }
  });
  const list = Array.from(mapFilePathToDependenceDetail.entries()).map(([k, v]) => {
    const { importedMap, exportedMap } = v;
    return [k, { importedMap: Object.fromEntries(importedMap.entries()), exportedMap: Object.fromEntries(exportedMap.entries()) }];
  });

  return Object.fromEntries(list);
}