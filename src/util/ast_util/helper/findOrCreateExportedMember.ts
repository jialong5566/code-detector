import { AstNode } from "../AstUtil";

export default function findOrCreateExportedMember(exportedMember: AstNode['_util']['exportedMember'],sourceValue: string){
  let target = exportedMember.find(v => v.sourcePath === sourceValue);
  if(!target){
    target = { sourcePath: sourceValue, members: [], ExportAllDeclaration: false };
    exportedMember.push(target);
  }
  return target;
}