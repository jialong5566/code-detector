import getAstKitByFilePath from "../ast_util/getAstKitByFilePath";
import AstUtil from "../ast_util/AstUtil";

export function fileIdentifierDetect(filePath: string, absPathPrefix: string){
  const { mapUuidToNode } = getAstKitByFilePath(filePath, absPathPrefix);
  const programNode = mapUuidToNode.get("Program");
  if(!programNode){
    return [];
  }
  const { dependenceIds } = programNode._util;
  const ids = [...dependenceIds].filter(id => {
    return AstUtil.isUntrackedId(id) || id._util.crossScope.size > 0;
  });
  return ids.map((id) => {
    const { name, _util} = id;
    const { crossScope } = _util;
    const isUntracked = AstUtil.isUntrackedId(id);
    const notFoundInfo = isUntracked ? `${name}:「${_util.startLine}:${_util.startColumn},${_util.endLine}:${_util.endColumn}」` : "";
    const dangerScopeInfo = [...crossScope].map(scope => {
      const { _util } = scope;
      return `${scope.name}:「${_util.startLine}:${_util.startColumn},${_util.endLine}:${_util.endColumn}」`;
    }).join("，");
    return [notFoundInfo, dangerScopeInfo].filter(Boolean).join("，");
  });
}