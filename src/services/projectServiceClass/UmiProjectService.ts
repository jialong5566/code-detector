import {formatGitDiffContent, GitDiffDetail} from "../../util/format_git_diff_content";
import {DetectService} from "../DetectService";
import {umi4SetUp} from "../../util/project_umi_util/umi4ProjectUtil";
import {readFileSync, writeFileSync} from "fs";
import {join} from "path";
import collectUpstreamFiles from "../../util/shared/collectUpstreamFiles";
import {createExportedNameToReferenceLocalSet} from "../../util/report_util/createDependenceMap";
import filterEffectedExportMember from "../../util/report_util/filterEffectedExportMember";
import {ProjectService} from "../ProjectService";
import {gitDiffFileName} from "../../util/constants";
import {IMadgeInstance} from "../../util/report_util/getMadgeInstance";
import findRelateUsageOfExport from "../../util/ast_util/helper/findRelateUsageOfExport";
import create_mmd from "../../util/report_util/create_mmd";
import {execa} from "@umijs/utils";
import mmd_html from "../../util/report_util/mmd_html";

export default class UmiProjectService implements ProjectService {
  gitDiffDetail: GitDiffDetail[] = [];
  helpInfo: ProjectService['helpInfo'] = {
    projectFileList: [],
    parsedAlias: {},
  };
  outputResult: ProjectService['outputResult'] = {
    noMatchExportMembers: [],
    relatedExportUsage: [],
    effectedImportUsage: [],
    error: null,
  };

  umiHelpInfo = {
    madgeResult: null as IMadgeInstance|null,
  };

  constructor(public detectService: DetectService) {
    this.detectService = detectService;
  }


  async run() {
    const targetDirPath = this.detectService.directoryInfo.targetBranchDir;
    const { madgeResult, parsedAlias } = await umi4SetUp({ targetDirPath, invokeType: 'remote' });
    this.helpInfo.projectFileList = Object.keys(madgeResult.tree);
    this.umiHelpInfo.madgeResult = madgeResult;
    this.helpInfo.parsedAlias = parsedAlias;
    await this.parseGitDiffContent();
    await this.collectEffectedFiles();
  }
  async parseGitDiffContent(){
    const targetDirPath = this.detectService.directoryInfo.targetBranchDir;
    const diff_txt = readFileSync(join(targetDirPath, gitDiffFileName), "utf-8");
    this.gitDiffDetail = formatGitDiffContent(diff_txt);
  }

  async collectEffectedFiles() {
    const { parsedAlias } = this.helpInfo;
    const { madgeResult } = this.umiHelpInfo;
    // 项目相关的 ts\tsx 文件
    const projectFileList = this.helpInfo.projectFileList;
    const targetBranchDir = this.detectService.directoryInfo.targetBranchDir;
    const absPathPrefix = join(targetBranchDir, '/');
    // 过滤 出改动的 ts\tsx 文件
    const validModifiedFiles = this.gitDiffDetail.reduce((acc, item) => {
      const { filePath } = item;
      this.helpInfo.projectFileList.includes(filePath) && acc.push(filePath);
      return acc;
    }, [] as string[]);
    // 根据引用关系 向上查找 关联文件
    const possibleEffectedFiles = collectUpstreamFiles(madgeResult!, validModifiedFiles);
    const { import2export, indirectExportMembers, noMatchExportMembers } = createExportedNameToReferenceLocalSet(projectFileList.map(file => join(absPathPrefix, file)), parsedAlias, absPathPrefix, projectFileList);
    const gitDiffDetail = this.gitDiffDetail;
    // 过滤出 有效改动文件 以及 有效改动内容
    const validGitDiffDetail = gitDiffDetail.filter(item => possibleEffectedFiles.includes(item.filePath));
    // 过滤出 改动的导出成员
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
    this.outputResult.noMatchExportMembers = noMatchExportMembers;
    const token = this.detectService.gitInfo.token;
    if(!token){
      const pwd = join(this.detectService.directoryInfo.tmpWorkDir, "..");
      writeFileSync(join(pwd, "effectedImportUsage.json"), JSON.stringify({ tree: madgeResult?.tree, projectFileList, possibleEffectedFiles, gitDiffDetailFiles: gitDiffDetail.map(e => e.filePath), validGitDiffDetail, ...this.outputResult }, null, 2))
      mmd_html(join(pwd, 'relation.html'), create_mmd(this.outputResult.relatedExportUsage));
    }
  }
}