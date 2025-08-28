export type GitDiffDetail = {
  filePath: string;
  type: "add" | "delete" | "modify";
  subType: "add" | "delete" | "modify";
  startLineOfNew: string,
  oldBranchLineScope: string,
  startLineOfOld: string,
  newBranchLineScope: string,
  items: string[],
};
export function formatGitDiffContent(modifyContent: string){
  const detailList: GitDiffDetail[] = [];
  if(typeof modifyContent !== "string"){
    return detailList;
  }
  const lines = modifyContent.split(/\n/);
  let filePath = "";
  let mainType: GitDiffDetail['type'] = "modify";
  let subType: GitDiffDetail['type'] = "modify";
  lines.forEach((line, index) => {
    if(line.startsWith("diff --git")){
      filePath = line.split(/\s+/)[2].slice(2);
      mainType = lines[index + 1]?.startsWith('new file') ? "add" : (lines[index + 1]?.startsWith('deleted') ? "delete" : "modify");
    }
    if(line.startsWith('@@')){
      const [, startLineOfOld, oldBranchLineScope, startLineOfNew, newBranchLineScope] = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*)/) || [];

      if(newBranchLineScope === '0'){
        subType = "delete";
      }
      else if(oldBranchLineScope === '0'){
        subType = "add";
      }
      else {
        subType = "modify";
      }
      detailList.push({
        filePath,
        type: mainType,
        subType,
        startLineOfNew,
        newBranchLineScope: newBranchLineScope ? newBranchLineScope : "1",
        startLineOfOld,
        oldBranchLineScope: oldBranchLineScope ? oldBranchLineScope : "1",
        items: []
      });
    }
    if((line.startsWith("+") && !line.startsWith('+++')) || (line.startsWith("-") && !line.startsWith('---'))){
      const lastItem = detailList[detailList.length - 1];
      lastItem.type !== "delete" && lastItem.items.push(line);
    }
  });
  return detailList;
}