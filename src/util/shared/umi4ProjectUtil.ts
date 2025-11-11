import {aliasUtils, execa, tsconfigPaths, logger} from "@umijs/utils";
import {readFileSync} from "fs";
import {join, relative} from "path";
import {getMadgeInstance} from "../report_util/getMadgeInstance";

const userAliasGetter = (cwd: string, appData: { config: { alias: Record<string, string> } }) => {
  return appData.config?.alias || {
    umi: '@@/exports',
    '@': cwd + '/src',
    '@@': cwd + '/src/.umi',
    '@umijs/max': '@@/exports'
  }
};

async function getUmiInvokeResult(targetDirPath: string, invokeType: 'local'|'remote') {
  return await execa.execa(`cd ${targetDirPath} && npx max setup`,  {shell: true});
}

export async function umi4SetUp({ targetDirPath, invokeType } : { targetDirPath: string, invokeType: 'local'|'remote' }){
  logger.info(`正在执行 setup 脚本...`);
  const shellExeResult = await getUmiInvokeResult(targetDirPath, invokeType);
  // 获取 ts 配置
  const tsconfig = (await tsconfigPaths.loadConfig(targetDirPath));
  // 读取 appData.json 文件
  let appData: any = { config: null };
  try {
    const appDataContent = readFileSync(join(targetDirPath, "src", ".umi", "appData.json"), "utf-8");
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

  const madgeResult = await getMadgeInstance(join(targetDirPath, "src", '.umi'), targetDirPath, exclude, filteredAlias, tsconfig);
  return {
    shellExeResult,
    madgeResult,
    parsedAlias,
  };
}

