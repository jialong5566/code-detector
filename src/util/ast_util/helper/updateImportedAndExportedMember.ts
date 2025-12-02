import { AstNode } from "../AstUtil";
import { EXPORT_DECLARATION_TYPES } from "../SHARED_CONSTANTS";
import findOrCreateExportedMember from "./findOrCreateExportedMember";
import findOrCreateImportedMember from "./findOrCreateImportedMember";
import collectVariableDeclarationIdentifiers from "./collectVariableDeclarationIdentifiers";

export default function updateImportedAndExportedMember(node: AstNode, programNode: AstNode){
  const { type, source, declaration, specifiers, _util } = node as AstNode & { source: { value: string }, declaration?: null|(AstNode & { declarations: AstNode[] }), specifiers: (AstNode & { local?: { type: string, name: string}, exported: { type: string, name: string } })[] };
  const { filePath } = _util;
  const sourceValue = source?.value || filePath;
  const { importedMember, exportedMember } = programNode._util;
  if(type === "ImportDeclaration"){
    specifiers.forEach(specifier => {
      const { local, imported } = specifier as unknown as AstNode & { local: AstNode, imported?: AstNode };
      const target = findOrCreateImportedMember(importedMember, sourceValue);
      if(specifier.type === "ImportNamespaceSpecifier"){
        target.members.push({
          localName: local.name as string,
          importedName: "*",
        });
        return;
      }
      if(specifier.type === "ImportDefaultSpecifier"){
        target.members.push({
          localName: local.name as string,
          importedName: "default",
        });
        return;
      }
      if(specifier.type === "ImportSpecifier"){
        target.members.push({
          localName: local.name as string,
          importedName: imported!.name as string,
        });
      }
    });
  }
  if(type === "ExportAllDeclaration"){
    const target = exportedMember.find(v => v.sourcePath === sourceValue);
    if(!target){
      exportedMember.push({ sourcePath: sourceValue, members: [], ExportAllDeclaration: true });
    }
  }
  if(type === "ExportNamedDeclaration"){
    Array.isArray(specifiers) && specifiers.forEach(specifier => {
      const { local, exported } = specifier as unknown as { local: AstNode, exported: AstNode };
      const target = findOrCreateExportedMember(exportedMember,  sourceValue);
      if(specifier.type === "ExportNamespaceSpecifier"){
        target.members.push({
          localName: "*",
          exportedName: exported.name as string,
        });
        return;
      }
      if(specifier.type === "ExportSpecifier"){
        target.members.push({
          localName: local.name as string,
          exportedName: exported.name as string,
        });
        return;
      }
    });
    if(Array.isArray(declaration?.declarations)){
      declaration?.declarations.forEach(dec => {
        const target = findOrCreateExportedMember(exportedMember,  sourceValue);
        collectVariableDeclarationIdentifiers(dec,identifier => {
          try{
            const idName = identifier.name;
            target!.members.push({
              localName: idName as string,
              exportedName: idName as string,
            });
          } catch(e: any){
            console.log("declaration?.declarations.forEach", e.message);
          }
        });
      });
    }
    else if(EXPORT_DECLARATION_TYPES.includes(declaration?.type as any)){
      const target = findOrCreateExportedMember(exportedMember,  sourceValue);
      try{
        const idName = (declaration as any).id?.name;
        target.members.push({
          localName: idName as string,
          exportedName: idName as string,
        });
      } catch(e: any) {
        console.log("declaration " + e.message)
      }
    }
  }
  if(type === "ExportDefaultDeclaration"){
    let target = exportedMember.find(v => v.sourcePath === filePath);
    if(!target){
      target = { sourcePath: filePath, members: [], ExportAllDeclaration: false };
      exportedMember.push(target);
    }
    target.members.push({
      localName: "default",
      exportedName: "default",
    });
  }
}