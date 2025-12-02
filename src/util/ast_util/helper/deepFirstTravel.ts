import { AstNode } from "../AstUtil";
import {INVALID_NODE_KEY} from "../SHARED_CONSTANTS";
import isValidNodeCollect from "./isValidNodeCollect";
import isValidArrayNodeCollect from "./isValidArrayNodeCollect";
import updateLoc from "./updateLoc";
import collectDependenceIds from "./collectDependenceIds";
import collectEffectId from "./collectEffectId";
import collectHoldingIds from "./collectHoldingIds";
import updateImportedAndExportedMember from "./updateImportedAndExportedMember";

export default function deepFirstTravel(node: AstNode, visitedNodeSet: Set<typeof node>, extra: { filePath: string, depth: number, mapUuidToNode: Map<string, AstNode>, mapFileLineToNodeSet: Map<number, Set<AstNode>>, mapPathToNodeSet: Map<string, Set<AstNode>>, stopTravelCallback?: (node: AstNode) => boolean | void }){
  visitedNodeSet.add(node);
  const { filePath, depth, mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet, stopTravelCallback } = extra;
  const _util: AstNode['_util'] = {
    startLine: NaN,
    endLine: NaN,
    startColumn: NaN,
    endColumn: NaN,
    filePath,
    parent: null,
    parentProperty: "",
    indexOfProperty: null,
    ancestors: [],
    nodeCollection: [],
    children: [],
    uuid: "",
    variableScope: [],
    dependenceIds: new Set<AstNode>(),
    dependenceIdsNoScope: new Set<AstNode>(),
    holdingIdType: null,
    holdingIds: new Set<AstNode>(),
    holdingIdNameMap: new Map<string, Set<AstNode>>(),
    inject: new Set<AstNode>(),
    provide: new Set<AstNode>(),
    effectIds: new Set<AstNode>(),
    occupation: new Set<AstNode>(),
    importedMember: [],
    exportedMember: [],
  }
  node._util = _util;
  // 存储 当前 ast 节点下的 所有的 node 集合
  const { nodeCollection, children } = _util;
  const stopTravel = stopTravelCallback?.(node);
  if(stopTravel){
    return node;
  }
  Object.keys(node).forEach(nodeKey => {
    // const isTs = nodeKey.startsWith("TS") || nodeKey.endsWith('Annotation');
    if(INVALID_NODE_KEY.includes(nodeKey)){
      return;
    }
    // @ts-ignore
    const nodeValue = node[nodeKey];
    if(visitedNodeSet.has(nodeValue) || !nodeValue){
      return;
    }
    if(isValidNodeCollect(nodeValue)){
      const childNode = deepFirstTravel(nodeValue, visitedNodeSet, { filePath, depth: depth +1, mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet, stopTravelCallback})
      nodeCollection.push(childNode, ...childNode._util.nodeCollection);
      children.push(childNode);
      childNode._util.parentProperty = nodeKey;
    }
    else if(isValidArrayNodeCollect(nodeValue)){
      const validNodeArray = (nodeValue as AstNode[]).filter(nodeItem => isValidNodeCollect(nodeItem)).map(v => {
        return deepFirstTravel(v, visitedNodeSet, { filePath, depth: depth +1, mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet, stopTravelCallback})
      });
      nodeCollection.push(...validNodeArray.map( n => [n, ...n._util.nodeCollection]).flat());
      children.push(...validNodeArray);
      validNodeArray.forEach((v, index) => {
        v._util.parentProperty = nodeKey;
        v._util.indexOfProperty = index;
      });
    }
  });
  try {
    children.forEach(child => child._util.parent = node);
    nodeCollection.forEach(nodeItem => {
      !nodeItem._util.ancestors.includes(node) && nodeItem._util.ancestors.unshift(node);
    });
  }
  catch(e: any){
    console.error('parent ancestors update',e.message);
  }
  try {
    const skip = nodeCollection.some(nodeItem => stopTravelCallback?.(nodeItem));
    if(!skip){
      collectHoldingIds(node as AstNode & { body: AstNode|null});
    }
  }
  catch(e: any){
    console.error("收集持有的 identifier 出错", e.message);
  }
  try {
    /** 所有 所持有的 标识符收集完成后，开始收集依赖的标识符 */
    collectDependenceIds(node);
  }
  catch(e: any){
    console.error('收集使用的标识符号', e.message);
  }
  if(node.type === "Program"){
    try {
      nodeCollection.forEach(child => collectEffectId(child));
    }
    catch(e: any){
      console.error('collectEffectId', e.message);
    }
    try {
      (node as unknown as  { body: AstNode[] }).body.forEach(child => updateImportedAndExportedMember(child, node));
    }
    catch(e: any){
      console.error('收集导入、导出成员信息报错',e.message);
    }
  }
  try {
    updateLoc(node, { mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet });
  }
  catch (e: any) {
    console.error('updateLoc', e.message);
  }
  return node;
}