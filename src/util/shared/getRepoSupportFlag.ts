import {readFileSync, existsSync} from "fs";
import { semver } from "@umijs/utils";

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
