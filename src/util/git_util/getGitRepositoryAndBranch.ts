import {chalk, execa} from "@umijs/utils";

export default async function getGitRepositoryAndBranch(){
  const res = await execa.execa('git remote get-url origin', {shell: true});
  chalk.green(["仓库地址：", res.stdout]);
  const branch = await execa.execa('git rev-parse --abbrev-ref HEAD', {shell: true});
  chalk.green(["分支名称：", branch.stdout]);
  return {
    gitUrl: res.stdout,
    branchName: branch.stdout
  }
}