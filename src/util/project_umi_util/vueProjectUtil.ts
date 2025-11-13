import {join} from "path";
import { writeFileSync } from "fs";
import {aliasUtils, execa, logger} from "@umijs/utils";
import {MadgeFunc} from "../report_util/getMadgeInstance";

const webpackConfigFileName = '__webpack.config.js';
export async function vueSetUp({ targetDir } : { targetDir: string }){
  const shellExeResult = await execa.execa(`cd ${targetDir} && npx vue-cli-service inspect --verbose`,  {shell: true});
  const { failed, stdout} = shellExeResult;
  const filePath = join(targetDir, webpackConfigFileName);
  if(!failed){
    writeFileSync(filePath, `module.exports = ${stdout}`);
  };

  let userAlias = {};
  let entryFiles: string[] = [];
  try {
    const webpackConfig = eval(`(${stdout})`);
    userAlias = webpackConfig.resolve.alias;
    entryFiles = Object.values(webpackConfig.entry).flat() as string[];
  }
  catch (error) {
    logger.error('解析webpack配置出错', error);
  }
  const madge = require('madge') as MadgeFunc;
  const madgeResult = await madge(entryFiles[0], {
    webpackConfig: filePath,
    // fileExtensions: ['.vue', '.js'],
    // excludeRegExp: [/node_modules/],
    baseDir: targetDir,
  });

  // 去除循环的别名
  const parsedAlias = aliasUtils.parseCircleAlias({
    alias: userAlias,
  });

  return {
    shellExeResult,
    madgeResult,
    parsedAlias,
  };
}