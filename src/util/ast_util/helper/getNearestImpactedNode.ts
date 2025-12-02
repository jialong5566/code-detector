import { AstNode } from "../AstUtil";
import getImpactedNode from "./getImpactedNode";

export default function getNearestImpactedNode(ancestors: AstNode[]){
  for (const ancestor of ancestors) {
    const impactedNode = getImpactedNode(ancestor);
    if(impactedNode){
      return impactedNode
    }
  }
}