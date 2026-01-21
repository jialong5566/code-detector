import { windowProperties } from "./windowProperties";
import { intrinsicElements, standardAttributes } from "./intrinsicElements";
import {EXPORT_DECLARATION_TYPES, INVALID_NODE_KEY} from "./SHARED_CONSTANTS";
import syncTravel from "./helper/syncTravel";
export interface AstNode {
  computed?: boolean;
  type: string;
  name?: string|AstNode;
  start?: number | null;
  end?: number | null;
  loc?: Record<'start'|'end', { line: number, column: number }> | null;
  range?: [number, number];
  extra?: Record<string, unknown>;
  _util: {
    startLine: number,
    endLine: number,
    startColumn: number,
    endColumn: number,
    filePath: string,
    parent: AstNode|null,
    parentProperty: string,
    indexOfProperty: number|null,
    ancestors: AstNode[],
    nodeCollection: AstNode[],
    children: AstNode[],
    uuid: string,
    variableScope: AstNode[],
    dependenceIds: Set<AstNode>,
    dependenceIdsNoScope: Set<AstNode>,
    holdingIds: Set<AstNode>,
    holdingIdNameMap: Map<string, Set<AstNode>>,
    holdingIdType: 'Import'|'Variable'|'Function'|'Class'|'Param'|'Enum'|'Interface'|'TypeAlias'|null,
    inject: Set<AstNode>,
    provide: Set<AstNode>,
    effectIds: Set<AstNode>,
    occupation: Set<AstNode>,
    importedMember: { sourcePath: string, members: { importedName: string, localName: string, useless?: boolean }[] }[],
    exportedMember: { sourcePath: string, members: { exportedName: string, localName: string }[], ExportAllDeclaration: boolean }[],
  }
}

export { AstUtil as default } from "./AstKit";


export class AstUtil {
  static invalidNodeKey = INVALID_NODE_KEY;
  static EXPORT_DECLARATION_TYPES = EXPORT_DECLARATION_TYPES;
  static windowProperties = windowProperties
  static intrinsicElements = intrinsicElements
  static standardAttributes = standardAttributes
  private static isValidNodeCollect(astNode: AstNode): astNode is AstNode {
    return typeof astNode?.type === 'string';
  }

  private static isValidArrayNodeCollect(astNode: any): astNode is AstNode[] {
    return Array.isArray(astNode) && astNode.some(v => typeof v?.type === 'string')
  }

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

  static getAncestorsFromBirth(occupationId: AstNode, sourceId: AstNode){
    const { _util: { ancestors }} = occupationId;
    return ancestors.filter(ancestor => !sourceId._util.ancestors.includes(ancestor));
  }

  static getNearestImpactedNode(ancestors: AstNode[]){
    for (const ancestor of ancestors) {
      const impactedNode = this.getImpactedNode(ancestor);
      if(impactedNode){
        return impactedNode
      }
    }
  }

  private static getImpactedNode(ancestor: AstNode){
    const { type } = ancestor;
    if(type === "JSXOpeningElement"){
      const { name } = (ancestor as unknown as { name: AstNode }).name;
      if(name && typeof name === "object"){
        return name;
      }
    }
    if(type === "JSXElement"){
      const { openingElement } = (ancestor as unknown as { openingElement: AstNode });
      const { name } = openingElement;
      if(name && typeof name === "object"){
        return name;
      }
    }
    if(type === "VariableDeclarator"){
      return (ancestor as unknown as { id: AstNode }).id;
    }
    if(type === "AssignmentExpression"){
      return (ancestor as unknown as { left: AstNode }).left;
    }
    if(type === "FunctionDeclaration"){
      return (ancestor as unknown as { id: AstNode|null }).id || ancestor;
    }
    return null;
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
        this.collectHoldingIds(node as AstNode & { body: AstNode|null});
      }
    }
    catch(e: any){
      console.error("collectHoldingIds", e.message);
    }
    try {
      /** 所有 所持有的 标识符收集完成后，开始收集依赖的标识符 */
      this.collectDependenceIds(node);
    }
    catch(e: any){
      console.error('collectDependenceIds', e.message);
    }
    try{
      this.collectInjectAndProvide(node as AstNode & { body: AstNode|null});
    }
    catch(e: any){
      console.error("collectInjectAndProvide", e.message);
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
        console.error('收集导入、导出成员 报错',e.message);
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

  private static findRelatedExportNameOfDeclarationIdentifier(id: AstNode){
    const occupationInExport = [...id._util.occupation].filter(op => (["ExportSpecifier", "ExportDefaultDeclaration"] as any[]).includes(op._util.parent?.type));
    for (const op of occupationInExport) {
      const occupationParentType = op._util.parent?.type;
      if(occupationParentType === "ExportSpecifier"){
        return (op._util.parent as any).exported.name;
      }
      if(occupationParentType === "ExportDefaultDeclaration"){
        return "default";
      }
    }
  }

  static findExportedMembersNameFromAncestors(node: AstNode|undefined|null) {
    if(!node){
      console.warn("findExportedMembersNameFromAncestors: node is null");
      return [];
    }
    const ancestors = node._util.ancestors;
    const nodeArray = [...ancestors, node];
    const nameList = new Set<string>();
    outer: for (const ancestor of nodeArray) {
      if(ancestor.type === "VElement"){
        nameList.add("default");
        break outer;
      }
      if(ancestor.type === "ExportDefaultDeclaration"){
        const { declaration } = ancestor as unknown as AstNode & { declaration: null|AstNode };
        if(declaration){
          nameList.add("default");
          break outer;
        }
      }
      if(ancestor.type === "ExportNamedDeclaration"){
        const declarationType = (ancestor as any).declaration?.type;
        if(this.EXPORT_DECLARATION_TYPES.includes(declarationType)){
          const nameToAdd = (ancestor as any).declaration.id.name;
          if(nameToAdd){
            nameList.add(nameToAdd);
          }
          break outer;
        }
        else if(["VariableDeclaration"].includes(declarationType)){
          this.findIdOfVariable((ancestor as any).declaration, identifier => {
            nameList.add(identifier.name as string);
          });
          break outer;
        }
        else if(declarationType){
          console.log("未处理的 declarationType :", declarationType)
        }

        const specifiers = (ancestor as any).specifiers;
        if(Array.isArray(specifiers)){
          for (const specifier of specifiers) {
            if(specifier.type === "ExportSpecifier" || specifier.type === "ExportNamespaceSpecifier"){
              nameList.add((specifier as any).exported.name);
            }
          }
        }
        break outer;
      }
      if(["FunctionDeclaration", "ClassDeclaration"].includes(ancestor.type) && "Program" === ancestor._util.parent?.type){
        const ancestorId = (ancestor as any).id;
        if(ancestorId){
          const nameToAdd = this.findRelatedExportNameOfDeclarationIdentifier(ancestorId);
          if(nameToAdd){
            nameList.add(nameToAdd);
          }
        }
        break outer;
      }
      if(["VariableDeclarator"].includes(ancestor.type)){
        const id = (ancestor as any).id;
        const varIdentifierSet = new Set<AstNode>();
        this._deepFindIdentifier(id, identifier => {
          varIdentifierSet.add(identifier);
        });
        for (const identifier of varIdentifierSet) {
          const nameToAdd = this.findRelatedExportNameOfDeclarationIdentifier(identifier);
          if(nameToAdd){
            nameList.add(nameToAdd);
          }
        }
        break outer;
      }
    }
    return Array.from(nameList);
  }

  private static updateImportedAndExportedMember(node: AstNode, programNode: AstNode){
    const { type, source, declaration, specifiers, _util } = node as AstNode & { source: { value: string }, declaration?: null|(AstNode & { declarations: AstNode[] }), specifiers: (AstNode & { local?: { type: string, name: string}, exported: { type: string, name: string } })[] };
    const { filePath } = _util;
    const sourceValue = source?.value || filePath;
    const { importedMember, exportedMember } = programNode._util;
    if(type === "ImportDeclaration"){
      specifiers.forEach(specifier => {
        const { local, imported } = specifier as unknown as AstNode & { local: AstNode, imported?: AstNode };
        let target = importedMember.find(v => v.sourcePath === sourceValue);
        if(!target){
          target = { sourcePath: sourceValue, members: [] };
          importedMember.push(target);
        }
        if(specifier.type === "ImportNamespaceSpecifier"){
          target.members.push({
            localName: local.name as string,
            importedName: "*",
          });
          return;
        }
        if(specifier.type === "ImportDefaultSpecifier"){
          target.members.push({
            localName: local.name as string,
            importedName: "default",
          });
          return;
        }
        if(specifier.type === "ImportSpecifier"){
          target.members.push({
            localName: local.name as string,
            importedName: imported!.name as string,
          });
        }
      });
    }
    if(type === "ExportAllDeclaration"){
      const target = exportedMember.find(v => v.sourcePath === sourceValue);
      if(!target){
        exportedMember.push({ sourcePath: sourceValue, members: [], ExportAllDeclaration: true });
      }
    }
    if(type === "ExportNamedDeclaration"){
      Array.isArray(specifiers) && specifiers.forEach(specifier => {
        const { local, exported } = specifier as unknown as { local: AstNode, exported: AstNode };
        let target = exportedMember.find(v => v.sourcePath === sourceValue);
        if(!target){
          target = { sourcePath: sourceValue, members: [], ExportAllDeclaration: false };
          exportedMember.push(target);
        }
        if(specifier.type === "ExportNamespaceSpecifier"){
          target.members.push({
            localName: "*",
            exportedName: exported.name as string,
          });
          return;
        }
        if(specifier.type === "ExportSpecifier"){
          target.members.push({
            localName: local.name as string,
            exportedName: exported.name as string,
          });
          return;
        }
      });
      if(Array.isArray(declaration?.declarations)){
        declaration?.declarations.forEach(dec => {
          let target = exportedMember.find(v => v.sourcePath === sourceValue);
          if(!target){
            target = { sourcePath: sourceValue, members: [], ExportAllDeclaration: false };
            exportedMember.push(target);
          }
          try{
            const idName = (dec as any).id?.name;
            target.members.push({
              localName: idName as string,
              exportedName: idName as string,
            });
          } catch(e: any){
            console.log("declaration?.declarations.forEach", e.message);
          }
        });
      }
      else if(this.EXPORT_DECLARATION_TYPES.includes(declaration?.type as any)){
        let target = exportedMember.find(v => v.sourcePath === filePath);
        if(!target){
          target = { sourcePath: filePath, members: [], ExportAllDeclaration: false };
          exportedMember.push(target);
        }
        try{
          const idName = (declaration as any).id?.name;
          target.members.push({
            localName: idName as string,
            exportedName: idName as string,
          });
        } catch(e: any) {
          console.log("declaration " + e.message)
        }
      }
    }
    if(type === "ExportDefaultDeclaration"){
      let target = exportedMember.find(v => v.sourcePath === filePath);
      if(!target){
        target = { sourcePath: filePath, members: [], ExportAllDeclaration: false };
        exportedMember.push(target);
      }
      target.members.push({
        localName: "default",
        exportedName: "default",
      });
    }
  }

  private static collectInjectAndProvide(ast: AstNode){
    const { type, _util: { inject, provide, holdingIds }} = ast;
    if(type !== "Program" || !this.isBodyArray(ast)){
      return;
    }
    ast.body.forEach(node => {
      // 搜集 注入的 标识符
      node.type === "ImportDeclaration" && this.findIdOfImport(node, id => inject.add(id));
      if(node.type === "ExportAllDeclaration"){
        const { exported } = node as unknown as { exported: AstNode };
        provide.add(exported);
        return;
      }
      if(node.type === "ExportDefaultDeclaration"){
        const declaration = (node as unknown as { declaration: AstNode}).declaration;
        // 导出已声明的 变量 或 函数 或 class
        if(declaration.type === "Identifier"){
          const theOne = [...holdingIds].find(e => e.name === declaration.name);
          theOne && provide.add(theOne);
        }
        else {
          provide.add(declaration);
        }
      }
      if(node.type === "ExportNamedDeclaration") {
        const {specifiers, declaration} = node as unknown as { specifiers: AstNode[], declaration: (AstNode & { declarations: AstNode[] }) | null};
        for (const specifier of specifiers) {
          const { exported } = specifier as unknown as { local: AstNode, exported: AstNode };
          provide.add(exported);
        }
        if(declaration && Array.isArray(declaration.declarations)){
          // todo 这里需要处理 导出多个变量 或 函数 或 class 的情况
          for (const dec of declaration.declarations) {
            provide.add(dec);
          }
        }
      }
    });
  }

  private static handleDeclaration(node: AstNode, callback: (inputId: AstNode) => void){
    if(this.EXPORT_DECLARATION_TYPES.includes(node.type as any)){
      const id = (node as unknown as { id: AstNode|null }).id;
      if(id){
        callback(id);
      }
    }
    else if(node.type === "VariableDeclaration"){
      this.findIdOfVariable(node, id => {
        callback(id);
      });
    }
  }

  private static collectHoldingIds(node: AstNode & { body: AstNode|null}){
    const { holdingIds, holdingIdNameMap } = node._util;
    // 主要针对 Program 节点，函数体内的 变量 或 函数 或 class
    if(this.isBodyArray(node)){
      const { body } = node;
      body.forEach((cur) => {
        if(cur.type === "ImportDeclaration"){
          this.findIdOfImport(cur, id => {
            holdingIds.add(id);
            id._util.variableScope = [id];
            id._util.holdingIdType = "Import";
          });
        }
        else if(cur.type === "FunctionDeclaration" || cur.type === "ClassDeclaration"){
          this.handleDeclaration(cur, (id) => {
            holdingIds.add(id);
            id._util.variableScope = [id];
            id._util.holdingIdType = cur.type === "ClassDeclaration" ? "Class" : "Function";
          });
        }
        else if(cur.type === "VariableDeclaration"){
          this.handleDeclaration(cur, id => {
            holdingIds.add(id);
            id._util.variableScope = [id];
            id._util.holdingIdType = "Variable";
          });
        }
        else if(cur.type === "ExportDefaultDeclaration"){
          const declaration = (cur as unknown as { declaration: AstNode}).declaration;
          // 导出已声明的 变量 或 函数 或 class
          this.handleDeclaration(declaration, (id) => {
            holdingIds.add(id);
            id._util.variableScope = [id];
            id._util.holdingIdType = cur.type === "ClassDeclaration" ? "Class" : "Function";
          });
        }
        else if(cur.type === "ExportNamedDeclaration") {
          const { declaration} = cur as unknown as { specifiers: AstNode[], declaration: (AstNode & { declarations: AstNode[] }) | null};
          if(declaration){
            this.handleDeclaration(declaration, id => {
              holdingIds.add(id);
              id._util.variableScope = [id];
              id._util.holdingIdType = "Variable";
            });
          }
        }
      });
    }
    // 主要针对 FunctionDeclaration 节点， 块作用域 BlockStatement 节点，函数体内的 变量 或 函数 或 class
    if(node.body && this.isBodyArray(node.body)){
      const { body } = node.body;
      body.forEach((cur) => {
        if(cur.type === "FunctionDeclaration" || cur.type === "ClassDeclaration"){
          const id = (cur as unknown as { id: AstNode|null }).id;
          if(id){
            holdingIds.add(id);
            id._util.variableScope = [id];
            id._util.holdingIdType = node.type === "ClassDeclaration" ? "Class" : "Function";
          }
        }
        else if(cur.type === "VariableDeclaration"){
          this.findIdOfVariable(cur, id => {
            holdingIds.add(id);
            id._util.variableScope = [id];
            id._util.holdingIdType = "Variable";
          });
        }
      });
    }
    // 收集函数参数的变量名
    if(["FunctionDeclaration", "ArrowFunctionExpression", "FunctionExpression", "ObjectMethod", "ClassMethod"].includes(node.type)){
      (node as unknown as { params: AstNode[] }).params.forEach(param => this._deepFindIdentifier(param, id => {
        holdingIds.add(id || node);
        id._util.variableScope = [id];
        id._util.holdingIdType = "Param";
      }))
    }
    holdingIds.forEach(holdingId => {
      const holdingIdName = holdingId.name!;
      if(typeof holdingIdName !== "string") return;
      const nodeSetOfIdName = holdingIdNameMap.get(holdingIdName) || new Set<AstNode>();
      nodeSetOfIdName.add(holdingId);
      holdingIdNameMap.set(holdingIdName, nodeSetOfIdName);
    });
  }

  private static collectDependenceIds(node: AstNode){
    const { _util } = node;
    const { dependenceIds, holdingIdNameMap, children, dependenceIdsNoScope } = _util;
    children.forEach(child => {
      if(child._util.dependenceIdsNoScope.size > 0){
        child._util.dependenceIdsNoScope.forEach(id => dependenceIds.add(id));
      }
      this.findExportIdentifiers(child, id => dependenceIds.add(id));
      this.collectExpressionIdentifiersShallow(child, id => dependenceIds.add(id));
    });

    for (const dependenceId of dependenceIds) {
      if(!dependenceId._util){
        continue;
      }
      // todo 全局变量不处理 JSXIdentifier 的 开合标签 进行判断
      if(dependenceId._util.variableScope.length === 0 && typeof dependenceId.name === "string" && holdingIdNameMap.has(dependenceId.name)){
        dependenceId._util.variableScope.push(...[...holdingIdNameMap.get(dependenceId.name)!]);
        const firstPick = dependenceId._util.variableScope[0];
        if(firstPick && firstPick._util.uuid !== dependenceId._util.uuid){
          firstPick._util.occupation.add(dependenceId);
        }
      }
      if(dependenceId._util.variableScope.length === 0){
        dependenceIdsNoScope.add(dependenceId);
      }
    }
  }


  private static isUseStateVarDec(node: AstNode): node is (AstNode & { type: "VariableDeclarator", id: { type: "ArrayPattern", elements: (null|AstNode)[]}, init: { type: "CallExpression", callee: AstNode, arguments: [AstNode]|[]} }) {
     if(node.type !== "VariableDeclarator") return false;
     const { id, init } = (node as unknown as { init: AstNode, id: AstNode });
     if(init.type !== "CallExpression" || id.type !== "ArrayPattern") return false;
     const { callee } = init as unknown as { callee: AstNode };
     return (callee.type === "Identifier") && (callee.name === "useState");
  }

  static isUseMemoVarDec(node: AstNode){
      if(node.type !== "VariableDeclarator") return false;
      const { init } = (node as unknown as { init: AstNode, id: AstNode });
      if(init.type !== "CallExpression") return false;
      const { callee } = init as unknown as { callee: AstNode };
      return (callee.type === "Identifier") && (callee.name === "useMemo");
  }
  private static isUseCallbackVarDec(node: AstNode){
      if(node.type !== "VariableDeclarator") return false;
      const { init } = (node as unknown as { init: AstNode, id: AstNode });
      if(init.type !== "CallExpression") return false;
      const { callee } = init as unknown as { callee: AstNode };
      return (callee.type === "Identifier") && (callee.name === "useCallback");
  }

  // todo 不断完善
  private static collectEffectId(node: AstNode){
    if(node.type === "VariableDeclarator"){
      this.collectEffectIdOfVarDec(node);
    }
    if(node.type === "AssignmentExpression"){
      this.collectEffectIdOfAssign(node);
      return;
    }
    const isDeleteOperator = "UnaryExpression" === node.type && (node as any).operator === "delete";
    if(isDeleteOperator || ["UpdateExpression"].includes(node.type)){
      this.collectEffectIdOfUnaryUpdate(node);
      return;
    }
    if(node.type === "CallExpression"){
      this.collectEffectIdOfFnCall(node);
      return;
    }
  }

  private static collectEffectIdOfFnCall(node: AstNode){
    if(node.type !== "CallExpression"){
      return;
    }
    const idSet = new Set<AstNode>();
    this.collectExpressionIdentifiers(node, id => idSet.add(id));
    for (const id of idSet) {
      if(id._util.variableScope.length === 0){
        continue;
      }
      const scopeId = id._util.variableScope[0];

      const isParamsElement = scopeId._util.parentProperty === "params";
      if(isParamsElement){
        const fnNode = scopeId._util.parent!;
        if(fnNode.type === "FunctionExpression" || fnNode.type === "ArrowFunctionExpression"){
          if(fnNode._util.parentProperty === "init" && fnNode._util.parent?.type === "VariableDeclarator"){
            const fnId = (fnNode._util.parent as unknown as { id: AstNode|null }).id;
            if(fnId){
              fnId._util.effectIds.add(id);
            }
            else {
              fnNode._util.effectIds.add(id);
            }
          }
          else if(fnNode._util.parentProperty === "right" && fnNode._util.parent?.type === "AssignmentExpression"){
            (fnNode._util.parent as unknown as { left: AstNode }).left._util.effectIds.add(id);
          }
        }
        else if(fnNode.type === "FunctionDeclaration"){
          const { id: fnId } = fnNode as unknown as { id?: AstNode };
          if(fnId){
            fnId._util.effectIds.add(id);
          }
          else {
            fnNode._util.effectIds.add(id);
          }
        }
        else if(fnNode.type === "ClassMethod"){
          const { key: fnId } = fnNode as unknown as { key?: AstNode };
          if(fnId){
            fnId._util.effectIds.add(id);
          }
          else {
            fnNode._util.effectIds.add(id);
          }
        }
      }
      const kindOfParamsElement = [...scopeId._util.effectIds].filter(e => e._util.variableScope[0]?._util.holdingIdType === "Param");
      if(kindOfParamsElement.length > 0){
        kindOfParamsElement.map(ele => {
          ele._util.variableScope[0]._util.parent?._util.effectIds.add(id);
        });
      }
    }
  }

  private static collectEffectIdOfVarDec(node: AstNode){
    // 收集等号后边的 表达式涉及的 id 集合
    // 重点关注 useState 生成的变量
    const { id, init } = (node as unknown as { init: AstNode, id: AstNode });
    if(!init){
      return;
    }
    if(this.isUseStateVarDec(node)){
      this.collectEffectIdOfUseState(node);
      return;
    }
    if(this.isUseMemoVarDec(node)){
      this.collectEffectIdOfUseMemo(node);
      return;
    }
    if(this.isUseCallbackVarDec(node)){
      this.collectEffectIdOfUseCallback(node);
      return;
    }
    const leftIdSet = new Set<AstNode>();
    this._deepFindIdentifier(id, ele => leftIdSet.add(ele));
    const rightIdSet = new Set<AstNode>();
    ["Identifier", "ArrowFunctionExpression", "FunctionExpression"].includes(init.type) ? rightIdSet.add(init) : this.collectExpressionIdentifiers(init, id => rightIdSet.add(id));
    // 创建的 每个变量的 effectIds
    for (const item of leftIdSet) {
      item._util.effectIds = new Set([...rightIdSet, ...item._util.effectIds]);
    }
  }

  private static collectEffectIdOfUseState(node: AstNode){
    const { id, init } = (node as unknown as { init: { arguments: AstNode[] }, id: { elements: (null|AstNode)[] } });
    const args = init.arguments;
    const argsIdSet = new Set<AstNode>();
    this._deepFindIdentifier(args[0], ele => argsIdSet.add(ele));
    const stateNode = id.elements[0];
    const setStateNode = id.elements[1];

    if(stateNode){
      const stateIdSet = new Set<AstNode>();
      this._deepFindIdentifier(stateNode, ele => stateIdSet.add(ele));
      const setStateIdSet = new Set<AstNode>();
      if(setStateNode){
        setStateIdSet.add(setStateNode);
      }
      for (const stateId of stateIdSet) {
        stateId._util.effectIds = new Set([...argsIdSet, ...setStateIdSet]);
      }
    }
  }

  private static collectEffectIdOfUseMemo(node: AstNode){
    const { id, init } = (node as unknown as { init: { arguments: AstNode[] }, id: AstNode });
    const args = init.arguments;
    const depsIdSet = new Set<AstNode>();
    this._deepFindIdentifier(args[1], ele => depsIdSet.add(ele));
    const memoIdSet = new Set<AstNode>();
    this._deepFindIdentifier(id, ele => memoIdSet.add(ele));
    for (const memoId of memoIdSet) {
      memoId._util.effectIds = new Set([...depsIdSet, ...memoId._util.effectIds]);
    }
  }
  private static collectEffectIdOfUseCallback(node: AstNode) {
    const { id, init } = (node as unknown as { init: { arguments: AstNode[] }, id: AstNode });
    const args = init.arguments;
    const depsIdSet = new Set<AstNode>();
    this._deepFindIdentifier(args[1], ele => depsIdSet.add(ele));
    if(id){
      id._util.effectIds = new Set([...depsIdSet, ...id._util.effectIds]);
    }
  }

  private static collectEffectIdOfAssign(node: AstNode){
    const { left, right } = node as unknown as { left: AstNode, right: AstNode };
    const idSetOfLeft = new Set<AstNode>();
    this.collectExpressionIdentifiers(left, id => idSetOfLeft.add(id));
    const idSetOfRight = new Set<AstNode>();
    this.collectExpressionIdentifiers(right, id => idSetOfRight.add(id));
    for (const id of idSetOfLeft) {
      id._util.effectIds = new Set([...idSetOfRight, ...id._util.effectIds]);
    }
  }

  private static collectEffectIdOfUnaryUpdate(node: AstNode){
    const { argument } = node as unknown as { argument: AstNode };
    const idSetOfArgument = new Set<AstNode>();
    this.collectExpressionIdentifiers(argument, id => idSetOfArgument.add(id));
    argument._util.effectIds = new Set([...argument._util.effectIds, ...idSetOfArgument]);
  }

  private static isBodyArray(node: AstNode): node is ({ body: AstNode[] } & AstNode) {
    return ["BlockStatement", "Program"].includes(node.type) && Array.isArray((node as unknown as { body: AstNode[] }).body);
  }

  private static findExportIdentifiers(node: any, callback: (identifier: AstNode) => void){
    if(!node){
      return;
    }
    if(node.type === "ExportDefaultDeclaration" && node.declaration?.type === "Identifier"){
      callback(node.declaration);
      return;
    }
    if(node.type === "ExportNamedDeclaration"){
      Array.isArray(node.specifiers) && node.specifiers.forEach((specifier: AstNode) => {
        if(specifier.type === "ExportSpecifier"){
          callback((specifier as unknown as { local: AstNode }).local);
        }
      });
      if(node.declaration){
        this.handleDeclaration((node as any).declaration,callback);
      }
    }
  }

  static collectExpressionIdentifiersShallow(exp: AstNode|null, callback: (identifier: AstNode) => void){
    if(!exp || exp.type === "ThisExpression"){
      return;
    }
    this._collectExpressionIdentifiersShallow(exp, callback);
  }

  private static _collectExpressionIdentifiersShallow(exp: AstNode, callback: (identifier: AstNode) => void){
    if(!exp || exp.type === "ThisExpression"){
      return;
    }
    if(exp._util.holdingIdType !== null){
      return;
    }
    if(exp.type === "Identifier"){
      if(exp._util.parentProperty === "property" || exp._util.parentProperty === "key"){
        if(exp._util.parent!.computed){
          callback(exp);
        }
      }
      else if(!exp._util.parent?.type?.startsWith("TS")) {
        callback(exp);
      }
      return;
    }
    if(exp.type === "JSXIdentifier" && exp._util.parent?.type !== "JSXAttribute"){
      callback(exp);
      return;
    }
  }

  static collectExpressionIdentifiers(exp: AstNode|null, callback: (identifier: AstNode) => void){
    if(!exp || exp.type === "ThisExpression"){
      return;
    }
    this._collectExpressionIdentifiers(exp, callback);
  }
  private static _collectExpressionIdentifiers(exp: AstNode, callback: (identifier: AstNode) => void){
    if(!exp || exp.type === "ThisExpression"){
      return;
    }
    if(exp._util.holdingIdType !== null){
      return;
    }
    if(exp.type === "Identifier"){
      if(exp._util.parentProperty === "property" || exp._util.parentProperty === "key"){
        if(exp._util.parent!.computed){
          callback(exp);
        }
      }
      else if(!exp._util.parent?.type?.startsWith("TS")) {
        callback(exp);
      }
      return;
    }
    if(exp.type === "JSXIdentifier" && exp._util.parent?.type !== "JSXAttribute"){
      callback(exp);
      return;
    }
    exp._util.nodeCollection.forEach(ele => this._collectExpressionIdentifiers(ele, callback));
  }

  private static findIdOfImport(node: AstNode, callback: (identifier: AstNode) => void){
    const specifiers = (node as unknown as { specifiers: AstNode[]}).specifiers;
    for (const specifier of specifiers) {
      callback((specifier as unknown as { local: AstNode}).local);
    }
  }

  private static findIdOfVariable(node: AstNode, callback: (identifier: AstNode) => void){
    if(node.type !== "VariableDeclaration"){
      return;
    }
    const declarations = (node as unknown as { declarations: AstNode[]}).declarations;
    if(!Array.isArray(declarations)){
      return;
    }
    for (const declaration of declarations) {
      const id = (declaration as unknown as { id: AstNode|null}).id;
      id && this._deepFindIdentifier(id, callback);
    }
  }

  private static _deepFindIdentifier(id: AstNode|null, callback: (identifier: AstNode) => void){
    if(!id){
      return;
    }
    if(id.type === "AssignmentPattern"){
      const left = (id as unknown as { left: AstNode}).left;
      this._deepFindIdentifier(left, callback);
    }
    if(id.type === "Identifier"){
      callback(id);
    }
    if(id.type === "ObjectPattern"){
      const properties = (id as unknown as { properties: AstNode[]}).properties;
      for (const property of properties) {
        if(property.type === "RestElement"){
          const argument = (property as unknown as { argument: AstNode}).argument;
          this._deepFindIdentifier(argument, callback);
        }
        else {
          const { value, key, computed } = property as unknown as { value: AstNode, key: AstNode, computed: boolean};
          this._deepFindIdentifier(value, callback);
          if(computed){
            this._deepFindIdentifier(key, callback);
          }
        }
      }
    }
    if(id.type === "ArrayPattern"){
      const elements = (id as unknown as { elements: AstNode[]}).elements;
      for (const element of elements) {
        this._deepFindIdentifier(element, callback);
      }
    }
    if(id.type === "RestElement"){
      this._deepFindIdentifier((id as unknown as { argument: AstNode}).argument, callback);
    }
  }

  private static updateLoc(astNode: AstNode, extra: { mapUuidToNode: Map<string, AstNode>, mapFileLineToNodeSet: Map<number, Set<AstNode>>, mapPathToNodeSet: Map<string, Set<AstNode>> }) {
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
        const path = this.getNodePath(n);
        mapPathToNodeSet.set(path, mapPathToNodeSet.get(path) || new Set());
        mapPathToNodeSet.get(path)?.add(n);
      });
    }
  }

  static isUntrackedId(id: AstNode){
    return id._util.variableScope.length === 0 && !this.isPropertyOfGlobal(id) && !this.isIntrinsicElement(id) && !this.isStandardAttribute(id)
  }
  static isPropertyOfGlobal(node: AstNode): boolean {
    return node.type === "Identifier" && !node._util.variableScope.length && typeof node.name === "string" && this.windowProperties.includes(node.name!);
  }

  static isIntrinsicElement(node: AstNode){
    return (node.type === "JSXIdentifier" && node._util.parent?.type && ["JSXOpeningElement", "JSXClosingElement"].includes(node._util.parent.type) && typeof node.name === "string" && this.intrinsicElements.includes(node.name!))
  }

  static isStandardAttribute(node: AstNode){
    return (node._util.parent!.type === "JSXAttribute" && typeof node.name === "string" && this.standardAttributes.includes(node.name!))
  }

  static getTopScopeNodesByLineNumberRange(mapFileLineToNodeSet: Map<number, Set<AstNode>>, lineNumberStart: number, lineNumberEnd: number, loose = false){
    const nodeSet = new Set<AstNode>();
    for (let i = lineNumberStart; i <= lineNumberEnd; i++) {
      const astNode = mapFileLineToNodeSet.get(i);
      if(!astNode){
        continue;
      }
      let added = false;
      for(const nodeItem of astNode){
        const { startLine, endLine } = nodeItem._util;
        if(startLine >= lineNumberStart && endLine <= lineNumberEnd){
          if(!["File", "Program"].includes(nodeItem.type)){
            nodeSet.add(nodeItem);
          }
          added = true;
        }
      }
      if(!added && loose){
        const firstNode = [...astNode][0];
        if(!["File", "Program"].includes(firstNode.type)){
          nodeSet.add(firstNode);
        }
      }
    }
    const collections = [...nodeSet].map(e => e._util.nodeCollection).flat();
    return [...nodeSet].filter(e => !collections.includes(e));
  }
};