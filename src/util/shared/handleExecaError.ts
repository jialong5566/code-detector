import {logger} from "@umijs/utils";

export function handleExecaError({ failed, stderr}: { failed: boolean; stderr: string }){
  if(failed){
    logger.error(stderr);
    throw new Error(stderr);
  }
}
