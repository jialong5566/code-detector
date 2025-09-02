import { readFileSync } from "fs";
import { readDirFiles } from "@umijs/utils";
import {join} from "path";

const exclude: RegExp[] = [/node_modules/, /\.d\.ts$/, /\.umi/];
export function readSrcFiles(dirOfCwd?: string){
  const dir = join(process.cwd(), dirOfCwd || "src");
  const fileItems = readDirFiles({
    dir,
    exclude
  });
  return Promise.all(fileItems.map((item) => {
    return {
      filePath: item.filePath,
      fileContent: readFileSync(item.filePath, "utf-8")
    };
  }));
};
