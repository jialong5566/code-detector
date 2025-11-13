import { intrinsicElements, standardAttributes } from "./intrinsicElements";
import {EXPORT_DECLARATION_TYPES, FUNCTION_TYPES, INVALID_NODE_KEY} from "./SHARED_CONSTANTS";
import { windowProperties } from "./windowProperties";
import {AstNode} from "./AstUtil";

export class AstUtil {
  static invalidNodeKey = INVALID_NODE_KEY;
  static EXPORT_DECLARATION_TYPES = EXPORT_DECLARATION_TYPES;
  static windowProperties = windowProperties;
  static intrinsicElements = intrinsicElements;
  static standardAttributes = standardAttributes;
  static FUNCTION_TYPES = FUNCTION_TYPES;

  static getNodePath(node: AstNode){
    return [...node._util.ancestors, node].map(n => n.type).join(':') + ":" + node.name;
  }

  static getShortNodeMsg(node: AstNode, hideParentProperty = false){
    const { _util: { startLine, startColumn, endLine, endColumn, parentProperty, indexOfProperty }} = node;
    let type = node.type;
    let name = node.name;
    if(name && typeof name === "object"){
      type = name.type;
      name = name.name;
    }
    const msg = [
      hideParentProperty ? [] : [parentProperty, indexOfProperty !== null ? String(indexOfProperty) : null],
      [type, name]
    ].map((e: any[]) => e.filter(Boolean).join(":")).filter(Boolean).join(' ');
    return `${msg}「${startLine}:${startColumn}, ${endLine}:${endColumn}」`;
  }
  private static isValidNodeCollect(astNode: AstNode): astNode is AstNode {
    return typeof astNode?.type === 'string';
  }
  private static isValidArrayNodeCollect(astNode: any): astNode is AstNode[] {
    return Array.isArray(astNode) && astNode.some(v => typeof v?.type === 'string')
  }

  private static collectEffectId(id: AstNode){
    // todo
  }

  private static updateImportedAndExportedMember(programBodyChild: AstNode, programNode: AstNode){
    // todo
    if(programNode.type !== "Program") return;
  }


  private static deepSearchParamsIdentifier(id: AstNode|null, callback: (identifier: AstNode) => void){
    if(!id){
      return;
    }
    if(id.type === "Identifier"){
      callback(id);
    }
    if(id.type === "AssignmentPattern"){
      const left = (id as unknown as { left: AstNode}).left;
      this.deepSearchParamsIdentifier(left, callback);
    }
    if(id.type === "RestElement"){
      this.deepSearchParamsIdentifier((id as unknown as { argument: AstNode}).argument, callback);
    }
    if(id.type === "ObjectProperty"){
      const value = (id as unknown as { value: AstNode}).value;
      this.deepSearchParamsIdentifier(value, callback);
    }
    if(id.type === "ObjectPattern"){
      const properties = (id as unknown as { properties: AstNode[]}).properties;
      for (const property of properties) {
        this.deepSearchParamsIdentifier(property, callback);
      }
    }
    if(id.type === "ArrayPattern"){
      const elements = (id as unknown as { elements: AstNode[]}).elements;
      for (const element of elements) {
        this.deepSearchParamsIdentifier(element, callback);
      }
    }
  }

  private static collectDependenceIds(node: AstNode){
    // todo
  }

  private static updateLoc(astNode: AstNode, extra: { mapUuidToNode: Map<string, AstNode>, mapFileLineToNodeSet: Map<number, Set<AstNode>>, mapPathToNodeSet: Map<string, Set<AstNode>> }) {
    const { _util, type, name } = astNode;
    const { mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet } = extra;
    const { nodeCollection, filePath, parent } = _util;
    _util.startLine = Math.min(...nodeCollection.map(n => n.loc?.start?.line!), astNode.loc?.start.line!);
    _util.endLine = Math.max(...nodeCollection.map(n => n.loc?.end?.line!), astNode.loc?.end.line!);
    _util.startColumn = astNode.loc?.start.column ?? Math.min(...nodeCollection.map(n => n.loc?.start?.column!), astNode.loc?.start.column!);
    _util.endColumn = astNode.loc?.end.column ?? Math.max(...nodeCollection.map(n => n.loc?.end?.column!), astNode.loc?.end.column!);
    _util.uuid = `${filePath}:${type}:${name}「${_util.startLine}:${_util.startColumn},${_util.endLine}:${_util.endColumn}」`;
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
        const path = AstUtil.getNodePath(n);
        mapPathToNodeSet.set(path, mapPathToNodeSet.get(path) || new Set());
        mapPathToNodeSet.get(path)?.add(n);
      });
    }
  }

  private static collectVariableDeclarationIdentifiers(node: AstNode, callback: (identifier: AstNode) => void) {
    if(node.type !== "VariableDeclaration") return;
    const declarations = (node as unknown as { declarations: AstNode[]}).declarations;
    for (const declaration of declarations) {
      this.deepSearchParamsIdentifier((declaration as unknown as { id: AstNode|null}).id, callback);
    }
  }

  private static collectDeclarationIdentifiers(node: AstNode, callback: (identifier: AstNode) => void) {
    if(!this.EXPORT_DECLARATION_TYPES.includes(node.type as any)) return;
    const id = (node as unknown as { id: AstNode|null }).id;
    id && callback(id);
  }

  private static collectImportDeclarationIdentifiers(node: AstNode, callback: (identifier: AstNode) => void){
    if(node.type !== "Program") return;
    const { body } = node as unknown as { body: AstNode[] };
    Array.isArray(body) && body.forEach(node => {
      if(node.type === "ImportDeclaration"){
        const specifiers = (node as unknown as { specifiers: AstNode[] }).specifiers;
        for (const specifier of specifiers) {
          const local = (specifier as unknown as { local: AstNode }).local;
          callback(local);
        }
      }
    });
  }

  private static collectHoldingIds(node: AstNode & { body: AstNode|null}){
    // 持有的 identifier ： fn的参数、导入声明、其他声明
    const { holdingIds, holdingIdNameMap } = node._util;
    if(this.FUNCTION_TYPES.includes(node.type)){
      // fn的参数
      const { params, id } = node as unknown as { params: AstNode[], id: AstNode|null };
      if(Array.isArray(params) && params.length > 0){
        params.forEach(param => this.deepSearchParamsIdentifier(param, id => {
          holdingIds.add(id || node);
          id._util.variableScope = [id];
          id._util.holdingIdType = "Param";
        }));
      }
      // fn 的函数体 是 BlockStatement， 把 函数体的 holdingId 提升到 函数中
      if(node.body && node.body.type === "BlockStatement"){
        node.body._util.holdingIds.forEach(id => {
          holdingIds.add(id);
        });
      }
    }
    // 导入声明
    this.collectImportDeclarationIdentifiers(node, id => {
      holdingIds.add(id);
      id._util.variableScope = [id];
      id._util.holdingIdType = "Import";
    });
    // body 是 BlockStatement 或者 Program， 遍历 body 的子节点
    if(["BlockStatement", "Program"].includes(node.type)){
      const body = (node as unknown as { body: AstNode[] }).body;
      Array.isArray(body) && body.forEach(bodyChild => {
        // 变量声明
        this.collectVariableDeclarationIdentifiers(bodyChild, id => {
          holdingIds.add(id);
          id._util.variableScope = [id];
          id._util.holdingIdType = "Variable";
        });
        // 函数、类、枚举、接口、类型别名声明
        if(this.EXPORT_DECLARATION_TYPES.includes(bodyChild.type as any)){
          this.collectDeclarationIdentifiers(bodyChild, id => {
            holdingIds.add(id);
            id._util.parent?._util.holdingIds?.add(id);
            id._util.variableScope = [id];
            // @ts-ignore
            id._util.holdingIdType = node.type.replace("Declaration", "");
          });
        }
        // 导出声明
        if(['ExportNamedDeclaration', 'ExportDefaultDeclaration'].includes(bodyChild.type)){
          const declaration = (bodyChild as unknown as { declaration: AstNode|null }).declaration;
          if(declaration){
            if(declaration.type === "VariableDeclaration"){
              this.collectVariableDeclarationIdentifiers(declaration, id => {
                holdingIds.add(id);
                id._util.variableScope = [id];
                id._util.holdingIdType = "Variable";
              });
            }
            else{
              this.collectDeclarationIdentifiers(declaration, id => {
                holdingIds.add(id);
                id._util.parent?._util.holdingIds?.add(id);
                id._util.variableScope = [id];
                // @ts-ignore
                id._util.holdingIdType = declaration.type.replace("Declaration", "");
              });
            }
          }
        }
      });
    };
    holdingIds.forEach(holdingId => {
      const holdingIdName = holdingId.name!;
      if(typeof holdingIdName !== "string") return;
      const nodeSetOfIdName = holdingIdNameMap.get(holdingIdName) || new Set<AstNode>();
      nodeSetOfIdName.add(holdingId);
      holdingIdNameMap.set(holdingIdName, nodeSetOfIdName);
    });
  }

  static deepFirstTravel(node: AstNode, filePath: string, mapUuidToNode: Map<string, AstNode>, mapFileLineToNodeSet: Map<number, Set<AstNode>>, mapPathToNodeSet: Map<string, Set<AstNode>>, stopTravelCallback?: (node: AstNode) => boolean | void){
    const visitedNodeSet = new Set<typeof node>();
    if(!node){
      return ;
    }
    return this._deepFirstTravel(node, visitedNodeSet, {filePath, depth:0, mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet, stopTravelCallback})
  }
  private static _deepFirstTravel(node: AstNode, visitedNodeSet: Set<typeof node>, extra: { filePath: string, depth: number, mapUuidToNode: Map<string, AstNode>, mapFileLineToNodeSet: Map<number, Set<AstNode>>, mapPathToNodeSet: Map<string, Set<AstNode>>, stopTravelCallback?: (node: AstNode) => boolean | void }){
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
      if(this.invalidNodeKey.includes(nodeKey)){
        return;
      }
      // @ts-ignore
      const nodeValue = node[nodeKey];
      if(visitedNodeSet.has(nodeValue) || !nodeValue){
        return;
      }
      if(this.isValidNodeCollect(nodeValue)){
        const childNode = this._deepFirstTravel(nodeValue, visitedNodeSet, { filePath, depth: depth +1, mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet, stopTravelCallback})
        nodeCollection.push(childNode, ...childNode._util.nodeCollection);
        children.push(childNode);
        childNode._util.parentProperty = nodeKey;
      }
      else if(this.isValidArrayNodeCollect(nodeValue)){
        const validNodeArray = (nodeValue as AstNode[]).filter(nodeItem => this.isValidNodeCollect(nodeItem)).map(v => {
          return this._deepFirstTravel(v, visitedNodeSet, { filePath, depth: depth +1, mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet, stopTravelCallback})
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
      nodeCollection.forEach(nodeItem => nodeItem._util.ancestors.unshift(node));
    }
    catch(e: any){
      console.error('parent ancestors update',e.message);
    }
    try {
      const skip = nodeCollection.some(nodeItem => stopTravelCallback?.(nodeItem));
      if(!skip){
        this.collectHoldingIds(node as AstNode & { body: AstNode|null});
      }
    }
    catch(e: any){
      console.error("收集持有的 identifier 出错", e.message);
    }
    try {
      /** 所有 所持有的 标识符收集完成后，开始收集依赖的标识符 */
      this.collectDependenceIds(node);
    }
    catch(e: any){
      console.error('收集使用的标识符号', e.message);
    }
    if(node.type === "Program"){
      try {
        nodeCollection.forEach(child => this.collectEffectId(child));
      }
      catch(e: any){
        console.error('collectEffectId', e.message);
      }
      try {
        (node as unknown as  { body: AstNode[] }).body.forEach(child => this.updateImportedAndExportedMember(child, node));
      }
      catch(e: any){
        console.error('收集导入、导出成员信息报错',e.message);
      }
    }
    try {
      this.updateLoc(node, { mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet });
    }
    catch (e: any) {
      console.error('updateLoc', e.message);
    }
    return node;
  }

}