/**
 * 解析GitLab分支对比链接的工具函数（含URL解码）
 * @param compareUrl - GitLab分支对比链接，格式需为 http://gitlab.xxx.com/项目路径/-/compare/分支1...分支2
 * @returns 包含项目Git地址和两个解码后分支名的对象
 * @throws 当输入链接格式不符合要求时抛出错误
 */
export function parseGitLabCompareUrl(compareUrl: string): {
  projectPathPart: string;
  gitRepoUrl: string;
  baseBranch: string;
  targetBranch: string;
} {
  // 1. 校验输入是否为有效URL
  let urlObj: URL;
  try {
    urlObj = new URL(compareUrl);
  } catch (error) {
    throw new Error(`输入不是有效URL：${compareUrl}，请检查链接格式`);
  }

  // 2. 校验是否为GitLab分支对比链接（必须包含 "/-/compare/" 路径标识）
  const comparePathMarker = "/-/compare/";
  if (!urlObj.pathname.includes(comparePathMarker)) {
    throw new Error(
        `不是GitLab分支对比链接，链接需包含 "${comparePathMarker}" 路径，当前链接：${compareUrl}`
    );
  }

  // 3. 拆分路径：提取项目路径（左侧）和分支对比部分（右侧）
  const [projectPathPart, branchComparePart] = urlObj.pathname.split(comparePathMarker);
  if (!projectPathPart || !branchComparePart) {
    throw new Error(
        `分支对比链接格式异常，无法拆分项目路径与分支信息，当前链接：${compareUrl}`
    );
  }

  // 4. 提取并解码分支名（分支对比部分格式为 "分支1...分支2"，需处理URL编码）
  const [encodedBaseBranch, encodedTargetBranch] = branchComparePart.split("...");
  if (!encodedBaseBranch || !encodedTargetBranch) {
    throw new Error(
        `分支对比格式错误，需符合 "分支1...分支2" 格式，当前分支部分：${branchComparePart}`
    );
  }
  // 解码URL特殊字符（如 %2F -> /、%2D -> - 等）
  const baseBranch = decodeURIComponent(encodedBaseBranch);
  const targetBranch = decodeURIComponent(encodedTargetBranch);

  // 5. 拼接项目Git地址（HTTPS协议，格式：域名+项目路径+.git）
  const gitRepoUrl = `${urlObj.origin}${projectPathPart}.git`;

  return {
    projectPathPart,
    gitRepoUrl,
    baseBranch,
    targetBranch,
  };
}

export function getSshGitRepoUrl(gitRepoUrl: string): string {
  return gitRepoUrl.replace(/https?:\/\/[^/]+/, "git@");
}
