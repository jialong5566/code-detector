import { intersection } from "lodash";
import sha1 from "crypto-js/sha1";
import base64 from "crypto-js/enc-base64";
import { Comment, Node, Identifier} from "@babel/types";
import { AST_NODE_FEATURE_LEVEL } from "../shared/featureLevel";
import {astNodeFeatureExtractorMap} from "../shared/astNodeFeatureExtractorMap";

export type MapHashKeyToAstNodeSet = Map<string, Set<AstFeatNode>>;
export interface AstFeatNode {
  type: Node["type"];
  name?: Identifier|string;
  leadingComments?: Comment[] | null;
  innerComments?: Comment[] | null;
  trailingComments?: Comment[] | null;
  start?: number | null;
  end?: number | null;
  loc?: Record<'start'|'end', { line: number }> | null;
  range?: [number, number];
  extra?: Record<string, unknown>;
  _util: {
    startLine: number,
    endLine: number,
    mapHashKeyToString: Map<string, string>,
    mapDepthDiffToHashKey: Map<number, string>,
    filePath: string,
    hashKey: string,
    nodeCollection: AstFeatNode[],
    childrenNode: AstFeatNode[],
    ancestors: AstFeatNode[],
    depth: number
  }
  [p: string]: any;
}

export default class AstFeatUtil {
  static skipHashCreateTypes = ["Program", "File", "ExportDeclaration"];
  static invalidNodeKey = [
    "comments",
    "tokens",
  ];
  // 忽略的 节点类型
  static AstNodeTypeConf = new Map([
    ["ImportDeclaration", {
      FEATURE_LEVEL: [
        AST_NODE_FEATURE_LEVEL.LOOSE,
        AST_NODE_FEATURE_LEVEL.NORMAL,
        AST_NODE_FEATURE_LEVEL.EXACT,
      ]
    }],
    ["TypeAlias", {
      FEATURE_LEVEL: [
        AST_NODE_FEATURE_LEVEL.LOOSE,
        AST_NODE_FEATURE_LEVEL.NORMAL,
      ]
    }],
    ["VExpressionContainer", {
      FEATURE_LEVEL: [
        AST_NODE_FEATURE_LEVEL.LOOSE,
        AST_NODE_FEATURE_LEVEL.NORMAL,
      ]
    }],
    ["VStartTag", {
      FEATURE_LEVEL: [
        AST_NODE_FEATURE_LEVEL.LOOSE,
      ]
    }],
    ["VEndTag", {
      FEATURE_LEVEL: [
        AST_NODE_FEATURE_LEVEL.LOOSE,
      ]
    }],
    ["VText", {
      FEATURE_LEVEL: [
        AST_NODE_FEATURE_LEVEL.LOOSE,
        AST_NODE_FEATURE_LEVEL.NORMAL,
      ]
    }],
    ["VDocumentFragment",{
      FEATURE_LEVEL: [
        AST_NODE_FEATURE_LEVEL.LOOSE,
        AST_NODE_FEATURE_LEVEL.NORMAL,
      ]
    }],
    ["CommentLine", {
      FEATURE_LEVEL: [
        AST_NODE_FEATURE_LEVEL.LOOSE,
        AST_NODE_FEATURE_LEVEL.NORMAL,
        AST_NODE_FEATURE_LEVEL.EXACT,
      ]
    }],
    ["CommentBlock", {
      FEATURE_LEVEL: [
        AST_NODE_FEATURE_LEVEL.LOOSE,
        AST_NODE_FEATURE_LEVEL.NORMAL,
        AST_NODE_FEATURE_LEVEL.EXACT,
      ]
    }],
    ["JSXIdentifier", {
      FEATURE_LEVEL: [
        AST_NODE_FEATURE_LEVEL.LOOSE,
        AST_NODE_FEATURE_LEVEL.NORMAL,
      ]
    }],
    ["JSXAttribute", {
      FEATURE_LEVEL: [
        AST_NODE_FEATURE_LEVEL.LOOSE,
        AST_NODE_FEATURE_LEVEL.NORMAL,
      ]
    }],
    ["EmptyStatement", {
      FEATURE_LEVEL: [
        AST_NODE_FEATURE_LEVEL.LOOSE,
        AST_NODE_FEATURE_LEVEL.NORMAL,
      ]
    }],
    ["JSXText", {
      FEATURE_LEVEL: [
        AST_NODE_FEATURE_LEVEL.LOOSE,
        AST_NODE_FEATURE_LEVEL.NORMAL,
      ]
    }],
    ["JSXClosingElement", {
      FEATURE_LEVEL: [
        AST_NODE_FEATURE_LEVEL.LOOSE,
        AST_NODE_FEATURE_LEVEL.NORMAL,
      ]
    }],
  ]);

  static validRuleListOfAstNodeType = [
    {
      test: (astNode: AstFeatNode) => /^TS\w+/.test(astNode.type),
      FEATURE_LEVEL: [
        AST_NODE_FEATURE_LEVEL.LOOSE,
        AST_NODE_FEATURE_LEVEL.NORMAL,
      ]
    },
    {
      test: (astNode: AstFeatNode) => /Literal$/.test(astNode.type),
      FEATURE_LEVEL: [
        AST_NODE_FEATURE_LEVEL.LOOSE,
        AST_NODE_FEATURE_LEVEL.NORMAL,
      ]
    },
  ];

  // 单节点判断
  static isValidNodeCollect(astNode: AstFeatNode){
    const isTypeString = typeof astNode?.type === 'string';
    if(!isTypeString){
      return false;
    }
    const ruleMatchAndPassed = this.validRuleListOfAstNodeType.find(({ test, FEATURE_LEVEL}) => {
      return FEATURE_LEVEL.includes(AST_NODE_FEATURE_LEVEL.EXACT) && test(astNode);
    });
    if(ruleMatchAndPassed){
      return false;
    }
    if(this.AstNodeTypeConf.get(astNode.type)?.FEATURE_LEVEL.includes(AST_NODE_FEATURE_LEVEL.EXACT)){
      return false;
    }
    return true;
  }

  // 数组节点 判断
  static isValidArrayNodeCollect(astNode: AstFeatNode){
    return Array.isArray(astNode) && astNode.some(v => typeof v?.type === 'string')
  }

  static createHashSeed(nodeCollection: AstFeatNode[]){
    const depthSet = new Set();
    nodeCollection.forEach(n => depthSet.add(n._util.depth));
    const astNodeFeatureExtractor = astNodeFeatureExtractorMap.get(AST_NODE_FEATURE_LEVEL.EXACT)!;
    return nodeCollection.map(n => astNodeFeatureExtractor(n)).join(":")
  }

  static createHashKey(str: string){
    return base64.stringify(sha1(str));
  }


  static addAncestorForNode(nodeCollection: AstFeatNode[], ancestor: AstFeatNode){
    nodeCollection.forEach(nodeItem => {
      nodeItem._util.ancestors.unshift(ancestor);
    });
  }

  static deepFirstTravel(node: AstFeatNode, mapRecord: { mapHashKeyToTopLevelNode: MapHashKeyToAstNodeSet, nodeTypeSet: Set<string> }, filePath: string){
    const visitedNodeSet = new Set<typeof node>();
    if(!node){
      return ;
    }
    return this._deepFirstTravel(node, visitedNodeSet ,mapRecord, filePath, 0)
  }

  static _deepFirstTravel(node: AstFeatNode, visitedNodeSet: Set<typeof node>, mapRecord: { mapHashKeyToTopLevelNode: MapHashKeyToAstNodeSet, nodeTypeSet: Set<string> }, filePath: string, depth: number ){
    visitedNodeSet.add(node);
    const { mapHashKeyToTopLevelNode, nodeTypeSet } = mapRecord;
    nodeTypeSet.add(node.type);
    const _util: AstFeatNode['_util'] = {
      startLine: NaN,
      endLine: NaN,
      mapHashKeyToString: new Map(),
      mapDepthDiffToHashKey: new Map(),
      filePath,
      hashKey: '',
      nodeCollection: [],
      childrenNode: [],
      ancestors: [],
      depth
    }

    node._util = _util;
    // 存储 当前 ast 节点下的 所有的 node 集合
    const { nodeCollection, childrenNode } = _util;
    Object.keys(node).forEach(nodeKey => {
      if(this.invalidNodeKey.includes(nodeKey)){
        return;
      }
      const nodeValue = node[nodeKey] as any;
      if(visitedNodeSet.has(nodeValue) || !node){
        return;
      }
      if(this.isValidNodeCollect(nodeValue)){
        const childNode = this._deepFirstTravel(nodeValue, visitedNodeSet, mapRecord, filePath, depth + 1)
        nodeCollection.push(childNode, ...childNode._util.nodeCollection);
        childrenNode.push(childNode);
      }
      else if(this.isValidArrayNodeCollect(nodeValue)){
        const validNodeArray = (nodeValue as AstFeatNode[]).filter(nodeItem => this.isValidNodeCollect(nodeItem)).map(v => {
          return this._deepFirstTravel(v, visitedNodeSet, mapRecord, filePath, depth + 1)
        });
        nodeCollection.push(...validNodeArray.map( n => [n, ...n._util.nodeCollection]).flat());
        childrenNode.push(...validNodeArray);
      }
    });
    this.updateLoc(node);
    this.addAncestorForNode(nodeCollection, node);
    this.updateNodeSetOfDepth(mapHashKeyToTopLevelNode, node, nodeCollection);
    return node;
  }

  static updateLoc(astNode: AstFeatNode) {
    const { _util } = astNode;
    const { nodeCollection } = _util;
    _util.startLine = Math.min(...nodeCollection.map(n => n.loc?.start?.line!), astNode.loc?.start.line!);
    _util.endLine = Math.max(...nodeCollection.map(n => n.loc?.end?.line!), astNode.loc?.end.line!);
  }

  static updateNodeSetOfDepth(mapHashKeyToTopLevelNode: MapHashKeyToAstNodeSet, rootNode: AstFeatNode, nodeCollection: AstFeatNode[]){
    if(this.skipHashCreateTypes.includes(rootNode.type)){
      return;
    }
    const { mapDepthDiffToHashKey, depth: baseDepth, mapHashKeyToString } = rootNode._util;
    const maxDepth = Math.max(...nodeCollection.map(n => n._util.depth));
    if(!Number.isInteger(maxDepth)){
      return;
    }
    let tmp = nodeCollection;
    for (let i = maxDepth; i > baseDepth; i--) {
      tmp = tmp.filter(n => n._util.depth <= i);
      const hashKey = this.createNodeHashKey(tmp, mapHashKeyToString);
      const depthDiff = i - baseDepth;
      mapDepthDiffToHashKey.set(depthDiff, hashKey)
      this.updateNodeSetByHashKey(`${depthDiff}:${hashKey}`, rootNode, mapHashKeyToTopLevelNode);
    }
  }

  static updateNodeSetByHashKey(hashKey: string, node: AstFeatNode, mapHashKeyToNode: MapHashKeyToAstNodeSet){
    const oldSet = mapHashKeyToNode.get(hashKey);
    if(oldSet){
      oldSet.add(node);
    }
    else {
      mapHashKeyToNode.set(hashKey, new Set([node]));
    };
  }


  static deleteSameSubSetPartial(mapHashKeyToTopLevelNode: MapHashKeyToAstNodeSet){
    const shallowCopy = new Map(mapHashKeyToTopLevelNode);
    for (const [hashKey, nodeSet] of shallowCopy) {
      if(nodeSet.size > 1){
        const depthDiff = Number(hashKey.split(":")[0])
        const hasKeyList = [...nodeSet].map(item => {
          const parent = [...item._util.ancestors].pop();
          if(parent){
            const { mapDepthDiffToHashKey } = parent._util;
            const tmpHashKey = mapDepthDiffToHashKey.get(depthDiff + 1);
            return tmpHashKey;
          }
          return undefined;
        });
        const only = new Set(hasKeyList).size === 1 && hasKeyList[0] !== undefined;
        if(only){
          mapHashKeyToTopLevelNode.delete(hashKey);
        }
      }
    }
  }

  static spreadSubNode(nodeSet: Set<AstFeatNode>, depthDiff: number){
    const listOfMaxDepthDiff: number[] = [];

    const listOfNodeInfo = [...nodeSet].map(rootNode => {
      const baseDepth = rootNode._util.depth;
      const edgeNodeCollection = rootNode._util.nodeCollection.filter(n => (n._util.depth - baseDepth) === depthDiff);
      const maxItemDepthDiff = Math.max(...edgeNodeCollection.map(node => node._util.depth - baseDepth));
      listOfMaxDepthDiff.push(maxItemDepthDiff);
      return {
        rootNode,
        edgeNodeCollection,
        commonHashKeyNodesOrdered: [] as AstFeatNode[][]
      };
    });
    const maxDepth = Math.min(...listOfMaxDepthDiff);
    let listOfCollection: AstFeatNode[][] = listOfNodeInfo.map(e => e.edgeNodeCollection);
    for (let i = 1; i <= maxDepth; i++) {
      const hashKeyList = listOfCollection.map(nodes => nodes.map(node => node._util.mapDepthDiffToHashKey.get(1)!).filter(Boolean))
      const commonHashKeyList = intersection(...hashKeyList);

      listOfCollection = listOfCollection.map(nodes => nodes.filter(node => commonHashKeyList.includes(node._util.mapDepthDiffToHashKey.get(1)!)));
      if(listOfCollection.every(collection => collection.length > 0)){
        listOfCollection.forEach((col, index) => {
          listOfNodeInfo[index].commonHashKeyNodesOrdered.push(col);
        });
      }
    }
    return listOfNodeInfo;
  }

  static createNodeHashKey(nodeList: AstFeatNode[], mapHashKeyToString: Map<string, string>){
    const seed = this.createHashSeed(nodeList);
    const hashKey = this.createHashKey(seed);
    mapHashKeyToString.set(hashKey, seed)
    return hashKey;
  }
};