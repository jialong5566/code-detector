import { intrinsicElements } from "./intrinsicElements";
import {EXPORT_DECLARATION_TYPES, INVALID_NODE_KEY} from "./SHARED_CONSTANTS";
import { windowProperties } from "./windowProperties";
import {AstNode} from "./AstUtil";
import isIdentifierUntracked from "./helper/isIdentifierUntracked";
import getExportedNameOfAncestor from "./helper/getExportedNameOfAncestor";
import getTopScopeNodesByLineNumberRange from "./helper/getTopScopeNodesByLineNumberRange";
import getShortNodeMsg from "./helper/getShortNodeMsg";
import getNearestImpactedNode from "./helper/getNearestImpactedNode";
import getNodePath from "./helper/getNodePath";
import syncTravel from "./helper/syncTravel";

export class AstUtil {
  static EXPORT_DECLARATION_TYPES = EXPORT_DECLARATION_TYPES;
  static windowProperties = windowProperties;
  static intrinsicElements = intrinsicElements;

  static isUntrackedId(id: AstNode){
    return isIdentifierUntracked(id);
  }

  static getNodePath(node: AstNode){
    return getNodePath(node);
  }

  static getShortNodeMsg(node: AstNode, hideParentProperty = false){
    return getShortNodeMsg(node, hideParentProperty);
  }

  static findExportedMembersNameFromAncestors(node: AstNode|undefined|null) {
    return getExportedNameOfAncestor(node);
  }

  static getAncestorsFromBirth(occupationId: AstNode, sourceId: AstNode){
    const { _util: { ancestors }} = occupationId;
    return ancestors.filter(ancestor => !sourceId._util.ancestors.includes(ancestor));
  }

  static getNearestImpactedNode(ancestors: AstNode[]){
    return getNearestImpactedNode(ancestors);
  }

  static getTopScopeNodesByLineNumberRange(mapFileLineToNodeSet: Map<number, Set<AstNode>>, lineNumberStart: number, lineNumberEnd: number, loose = false){
    return getTopScopeNodesByLineNumberRange(mapFileLineToNodeSet, lineNumberStart, lineNumberEnd, loose);
  }


  static deepFirstTravel(node: AstNode, filePath: string, mapUuidToNode: Map<string, AstNode>, mapFileLineToNodeSet: Map<number, Set<AstNode>>, mapPathToNodeSet: Map<string, Set<AstNode>>, stopTravelCallback?: (node: AstNode) => boolean | void){
    const visitedNodeSet = new Set<typeof node>();
    if(!node){
      return ;
    }
    syncTravel(node, { filePath, mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet, visitedNodeSet, upstreamIdentifiers: [] }, () => {});
  }
}