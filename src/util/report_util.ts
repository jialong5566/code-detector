import {GitDiffDetail} from "./format_git_diff_content";
import codeBlockDetect, {BlockReport} from "./report_util/code_block_detect";
import getAstKitByFilePath from "./ast_util/getAstKitByFilePath";
import AstUtil from "./ast_util/AstUtil";
import {fileIdentifierDetect} from "./report_util/file_identifier_detect";
import getFileDepends from "./report_util/getFileDepends";

export type DetectReport = {
  filePath: string;
  type: "modify" | "add" | "delete";
  // 主要针对 add 和 delete 类型的文件，不包含 modify
  filesDependsOnMe: string[][];
  dangerIdentifiers: string[];
  blockReports: BlockReport[];
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
        dangerIdentifiers: [],
        blockReports: []
      }
      reports.push(reportItem);
    }
    reportItem.dangerIdentifiers = fileIdentifierDetect(filePath, absPathPrefix);
    if(type === "modify"){
      codeBlockDetect({ gitDiffItem: item, absPathPrefix, blockReports: reportItem.blockReports, index });
    }
  });
  return reports.map(report => {
    const filePath = report.filePath;
    // todo 过滤 ext
    const astKit = getAstKitByFilePath(filePath, absPathPrefix);
    const allNodes = new Map([...astKit.mapUuidToNode.values()].map(ele => [AstUtil.getNodePath(ele), ele]));
    return {
      ...report,
      blockReports: report.blockReports.map(blockReport => {
        const { infos, diff_txt } = blockReport;
        const infosList = infos.map(info => {
          const { addedEffects, removedEffects, topAdded, topRemoved, ...rest } = info;
          const removedEffectsInfos = removedEffects.map(item => {
            const tmpList = item.effects.map(ele => {
              // todo
              const nodePath = AstUtil.getNodePath(ele);
              const item = allNodes.get(nodePath);
              return item && AstUtil.createScopeContent(item);
            }).filter(Boolean);
            const effects= [...new Set(tmpList)];
            return {
              causeBy: item.causeBy.name || item.causeBy.type,
              effects
            }
          }).filter(item => item.effects.length > 0);
          const addedEffectsInfos = addedEffects.map(item => {
            const effects = [...new Set(item.effects.map(AstUtil.createScopeContent))];
            return {
              causeBy: item.causeBy.name || item.causeBy.type,
              effects
            }
          }).filter(item => item.effects.length > 0);
          return {
            ...rest,
            addedEffects: addedEffectsInfos,
            removedEffects: removedEffectsInfos,
          };
        });
        return {
          diff_txt,
          infos: infosList,
        };
      })
    }
  });
};