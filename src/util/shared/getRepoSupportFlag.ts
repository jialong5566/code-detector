import {readFileSync, existsSync} from "fs";

export function getRepoSupportFlag(jsonPath:string){
  const isExist = existsSync(jsonPath);
  if(!isExist) return false;
  const packageJson = readFileSync(jsonPath, "utf-8");
  if(!packageJson) return false;
  try{
    const packageJsonObj = JSON.parse(packageJson);
    const supportFlag = !!(packageJsonObj.dependencies?.['@umijs/max']);
    return supportFlag;
  }
  catch (e) {
    return false;
  }
}