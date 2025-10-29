import {logger} from "@umijs/utils";

export function handleExecaError({ failed, stderr}: { failed: boolean|undefined; stderr: string|undefined }){
  if(failed){
    logger.error(stderr);
    throw new Error(stderr);
  }
}
