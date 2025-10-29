import {join} from "path";
import {writeFileSync} from "fs";
import {execa, chalk} from "@umijs/utils";
import dayjs from "dayjs";
import {readSrcFiles} from "./util/shared/readDirFiles";
import Core from "./util/ast_util/Core";
import {parseGitLabCompareUrl} from "./util/parseGitLabDiffUril";
import {cloneGitRepoAndGetDiff, CloneType, gitDiffTool} from "./util/shared/gitDiffTool";

export const gitDiffFileName = "git_diff.txt";


export async function getGitRepositoryAndBranch(){
  const res = await execa.execa('git remote get-url origin', {shell: true});
  chalk.green(["仓库地址：", res.stdout]);
  const branch = await execa.execa('git rev-parse --abbrev-ref HEAD', {shell: true});
  chalk.green(["分支名称：", branch.stdout]);
  return {
    gitUrl: res.stdout,
    branchName: branch.stdout
  }
}



export async function sameCodeDetect(dirOfCwd?: string) {
  const filesAndContent = await readSrcFiles(dirOfCwd);
  const { nodeContentGroupList, depthList } = Core.investigate(filesAndContent);
  const top3DepthsSet = [...new Set(depthList)].slice(0, 3);
  const validDepthList = depthList.filter(e => top3DepthsSet.includes(e));
  const validContentList = nodeContentGroupList.filter(e => validDepthList.includes(e.depth)).sort((a, b) => b.depth - a.depth);
  const md = Core.createMarkdownFile(validContentList);
  writeFileSync(join(process.cwd(), `${dayjs().format('YYYYMDD_HHmm')}_same_code.md`), md, { encoding: 'utf-8', flag: 'w' });
}


export async function gitDiffDetect() {
  const { gitUrl, branchName } = await getGitRepositoryAndBranch();
  const today = dayjs().format('YYYYMDD_HHmmss');
  return gitDiffTool({ gitRepoUrl: gitUrl, targetBranch: branchName, baseBranch: 'master', tempDirPath: today, generateFile: undefined });
}

export async function gitDiffDetectByUrl(inputUrl: string) {
  const today = dayjs().format('YYYYMDD_HHmmss') + Math.random().toString(36).slice(-5);
  const gitInfo = parseGitLabCompareUrl(inputUrl);
  return gitDiffTool({ ...gitInfo, tempDirPath: today, generateFile: [] });
}

export async function getUpstreamDependenceJson(inputUrl: string, token: string){
  const gitInfo = parseGitLabCompareUrl(inputUrl);
  return cloneGitRepoAndGetDiff(gitInfo.gitRepoUrl, gitInfo.targetBranch, { cloneType: token ? "token" : undefined, token});
}