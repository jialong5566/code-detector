import { AstNode } from "../AstUtil";
import deepSearchParamsIdentifier from "./deepSearchParamsIdentifier";

export default function collectVariableDeclarationIdentifiers(node: AstNode, callback: (identifier: AstNode) => void) {
  if(node.type !== "VariableDeclaration") return;
  const declarations = (node as unknown as { declarations: AstNode[]}).declarations;
  for (const declaration of declarations) {
    deepSearchParamsIdentifier((declaration as unknown as { id: AstNode|null}).id, callback);
  }
}