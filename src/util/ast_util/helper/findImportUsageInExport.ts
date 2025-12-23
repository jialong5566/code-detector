import {AstNode} from "../AstUtil";
import deepSearchParamsIdentifier from "./deepSearchParamsIdentifier";
import {EXPORT_DECLARATION_TYPES} from "../SHARED_CONSTANTS";

export function findImportUsageInExport(programNode: AstNode|undefined, importedNames: string[]){
  if(!programNode) return [];
  const importDeclarations = programNode._util.children.filter(node => node.type === "ImportDeclaration");
  const localIdentifiers = importDeclarations.map(node => (node as unknown as { specifiers: ({ local: AstNode })[] }).specifiers).flat().filter(Boolean).map(e => e.local);
  const targetSpecifiers = localIdentifiers.filter(item => importedNames.includes(item.name as string));
  return targetSpecifiers.map(item => {
    const members = wideDeepCollectNames([item]);
    return [item.name as string, members] as const;
  });
}



function wideDeepCollectNames(nodes: AstNode[]){
  const exportedNames = new Set<string>();
  const identifierSet = new Set<AstNode>();
  const bodyMemberSet = new Set<AstNode>();
  const memberCallback = (n: string) => n && exportedNames.add(n);
  wideHelper(nodes, bodyMemberSet, identifierSet, memberCallback);
  return [...exportedNames];
}

function wideHelper(idNodes: AstNode[], bodyMemberSet: Set<AstNode>, identifierSet: Set<AstNode>, memberCallback: (n: string) => void){
  const identifierSetTmp = new Set<AstNode>();
  const bodyElements = idNodes.map(item => [...item._util.provide].filter(e => e._util.parent?.type === "Program")).flat().filter(e => !bodyMemberSet.has(e));
  for (const node of bodyElements) {
    bodyMemberSet.add(node);
    collectIdentifiers(node, id => {
      if(identifierSet.has(id) || !id) return;
      identifierSet.add(id);
      identifierSetTmp.add(id);
    });
    collectExportIds(node, memberCallback, id => {
      if(identifierSet.has(id) || !id) return;
      identifierSet.add(id);
      identifierSetTmp.add(id);
    });
  }
  if(identifierSetTmp.size){
    wideHelper([...identifierSetTmp], bodyMemberSet, identifierSet, memberCallback);
  }
}


function collectIdentifiers(node: AstNode, callback: (id: AstNode) => void){
  if (node.type === "VariableDeclaration") {
    const declarations = (node as unknown as { declarations: AstNode[] }).declarations;
    for (const declaration of declarations) {
      if (declaration.type === "VariableDeclarator") {
        const id = (declaration as unknown as { id: AstNode}).id;
        deepSearchParamsIdentifier(id, callback);
      }
    }
  }
  if(EXPORT_DECLARATION_TYPES.includes(node.type as any)){
    const id = (node as unknown as { id: AstNode}).id;
    id && callback(id);
  }
}

function collectExportIds(node: AstNode, memberCallback: (name: string) => void, idCallback: (id: AstNode) => void){
  if(node.type === "ExportNamedDeclaration"){
    const specifiers = (node as unknown as { specifiers: AstNode[] }).specifiers;
    for(const specifier of specifiers){
      if(specifier.type === "ExportSpecifier"){
        memberCallback((specifier as unknown as { local: AstNode}).local.name as string);
      }
    }
    const declaration = (node as unknown as { declaration: { id: AstNode } & AstNode }).declaration;
    declaration && collectIdentifiers(declaration, id => {
      idCallback(id);
      memberCallback(id.name as string);
    });
  }
  if(node.type === "ExportDefaultDeclaration"){
    idCallback((node as unknown as { declaration: { id: AstNode } }).declaration?.id);
    memberCallback('default');
  }
}