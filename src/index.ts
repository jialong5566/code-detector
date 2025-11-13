import {join} from "path";
import {writeFileSync} from "fs";
import dayjs from "dayjs";
import {readSrcFiles} from "./util/shared/readDirFiles";
import Core from "./util/ast_util/Core";
import {gitDiffTool} from "./util/shared/gitDiffTool";
import {DetectService} from "./services/DetectService";
import getGitRepositoryAndBranch from "./util/git_util/getGitRepositoryAndBranch";



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

export { isRepoTypeSupported } from "./util/shared/getRepoSupportFlag";

export async function runDiffDetect(compareUrl?: string, token?: string){
  const option = {
    compareUrl,
    token,
    gitRepoUrl: '',
    branchName: ''
  }
  if(!compareUrl || !token){
    const { gitUrl, branchName } = await getGitRepositoryAndBranch();
    option.gitRepoUrl = gitUrl;
    option.branchName = branchName;
  }
  const service = new DetectService(option);
  await service.run();
  return service.formatResult();
}