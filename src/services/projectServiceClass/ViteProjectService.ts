import {formatGitDiffContent, GitDiffDetail} from "../../util/format_git_diff_content";
import {ProjectService} from "../ProjectService";
import {DetectService} from "../DetectService";
import {readFileSync, writeFileSync} from "fs";
import {join} from "path";
import {gitDiffFileName} from "../../util/constants";
import {logger, readDirFiles} from "@umijs/utils";
import madge from "madge";
import {IMadgeInstance} from "../../util/report_util/getMadgeInstance";
import collectUpstreamFiles from "../../util/shared/collectUpstreamFiles";
import {createExportedNameToReferenceLocalSet} from "../../util/report_util/createDependenceMap";
import filterEffectedExportMember from "../../util/report_util/filterEffectedExportMember";
import isVueEntryFile from "../../util/project_umi_util/isVueEntryFile";
import {tsConfigPathsToWebpackAlias} from "../../util/project_umi_util/tsConfigPathsToWebpackAlias";
import findRelateUsageOfExport from "../../util/ast_util/helper/findRelateUsageOfExport";


export default class ViteProjectService implements ProjectService{
  gitDiffDetail: GitDiffDetail[] = [];
  helpInfo: ProjectService['helpInfo'] = {
    projectFileList: [],
    parsedAlias: {},
  };
  outputResult: ProjectService['outputResult'] = {
    relatedExportUsage: [],
    effectedImportUsage: [],
    error: null
  };

  viteHelpInfo = {
    madgeResult: null as IMadgeInstance|null,
    tsConfigPath: '',
    entryFiles: [] as string[],
    extensions: [] as string[],
  };

  constructor(public detectService: DetectService){
    this.detectService = detectService;
  }

  async run(){
    logger.info("格式化 git diff 内容...");
    await this.parseGitDiffContent();
    logger.info("获取 Alias 配置...");
    await this.setAlias();
    logger.info("读取 src 目录文件...");
    await this.readSrcDirFilesAndSetEntries();
    logger.info("获取 madge 结果...");
    await this.getMadgeResult();
    logger.info("收集受影响的文件...");
    await this.collectEffectedFiles();
  }

  async parseGitDiffContent(){
    const targetDirPath = this.detectService.directoryInfo.targetBranchDir;
    const diff_txt = readFileSync(join(targetDirPath, gitDiffFileName), "utf-8");
    this.gitDiffDetail = formatGitDiffContent(diff_txt);
  }

  async setAlias(){
    const targetDirPath = this.detectService.directoryInfo.targetBranchDir;
    this.helpInfo.parsedAlias = await tsConfigPathsToWebpackAlias({
      tsconfigPath: join(targetDirPath, "tsconfig.json"),
      projectRoot: targetDirPath,
      excludeTypeOnly: false
    });
  }

  async readSrcDirFilesAndSetEntries(){
    const targetDirPath = this.detectService.directoryInfo.targetBranchDir;
    const projectFileList = readDirFiles({ dir: join(targetDirPath, 'src')}).filter(e => (e.filePath.endsWith('.ts') && !e.filePath.endsWith('.d.ts')) || e.filePath.endsWith('.js'));
    // todo 有优化空间
    this.viteHelpInfo.entryFiles = projectFileList.filter(file => isVueEntryFile(file.filePath)).map(e => e.filePath);
  }


  async getMadgeResult(){
    const targetBranchDir = this.detectService.directoryInfo.targetBranchDir;
    const entryFilePath = this.viteHelpInfo.entryFiles;
    const tsConfig = join(targetBranchDir, "tsconfig.json");
    const madgeConfig = {
      baseDir: targetBranchDir,
      fileExtensions: ['vue', 'ts', 'js'],
      tsConfig,
      excludeRegExp: [/node_modules/, /\.d\.ts$/],
    };
    const res = await madge(entryFilePath, madgeConfig) as IMadgeInstance;
    this.viteHelpInfo.madgeResult = res;
    this.helpInfo.projectFileList = Object.keys(res.tree);
  }

  async collectEffectedFiles() {
    const { parsedAlias } = this.helpInfo;
    const { madgeResult } = this.viteHelpInfo;
    const projectFileList = this.helpInfo.projectFileList;
    const targetBranchDir = this.detectService.directoryInfo.targetBranchDir;
    const absPathPrefix = join(targetBranchDir, '/');
    const validModifiedFiles = this.gitDiffDetail.reduce((acc, item) => {
      const { filePath } = item;
      this.helpInfo.projectFileList.includes(filePath) && acc.push(filePath);
      return acc;
    }, [] as string[]);
    const possibleEffectedFiles = collectUpstreamFiles(madgeResult!, validModifiedFiles);
    const possibleEffectedFilesFullPath = possibleEffectedFiles.map(file => join(absPathPrefix, file));
    const mapRef = createExportedNameToReferenceLocalSet(possibleEffectedFilesFullPath, parsedAlias, absPathPrefix, projectFileList);
    const { import2export, indirectExportMembers } = mapRef;
    const gitDiffDetail = this.gitDiffDetail;
    const validGitDiffDetail = gitDiffDetail.filter(item => possibleEffectedFiles.includes(item.filePath));
    const effectedExportNames = validGitDiffDetail.map(item => {
      const { filePath, newBranchLineScope, startLineOfNew } = item;
      const exportedNames = filterEffectedExportMember(join(absPathPrefix, filePath), absPathPrefix, Number(startLineOfNew), Number(startLineOfNew) + Number(newBranchLineScope) - 1);
      return exportedNames.map(name => [filePath, name].join('#'));
    }).flat();
    const effectedImportUsage = [...Object.entries(import2export), ...Object.entries(indirectExportMembers)].filter(([_, value]) => {
      return effectedExportNames.includes(value);
    });
    this.outputResult.effectedImportUsage = effectedImportUsage;
    const effectedImportUsageUnique = [...new Set(effectedImportUsage.map(item => item[0]))].map(importFileAndMember => importFileAndMember.split("#") as [string, string]);
    this.outputResult.relatedExportUsage = findRelateUsageOfExport(effectedImportUsageUnique, import2export, indirectExportMembers, absPathPrefix);
    const token = this.detectService.gitInfo.token;
    if(!token){
      const pwd = join(this.detectService.directoryInfo.tmpWorkDir, "..");
      writeFileSync(join(pwd, "effectedImportUsage.json"), JSON.stringify({  tree: madgeResult?.tree, projectFileList, possibleEffectedFiles, gitDiffDetailFiles: gitDiffDetail.map(e => e.filePath), validGitDiffDetail, ...this.outputResult, ...mapRef}, null, 2))
    }
  }
}