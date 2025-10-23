import {dirname, join} from "path";
import {resolve} from "@umijs/utils";
import {MadgeConfig, MadgeInstance, MadgePath} from "madge";

export interface IMadgeInstance extends MadgeInstance {
  tree: Record<string, string[]>;
}
export type MadgeFunc = (
    path: MadgePath,
    config: MadgeConfig,
) => Promise<IMadgeInstance>;

const MADGE_NAME = 'madge';


export async function getMadgeInstance(devTmpDir: string, targetDirPath: string, exclude: RegExp[], filteredAlias: Record<string, string[]>, tsconfig: any = {}){
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
  return res;
}