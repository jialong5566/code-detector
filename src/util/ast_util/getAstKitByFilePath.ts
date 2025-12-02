import AstUtil, {AstNode} from "./AstUtil";
import FileUtil from "./FileUtil";

const mapFilePathToTools = new Map<string, ReturnType<typeof createMapFileLineToNodeSet>>();

const createMapFileLineToNodeSet = (file: string, absPathPrefix: string, stopTravelCallback: Parameters<typeof AstUtil.deepFirstTravel>[5]) => {
  const mapUuidToNode = new Map<string, AstNode>();
  const mapPathToNodeSet = new Map<string, Set<AstNode>>();
  const mapFileLineToNodeSet = new Map<number, Set<AstNode>>();
  const ast = FileUtil.getASTByFilePath(file);
  const filePathRelative = file.replace(absPathPrefix, "");
  AstUtil.deepFirstTravel(ast as any, filePathRelative, mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet, stopTravelCallback);
  return {mapFileLineToNodeSet, mapUuidToNode, mapPathToNodeSet};
};

export default function getAstKitByFilePath(filePath: string, absPathPrefix: string = '', stopTravelCallback?: Parameters<typeof AstUtil.deepFirstTravel>[5]){
  if(stopTravelCallback){
    return createMapFileLineToNodeSet(filePath, absPathPrefix, stopTravelCallback);
  }
  let tools = mapFilePathToTools.get(filePath);
  if(!tools){
    mapFilePathToTools.set(filePath, tools = createMapFileLineToNodeSet(filePath, absPathPrefix, stopTravelCallback));
  }
  return tools;
};