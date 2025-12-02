import { AstNode } from "../AstUtil";
import { EXPORT_DECLARATION_TYPES } from "../SHARED_CONSTANTS";

export default function collectDeclarationIdentifiers(node: AstNode, callback: (identifier: AstNode) => void) {
  if(!EXPORT_DECLARATION_TYPES.includes(node.type as any)) return;
  const id = (node as unknown as { id: AstNode|null }).id;
  id && callback(id);
}