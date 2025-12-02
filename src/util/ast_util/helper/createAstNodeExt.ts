import {AstNode} from "../AstUtil";

export default function createAstNodeExt(ext: Partial<AstNode['_util']>){
  const _util: AstNode['_util'] = {
    startLine: NaN,
    endLine: NaN,
    startColumn: NaN,
    endColumn: NaN,
    filePath: "",
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
  Object.assign(_util, ext);
  return _util;
}