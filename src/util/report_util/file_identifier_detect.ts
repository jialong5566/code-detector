import getAstKitByFilePath from "../ast_util/getAstKitByFilePath";
import AstUtil from "../ast_util/AstUtil";

export function extractUndefinedIdentifiers(filePath: string, absPathPrefix: string){
  const { mapUuidToNode } = getAstKitByFilePath(filePath, absPathPrefix);
  /** 找出根节点 */
  const programNode = mapUuidToNode.get("Program");
  if(!programNode){
    return [];
  }
  const { dependenceIds } = programNode._util;
  const ids = [...dependenceIds].filter(id => AstUtil.isUntrackedId(id));
  return ids.map((id) => AstUtil.getShortNodeMsg(id));
}

export function fileIdentifierDetect(filePath: string, absPathPrefix: string){
  const { mapUuidToNode } = getAstKitByFilePath(filePath, absPathPrefix);
  /** 找出根节点 */
  const programNode = mapUuidToNode.get("Program");
  if(!programNode){
    return [];
  }
  const { effectIds } = programNode._util;
  return [...effectIds].map((id) => AstUtil.getShortNodeMsg(id));
}