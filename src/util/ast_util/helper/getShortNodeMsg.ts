import { AstNode } from "../AstUtil";

export default function getShortNodeMsg(node: AstNode, hideParentProperty = false){
  const { _util: { startLine, startColumn, endLine, endColumn, parentProperty, indexOfProperty }} = node;
  let type = node.type;
  let name = node.name;
  if(name && typeof name === "object"){
    type = name.type;
    name = name.name;
  }
  const msg = [
    hideParentProperty ? [] : [parentProperty, indexOfProperty !== null ? String(indexOfProperty) : null],
    [type, name]
  ].map((e: any[]) => e.filter(Boolean).join(":")).filter(Boolean).join(' ');
  return `${msg}「${startLine}:${startColumn}, ${endLine}:${endColumn}」`;
}