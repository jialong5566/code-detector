import { AstNode } from "../AstUtil";

export default function getNodePath(node: AstNode){
  return [...node._util.ancestors, node].map(n => n.type).join(':') + ":" + node.name;
}