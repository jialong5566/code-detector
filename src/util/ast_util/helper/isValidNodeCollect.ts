import { AstNode } from "../AstUtil";

export default function isValidNodeCollect(astNode: AstNode): astNode is AstNode {
  return typeof astNode?.type === 'string';
}