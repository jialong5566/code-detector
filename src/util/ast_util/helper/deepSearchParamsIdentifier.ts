import { AstNode } from "../AstUtil";

export default function deepSearchParamsIdentifier(id: AstNode|null, callback: (identifier: AstNode) => void){
  if(!id){
    return;
  }
  if(id.type === "Identifier"){
    callback(id);
  }
  if(id.type === "AssignmentPattern"){
    const left = (id as unknown as { left: AstNode}).left;
    deepSearchParamsIdentifier(left, callback);
  }
  if(id.type === "RestElement"){
    deepSearchParamsIdentifier((id as unknown as { argument: AstNode}).argument, callback);
  }
  if(id.type === "ObjectProperty"){
    const value = (id as unknown as { value: AstNode}).value;
    deepSearchParamsIdentifier(value, callback);
  }
  if(id.type === "ObjectPattern"){
    const properties = (id as unknown as { properties: AstNode[]}).properties;
    for (const property of properties) {
      deepSearchParamsIdentifier(property, callback);
    }
  }
  if(id.type === "ArrayPattern"){
    const elements = (id as unknown as { elements: AstNode[]}).elements;
    for (const element of elements) {
      deepSearchParamsIdentifier(element, callback);
    }
  }
}