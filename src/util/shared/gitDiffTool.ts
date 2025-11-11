import {getGitRepoUrlByToken} from "../parseGitLabDiffUril";
import {execa, logger, rimraf, winPath} from "@umijs/utils";
import to from "await-to-js";
import {SOURCE, TARGET} from "../constants";
import {handleExecaError} from "./handleExecaError";
import {getRepoType, isRepoTypeSupported} from "./getRepoSupportFlag";
import {join} from "path";
import {umi4SetUp} from "./umi4ProjectUtil";
import {generateGitDiffReport} from "../report_util/generateGitDiffReport";
import {vueSetUp} from "./vueProjectUtil";
import {gitDiffFileName} from "../../index";
import dayjs from "dayjs";
import {readFileSync} from "fs";
import {formatGitDiffContent} from "../format_git_diff_content";
import { cloneRepoWithBranchAndDefault } from "./gitUtil";
import { performance } from "perf_hooks";
import {createExportedNameToReferenceLocalSet} from "../report_util/createDependenceMap";
import collectUpstreamFiles from "./collectUpstreamFiles";
import filterEffectedCode from "../report_util/filterEffectedCode";
import {createDetectReport} from "../report_util";
import createRandomStr from "../createRandomStr";

export async function cloneGitRepoAndGetDiff(gitRepoUrl: string, branchName: string, extra: { token?: string, jsonKeys?: (keyof Awaited<ReturnType<typeof cloneGitRepoAndGetDiff>>)[] } = {}){
  performance.mark('stage 0');
  const { token, jsonKeys = ['upstreamDependenceJson'] } = extra;
  const today = createRandomStr();
  logger.ready("准备生成临时工作目录...")
  const [err] = await to(execa.execa(`rm -rf ${today}`, {shell: true}));
  if (err) {
    logger.error("临时目录删除失败");
  }
  let stderr, failed;
  ({ stderr, failed } = await execa.execa(`mkdir -p ${today}`, {shell: true}));
  handleExecaError({ failed, stderr });
  logger.info("临时目录建立完成");
  let upstreamDependenceJson = {};
  let dependenceJson: ReturnType<typeof createExportedNameToReferenceLocalSet> = {
    indirectExportMembers: {},
    import2export: {},
    export2export: {},
    mapFilePathToExportAllSources: {},
  };
  let effectedCode: Record<string, any> = {};
  let reports: ReturnType<typeof createDetectReport> = [];
  try {
    logger.ready(`准备clone 源代码到临时目录下的 ${today}/${TARGET} 文件夹`);
    const repoUrl = getGitRepoUrlByToken(gitRepoUrl, token || '');
    performance.mark('stage 1');
    await cloneRepoWithBranchAndDefault(repoUrl, branchName, join(today, TARGET));
    performance.mark('stage 2');
    logger.info(`stage 1 --> stage 2 耗时: ${performance.measure('stage 1 --> stage 2', 'stage 1', 'stage 2').duration}ms`);
    await cloneRepoWithBranchAndDefault(repoUrl, 'master', join(today, SOURCE));
    performance.mark('stage 3');
    logger.info(`stage 2 --> stage 3 耗时: ${performance.measure('stage 2 --> stage 3', 'stage 2', 'stage 3').duration}ms`);
    logger.ready("准备生成git_diff.txt文件");
    ({ stderr, failed } = await execa.execa(`cd ${today}/${TARGET} && git diff master..${branchName} --unified=0 --output=${gitDiffFileName}`, {shell: true}));
    performance.mark('stage 4');
    logger.info(`stage 3 --> stage 4 耗时: ${performance.measure('stage 3 --> stage 4', 'stage 3', 'stage 4').duration}ms`);
    handleExecaError({ failed, stderr });
    const repoType = await getRepoType(join(process.cwd(), today, TARGET, 'package.json'));
    logger.info(`项目类型为: ${repoType}`);
    if(repoType === 'umi'){
      const { madgeResult, shellExeResult, parsedAlias } = await umi4SetUp({ targetDirPath: join(process.cwd(), today, TARGET), invokeType: 'remote' });
      performance.mark('stage 5');
      logger.info(`stage 4 --> stage 5 耗时: ${performance.measure('stage 4 --> stage 5', 'stage 4', 'stage 5').duration}ms`);
      ({ stderr, failed } = shellExeResult);
      handleExecaError({ failed, stderr });
      const targetDirPath = join(process.cwd(), today, TARGET);
      const diff_txt = readFileSync(join(targetDirPath, gitDiffFileName), "utf-8");
      const gitDiffDetail = formatGitDiffContent(diff_txt);
      const usingFileNoPrefix = Object.keys(madgeResult.tree);
      const groupGitDiffLines = gitDiffDetail.filter(item => usingFileNoPrefix.includes(item.filePath));
      const changedFilePaths = groupGitDiffLines.map(item => item.filePath);
      upstreamDependenceJson = Object.fromEntries(changedFilePaths.map(p => [p, madgeResult.depends(p)]));
      const absPathPrefix = targetDirPath + '/';
      /** 汇总修改的文件 */
      const modifiedFilePaths = gitDiffDetail.map(item => item.filePath);
      performance.mark('stage 6');
      logger.info(`stage 5 --> stage 6 耗时: ${performance.measure('stage 5 --> stage 6', 'stage 5', 'stage 6').duration}ms`);
      /** 汇总上游 直接被影响的 文件 */
      const effectedFilePaths = collectUpstreamFiles(madgeResult, modifiedFilePaths).map(item => winPath(join(absPathPrefix, item)));
      performance.mark('stage 7');
      logger.info(`stage 6 --> stage 7 耗时: ${performance.measure('stage 6 --> stage 7', 'stage 6', 'stage 7').duration}ms`);
      if(jsonKeys.includes('dependenceJson')){
        dependenceJson = createExportedNameToReferenceLocalSet(effectedFilePaths, parsedAlias, absPathPrefix, Object.keys(madgeResult.tree));
      }
      performance.mark('stage 8');
      logger.info(`stage 7 --> stage 8 耗时: ${performance.measure('stage 7 --> stage 8', 'stage 7', 'stage 8').duration}ms`);
      if(jsonKeys.includes('reports')){
        reports = createDetectReport({ groupGitDiffLines, tree: madgeResult.tree, absPathPrefix });
      }
      performance.mark('stage 9');
      logger.info(`stage 8 --> stage 9 耗时: ${performance.measure('stage 8 --> stage 9', 'stage 8', 'stage 9').duration}ms`);
      if(jsonKeys.includes('effectedCode')){
        effectedCode = filterEffectedCode(reports, dependenceJson);
      }
      performance.mark('stage 10');
      logger.info(`stage 9 --> stage 10 耗时: ${performance.measure('stage 9 --> stage 10', 'stage 9', 'stage 10').duration}ms`);
      logger.info(`total 耗时: ${performance.measure('stage 0 --> stage 10', 'stage 0', 'stage 10').duration}ms`);
    }
    return {
      reports,
      dependenceJson,
      effectedCode,
      upstreamDependenceJson,
      repoType,
      message: "",
    };
  }
  catch (error: any) {
    logger.error(error);
    return {
      effectedCode,
      upstreamDependenceJson,
      repoType: "",
      message: error.message,
    };
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
    logger.ready(`准备clone 源代码 分支：${branchName} 到临时目录下的 ${TARGET} 文件夹`);
    await cloneRepoWithBranchAndDefault(gitUrl, branchName, join(process.cwd(), today, TARGET));
    let stderr, failed;
    logger.info("源代码clone完成");
    logger.wait("检测项目类型");
    const repoType = await getRepoType(join(process.cwd(), today, TARGET, 'package.json'));
    logger.info(`项目类型为: ${repoType}`);
    if(!isRepoTypeSupported(repoType)){
      logger.error("该项目不支持检测");
      rimraf(join(process.cwd(), today), () => {
        logger.info("临时目录已删除");
      });
      return;
    }
    logger.ready(`准备clone 源代码 分支：master 到临时目录下的 ${SOURCE} 文件夹`);
    await cloneRepoWithBranchAndDefault(gitUrl, 'master', join(process.cwd(), today, SOURCE));
    logger.info(`分支 ${branchName} 代码 clone 完成`);
    logger.ready("准备生成git_diff.txt文件");
    ({ stderr, failed } = await execa.execa(`cd ${today}/${TARGET} && git diff ${baseBranch}..${branchName} --unified=0 --output=${gitDiffFileName}`, {shell: true}));
    handleExecaError({ failed, stderr });
    logger.info("git_diff.txt文件生成完成");

    if(repoType === 'umi'){
      const { madgeResult, shellExeResult, parsedAlias } = await umi4SetUp({ targetDirPath: join(process.cwd(), today, TARGET), invokeType: 'local' });
      ({ stderr, failed } = shellExeResult);
      handleExecaError({ failed, stderr });
      const reports = await generateGitDiffReport({ madgeResult, parsedAlias, targetDirPath: join(process.cwd(), today, TARGET), generateFile });
      return reports;
    }
    else if(repoType === 'vue2'){
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