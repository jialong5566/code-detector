import { AstNode } from "../AstUtil";
import { intrinsicElements } from "../intrinsicElements";
import { windowProperties } from "../windowProperties";
import collectDependenceIdsOfExportMembers from "./collectDependenceIdsOfExportMembers";
import collectExpressionIdentifiersShallow from "./collectExpressionIdentifiersShallow";

export default function collectDependenceIds(node: AstNode){
  const { _util } = node;
  const { dependenceIds, holdingIdNameMap, children, dependenceIdsNoScope, holdingIds } = _util;
  children.forEach(child => {
    if(child._util.dependenceIdsNoScope.size > 0){
      child._util.dependenceIdsNoScope.forEach(id => dependenceIds.add(id));
    }
    collectDependenceIdsOfExportMembers(child, id => dependenceIds.add(id));
    collectExpressionIdentifiersShallow(child, exp => {
      if(exp.type === "ThisExpression" || exp._util.holdingIdType || ["imported", "exported"].includes(exp._util.parentProperty)) return;
      if(exp.type === "Identifier"){
        if((exp._util.parentProperty === "property" || exp._util.parentProperty === "key") && !exp._util.parent?.computed) return;
      }
      if(exp.type === "JSXIdentifier" && exp._util.parent?.type === "JSXAttribute") return;
      dependenceIds.add(exp);
    });
  });

  for (const dependenceId of [...dependenceIds]) {
    if(!dependenceId._util){
      continue;
    }
    if(holdingIds.has(dependenceId)){
      dependenceIds.delete(dependenceId);
      continue;
    }
    if(dependenceId._util.variableScope.length === 0 && typeof dependenceId.name === "string" && holdingIdNameMap.has(dependenceId.name)){
      dependenceId._util.variableScope.push(...holdingIdNameMap.get(dependenceId.name)!);
      const firstPick = dependenceId._util.variableScope[0];
      if(firstPick && firstPick._util.uuid !== dependenceId._util.uuid){
        firstPick._util.occupation.add(dependenceId);
      }
    }
    if(dependenceId._util.variableScope.length === 0){
      dependenceIdsNoScope.add(dependenceId);
    }
  }
  if(node.type === 'Program'){
    for (const dependenceId of [...dependenceIdsNoScope]) {
      if(dependenceId.type === "JSXIdentifier" && intrinsicElements.includes(dependenceId.name as string)){
        dependenceIdsNoScope.delete(dependenceId);
        dependenceIds.delete(dependenceId);
      }
      else if(dependenceId.type === "Identifier" && windowProperties.includes(dependenceId.name as string)){
        dependenceIdsNoScope.delete(dependenceId);
        dependenceIds.delete(dependenceId);
      }
    }
  }
}