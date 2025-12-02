import {formatGitDiffContent, GitDiffDetail} from "../../util/format_git_diff_content";
import {ProjectService} from "../ProjectService";
import {DetectService} from "../DetectService";
import {readFileSync, writeFileSync} from "fs";
import {join} from "path";
import {gitDiffFileName} from "../../util/constants";
import {aliasUtils, execa, logger, readDirFiles} from "@umijs/utils";
import madge from "madge";
import {IMadgeInstance} from "../../util/report_util/getMadgeInstance";
import collectUpstreamFiles from "../../util/shared/collectUpstreamFiles";
import {createExportedNameToReferenceLocalSet} from "../../util/report_util/createDependenceMap";
import filterEffectedExportMember from "../../util/report_util/filterEffectedExportMember";
import to from "await-to-js";


export default class VueProjectService implements ProjectService{
  gitDiffDetail: GitDiffDetail[] = [];
  helpInfo: ProjectService['helpInfo'] = {
    projectFileList: [],
    parsedAlias: {},
  };
  outputResult: ProjectService['outputResult'] = {
    effectedImportUsage: [],
    error: null
  };

  vueHelpInfo = {
    madgeResult: null as IMadgeInstance|null,
    webpackConfigPath: '',
    webpackConfigTextLines: [] as string[],
    entryFiles: [] as string[],
    extensions: [] as string[],
  };

  constructor(public detectService: DetectService){
    this.detectService = detectService;
  }

  async run(){
    logger.info("格式化 git diff 内容...");
    await this.parseGitDiffContent();
    logger.info("获取 webpack 配置...");
    await this.getWebpackConfigText();
    await this.collectEffectedFiles();
  }

  async readSrcDirFiles(){
    const targetDirPath = this.detectService.directoryInfo.targetBranchDir;
    const projectFileList = readDirFiles({ dir: join(targetDirPath, 'src')});
  }
  async parseGitDiffContent(){
    const targetDirPath = this.detectService.directoryInfo.targetBranchDir;
    const diff_txt = readFileSync(join(targetDirPath, gitDiffFileName), "utf-8");
    this.gitDiffDetail = formatGitDiffContent(diff_txt);
  }

  async handleWebpackConfigText(webpackConfigText: string){
    const targetDirPath = this.detectService.directoryInfo.targetBranchDir;
    this.vueHelpInfo.webpackConfigTextLines = webpackConfigText.split("\n");
    this.getWebpackAlias();
    this.getWebpackExtensions();
    this.getEntryFiles();
    logger.info("生成简单的 webpack 配置...");
    const wb = this.createSimpleWebpackConfig();
    writeFileSync(this.vueHelpInfo.webpackConfigPath = join(targetDirPath, 'webpack.config.js'), `module.exports = ${JSON.stringify(wb, null, 2)}`, 'utf-8')
    await this.getMadgeResult();
  }

  async getWebpackConfigText(){
    const targetDirPath = this.detectService.directoryInfo.targetBranchDir;
    logger.info("执行 npx vue-cli-service inspect");
    let [err, data] = await to(execa.execa(`cd ${targetDirPath} && npx vue-cli-service inspect`, {shell: true}));
    if(err){
      await execa.execa(`cd ${targetDirPath} && yarn`, {shell: true});
      [err, data] = await to(execa.execa(`cd ${targetDirPath} && npx vue-cli-service inspect`, {shell: true}));
    }
    this.outputResult.error = err;
    const webpackConfigText = data?.stdout;
    if(webpackConfigText){
      await this.handleWebpackConfigText(webpackConfigText);
    }
  }

  createSimpleWebpackConfig(){
    return {
      resolve: {
        alias: this.helpInfo.parsedAlias,
        extensions: this.vueHelpInfo.extensions,
      },
    };
  }

  getEntryFiles(){
    const lines = this.vueHelpInfo.webpackConfigTextLines;
    let entryObject = {};
    const entryLines = [];
    let entryFind = false;
    for (const line of lines) {
      if (!entryFind && line.trim().startsWith("entry:")) {
        entryLines.push(line.replace("entry:", ""));
        entryFind = true;
      }
      else if (entryFind && line.trim().startsWith("}")) {
        entryLines.push(line.replace(/,/g, ""));
        break;
      }
      else if (entryFind) {
        entryLines.push(line);
      }
    }
    const entryLinesJoin = entryLines.join("\n")
    entryObject = eval(`(${entryLinesJoin})`);
    this.vueHelpInfo.entryFiles = Object.values({...entryObject}).flat() as string[];
  }

  getWebpackExtensions(){
    logger.info("获取 webpack extensions...");
    const lines = this.vueHelpInfo.webpackConfigTextLines;
    let extensions = "";
    let extensionsFind = false;
    for (const line of lines) {
      if(!extensionsFind && line.trim().startsWith('extensions:')){
        extensionsFind = true;
        extensions += line.trim().replace(/^\s*extensions:\s*/, "");
      }
      else if(extensionsFind &&line.trim().startsWith("]")){
        extensions += line.replace(/,/g, "");
        break;
      }
      else if(extensionsFind){
        extensions += line.trim();
      }
    }
    this.vueHelpInfo.extensions = eval(`(${extensions})`) as string[];
  }

  getWebpackAlias(){
    logger.info("获取 webpack alias...");
    const lines = this.vueHelpInfo.webpackConfigTextLines;
    const aliasLines = [];
    let aliasFind = false;
    for (const line of lines) {
      if (!aliasFind && line.trim().startsWith("alias:")) {
        aliasLines.push(line.replace("alias:", ""));
        aliasFind = true;
      }
      else if (aliasFind && line.trim().startsWith("}")) {
        aliasLines.push(line.replace(/,/g, ""));
        break;
      }
      else if (aliasFind) {
        aliasLines.push(line);
      }
    }
    const userAlias = eval(`(${aliasLines.join("\n")})`);
    this.helpInfo.parsedAlias = userAlias;
  }


  async getMadgeResult(){
    const targetBranchDir = this.detectService.directoryInfo.targetBranchDir;
    const entryFilePath = this.vueHelpInfo.entryFiles.map(file => join(targetBranchDir, file));
    const madgeConfig = {
      baseDir: this.detectService.directoryInfo.targetBranchDir,
      fileExtensions: this.vueHelpInfo.extensions.map(ext => ext.replace(/^\./, "")),
      webpackConfig: this.vueHelpInfo.webpackConfigPath,
      excludeRegExp: [/node_modules/, /\.d\.ts$/],
    };
    const res = await madge(entryFilePath, madgeConfig) as IMadgeInstance;
    this.vueHelpInfo.madgeResult = res;
    this.helpInfo.projectFileList = Object.keys(res.tree);
  }

  async collectEffectedFiles() {
    const { parsedAlias } = this.helpInfo;
    const { madgeResult } = this.vueHelpInfo;
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
      const exportedNames = filterEffectedExportMember(join(absPathPrefix, filePath), absPathPrefix, Number(startLineOfNew), Number(startLineOfNew) + Number(newBranchLineScope));
      return exportedNames.map(name => [filePath, name].join('#'));
    }).flat();
    const effectedImportUsage = [...Object.entries(import2export), ...Object.entries(indirectExportMembers)].filter(([_, value]) => {
      return effectedExportNames.includes(value);
    });
    this.outputResult.effectedImportUsage = effectedImportUsage;
    const token = this.detectService.gitInfo.token;
    if(!token){
      const pwd = join(this.detectService.directoryInfo.tmpWorkDir, "..");
      writeFileSync(join(pwd, "effectedImportUsage.json"), JSON.stringify({ webpackConfig: this.createSimpleWebpackConfig(), tree: madgeResult?.tree, projectFileList, possibleEffectedFiles, gitDiffDetailFiles: gitDiffDetail.map(e => e.filePath), validGitDiffDetail, effectedImportUsage, ...mapRef}, null, 2))
    }
  }
}