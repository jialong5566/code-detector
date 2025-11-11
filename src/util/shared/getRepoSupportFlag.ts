import {readFileSync, existsSync} from "fs";
import {logger, semver} from "@umijs/utils";

export function isRepoTypeSupported(repoType: string){
  return ['umi'].includes(repoType);
}

export function getRepoType(jsonPath:string){
  const isExist = existsSync(jsonPath);
  if(!isExist) return "unknown";
  const packageJson = readFileSync(jsonPath, "utf-8");
  if(!packageJson) return "unknown";
  try{
    const packageJsonObj = JSON.parse(packageJson);
    if(packageJsonObj?.dependencies?.['@umijs/max']){
      return 'umi';
    }
    if(packageJsonObj?.dependencies?.['@vue/cli-service'] || packageJsonObj?.devDependencies?.['@vue/cli-service']){
      return 'vue2';
    }
  }
  catch (e: any) {
    logger.error(e.message);
  }
  return "unknown";
}
export function getMinVersion(jsonPath:string, depName:string){
  const packageJson = readFileSync(jsonPath, "utf-8");
  if(!packageJson) return null;
  try{
    const packageJsonObj = JSON.parse(packageJson);
    const v = packageJsonObj?.dependencies?.[depName] || packageJsonObj?.devDependencies?.[depName];
    if(v){
      return semver.minVersion(v);
    }
  }
  catch (e) {
    return null;
  }
}
