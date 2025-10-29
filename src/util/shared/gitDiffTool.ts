import {getSshGitRepoUrl} from "../parseGitLabDiffUril";
import {execa, logger, rimraf, winPath} from "@umijs/utils";
import to from "await-to-js";
import {SOURCE, TARGET} from "../constants";
import {handleExecaError} from "./handleExecaError";
import {getRepoType} from "./getRepoSupportFlag";
import {join} from "path";
import {umi4SetUp} from "./umi4ProjectUtil";
import {generateGitDiffReport} from "../report_util/generateGitDiffReport";
import {vueSetUp} from "./vueProjectUtil";
import {gitDiffFileName} from "../../index";
import dayjs from "dayjs";
import {readFileSync} from "fs";
import {formatGitDiffContent} from "../format_git_diff_content";

export async function cloneGitRepo(gitUrl: string, branchName: string, tempDirPath: string, folder: string, cloneType?: 'ssh'){
  logger.ready(`准备clone 源代码到临时目录下的 ${tempDirPath}/${folder} 文件夹`);
  let stderr, failed;
  if(cloneType === 'ssh'){
    const sshGitRepoUrl = getSshGitRepoUrl(gitUrl);
    ({ stderr, failed } = await execa.execa(`git clone ${sshGitRepoUrl} ${tempDirPath}/${folder}`, {shell: true}));
  }
  else {
    ({ stderr, failed } = await execa.execa(`git clone ${gitUrl} ${tempDirPath}/${folder}`, {shell: true}));
  }
  handleExecaError({ failed, stderr });
  logger.info("源代码clone完成");
  if(branchName !== "master"){
    logger.ready("准备切换到分支");
    ({ stderr, failed } = await execa.execa(`cd ${tempDirPath}/${folder} && git fetch origin ${branchName}:${branchName} && git checkout ${branchName}`, {shell: true}));
    handleExecaError({ failed, stderr });
    logger.info("源代码切换分支完成");
  }
  return { failed, stderr };
}

export async function cloneGitRepoAndGetDiff(gitRepoUrl: string, branchName: string, cloneType?: 'ssh'){
  const today = dayjs().format('YYYYMDD_HHmmss') + Math.random().toString(36).slice(-5);
  logger.ready("准备生成临时工作目录...")
  const [err] = await to(execa.execa(`rm -rf ${today}`, {shell: true}));
  if (err) {
    logger.error("临时目录删除失败");
  }
  await execa.execa(`mkdir -p ${today}`, {shell: true});
  logger.info("临时目录建立完成");
  try {
    let stderr, failed;
    ({ stderr, failed } = await cloneGitRepo(gitRepoUrl, branchName, today, TARGET, cloneType));
    handleExecaError({ failed, stderr });
    logger.ready("准备生成git_diff.txt文件");
    ({ stderr, failed } = await execa.execa(`cd ${today}/${TARGET} && git diff master..${branchName} --unified=0 --output=${gitDiffFileName}`, {shell: true}));
    handleExecaError({ failed, stderr });
    const repoType = await getRepoType(join(process.cwd(), today, TARGET, 'package.json'));
    logger.info(`项目类型为: ${repoType}`);
    if(repoType === 'umi'){
      const { madgeResult, shellExeResult } = await umi4SetUp({ targetDirPath: join(process.cwd(), today, TARGET) });
      ({ stderr, failed } = shellExeResult);
      handleExecaError({ failed, stderr });
      const targetDirPath = join(process.cwd(), today, TARGET);
      const diff_txt = readFileSync(join(targetDirPath, gitDiffFileName), "utf-8");
      const gitDiffDetail = formatGitDiffContent(diff_txt);
      const usingFileNoPrefix = Object.keys(madgeResult.tree);
      const groupGitDiffLines = gitDiffDetail.filter(item => usingFileNoPrefix.includes(item.filePath));
      const changedFilePaths = groupGitDiffLines.map(item => item.filePath);
      const upstreamDependenceJson = Object.fromEntries(changedFilePaths.map(p => [p, madgeResult.depends(p)]));
      return upstreamDependenceJson;
    }
  }
  catch (error: any) {
    logger.error(error);
  }
  finally {
    rimraf(join(process.cwd(), today), () => {
      logger.info("临时目录已删除");
    });
  }
}

export async function gitDiffTool(arg: { gitRepoUrl: string, baseBranch: string, targetBranch: string, tempDirPath: string, generateFile: Parameters<typeof generateGitDiffReport>[0]['generateFile'] }){
  const { gitRepoUrl: gitUrl, baseBranch, targetBranch: branchName, tempDirPath: today, generateFile } = arg;
  logger.ready("准备生成临时工作目录...")
  const [err] = await to(execa.execa(`rm -rf ${today}`, {shell: true}));
  if (err) {
    logger.error("临时目录删除失败");
  }
  await execa.execa(`mkdir -p ${today}`, {shell: true});
  logger.info("临时目录建立完成");
  try {
    logger.ready(`准备clone 源代码到临时目录下的 ${TARGET} 文件夹`);
    let stderr, failed;
    ({ stderr, failed } = await execa.execa(`git clone ${gitUrl} ${today}/${TARGET}`, {shell: true}));
    handleExecaError({ failed, stderr });
    logger.info("源代码clone完成");
    logger.wait("检测项目类型");
    const repoType = await getRepoType(join(process.cwd(), today, TARGET, 'package.json'));
    logger.info(`项目类型为: ${repoType}`);
    if(!repoType){
      logger.error("该项目不支持检测");
      rimraf(join(process.cwd(), today), () => {
        logger.info("临时目录已删除");
      });
      return;
    }
    logger.ready(`准备clone 源代码到临时目录下的 ${SOURCE} 文件夹`);
    ({ stderr, failed } = await execa.execa(`git clone ${gitUrl} ${today}/${SOURCE}`, {shell: true}));
    handleExecaError({ failed, stderr });
    logger.info("源代码clone完成");
    if(baseBranch !== "master"){
      logger.ready("准备切换到基准分支");
      ({ stderr, failed } = await execa.execa(`cd ${today}/${SOURCE} && git fetch origin ${baseBranch}:${baseBranch} && git checkout ${baseBranch}`, {shell: true}));
      handleExecaError({ failed, stderr });
      logger.info("源代码切换到基准分支完成");
    }
    logger.ready("准备切换到目标分支");
    ({ stderr, failed } = await execa.execa(`cd ${today}/${TARGET} && git fetch origin ${branchName}:${branchName} && git checkout ${branchName}`, {shell: true}));
    handleExecaError({ failed, stderr });
    logger.info("分支切换完成");
    logger.ready("准备生成git_diff.txt文件");
    ({ stderr, failed } = await execa.execa(`cd ${today}/${TARGET} && git diff ${baseBranch}..${branchName} --unified=0 --output=${gitDiffFileName}`, {shell: true}));
    handleExecaError({ failed, stderr });
    logger.info("git_diff.txt文件生成完成");

    if(repoType === 'umi'){
      const { madgeResult, shellExeResult, parsedAlias } = await umi4SetUp({ targetDirPath: join(process.cwd(), today, TARGET) });
      ({ stderr, failed } = shellExeResult);
      handleExecaError({ failed, stderr });
      return await generateGitDiffReport({ madgeResult, parsedAlias, targetDirPath: join(process.cwd(), today, TARGET), generateFile });
    }
    else if(repoType === 'vue'){
      const { madgeResult, shellExeResult, parsedAlias } = await vueSetUp({ targetDir: `${today}/${TARGET}` });
      ({ stderr, failed } = shellExeResult);
      handleExecaError({ failed, stderr });
      return await generateGitDiffReport({ madgeResult, parsedAlias, targetDirPath: join(process.cwd(), today, TARGET), generateFile });
    }
  }
  catch (error: any) {
    logger.error(error.message);
  }
  finally {
    rimraf(join(process.cwd(), today), () => {
      logger.info("临时目录已删除");
    });
  }
}