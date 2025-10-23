import {readFileSync} from "fs";
import {join} from "path";
import {writeFileSync} from "fs";
import {execa, chalk, logger, rimraf} from "@umijs/utils";
import dayjs from "dayjs";
import {readSrcFiles} from "./util/shared/readDirFiles";
import Core from "./util/ast_util/Core";
import {SOURCE, TARGET} from "./util/constants";
import to from "await-to-js";
import {generateGitDiffReport} from "./util/report_util/generateGitDiffReport";
import {parseGitLabCompareUrl} from "./util/parseGitLabDiffUril";
import {getRepoSupportFlag} from "./util/shared/getRepoSupportFlag";
import {handleExecaError} from "./util/shared/handleExecaError";

export const gitDiffFileName = "git_diff.txt";
const eslintJsonName = "eslint-report.json";
const eslintFinalJsonName = "eslint-final-report.json";


export async function getGitRepositoryAndBranch(){
  const res = await execa.execa('git remote get-url origin', {shell: '/bin/bash'});
  chalk.green(["仓库地址：", res.stdout]);
  const branch = await execa.execa('git rev-parse --abbrev-ref HEAD', {shell: '/bin/bash'});
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
  const today = dayjs().format('YYYYMDD');
  const { gitUrl, branchName } = await getGitRepositoryAndBranch();
  logger.ready("准备生成临时工作目录...")
  const [err] = await to(execa.execa(`rm -rf ${today}`, {shell: '/bin/bash'}));
  if (err) {
    logger.error("临时目录删除失败");
  }
  await execa.execa(`mkdir -p ${today}`, {shell: '/bin/bash'});
  logger.info("临时目录建立完成");
  logger.ready(`准备clone源代码到临时目录下的 ${TARGET} 文件夹`)
  await execa.execa(`git clone ${gitUrl} ${today}/${TARGET}`, {shell: '/bin/bash'});
  logger.info("源代码clone完成");
  const supportFlag = getRepoSupportFlag(join(process.cwd(), today, TARGET, 'package.json'));
  if(!supportFlag){
    logger.error("该项目不支持检测");
    rimraf(join(process.cwd(), today), () => {
      logger.info("临时目录已删除");
    });
    return;
  }
  logger.ready(`准备clone源代码到临时目录下的 ${SOURCE} 文件夹`)
  await execa.execa(`git clone ${gitUrl} ${today}/${SOURCE}`, {shell: '/bin/bash'});
  logger.info("源代码clone完成");
  logger.ready("准备切换到目标分支")
  await execa.execa(`cd ${today}/${TARGET} && git fetch origin ${branchName}:${branchName} && git checkout ${branchName}`, {shell: '/bin/bash'});
  logger.info("分支切换完成");
  logger.ready("准备生成git_diff.txt文件")
  await execa.execa(`cd ${today}/${TARGET} && git diff master..${branchName} --unified=0 --output=${gitDiffFileName}`, {shell: '/bin/bash'});
  logger.info("git_diff.txt文件生成完成");
  logger.wait("准备生成 入口文件");
  await execa.execa(`cd ${today}/${TARGET} && npx max setup`,  {shell: '/bin/bash'});
  logger.info("入口文件 生成完成！");
  logger.ready("准备生成报告");
  await generateGitDiffReport({ targetDirPath: join(process.cwd(), today, TARGET) });
  logger.info("报告完成");
  rimraf(join(process.cwd(), today), () => {
    logger.info("临时目录已删除");
  });
}

export async function getEslintCheckResult(today: string){
  today = today || dayjs().format('YYYYMDD');
  logger.ready("准备生成 eslint 类型检查 json");
  await to(execa.execa(`cd ${today}/target && npx eslint src --ext .js,.jsx,.ts,.tsx --format json -o ${eslintJsonName}`,  {shell: '/bin/bash'}));
  logger.info("eslint 类型检查 json 生成完成");
  logger.ready(`读取 ${eslintJsonName} 文件内容,并解析`);
  let eslintJson: { filePath: string, [p: string]: any }[] = [];
  {
    const content = readFileSync(join(process.cwd(), today, 'target', eslintJsonName), "utf-8");
    try {
      eslintJson = JSON.parse(content);
    }
    catch (error) {
      logger.error("解析json文件失败");
    }
  }

  const validEslintJson = eslintJson.filter(e => {
    const { filePath, ...rest } = e;
    return Object.values(rest).some(v => Array.isArray(v) && v.length> 0 || !Array.isArray(v) && v);
  });
  writeFileSync(join(process.cwd(), eslintFinalJsonName), JSON.stringify(validEslintJson, null, 2), { encoding: 'utf-8', flag: 'w' });
  logger.info(`${eslintFinalJsonName} 文件生成`)
}

export async function gitDiffDetectByUrl(inputUrl: string) {
  const today = dayjs().format('YYYYMDD_HHmmss') + Math.random().toString(36).slice(-5);
  const { gitRepoUrl: gitUrl, targetBranch: branchName, baseBranch, projectPathPart } = parseGitLabCompareUrl(inputUrl);
  logger.ready("准备生成临时工作目录...")
  const [err] = await to(execa.execa(`rm -rf ${today}`, {shell: '/bin/bash'}));
  if (err) {
    logger.error("临时目录删除失败");
  }
  await execa.execa(`mkdir -p ${today}`, {shell: '/bin/bash'});
  logger.info("临时目录建立完成");
  try {
    logger.ready(`准备clone ${projectPathPart} 源代码到临时目录下的 ${TARGET} 文件夹`);
    let stderr, failed;
    ({ stderr, failed } = await execa.execa(`git clone ${gitUrl} ${today}/${TARGET}`, {shell: '/bin/bash'}));
    handleExecaError({ failed, stderr });
    logger.info("源代码clone完成");
    const supportFlag = getRepoSupportFlag(join(process.cwd(), today, TARGET, 'package.json'));
    if(!supportFlag){
      logger.error("该项目不支持检测");
      rimraf(join(process.cwd(), today), () => {
        logger.info("临时目录已删除");
      });
      return;
    }
    logger.ready(`准备clone ${projectPathPart} 源代码到临时目录下的 ${SOURCE} 文件夹`);
    ({ stderr, failed } = await execa.execa(`git clone ${gitUrl} ${today}/${SOURCE}`, {shell: '/bin/bash'}));
    handleExecaError({ failed, stderr });
    logger.info("源代码clone完成");
    if(baseBranch !== "master"){
      logger.ready("准备切换到基准分支");
      ({ stderr, failed } = await execa.execa(`cd ${today}/${SOURCE} && git fetch origin ${baseBranch}:${baseBranch} && git checkout ${baseBranch}`, {shell: '/bin/bash'}));
      handleExecaError({ failed, stderr });
      logger.info("源代码切换到基准分支完成");
    }
    logger.ready("准备切换到目标分支");
    ({ stderr, failed } = await execa.execa(`cd ${today}/${TARGET} && git fetch origin ${branchName}:${branchName} && git checkout ${branchName}`, {shell: '/bin/bash'}));
    handleExecaError({ failed, stderr });
    logger.info("分支切换完成");
    logger.ready("准备生成git_diff.txt文件");
    ({ stderr, failed } = await execa.execa(`cd ${today}/${TARGET} && git diff ${baseBranch}..${branchName} --unified=0 --output=${gitDiffFileName}`, {shell: '/bin/bash'}));
    handleExecaError({ failed, stderr });
    logger.info("git_diff.txt文件生成完成");
    logger.wait("准备生成 入口文件");
    ({ stderr, failed } = await execa.execa(`cd ${today}/${TARGET} && npx max setup`,  {shell: '/bin/bash'}));
    handleExecaError({ failed, stderr });
    logger.info("入口文件 生成完成！");
    logger.ready("准备生成报告");
    const res = await generateGitDiffReport({ targetDirPath: join(process.cwd(), today, TARGET), generateFile: [] });
    logger.info("报告完成");
    return res;
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