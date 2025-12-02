import * as fs from 'fs';
import * as path from 'path';
import type { CompilerOptions } from 'typescript';
import { tsconfigPaths} from "@umijs/utils"

/**
 * TS Config paths 转 Webpack alias（完美适配你的配置场景）
 * @param options 转换配置
 * @returns Webpack resolve.alias 配置
 */
export async function tsConfigPathsToWebpackAlias(options: {
  tsconfigPath?: string;
  projectRoot?: string;
  excludeTypeOnly?: boolean;
} = {}): Promise<Record<string, string>> {
  const {
    tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json'),
    projectRoot = path.dirname(tsconfigPath),
    excludeTypeOnly = true,
  } = options;

  // 校验 tsconfig 存在
  if (!fs.existsSync(tsconfigPath)) {
    throw new Error(`未找到 tsconfig.json 文件：${tsconfigPath}`);
  }

  const compilerOptions = await tsconfigPaths.loadConfig(projectRoot) as Pick<CompilerOptions, 'paths'|'baseUrl'>;
  const { paths = {}, baseUrl = '.' } = compilerOptions || {};

  // 解析 baseUrl（绝对路径直接用，相对路径基于项目根目录）
  const resolvedBaseUrl = path.isAbsolute(baseUrl)
                          ? baseUrl
                          : path.resolve(projectRoot, baseUrl);

  const alias: Record<string, string> = {};

  Object.entries(paths).forEach(([tsPath, tsPathTargets]) => {
    // 过滤类型声明路径（可选）
    if (excludeTypeOnly && /@types\/.+/.test(tsPath)) {
      return;
    }

    // 处理同别名的多个目标（如 @utils 的两个映射）
    tsPathTargets.forEach((targetPath) => {
      const isWildcard = tsPath.endsWith('/*');
      const targetIsWildcard = targetPath.endsWith('/*');

      // 1. 统一通配符逻辑：TS 路径和目标路径必须同时带/*或同时不带
      if (isWildcard !== targetIsWildcard) {
        console.warn(`跳过无效映射：${tsPath} -> ${targetPath}（通配符不一致）`);
        return;
      }

      // 2. 生成 alias 的 key 和 value
      const aliasKey = isWildcard ? tsPath.slice(0, -2) : tsPath;
      let aliasValue: string;

      // 特殊处理：目标路径以 node_modules 开头（直接映射到项目根目录下的 node_modules）
      if (targetPath.startsWith('node_modules/')) {
        aliasValue = path.resolve(projectRoot, targetPath);
      }
      // 处理绝对路径目标
      else if (path.isAbsolute(targetPath)) {
        aliasValue = targetPath;
      }
      // 处理相对路径目标（基于 baseUrl）
      else {
        const resolvedTarget = isWildcard
                               ? targetPath.slice(0, -2)
                               : targetPath;
        aliasValue = path.resolve(resolvedBaseUrl, resolvedTarget);
      }

      // 3. 覆盖写入：后定义的映射优先级更高（符合 TS 规则）
      alias[aliasKey] = aliasValue;
    });
  });

  return alias;
}