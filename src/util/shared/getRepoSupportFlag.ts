import {readFileSync, existsSync} from "fs";

export function getRepoType(jsonPath:string){
  const isExist = existsSync(jsonPath);
  if(!isExist) return null;
  const packageJson = readFileSync(jsonPath, "utf-8");
  if(!packageJson) return null;
  try{
    const packageJsonObj = JSON.parse(packageJson);
    if(packageJsonObj?.dependencies?.['@umijs/max']){
      return 'umi';
    }
    /*
    if(packageJsonObj?.dependencies?.['@vue/cli-service'] || packageJsonObj?.devDependencies?.['@vue/cli-service']){
      return 'vue';
    }
    */
  }
  catch (e) {
    return null;
  }
}

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