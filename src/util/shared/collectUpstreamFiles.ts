import {IMadgeInstance} from "../report_util/getMadgeInstance";

export default function collectUpstreamFiles(madgeResult: IMadgeInstance, modifiedFilePaths: string[], maxCount = 30): string[] {
  const changedFilePaths = [...modifiedFilePaths];
  let tmpFiles = [...modifiedFilePaths];
  for (let i = 0; i < 9; i++) {
    tmpFiles = tmpFiles.map(file => madgeResult.depends(file)).flat();
    if (tmpFiles.length === 0) {
      break;
    }
    changedFilePaths.push(...tmpFiles);
    if(changedFilePaths.length > maxCount){
      // break;
    }
  }
  return [...new Set(changedFilePaths)];
}