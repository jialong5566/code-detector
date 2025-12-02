import {AstNode} from "../AstUtil";

export default function collectExpressionIdentifiersShallow(exp: AstNode, callback: (identifier: AstNode) => void){
  if(!exp || exp.type === "ThisExpression" || exp._util.holdingIdType) return;
  if(exp.type === "Identifier"){
    if((exp._util.parentProperty === "property" || exp._util.parentProperty === "key") && !exp._util.parent?.computed) return;
    callback(exp);
    return;
  }
  if(exp.type === "JSXIdentifier" && exp._util.parent?.type !== "JSXAttribute"){
    callback(exp);
    return;
  }
}