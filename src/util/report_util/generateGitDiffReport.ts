import {readFileSync, writeFileSync} from "fs";
import { join, relative} from "path";
import {gitDiffFileName} from "../../index";
import {formatGitDiffContent} from "../format_git_diff_content";
import {aliasUtils, readDirFiles, tsconfigPaths, winPath} from "@umijs/utils";
import {createDetectReport} from "../report_util";
import {createMdByJson} from "./createMdByJson";
import {getMadgeInstance, IMadgeInstance} from "./getMadgeInstance";
import {createDependenceMap} from "./createDependenceMap";
import dayjs from "dayjs";

const userAliasGetter = (cwd: string, appData: { config: { alias: Record<string, string> } }) => {
  return appData.config?.alias || {
    umi: '@@/exports',
    '@': cwd + '/src',
    '@@': cwd + '/src/.umi',
    '@umijs/max': '@@/exports'
  }
};

const reportFileName = "git_diff_report.md";

export async function generateGitDiffReport(arg: { madgeResult: IMadgeInstance, parsedAlias: Record<string, any>, targetDirPath: string, generateFile?: ('dependence_map.json'|'partial_dependence_map.json'|'report.json'|typeof reportFileName)[] }){
  const { madgeResult, parsedAlias, targetDirPath, generateFile = ['upstream_dependence_map.json', 'dependence_map.json', 'partial_dependence_map.json', 'report.json', reportFileName] } = arg;
  const { tree } = madgeResult;
  // 读取 git diff 内容，生成 json 文件
  const diff_txt = readFileSync(join(targetDirPath, gitDiffFileName), "utf-8");
  const gitDiffDetail = formatGitDiffContent(diff_txt);
  const absPathPrefix = targetDirPath + '/';
  const usingFileNoPrefix = Object.keys(tree);
  const usingFilePaths = usingFileNoPrefix.map(item => winPath(join(absPathPrefix, item)));
  const groupGitDiffLines = gitDiffDetail.filter(item => usingFileNoPrefix.includes(item.filePath));
  const changedFilePaths = groupGitDiffLines.map(item => item.filePath);
  const time = dayjs().format('YYYYMDD_HHmm');
  let dependenceJson: Record<string, any> = {};
  let partialDependenceJson: Record<string, any> = {};
  let upstreamDependenceJson: Record<string, any> = {};
  // 本地文件的别名
  try {
    dependenceJson = createDependenceMap(usingFilePaths, parsedAlias, absPathPrefix);
    partialDependenceJson = Object.fromEntries(changedFilePaths.map(p => [p, dependenceJson[p]]));
    upstreamDependenceJson = Object.fromEntries(changedFilePaths.map(p => [p, madgeResult.depends(p)]));
  }
  catch (e) {
    console.warn('dependenceJson 生成失败', e);
  }
  const reports = createDetectReport({ groupGitDiffLines, tree, absPathPrefix });
  const mdContent = createMdByJson(reports);
  generateFile.includes('upstream_dependence_map.json') && writeFileSync(join(targetDirPath, "..", "..", `${time}_upstream_dependence_map.json`), JSON.stringify(dependenceJson, null, 2), { encoding: 'utf-8', flag: 'w' });
  generateFile.includes('dependence_map.json') && writeFileSync(join(targetDirPath, "..", "..", `${time}_dependence_map.json`), JSON.stringify(dependenceJson, null, 2), { encoding: 'utf-8', flag: 'w' });
  generateFile.includes('partial_dependence_map.json') && writeFileSync(join(targetDirPath, "..", "..", `${time}_partial_dependence_map.json`), JSON.stringify(partialDependenceJson, null, 2), { encoding: 'utf-8', flag: 'w' });
  generateFile.includes('report.json') && writeFileSync(join(targetDirPath, "..", "..", `${time}_report.json`), JSON.stringify(reports, null, 2), { encoding: 'utf-8', flag: 'w' });
  generateFile.includes(reportFileName) && writeFileSync(join(targetDirPath, "..", "..", `${time}_${reportFileName}`), mdContent, { encoding: 'utf-8', flag: 'w' });
  return {
    mdContent,
    dependenceJson,
    upstreamDependenceJson,
    partialDependenceJson,
    reports,
  };
}