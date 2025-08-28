import {dirname, join, relative} from "path";
import {MadgeConfig, MadgeInstance, MadgePath} from "madge";
import {aliasUtils, readDirFiles, resolve, tsconfigPaths, winPath} from "@umijs/utils";


interface IMadgeInstance extends MadgeInstance {
  tree: Record<string, string[]>;
}
type MadgeFunc = (
    path: MadgePath,
    config: MadgeConfig,
) => Promise<IMadgeInstance>;

const MADGE_NAME = 'madge';
export default async function (api: any){
  const userAlias = api.config.alias;
  if(!userAlias){
    console.log("userAlias -> null");
    return;
  }
  // 获取当前工作文件夹
  const cwd = api.cwd;
  // 获取 ts 配置
  const tsconfig = (await tsconfigPaths.loadConfig(cwd));
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
        const tsconfigValue = [join(relative(cwd, value), '/*')];
        const tsconfigKey = `${key}/*`;
        if (tsconfig.paths?.[tsconfigKey]) {
          return acc;
        }
        acc[tsconfigKey] = tsconfigValue;
        return acc;
      },
      {},
  );

  const devTmpDir = join(api.paths.absSrcPath, '.umi');
  const entryFile = join(devTmpDir, 'umi.ts');
  const exportsFile = join(devTmpDir, 'exports.ts');
  // get madge package
  const madgePkg = dirname(
      resolve.sync(`${MADGE_NAME}/package.json`, {
        basedir: cwd,
      }),
  );
  const madge = require(madgePkg) as MadgeFunc;

  const madgeConfig = {
    tsConfig: {
      compilerOptions: {
        baseUrl: tsconfig.baseUrl,
        paths: {
          ...filteredAlias,
          ...tsconfig.paths,
          umi: [exportsFile],
          '@umijs/max': [exportsFile],
          // 适配 bigfish
          ...(api.appData?.umi?.importSource
              ? {
                [api.appData.umi.importSource]: [exportsFile],
              }
              : {}),
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
    baseDir: cwd,
  };
  // get madgeInstance
  const res = await madge(entryFile, madgeConfig);

  // get dependence map
  // treeMap { src/*: [] } 需要把 key 转化为绝对路径
  const treeMap = res.tree;
  const dependenceMap = Object.keys(treeMap).reduce(
      (acc: Record<string, boolean>, key) => {
        const path = winPath(join(api.paths.cwd, key));
        acc[path] = true;
        return acc;
      },
      {},
  );

  // 在 dependenceMap 里, 且不在 fileExcludeNames 里
  const usingFiles = readDirFiles({
    dir: api.paths.absSrcPath,
    exclude,
  }).filter(({ filePath }) => dependenceMap[filePath]);

  return {
    usingFiles: usingFiles as { filePath: string; name: string; }[],
    madgeInstance: res,
  };
}