import {readFileSync} from "fs";
import {join} from "path";
import {formatGitDiffContent} from "./util/format_git_diff_content";
import madge_util from "./util/madge_util";
import {writeFileSync} from "fs";
import {createDetectReport} from "./util/report_util";
import {execa, chalk, logger, rimraf} from "@umijs/utils";
import dayjs from "dayjs";
import {createMdByJson} from "./util/report_util/createMdByJson";
import {readSrcFiles} from "./util/shared/readDirFiles";
import Core from "./util/ast_util/Core";

const jsonName = "git_diff_report.md";

export async function umiPluginCallback(api: any){
  const diff_txt = readFileSync(join(api.cwd, "git_diff.txt"), "utf-8");
  const gitDiffDetail = formatGitDiffContent(diff_txt);
  const madgeUtil = await madge_util(api);
  if(!madgeUtil){
    return;
  }
  const { madgeInstance: { tree }, usingFiles } = madgeUtil;
  const cwd = api.cwd;
  const absPathPrefix = cwd + '/';
  const usingFileNoPrefix = usingFiles.map(item => item.filePath.replace(absPathPrefix, ""));
  const groupGitDiffLines = gitDiffDetail.filter(item => usingFileNoPrefix.includes(item.filePath));
  const reports = createDetectReport({ groupGitDiffLines, tree, absPathPrefix });
  const mdContent = createMdByJson(reports);
  writeFileSync(join(api.cwd, jsonName), mdContent, { encoding: 'utf-8', flag: 'w' });
}

const shellFileContent = `#!/bin/sh
time=$(date "+%Y%-m%d")
mkdir -p $time
cd $time

git clone $1 target
cd target
yarn install

git fetch origin $2:$2
git checkout $2

git diff master..$2 --unified=0 --output=git_diff.txt
cd ..
git clone $1 source
`;
const pluginFileContent = `import * as cb from "js-code-detector"

export default async (api: any) => {
  const buildCallback = () => cb.umiPluginCallback(api);
  api.onBuildComplete(buildCallback);
}`
export async function writeGitDiffTxt(gitUrl: string, branchName: string){
  const today = dayjs().format('YYYYMDD');
  writeFileSync(join(process.cwd(), 'detect.sh'), shellFileContent, { encoding: 'utf-8', flag: 'w' });
  await execa.execa('chmod +x detect.sh', {shell: '/bin/bash'});
  const res0 = await execa.execa('sh detect.sh', [gitUrl, branchName], {shell: '/bin/bash'})
  chalk.green(["临时文件夹建立，源代码clone完成"]);
  writeFileSync(join(process.cwd(), today, 'target', 'plugin.ts'), pluginFileContent, { encoding: 'utf-8', flag: 'w' });
  chalk.green(["临时文件写入完成"]);
  await execa.execa(`cd ${today}/target && npm run build`,  {shell: '/bin/bash'});
  chalk.green(["临时入口文件生成"]);
  return readFileSync(join(process.cwd(), today, 'target', jsonName), "utf-8");
};

export async function getGitRepositoryAndBranch(){
  const res = await execa.execa('git remote get-url origin', {shell: '/bin/bash'});
  chalk.green(["仓库地址：", res.stdout]);
  const branch = await execa.execa('git rev-parse --abbrev-ref HEAD', {shell: '/bin/bash'});
  chalk.green(["分支名称：", branch.stdout]);
  return {
    gitUrl: res.stdout,
    branchName: branch.stdout
  }
}

export function generateReport(content: string){
  writeFileSync(join(process.cwd(), `${dayjs().format('YYYYMDD_HHmm')}_${jsonName}`), content, { encoding: 'utf-8', flag: 'w' });
}

export async function sameCodeDetect(dirOfCwd?: string) {
  const filesAndContent = await readSrcFiles(dirOfCwd);
  const { nodeContentGroupList, depthList } = Core.investigate(filesAndContent);
  const top3DepthsSet = [...new Set(depthList)].slice(0, 3);
  const validDepthList = depthList.filter(e => top3DepthsSet.includes(e));
  const validContentList = nodeContentGroupList.filter(e => validDepthList.includes(e.depth)).sort((a, b) => b.depth - a.depth);
  const md = Core.createMarkdownFile(validContentList);
  writeFileSync(join(process.cwd(), `${dayjs().format('YYYYMDD_HHmm')}_same_code.md`), md, { encoding: 'utf-8', flag: 'w' });
}

export async function gitDiffDetect() {
  const today = dayjs().format('YYYYMDD');
  const { gitUrl, branchName } = await getGitRepositoryAndBranch();
  logger.ready("准备生成临时工作目录...")
  await execa.execa(`mkdir -p ${today}`, {shell: '/bin/bash'});
  logger.info("临时目录建立完成");
  logger.ready("准备clone源代码到临时目录下的target文件夹")
  await execa.execa(`git clone ${gitUrl} ${today}/target`, {shell: '/bin/bash'});
  logger.info("源代码clone完成");
  logger.ready("准备clone源代码到临时目录下的source文件夹")
  await execa.execa(`git clone ${gitUrl} ${today}/source`, {shell: '/bin/bash'});
  logger.info("源代码clone完成");
  logger.ready("准备切换到目标分支")
  await execa.execa(`cd ${today}/target && git fetch origin ${branchName}:${branchName} && git checkout ${branchName}`, {shell: '/bin/bash'});
  logger.info("分支切换完成");
  logger.ready("准备生成git_diff.txt文件")
  await execa.execa(`cd ${today}/target && git diff master..${branchName} --unified=0 --output=git_diff.txt`, {shell: '/bin/bash'});
  logger.info("git_diff.txt文件生成完成");
  logger.ready("准备生成插件文件");
  writeFileSync(join(process.cwd(), today, 'target', 'plugin.ts'), pluginFileContent, { encoding: 'utf-8', flag: 'w' });
  logger.info("插件文件生成完成");
  logger.ready("准备生成报告");
  await execa.execa(`cd ${today}/target && yarn install && npm run build`,  {shell: '/bin/bash'});
  logger.info("报告生成完成！");
  logger.ready("准备移动报告");
  const content = readFileSync(join(process.cwd(), today, 'target', jsonName), "utf-8");
  const mdFileName = `${dayjs().format('YYYYMDD_HHmm')}_${jsonName}`;
  writeFileSync(join(process.cwd(), mdFileName), content, { encoding: 'utf-8', flag: 'w' });
  logger.info("报告完成: " + mdFileName);
  rimraf(join(process.cwd(), today), () => {
    logger.info("临时目录已删除");
  });
}