import {DetectService} from "./DetectService";
import {formatGitDiffContent} from "../util/format_git_diff_content";
import {IMadgeInstance} from "../util/report_util/getMadgeInstance";

export interface ProjectService {
  detectService: DetectService;
  gitDiffDetail: ReturnType<typeof formatGitDiffContent>;
  helpInfo: {
    projectFileList: string[];
    madgeResult: IMadgeInstance|null;
    parsedAlias: Record<string, any>;
  };
  outputResult: {
    effectedImportUsage: [string, string][]
  }
  run(): void;
}