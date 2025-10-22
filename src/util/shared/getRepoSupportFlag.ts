import {readFileSync} from "fs";

export function getRepoSupportFlag(jsonPath:string){
  const packageJson = readFileSync(jsonPath, "utf-8");
  const packageJsonObj = JSON.parse(packageJson);
  const supportFlag = !!(packageJsonObj.dependencies?.['@umijs/max']);
  return supportFlag;
}