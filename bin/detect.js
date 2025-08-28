#!/usr/bin/env node

async function main() {
  const { gitUrl, branchName } = await require('../dist/cjs/index').getGitRepositoryAndBranch();
  require('../dist/cjs/index').writeGitDiffTxt(gitUrl, branchName);
}
main();