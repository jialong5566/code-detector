import {readFileSync, writeFileSync} from "fs";
import { join, } from "path";
import {gitDiffFileName} from "../../index";
import {formatGitDiffContent} from "../format_git_diff_content";
import {logger,  winPath} from "@umijs/utils";
import {createDetectReport} from "../report_util";
import { IMadgeInstance} from "./getMadgeInstance";
import { createExportedNameToReferenceLocalSet} from "./createDependenceMap";
import dayjs from "dayjs";
import { performance } from "perf_hooks"
import collectUpstreamFiles from "../shared/collectUpstreamFiles";
import filterEffectedCode from "./filterEffectedCode";


const reportFileName = "git_diff_report.md";

export async function generateGitDiffReport(arg: { madgeResult: IMadgeInstance, parsedAlias: Record<string, any>, targetDirPath: string, generateFile?: ('dependence_map.json'|'partial_dependence_map.json'|'report.json'|'gitDiffDetail.json'|typeof reportFileName)[] }){
  const { madgeResult, parsedAlias, targetDirPath, generateFile = ['upstream_dependence_map.json', 'dependence_map.json', 'partial_dependence_map.json', 'report.json', 'gitDiffDetail.json', reportFileName] } = arg;
  const absPathPrefix = targetDirPath + '/';
  const { tree } = madgeResult;
  const projectFilePaths = Object.keys(tree);
  /** 读取 git diff 内容，生成 json 文件 */
  logger.info("读取 git diff 内容，生成 json 文件");
  const diff_txt = readFileSync(join(targetDirPath, gitDiffFileName), "utf-8");
  /** 格式化 diff 文本 */
  const gitDiffDetail = formatGitDiffContent(diff_txt);
  /** 汇总修改的文件 */
  const modifiedFilePaths = gitDiffDetail.map(item => item.filePath);
  /** 汇总上游 直接被影响的 文件 */
  const upstreamFilePaths = collectUpstreamFiles(madgeResult, modifiedFilePaths);
  const upstreamFileFullPaths = upstreamFilePaths.map(item => winPath(join(absPathPrefix, item)));
  const groupGitDiffLines = gitDiffDetail.filter(item => upstreamFilePaths.includes(item.filePath));
  const time = dayjs().format('YYYYMDD_HHmm');
  let dependenceJson: ReturnType<typeof createExportedNameToReferenceLocalSet> = {
    indirectExportMembers: {},
    import2export: {},
    export2export: {},
    mapFilePathToExportAllSources: {},
  };
  let partialDependenceJson: Record<string, any> = {};
  let reports: ReturnType<typeof createDetectReport> = [];
  // 本地文件的别名
  try {
    logger.info("生成 dependenceJson ...");
    dependenceJson = createExportedNameToReferenceLocalSet(upstreamFileFullPaths, parsedAlias, absPathPrefix, projectFilePaths);
    /** 生成报告 */
    reports = createDetectReport({ groupGitDiffLines, tree, absPathPrefix });
    /** 生成影响范围 */
    partialDependenceJson = filterEffectedCode(reports, dependenceJson);
  }
  catch (e) {
    logger.warn('dependenceJson 生成失败', e);
  }
  logger.info("完成");
  generateFile.includes('dependence_map.json') && writeFileSync(join(targetDirPath, "..", "..", `${time}_dependence_map.json`), JSON.stringify(dependenceJson, null, 2), { encoding: 'utf-8', flag: 'w' });
  generateFile.includes('partial_dependence_map.json') && writeFileSync(join(targetDirPath, "..", "..", `${time}_partial_dependence_map.json`), JSON.stringify(partialDependenceJson, null, 2), { encoding: 'utf-8', flag: 'w' });
  generateFile.includes('report.json') && writeFileSync(join(targetDirPath, "..", "..", `${time}_report.json`), JSON.stringify(reports, null, 2), { encoding: 'utf-8', flag: 'w' });
  generateFile.includes('gitDiffDetail.json') && writeFileSync(join(targetDirPath, "..", "..", `${time}_gitDiffDetail.json`), JSON.stringify(gitDiffDetail, null, 2), { encoding: 'utf-8', flag: 'w' });

  return {
    dependenceJson,
    partialDependenceJson,
    reports,
  };
}