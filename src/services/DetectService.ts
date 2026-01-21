import {join} from "path";
import to from "await-to-js";
import {execa, logger} from "@umijs/utils";
import {getGitRepoUrlByToken, parseGitLabCompareUrl} from "../util/git_util/parseGitLabDiffUril";
import createRandomStr from "../util/shared/createRandomStr";
import {SOURCE, TARGET} from "../util/constants";
import execGitDiff from "../util/git_util/execGitDiff";
import {getRepoType, isRepoTypeSupported} from "../util/shared/getRepoSupportFlag";
import {ProjectService} from "./ProjectService";
import UmiProjectService from "./projectServiceClass/UmiProjectService";
import { performance } from "perf_hooks";
import cloneRepoWithBranchAndDefault from "../util/git_util/cloneRepoWithBranchAndDefault";
import VueProjectService from "./projectServiceClass/VueProjectService";
import ViteProjectService from "./projectServiceClass/ViteProjectService";

export class DetectService {
  directoryInfo: {
    tmpWorkDir: string;
    sourceBranchDir: string;
    targetBranchDir: string;
  } = {
    tmpWorkDir: '',
    sourceBranchDir: '',
    targetBranchDir: ''
  };
  gitInfo: {
    token: string;
    repoType: string;
  } & ReturnType<typeof parseGitLabCompareUrl> = {
    token: '',
    gitRepoUrl: '',
    baseBranch: '',
    targetBranch: '',
    projectPathPart: '',
    repoType: ''
  };

  projectService: ProjectService|null = null;
  constructor(option: { compareUrl?: string, gitRepoUrl?: string, token?: string, branchName?: string }) {
    this.init(option);
  }
  async init(option: { compareUrl?: string, gitRepoUrl?: string, token?: string, branchName?: string }) {
    const { compareUrl, token = '', gitRepoUrl, branchName } = option;
    const tmpWorkDir = createRandomStr();
    this.directoryInfo = {
      tmpWorkDir,
      sourceBranchDir: join(tmpWorkDir, SOURCE),
      targetBranchDir: join(tmpWorkDir, TARGET),
    };
    if(compareUrl){
      this.gitInfo = {
        ...this.gitInfo,
        ...parseGitLabCompareUrl(compareUrl),
        token,
        repoType: ''
      }
    }
    if(gitRepoUrl){
      this.gitInfo = {
        ...this.gitInfo,
        baseBranch: 'master',
        targetBranch: branchName || 'master',
        gitRepoUrl,
        token: token || '',
        repoType: ''
      }
    }
  }

  async run(){
    await this.clean();
    try {
      performance.mark('mkdir');
      await this.mkdir();
      performance.mark('clone');
      {
        const duration = performance.measure('mkdir', 'mkdir', 'clone').duration;
        logger.info(`mkdir 耗时: ${duration}ms`);
      }
      await this.clone();
      const token = this.gitInfo.token;
      if(token){
        await this.move();
      }
      performance.mark('projectHandle');
      {
        const duration = performance.measure('clone', 'clone', 'projectHandle').duration;
        logger.info(`clone 耗时: ${duration}ms`);
      }
      await this.projectHandle();
      {
        const duration = performance.measure('projectHandle', 'projectHandle').duration;
        logger.info(`项目处理耗时: ${duration}ms`);
      }
    } catch (e: any) {
      logger.error("失败:" + e.message);
    }
    finally {
      this.clean();
    }
  }
  async clean(){
    const dirPath = this.directoryInfo.tmpWorkDir;
    if (!dirPath) return;
    const [err] = await to(execa.execa(`rm -rf ${dirPath}`, {shell: true}));
    if (err) {
      logger.error("临时目录删除失败");
    }
  }
  async mkdir(){
    const dirPath = this.directoryInfo.tmpWorkDir;
    await execa.execa(`mkdir -p ${dirPath}`, {shell: true});
  }

  async clone(){
    logger.info("开始克隆仓库");
    const { tmpWorkDir } = this.directoryInfo;
    const {gitRepoUrl, token, baseBranch, targetBranch} = this.gitInfo;
    logger.info(`开始克隆仓库: ${gitRepoUrl}`);
    logger.info(`token: ${token}`);
    const repoUrl = token ? getGitRepoUrlByToken(gitRepoUrl, token || '') : gitRepoUrl;
    logger.info(`克隆仓库URL: ${repoUrl}`);
    const branchesAndTargetDirPaths = [
      {
        branch: baseBranch,
        targetDirPath: join(tmpWorkDir, SOURCE),
      },
      {
        branch: targetBranch,
        targetDirPath: join(tmpWorkDir, TARGET),
      }
    ];
    await Promise.all(branchesAndTargetDirPaths.map(({ branch, targetDirPath }) => {
      return cloneRepoWithBranchAndDefault(repoUrl, branch, targetDirPath);
    }));
    const targetDirPath = join(tmpWorkDir, TARGET);
    await execGitDiff(targetDirPath, baseBranch, targetBranch);
    const repoType = await getRepoType(join(targetDirPath, 'package.json'));
    this.gitInfo.repoType = repoType;
    logger.info(`克隆仓库成功, repoType: ${repoType}`);
  }

  async move(){
    const repoType = this.gitInfo.repoType;
    const tmpWorkDir = this.directoryInfo.tmpWorkDir;
    const newTmpWorkDir = join(repoType, tmpWorkDir);
    this.directoryInfo.tmpWorkDir = newTmpWorkDir;
    this.directoryInfo.sourceBranchDir = join(newTmpWorkDir, SOURCE);
    this.directoryInfo.targetBranchDir = join(newTmpWorkDir, TARGET);
    await execa.execa(`mv ${tmpWorkDir} ${newTmpWorkDir}`, {shell: true});
  }

  async projectHandle(){
    const { repoType } = this.gitInfo;
    logger.info('开始处理项目' + repoType);
    if(!isRepoTypeSupported(repoType)){
      logger.info('不支持的 repoType:' + repoType);
      return;
    }
    if(repoType === 'umi'){
      this.projectService = new UmiProjectService(this);
    }
    if(repoType === 'vue2'){
      this.projectService = new VueProjectService(this);
    }
    if(repoType === 'vite'){
      this.projectService = new ViteProjectService(this);
    }
    await this.projectService?.run();
  }

  formatResult(){
    const repoType = this.gitInfo.repoType;
    const { effectedImportUsage, error, relatedExportUsage, noMatchExportMembers } = this.projectService?.outputResult || { relatedExportUsage: [], effectedImportUsage: [], noMatchExportMembers: [], error: null };
    return {
      error,
      repoType,
      effectedImportUsage,
      relatedExportUsage,
      noMatchExportMembers
    }
  }
};