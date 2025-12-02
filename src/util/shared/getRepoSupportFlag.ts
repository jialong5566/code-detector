import {readFileSync, existsSync} from "fs";
import {logger, semver} from "@umijs/utils";
import {getMajorVersion} from "./getMajorVersion";

export function isRepoTypeSupported(repoType: string){
  return ['umi', 'vue2', 'vite'].includes(repoType);
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
    if(packageJsonObj?.dependencies?.['vite'] || packageJsonObj?.devDependencies?.['vite']){
      return 'vite';
    }
    const vueVersion = packageJsonObj?.dependencies?.['vue'];
    if(vueVersion && getMajorVersion(vueVersion) === 2){
      return 'vue2';
    }
  }
  catch (e: any) {
    logger.error(e.message);
  }
  return "unknown";
}
