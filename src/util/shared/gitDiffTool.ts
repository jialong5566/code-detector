import {execa, logger, rimraf} from "@umijs/utils";
import to from "await-to-js";
import {SOURCE, TARGET} from "../constants";
import {handleExecaError} from "./handleExecaError";
import {getRepoType, isRepoTypeSupported} from "./getRepoSupportFlag";
import {join} from "path";
import {umi4SetUp} from "../project_umi_util/umi4ProjectUtil";
import {generateGitDiffReport} from "../report_util/generateGitDiffReport";
import {vueSetUp} from "./vueProjectUtil";
import {gitDiffFileName} from "../constants";
import cloneRepoWithBranchAndDefault from "../git_util/cloneRepoWithBranchAndDefault";

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