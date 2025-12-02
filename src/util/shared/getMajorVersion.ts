import { semver } from "@umijs/utils";

export function getMajorVersion(version: string): number {
  // 手动移除 ^/~ 前缀（兼容 semver@6.x 及以下）
  const strippedVersion = version.replace(/^[\^~]/, '');
  // 再用 clean() 清理其他无效字符
  const cleanedVersion = semver.clean(strippedVersion);

  if (!cleanedVersion) {
    throw new Error(`无效的版本号格式：${version}`);
  }

  return semver.major(cleanedVersion);
}