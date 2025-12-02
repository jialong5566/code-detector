import { AstNode } from "../AstUtil";

export default function getImpactedNode(ancestor: AstNode){
  const { type } = ancestor;
  if(type === "JSXOpeningElement"){
    const { name } = (ancestor as unknown as { name: AstNode }).name;
    if(name && typeof name === "object"){
      return name;
    }
  }
  if(type === "JSXElement"){
    const { openingElement } = (ancestor as unknown as { openingElement: AstNode });
    const { name } = openingElement;
    if(name && typeof name === "object"){
      return name;
    }
  }
  if(type === "VariableDeclarator"){
    return (ancestor as unknown as { id: AstNode }).id;
  }
  if(type === "AssignmentExpression"){
    return (ancestor as unknown as { left: AstNode }).left;
  }
  if(type === "FunctionDeclaration"){
    return (ancestor as unknown as { id: AstNode|null }).id || ancestor;
  }
  return null;
}