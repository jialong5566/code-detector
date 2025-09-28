import {readFileSync, writeFileSync} from "fs";
import {dirname, join, relative} from "path";
import {gitDiffFileName, gitDiffJsonName} from "../../index";
import {formatGitDiffContent} from "../format_git_diff_content";
import {aliasUtils, readDirFiles, resolve, tsconfigPaths, winPath} from "@umijs/utils";
import {MadgeConfig, MadgeInstance, MadgePath} from "madge";
import {createDetectReport} from "../report_util";
import {createMdByJson} from "./createMdByJson";

interface IMadgeInstance extends MadgeInstance {
  tree: Record<string, string[]>;
}
type MadgeFunc = (
    path: MadgePath,
    config: MadgeConfig,
) => Promise<IMadgeInstance>;

const MADGE_NAME = 'madge';
const userAliasGetter = (cwd: string, appData: { config: { alias: Record<string, string> } }) => {
  return appData.config?.alias || {
    umi: '@@/exports',
    '@': cwd + '/src',
    '@@': cwd + '/src/.umi',
    '@umijs/max': '@@/exports'
  }
};

const reportFileName = "git_diff_report.md";

export async function generateGitDiffReport(arg: { targetDirPath: string }){
  const { targetDirPath } = arg;
  // 获取绝对路径的 src 目录
  const absSrcPath = join(targetDirPath, "src");
  // 读取 git diff 内容，生成 json 文件
  const diff_txt = readFileSync(join(targetDirPath, gitDiffFileName), "utf-8");
  const gitDiffDetail = formatGitDiffContent(diff_txt);
  // 写入 json 文件
  writeFileSync(join(targetDirPath, gitDiffJsonName), JSON.stringify(gitDiffDetail, null, 2), { encoding: 'utf-8', flag: 'w' });
  // 获取 ts 配置
  const tsconfig = (await tsconfigPaths.loadConfig(targetDirPath));
  // 读取 appData.json 文件
  const appDataContent = readFileSync(join(targetDirPath, "src", ".umi", "appData.json"), "utf-8");
  let appData: any = { config: null };
  try {
    appData = JSON.parse(appDataContent);
  } catch (e) {
    console.warn('appData.json 解析失败，将使用默认别名');
  }
  // 获取别名配置
  const userAlias = userAliasGetter(targetDirPath, appData);
  // 忽略目录正则
  const exclude: RegExp[] = [/node_modules/, /\.d\.ts$/, /\.umi/];
  // 忽略方法
  const isExclude = (path: string) => {
    return exclude.some((reg) => reg.test(path));
  };

  // 去除循环的别名
  const parsedAlias = aliasUtils.parseCircleAlias({
    alias: userAlias,
  });

  const filteredAlias = Object.keys(parsedAlias).reduce<Record<string, string[]>>(
      (acc, key) => {
        const value = parsedAlias[key];
        if (isExclude(value)) {
          return acc;
        }
        if (tsconfig.paths?.[key]) {
          return acc;
        }
        const tsconfigValue = [join(relative(targetDirPath, value), '/*')];
        const tsconfigKey = `${key}/*`;
        if (tsconfig.paths?.[tsconfigKey]) {
          return acc;
        }
        acc[tsconfigKey] = tsconfigValue;
        return acc;
      },
      {},
  );

  const devTmpDir = join(absSrcPath, '.umi');
  const exportsFile = join(devTmpDir, 'exports.ts');
  // get madge package
  const madgePkg = dirname(
      resolve.sync(`${MADGE_NAME}/package.json`, {
        basedir: process.cwd(),
      }),
  );
  const madge = require(madgePkg) as MadgeFunc;

  const madgeConfig = {
    tsConfig: {
      compilerOptions: {
        baseUrl: targetDirPath,
        paths: {
          ...filteredAlias,
          ...tsconfig.paths,
          umi: [exportsFile],
          '@umijs/max': [exportsFile],
        },
        target: 'esnext',
        module: 'esnext',
        moduleResolution: 'node',
        importHelpers: true,
        jsx: 'react-jsx',
        esModuleInterop: true,
        strict: true,
        resolveJsonModule: true,
        allowSyntheticDefaultImports: true,
      },
    },
    fileExtensions: ['ts', 'tsx', 'js', 'jsx'],
    excludeRegExp: exclude,
    baseDir: targetDirPath,
  };
  // get madgeInstance
  const res = await madge(join(devTmpDir, 'umi.ts'), madgeConfig);

  // get dependence map
  // treeMap { src/*: [] } 需要把 key 转化为绝对路径
  const treeMap = res.tree;
  const dependenceMap = Object.keys(treeMap).reduce(
      (acc: Record<string, boolean>, key) => {
        const path = winPath(join(targetDirPath, key));
        acc[path] = true;
        return acc;
      },
      {},
  );

  // 在 dependenceMap 里, 且不在 fileExcludeNames 里
  const usingFiles = readDirFiles({
    dir: absSrcPath,
    exclude,
  }).filter(({ filePath }) => dependenceMap[filePath]);

  const tree = res.tree;
  const absPathPrefix = targetDirPath + '/';
  const usingFileNoPrefix = usingFiles.map(item => item.filePath.replace(absPathPrefix, ""));
  const groupGitDiffLines = gitDiffDetail.filter(item => usingFileNoPrefix.includes(item.filePath));
  writeFileSync(join(targetDirPath, "reports_helper.json"), JSON.stringify({ groupGitDiffLines, absPathPrefix, tree, filteredAlias, parsedAlias, tsconfig, madgeConfig  }, null, 2), { encoding: 'utf-8', flag: 'w' });
  const reports = createDetectReport({ groupGitDiffLines, tree, absPathPrefix });
  writeFileSync(join(targetDirPath, "reports.json"), JSON.stringify(reports, null, 2), { encoding: 'utf-8', flag: 'w' });
  const mdContent = createMdByJson(reports);
  writeFileSync(join(targetDirPath, reportFileName), mdContent, { encoding: 'utf-8', flag: 'w' });
}