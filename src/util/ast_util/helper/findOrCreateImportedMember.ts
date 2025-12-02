import { AstNode } from "../AstUtil";

export default function findOrCreateImportedMember(importedMember: AstNode['_util']['importedMember'],sourceValue: string){
  let target = importedMember.find(v => v.sourcePath === sourceValue);
  if(!target){
    target = { sourcePath: sourceValue, members: [] };
    importedMember.push(target);
  }
  return target;
}