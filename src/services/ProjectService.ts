import {DetectService} from "./DetectService";
import {formatGitDiffContent} from "../util/format_git_diff_content";

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
  }
  run(): void;
}