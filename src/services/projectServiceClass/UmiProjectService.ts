import {formatGitDiffContent, GitDiffDetail} from "../../util/format_git_diff_content";
import {DetectService} from "../DetectService";
import {umi4SetUp} from "../../util/project_umi_util/umi4ProjectUtil";
import {readFileSync} from "fs";
import {join} from "path";
import collectUpstreamFiles from "../../util/shared/collectUpstreamFiles";
import {createExportedNameToReferenceLocalSet} from "../../util/report_util/createDependenceMap";
import filterEffectedExportMember from "../../util/report_util/filterEffectedExportMember";
import {ProjectService} from "../ProjectService";
import {gitDiffFileName} from "../../util/constants";

export default class UmiProjectService implements ProjectService {
  gitDiffDetail: GitDiffDetail[] = [];
  helpInfo: ProjectService['helpInfo'] = {
    projectFileList: [],
    madgeResult: null,
    parsedAlias: {},
  };
  outputResult: ProjectService['outputResult'] = {
    effectedImportUsage: [],
  };

  constructor(public detectService: DetectService) {
    this.detectService = detectService;
  }


  async run() {
    const targetDirPath = this.detectService.directoryInfo.targetBranchDir;
    const { madgeResult, parsedAlias } = await umi4SetUp({ targetDirPath, invokeType: 'remote' });
    this.helpInfo.projectFileList = Object.keys(madgeResult.tree);
    this.helpInfo.madgeResult = madgeResult;
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
    const { madgeResult, parsedAlias } = this.helpInfo;
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
    const { import2export, indirectExportMembers } = createExportedNameToReferenceLocalSet(possibleEffectedFilesFullPath, parsedAlias, absPathPrefix, projectFileList);
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
  }
}