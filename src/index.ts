import {readFileSync} from "fs";
import {join} from "path";
import {formatGitDiffContent} from "./util/format_git_diff_content";
import madge_util from "./util/madge_util";
import {writeFileSync} from "fs";
import {createDetectReport} from "./util/report_util";
import {execa, chalk} from "@umijs/utils";
import dayjs from "dayjs";
import {createMdByJson} from "./util/report_util/createMdByJson";
import { readDirFiles } from "@umijs/utils";
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

export default async (api) => {
  const buildCallback = () => cb.umiPluginCallback(api);
  api.onBuildComplete(buildCallback);
}`
export async function writeGitDiffTxt(gitUrl: string, branchName: string){
  const today = dayjs().format('YYYYMDD');
  writeFileSync(join(process.cwd(), 'detect.sh'), shellFileContent, { encoding: 'utf-8', flag: 'w' });
  execa.execa('chmod +x detect.sh', {shell: '/bin/bash'});
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

export function generateReport(jsonStr: string){
  writeFileSync(join(process.cwd(), `${dayjs().format('YYYYMDD_HHmm')}_${jsonName}`), jsonStr, { encoding: 'utf-8', flag: 'w' });
}

export async function sameCodeDetect(dirOfCwd?: string) {
  const filesAndContent = await readSrcFiles(dirOfCwd);
  const { nodeContentGroupList, depthList } = Core.investigate(filesAndContent);
  let validDepthList = depthList.filter(e => e > 3);
  if(validDepthList.length === 0){
    validDepthList = depthList.slice(0, 1);
  }
  const md = Core.createMarkdownFile(nodeContentGroupList.filter(e => validDepthList.includes(e.depth)).slice(0, 5));
  writeFileSync(join(process.cwd(), `${dayjs().format('YYYYMDD_HHmm')}_same_code.md`), md, { encoding: 'utf-8', flag: 'w' });
}