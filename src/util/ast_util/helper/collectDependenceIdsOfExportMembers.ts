import { AstNode } from "../AstUtil";

export default function collectDependenceIdsOfExportMembers(node: AstNode, callback: (identifier: AstNode) => void){
  if(node.type === "ExportNamedDeclaration"){
    const { declaration, specifiers } = (node as unknown as { declaration: AstNode, specifiers: AstNode[] });
    if(declaration?.type === "Identifier"){
      callback(declaration);
    }
    for (const specifier of specifiers) {
      const { local } = specifier as unknown as { local: AstNode } ;
      if(local?.type === "Identifier"){
        callback(local);
      }
    }
  }
  if(node.type === "ExportDefaultDeclaration"){
    const declaration = (node as unknown as { declaration: AstNode }).declaration;
    if(declaration?.type === "Identifier"){
      callback(declaration);
    }
  }
}