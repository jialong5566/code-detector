import {gitDiffFileName} from "../constants";

const simpleGit = require('simple-git');

/**
 * 执行 baseBranch  和 targetBranch 的 diff
 */
export default async function execGitDiff(targetDir: string, baseBranch: string, targetBranch: string) {
  try {
    const repoGit = simpleGit(targetDir);
    // 切换到目标分支
    await repoGit.checkout(targetBranch);
    // 拉取最新代码（可选，确保分支是最新的）
    await repoGit.pull('origin', targetBranch);
    // 获取差异文件列表
    const diffFiles = await repoGit.diffSummary([baseBranch, '--unified=0', `--output=${gitDiffFileName}`]);
    console.log(`${targetBranch} 与 ${baseBranch} 的差异：`, diffFiles);
    return diffFiles;
  } catch (error: any) {
    console.error(`获取差异失败：${error.message}`);
    throw error;
  }
}