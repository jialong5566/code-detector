import getAstKitByFilePath from "../ast_util/getAstKitByFilePath";

export default function isVueEntryFile(filePath: string){
  let astKit = null;
  try{
    astKit = getAstKitByFilePath(filePath);
  }catch(e){
    console.error("isVueEntryFile", e, filePath);
    return false;
  }
  const programNode = astKit.mapUuidToNode.get("Program");
  if(!programNode) return false;
  const { children } = programNode._util;
  return children.some(child => isMountStatement(child));
}

function isMountStatement(astNode: any){
  return astNode.type === "ExpressionStatement" && astNode.expression?.type === "CallExpression" && (isMemberExpressionOfMountName(astNode.expression.callee) || astNode.expression.callee.name === "mount");
}

function isMemberExpressionOfMountName(astNode: any){
  return astNode.type === "MemberExpression" && astNode.property?.name === "mount";
}