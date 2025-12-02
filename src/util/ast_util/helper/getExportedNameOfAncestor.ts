import { AstNode } from "../AstUtil";
import { EXPORT_DECLARATION_TYPES } from "../SHARED_CONSTANTS";
import getExportedNameOfDeclarationIdentifier from "./getExportedNameOfDeclarationIdentifier";
import collectVariableDeclarationIdentifiers from "./collectVariableDeclarationIdentifiers";
import deepSearchParamsIdentifier from "./deepSearchParamsIdentifier";

export default function getExportedNameOfAncestor(node: AstNode|undefined|null){
  if(!node){
    console.warn("获取 上级导出成员名字报错: node is null");
    return [];
  }
  const ancestors = node._util.ancestors;
  const nodeArray = [...ancestors, node];
  const nameList = new Set<string>();
  outer: for (const ancestor of nodeArray) {
    if(ancestor.type === "VElement"){
      nameList.add("default");
      break outer;
    }
    if(ancestor.type === "ExportDefaultDeclaration"){
      const { declaration } = ancestor as unknown as AstNode & { declaration: null|AstNode };
      if(declaration){
        nameList.add("default");
        break outer;
      }
    }
    if(ancestor.type === "ExportNamedDeclaration"){
      const declarationType = (ancestor as any).declaration?.type;
      if(EXPORT_DECLARATION_TYPES.includes(declarationType)){
        const nameToAdd = (ancestor as any).declaration.id.name;
        if(nameToAdd){
          nameList.add(nameToAdd);
        }
        break outer;
      }
      else if(["VariableDeclaration"].includes(declarationType)){
        collectVariableDeclarationIdentifiers((ancestor as any).declaration, identifier => {
          nameList.add(identifier.name as string);
        });
        break outer;
      }
      else if(declarationType){
        console.log("未处理的 declarationType :", declarationType)
      }

      const specifiers = (ancestor as any).specifiers;
      if(Array.isArray(specifiers)){
        for (const specifier of specifiers) {
          if(specifier.type === "ExportSpecifier" || specifier.type === "ExportNamespaceSpecifier"){
            nameList.add((specifier as any).exported.name);
          }
        }
      }
      break outer;
    }
    if(["FunctionDeclaration", "ClassDeclaration"].includes(ancestor.type) && "Program" === ancestor._util.parent?.type){
      const ancestorId = (ancestor as any).id;
      if(ancestorId){
        const nameToAdd = getExportedNameOfDeclarationIdentifier(ancestorId);
        if(nameToAdd){
          nameList.add(nameToAdd);
        }
      }
      break outer;
    }
    if(["VariableDeclarator"].includes(ancestor.type)){
      const id = (ancestor as any).id;
      const varIdentifierSet = new Set<AstNode>();
      deepSearchParamsIdentifier(id, identifier => {
        varIdentifierSet.add(identifier);
      });
      for (const identifier of varIdentifierSet) {
        const nameToAdd = getExportedNameOfDeclarationIdentifier(identifier);
        if(nameToAdd){
          nameList.add(nameToAdd);
        }
      }
      break outer;
    }
  }
  return Array.from(nameList);
}