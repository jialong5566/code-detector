#!/usr/bin/env node

const { writeGitDiffTxt, getGitRepositoryAndBranch, generateReport } = require('../dist/cjs/index')
async function main() {
  const { gitUrl, branchName } = await getGitRepositoryAndBranch();
  writeGitDiffTxt(gitUrl, branchName).then(reportContent => generateReport(reportContent));
}
main();