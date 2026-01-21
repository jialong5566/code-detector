import {DetectService} from "./DetectService";
import {formatGitDiffContent} from "../util/format_git_diff_content";
import {RelateUsageOfExport} from "../util/ast_util/helper/findRelateUsageOfExport";
import findNoMatchExportMember from "../util/ast_util/helper/findNoMatchExportMember";

export interface ProjectService {
  detectService: DetectService;
  gitDiffDetail: ReturnType<typeof formatGitDiffContent>;
  helpInfo: {
    projectFileList: string[];
    parsedAlias: Record<string, any>;
  };
  outputResult: {
    effectedImportUsage: [string, string][],
    error: Error|null,
    relatedExportUsage: RelateUsageOfExport[],
    noMatchExportMembers: ReturnType<typeof findNoMatchExportMember>,
  }
  run(): void;
}