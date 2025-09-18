import {GitDiffDetail} from "./format_git_diff_content";
import AstUtil, {AstNode} from "./ast_util/AstUtil";
import {extractUndefinedIdentifiers, fileIdentifierDetect} from "./report_util/file_identifier_detect";
import getFileDepends from "./report_util/getFileDepends";
import {BlockReportItem, diffBlockDetect, reportItemDetect} from "./report_util/diffBlockDetect";

export type DetectReport = {
  filePath: string;
  type: "modify" | "add" | "delete";
  // 主要针对 add 和 delete 类型的文件，不包含 modify
  filesDependsOnMe: string[][];
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
    const filesDependsOnMe = getFileDepends(filePath, tree);
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
    reportItem.undefinedIdentifiers = extractUndefinedIdentifiers(filePath, absPathPrefix);
    reportItem.dangerIdentifiers = fileIdentifierDetect(filePath, absPathPrefix);
    if(type === "modify"){
      diffBlockDetect(item, index, { reportItem, absPathPrefix});
    }
  });
  return reports.map(reportItem => {
    const { _fileAddedNodesPaths, _fileRemovedNodesPaths, filePath, blockReports,  ...reportProperties } = reportItem;
    reportItemDetect(reportItem, absPathPrefix);
    const fileAddedNodesPaths = reportItem._fileAddedNodesPaths.map(item => item.nodePath);
    const fileRemovedNodesPaths = reportItem._fileRemovedNodesPaths.map(item => item.nodePath);
    return {
      filePath,
      ...reportProperties,
      blockReports: blockReports.map(blockReport => {
        const { diff_txt } = blockReport;
        const addNodeAndPaths = blockReport.addNodeAndPaths.filter(e => fileAddedNodesPaths.includes(e.nodePath));
        const infosList = addNodeAndPaths.map(item => {
          const { node } = item;
          const { effectIds } = node._util;
          return {
            causeBy: AstUtil.getShortNodeMsg(node),
            effects: [...effectIds].map(e => AstUtil.getShortNodeMsg(e))
          }
        });
        return {
          diff_txt,
          infos: infosList.filter(e => e.effects.length > 0),
        };
      }).filter(e => e.infos.length > 0)
    }
  });
};