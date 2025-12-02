import {AstNode} from "../AstUtil";

export default function isValidArrayNodeCollect(astNode: any): astNode is AstNode[] {
  return Array.isArray(astNode) && astNode.some(v => typeof v?.type === 'string')
}