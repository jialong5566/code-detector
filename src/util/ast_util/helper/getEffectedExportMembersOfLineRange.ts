import {AstNode} from "../AstUtil";
import deepSearchParamsIdentifier from "./deepSearchParamsIdentifier";
import {EXPORT_DECLARATION_TYPES} from "../SHARED_CONSTANTS";
import collectVariableDeclarationIdentifiers from "./collectVariableDeclarationIdentifiers";

export default function getEffectedExportMembersOfLineRange(mapFileLineToNodeSet: Map<number, Set<AstNode>>, startLine: number, endLine: number, filePath: string){
  const effectedExportMembers = new Set<string>();
  const identifiers = new Set<AstNode>();
  const callback = (identifier: AstNode) => identifiers.add(identifier);
  const programChildSet = new Set<AstNode>();
  for (let i = startLine; i <= endLine; i++) {
    const nodes = mapFileLineToNodeSet.get(i);
    if(!nodes) continue;
    for (const node of nodes) {
      const ancestors = node._util.ancestors;
      const programChild = ancestors.find(ancestor => ancestor._util.parent?.type === 'Program');
      if(programChild) programChildSet.add(programChild);
    }
  }
  for(const programChild of programChildSet) {
    const { type, _util } = programChild;

    if(type === "VariableDeclaration"){
      Array.from(new Set((programChild as unknown as { declarations: AstNode[] }).declarations)).forEach(declaration => {
        const id = (declaration as unknown as { id: AstNode }).id;
        if(id){
          deepSearchParamsIdentifier(id, callback);
        }
      });
    }
    if(EXPORT_DECLARATION_TYPES.includes(programChild.type as any)){
      const id = (programChild as unknown as { id: AstNode }).id;
      if(id){
        callback(id);
      }
    }
  }
  for(const identifier of identifiers){
    const { _util } = identifier;
    const { occupation } = _util;
    for(const occ of occupation){
      const programElement = occ._util.ancestors.find(ancestor => ancestor._util.parent?.type === 'Program');
      if(programElement){
        programChildSet.add(programElement);
      }
    }
  }
  for(const programChild of programChildSet) {
    const { type, specifiers, declaration } = programChild as unknown as { type: string, specifiers?: AstNode[], declaration?: AstNode & { declarations?: AstNode[]} };
    if (type === "ExportDefaultDeclaration") {
      effectedExportMembers.add("default");
    }
    if(type === "ExportNamedDeclaration"){
      Array.isArray(specifiers) && specifiers.forEach(specifier => {
        const { exported } = specifier as unknown as { exported: AstNode };
        if(exported){
          effectedExportMembers.add((exported as any).name);
        }
      });
    }
    if(type === "ExportNamedDeclaration" && EXPORT_DECLARATION_TYPES.includes(declaration?.type as any)){
      const idName = (declaration as any).id?.name;
      if(idName){
        effectedExportMembers.add(idName);
      }
    }
    if(type === "ExportNamedDeclaration" && Array.isArray(declaration?.declarations)){
      collectVariableDeclarationIdentifiers(declaration!,identifier => {
        try{
          const idName = identifier.name;
          typeof idName === "string" && effectedExportMembers.add(idName);
        } catch(e: any){
          console.log("getEffectedExportMembersOfLineRange", e.message);
        }
      });
    }
  }
  if(effectedExportMembers.size === 0 && filePath.endsWith('.vue')){
    effectedExportMembers.add('default');
  }
  return Array.from(effectedExportMembers);
};