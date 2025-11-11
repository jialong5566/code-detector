import {GitDiffDetail} from "./format_git_diff_content";
import AstUtil, {AstNode} from "./ast_util/AstUtil";
import {
  extractUndefinedIdentifiers,
} from "./report_util/file_identifier_detect";
import {BlockReportItem, diffBlockDetect, reportItemDetect} from "./report_util/diffBlockDetect";
import { join } from "path";

export type DetectReport = {
  filePath: string;
  type: "modify" | "add" | "delete";
  // 主要针对 add 和 delete 类型的文件，不包含 modify
  filesDependsOnMe: string[];
  undefinedIdentifiers: string[];
  dangerIdentifiers: string[];
  _fileAddedNodesPaths: { node: AstNode, nodePath: string, blockIndex: number }[];
  _fileRemovedNodesPaths: { node: AstNode, nodePath: string, blockIndex: number }[];
  blockReports: BlockReportItem[];
};

type Arg = {
  groupGitDiffLines: GitDiffDetail[],
  tree: Record<string, string[]>,
  absPathPrefix: string,
};

export function createDetectReport(arg: Arg){
  const { groupGitDiffLines, tree, absPathPrefix } = arg;

  const reports: DetectReport[] = [];
  groupGitDiffLines.forEach((item, index) => {
    const {filePath, type} = item;
    const filesDependsOnMe = tree[filePath] || [];
    let reportItem = reports.find(e => e.filePath === filePath);
    if(!reportItem){
      reportItem = {
        filePath,
        type,
        filesDependsOnMe,
        undefinedIdentifiers: [],
        dangerIdentifiers: [],
        _fileAddedNodesPaths: [],
        _fileRemovedNodesPaths: [],
        blockReports: []
      }
      reports.push(reportItem);
    }
    reportItem.undefinedIdentifiers = extractUndefinedIdentifiers(join(absPathPrefix, filePath), absPathPrefix);
    // reportItem.dangerIdentifiers = fileIdentifierDetect(join(absPathPrefix, filePath), absPathPrefix);
    if(type === "modify"){
      diffBlockDetect(item, index, { reportItem, absPathPrefix});
    }
  });
  return reports.map(reportItem => {
    const { _fileAddedNodesPaths, _fileRemovedNodesPaths, filePath, blockReports,  ...reportProperties } = reportItem;
    const topEffectedExportsAdded = _fileAddedNodesPaths.map(e => {
      const { node } = e;
      return AstUtil.findExportedMembersNameFromAncestors(node);
    }).flat();
    const topEffectedExportsRemoved = _fileRemovedNodesPaths.map(e => {
      const { node } = e;
      return AstUtil.findExportedMembersNameFromAncestors(node);
    }).flat();
    reportItemDetect(reportItem, absPathPrefix);
    /** 汇总后 新增的节点路径 */
    const fileAddedNodesPaths = reportItem._fileAddedNodesPaths.map(item => item.nodePath);
    /** 汇总后 删除的节点路径 */
    const fileRemovedNodesPaths = reportItem._fileRemovedNodesPaths.map(item => AstUtil.getShortNodeMsg(item.node, true));
    return {
      filePath,
      ...reportProperties,
      dangerIdentifiers: fileRemovedNodesPaths,
      topEffectedExportsAdded: [...new Set(topEffectedExportsAdded)],
      topEffectedExportsRemoved: [...new Set(topEffectedExportsRemoved)],
      blockReports: blockReports.map(blockReport => {
        const { diff_txt } = blockReport;
        /** 用汇总的结果进行过滤 得到真正的新增节点 */
        const addNodeAndPaths = blockReport.addNodeAndPaths.filter(e => fileAddedNodesPaths.includes(e.nodePath));
        const infosList = addNodeAndPaths.map(item => {
          const { node } = item;
          const { effectIds, occupation, holdingIdType } = node._util;
          return {
            causeBy: AstUtil.getShortNodeMsg(node, true),
            effectsUpstream: [...effectIds].map(e => AstUtil.getShortNodeMsg(e, true)),
            occupations: [...occupation].map(e => AstUtil.getShortNodeMsg(e, true)),
            effectsDownstream: holdingIdType ? [...occupation].map((occupationId) => {
              const ans = AstUtil.getAncestorsFromBirth(occupationId, node)
              return AstUtil.getNearestImpactedNode(ans.reverse());
            }).filter(Boolean).map(e => AstUtil.getShortNodeMsg(e!, true)): [],
          }
        });
        return {
          diff_txt,
          infos: infosList.filter(e => e.effectsUpstream.length > 0 || e.occupations.length > 0 || e.effectsDownstream.length > 0),
        };
      }).filter(e => e.infos.length > 0)
    }
  });
};