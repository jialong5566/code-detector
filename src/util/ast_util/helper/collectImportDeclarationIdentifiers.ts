import { AstNode } from "../AstUtil";

export default function collectImportDeclarationIdentifiers(node: AstNode, callback: (identifier: AstNode) => void){
  if(node.type !== "Program") return;
  const { body } = node as unknown as { body: AstNode[] };
  Array.isArray(body) && body.forEach(node => {
    if(node.type === "ImportDeclaration"){
      const specifiers = (node as unknown as { specifiers: AstNode[] }).specifiers;
      for (const specifier of specifiers) {
        const local = (specifier as unknown as { local: AstNode }).local;
        callback(local);
      }
    }
  });
}