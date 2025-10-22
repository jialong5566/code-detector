import {GitDiffDetail} from "../format_git_diff_content";
import getAstKitByFilePath from "../ast_util/getAstKitByFilePath";
import {dirname, join} from "path";
import {SOURCE, TARGET} from "../constants";
import AstUtil, {AstNode} from "../ast_util/AstUtil";
import {DetectReport} from "../report_util";

export type BlockReportItem = {
  index: number,
  diff_txt: string[],
  addNodeAndPaths: ReturnType<typeof createPathsOfNodes>,
  removeNodeAndPaths: ReturnType<typeof createPathsOfNodes>,
}


const createBlockReport = (index: number): BlockReportItem => ({
  index,
  diff_txt: [],
  addNodeAndPaths: [],
  removeNodeAndPaths: [],
});

function createPathsOfNodes(ast: AstNode, blockIndex: number): { node: AstNode, nodePath: string, blockIndex: number }[]{
  return [ast, ...ast._util.nodeCollection].map(node => {
    return { node, nodePath: AstUtil.getNodePath(node), blockIndex }
  })
}

function findOrCreateBlockReport(blockReports: BlockReportItem[], index: number){
  const res = blockReports.find(item => item.index === index) || createBlockReport(index);
  if(!blockReports.includes(res)){
    blockReports.push(res);
  }
  return res;
}


export function diffBlockDetect(gitDiffDetail: GitDiffDetail, index: number, extra: { reportItem: DetectReport, absPathPrefix: string }){
  /** diff 块 原始信息 */
  const { filePath, startLineOfNew, items, startLineOfOld } = gitDiffDetail;
  /** 文件报告对象 */
  const { reportItem, absPathPrefix } = extra;
  /** 文件增加的节点 & 文件减少的节点 */
  const { blockReports, _fileRemovedNodesPaths, _fileAddedNodesPaths } = reportItem;
  /** diff 块报告对象 */
  const blockReportItem = findOrCreateBlockReport(blockReports, index);

  const filePathOfOld = join(dirname(absPathPrefix), SOURCE, filePath);
  const filePathOfNew = join(dirname(absPathPrefix), TARGET, filePath);
  const { mapFileLineToNodeSet, mapUuidToNode } = getAstKitByFilePath(filePathOfNew, absPathPrefix);
  const { mapFileLineToNodeSet: mapFileLineToNodeSetOld } = getAstKitByFilePath(filePathOfOld, absPathPrefix.replace(`${TARGET}/`, `${SOURCE}/`));
  const programNode = mapUuidToNode.get("Program");
  if(programNode){
    const lineNumberStartNew = Number(startLineOfNew);
    const lineNumberEndNew = lineNumberStartNew + items.filter(item => item.startsWith("+")).length - 1;
    const lineNumberStartOld = Number(startLineOfOld);
    const lineNumberEndOld = lineNumberStartOld + items.filter(item => item.startsWith("-")).length - 1;
    // 获取从 startLineOfNew 到 lineNumberEndNew 的所有 新增的 顶层节点
    const addNodes = AstUtil.getTopScopeNodesByLineNumberRange(mapFileLineToNodeSet, lineNumberStartNew, lineNumberEndNew);
    // 获取从 startLineOfOld 到 lineNumberEndOld 的所有 删除的 顶层节点
    const removeNodes = AstUtil.getTopScopeNodesByLineNumberRange(mapFileLineToNodeSetOld, lineNumberStartOld, lineNumberEndOld);
    blockReportItem.diff_txt = items;
    const addNodeAndPaths = addNodes.map(e => createPathsOfNodes(e, index)).flat();
    const removeNodeAndPaths = removeNodes.map(e => createPathsOfNodes(e, index)).flat();
    blockReportItem.addNodeAndPaths = addNodeAndPaths;
    blockReportItem.removeNodeAndPaths = removeNodeAndPaths;
    /** 汇总到文件的节点统计中 */
    _fileAddedNodesPaths.push(...addNodeAndPaths);
    _fileRemovedNodesPaths.push(...removeNodeAndPaths);
  }
}

export function reportItemDetect(reportItem: DetectReport, absPathPrefix: string){
  const { _fileRemovedNodesPaths, _fileAddedNodesPaths, filePath } = reportItem;
  const filePathOfNew = join(absPathPrefix, filePath);
  const { mapPathToNodeSet } = getAstKitByFilePath(filePathOfNew, absPathPrefix);

  const _fileAddedPaths = _fileAddedNodesPaths.map(e => e.nodePath);
  const _fileRemovedPaths = _fileRemovedNodesPaths.map(e => e.nodePath);
  const _fileSamePathsNode = _fileAddedPaths.filter(e => _fileRemovedPaths.includes(e));
  if(_fileSamePathsNode.length){
    reportItem._fileAddedNodesPaths = [...new Set(_fileAddedNodesPaths)].filter(e => !_fileSamePathsNode.includes(e.nodePath));
    reportItem._fileRemovedNodesPaths = [...new Set(_fileRemovedNodesPaths)].filter(e => !_fileSamePathsNode.includes(e.nodePath));
    const { blockReports, dangerIdentifiers } = reportItem;
    blockReports.forEach(e => {
      e.addNodeAndPaths = e.addNodeAndPaths.filter(item => !_fileSamePathsNode.includes(item.nodePath));
      e.removeNodeAndPaths = e.removeNodeAndPaths.filter(item => !_fileSamePathsNode.includes(item.nodePath));
      const effectedNodeOfRemove = e.removeNodeAndPaths.map(item => [...item.node._util.effectIds]).flat();
      // dangerIdentifiers.push(...e.removeNodeAndPaths.map(e => e.nodePath));
      // 删除的 node 的 effectId 的 nodePath，去 新文件中查找，找到为 高危影响
      effectedNodeOfRemove.forEach(item => {
        const path = AstUtil.getNodePath(item);
        const nodes = mapPathToNodeSet.get(path);
        if(nodes){
          dangerIdentifiers.push(...[...nodes].map(e => AstUtil.getShortNodeMsg(e)));
        }
      });
    });
  }
}