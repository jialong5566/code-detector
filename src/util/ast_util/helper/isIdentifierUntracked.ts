import { AstNode } from "../AstUtil";
import {windowProperties} from "../windowProperties";
import {intrinsicElements, standardAttributes} from "../intrinsicElements";

export default function isIdentifierUntracked(id: AstNode) {
  return id._util.variableScope.length === 0 && !isPropertyOfGlobal(id) && !isIntrinsicElement(id) && !isStandardAttribute(id)
}

function isPropertyOfGlobal(node: AstNode): boolean {
  return node.type === "Identifier" && !node._util.variableScope.length && typeof node.name === "string" && windowProperties.includes(node.name!);
}

function isIntrinsicElement(node: AstNode){
  return (node.type === "JSXIdentifier" && node._util.parent?.type && ["JSXOpeningElement", "JSXClosingElement"].includes(node._util.parent.type) && typeof node.name === "string" && intrinsicElements.includes(node.name!))
}

function isStandardAttribute(node: AstNode){
  return (node._util.parent!.type === "JSXAttribute" && typeof node.name === "string" && standardAttributes.includes(node.name!))
}