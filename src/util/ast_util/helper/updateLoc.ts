import { AstNode } from "../AstUtil";
import getNodePath from "./getNodePath";

export default function updateLoc(astNode: AstNode, extra: { mapUuidToNode: Map<string, AstNode>, mapFileLineToNodeSet: Map<number, Set<AstNode>>, mapPathToNodeSet: Map<string, Set<AstNode>> }) {
  const { _util, type, name } = astNode;
  const { mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet } = extra;
  const { nodeCollection, filePath, parent } = _util;
  _util.startLine = Math.min(...nodeCollection.map(n => n.loc?.start?.line!), astNode.loc?.start.line!);
  _util.endLine = Math.max(...nodeCollection.map(n => n.loc?.end?.line!), astNode.loc?.end.line!);
  _util.startColumn = astNode.loc?.start.column ?? Math.min(...nodeCollection.map(n => n.loc?.start?.column!), astNode.loc?.start.column!);
  _util.endColumn = astNode.loc?.end.column ?? Math.max(...nodeCollection.map(n => n.loc?.end?.column!), astNode.loc?.end.column!);
  _util.uuid = `${filePath}@${type}:${name}「${_util.startLine}:${_util.startColumn},${_util.endLine}:${_util.endColumn}」`;
  mapUuidToNode.set(_util.uuid, astNode);

  for (let i = _util.startLine; i <= _util.endLine; i++) {
    mapFileLineToNodeSet.set(i, mapFileLineToNodeSet.get(i) || new Set());
    mapFileLineToNodeSet.get(i)?.add(astNode);
  }
  if(astNode.type === "Program"){
    mapUuidToNode.set(astNode.type, astNode);
  }
  if(parent === null){
    nodeCollection.forEach(n => {
      const path = getNodePath(n);
      mapPathToNodeSet.set(path, mapPathToNodeSet.get(path) || new Set());
      mapPathToNodeSet.get(path)?.add(n);
    });
  }
}