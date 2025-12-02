import getAstKitByFilePath from "../ast_util/getAstKitByFilePath";
import AstUtil, {AstNode} from "../ast_util/AstUtil";

export default function filterEffectedExportMember(filePath: string, absPathPrefix: string, startLine: number, endLine: number){
  const astKit = getAstKitByFilePath(filePath, absPathPrefix, travelNode => ["VElement", "ImportDeclaration", "ExportAllDeclaration", "ExportNamedDeclaration", "ExportDefaultDeclaration"].includes(travelNode.type));
  const { mapFileLineToNodeSet } = astKit;
  return extractEffectedExportMemberByLineRange(mapFileLineToNodeSet, startLine, endLine, filePath);
}

export function extractEffectedExportMemberByLineRange(mapFileLineToNodeSet: Map<number, Set<AstNode>>, startLine: number, endLine: number, filePath: string){
  const topScopeNodes = AstUtil.getTopScopeNodesByLineNumberRange(mapFileLineToNodeSet, startLine, endLine);
  const exportMembers = topScopeNodes.map(node => AstUtil.findExportedMembersNameFromAncestors(node)).flat();
  const res = [...new Set(exportMembers)];
  if(res.length === 0 && filePath.endsWith('.vue')){
    res.push('default');
  }
  return res;
}