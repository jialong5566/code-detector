const simpleGit = require('simple-git');

/**
 * 克隆 Git 仓库，同时获取目标分支和默认分支的代码
 * @param {string} repoUrl - 仓库地址（带认证信息的 HTTPS/SSH 地址）
 * @param {string} targetBranch - 主要目标分支（如 dev）
 * @param {string} targetDir - 本地目标目录
 * @returns {Promise<string>} 克隆目录路径
 */
export async function cloneRepoWithBranchAndDefault(repoUrl: string, targetBranch: string, targetDir: string) {
  try {
    const git = simpleGit();

    // 1. 克隆仓库（不限制单分支，获取所有分支引用）
    await git.clone(repoUrl, targetDir, [
      `--branch=${targetBranch}` // 初始检出目标分支
      // 不添加 --single-branch，默认会拉取所有分支的引用
    ]);

    // 2. 进入克隆后的仓库目录，获取默认分支名称（通常是 main 或 master）
    const repoGit = simpleGit(targetDir);
    const remoteInfo = await repoGit.remote(['show', 'origin']);
    // 从 remote info 中提取默认分支（正则匹配 "HEAD branch: <默认分支名>"）
    const defaultBranchMatch = remoteInfo.match(/HEAD branch: (\S+)/);
    const defaultBranch = defaultBranchMatch ? defaultBranchMatch[1] : 'main'; // 兜底默认值

    // 3. 拉取默认分支的代码（本地创建并检出默认分支）
    await repoGit.checkout(defaultBranch);
    await repoGit.pull('origin', defaultBranch); // 确保默认分支是最新的

    // 4. 回到最初的目标分支（保持用户预期的初始分支）
    await repoGit.checkout(targetBranch);

    console.log(`克隆完成：目标分支 ${targetBranch} + 默认分支 ${defaultBranch}，路径：${targetDir}`);
    return targetDir;
  } catch (error: any) {
    console.error(`克隆失败：${error.message}`);
    throw error;
  }
}