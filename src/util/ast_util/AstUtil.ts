import { windowProperties } from "./windowProperties";
import { intrinsicElements, standardAttributes } from "./intrinsicElements";
export interface AstNode {
  computed?: boolean;
  type: string;
  name?: string;
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
    holdingIds: Set<AstNode>,
    holdingIdNameMap: Map<string, Set<AstNode>>,
    holdingIdType: 'Import'|'Variable'|'Function'|'Class'|'Param'|null,
    inject: Set<AstNode>,
    provide: Set<AstNode>,
    effectIds: Set<AstNode>,
  }
}

export default class AstUtil {
  static invalidNodeKey = [
    "comments",
    "tokens",
  ];

  static getNodePath(node: AstNode){
    return [...node._util.ancestors, node].map(n => n.type).join(':') + ":" + node.name;
  }

  static getShortNodeMsg(node: AstNode){
    const { _util: { startLine, startColumn, endLine, endColumn }} = node;
    return `${node.name || node.type}「${startLine}:${startColumn}, ${endLine}:${endColumn}」`;
  }

  static deepFirstTravel(node: AstNode, filePath: string, mapUuidToNode: Map<string, AstNode>, mapFileLineToNodeSet: Map<number, Set<AstNode>>, mapPathToNodeSet: Map<string, Set<AstNode>>){
    const visitedNodeSet = new Set<typeof node>();
    if(!node){
      return ;
    }
    return this._deepFirstTravel(node, visitedNodeSet, {filePath, depth:0, mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet})
  }
  private static _deepFirstTravel(node: AstNode, visitedNodeSet: Set<typeof node>, extra: { filePath: string, depth: number, mapUuidToNode: Map<string, AstNode>, mapFileLineToNodeSet: Map<number, Set<AstNode>>, mapPathToNodeSet: Map<string, Set<AstNode>> }){
    visitedNodeSet.add(node);
    const { filePath, depth, mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet } = extra;
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
      holdingIdType: null,
      holdingIds: new Set<AstNode>(),
      holdingIdNameMap: new Map<string, Set<AstNode>>(),
      inject: new Set<AstNode>(),
      provide: new Set<AstNode>(),
      effectIds: new Set<AstNode>(),
    }
    node._util = _util;
    // 存储 当前 ast 节点下的 所有的 node 集合
    const { nodeCollection, children } = _util;
    Object.keys(node).forEach(nodeKey => {
      if(this.invalidNodeKey.includes(nodeKey) || nodeKey.startsWith("TS") || nodeKey.endsWith('Annotation')){
        return;
      }
      // @ts-ignore
      const nodeValue = node[nodeKey];
      if(visitedNodeSet.has(nodeValue) || !nodeValue){
        return;
      }
      if(this.isValidNodeCollect(nodeValue)){
        const childNode = this._deepFirstTravel(nodeValue, visitedNodeSet, { filePath, depth: depth +1, mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet})
        nodeCollection.push(childNode, ...childNode._util.nodeCollection);
        children.push(childNode);
        childNode._util.parentProperty = nodeKey;
      }
      else if(this.isValidArrayNodeCollect(nodeValue)){
        const validNodeArray = (nodeValue as AstNode[]).filter(nodeItem => this.isValidNodeCollect(nodeItem)).map(v => {
          return this._deepFirstTravel(v, visitedNodeSet, { filePath, depth: depth +1, mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet})
        });
        nodeCollection.push(...validNodeArray.map( n => [n, ...n._util.nodeCollection]).flat());
        children.push(...validNodeArray);
        validNodeArray.forEach((v, index) => {
          v._util.parentProperty = nodeKey;
          v._util.indexOfProperty = index;
        });
      }
    });
    children.forEach(child => child._util.parent = node);
    nodeCollection.forEach(nodeItem => nodeItem._util.ancestors.unshift(node));
    this.collectHoldingIds(node as AstNode & { body: AstNode|null});
    /** 所有 所持有的 标识符收集完成后，开始收集依赖的标识符 */
    this.collectDependenceIds(node);
    this.collectInjectAndProvide(node as AstNode & { body: AstNode|null});
    if(node.type === "Program"){
      nodeCollection.forEach(child => this.collectEffectId(child));
    }
    this.updateLoc(node, { mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet });
    return node;
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
          for (const dec of declaration.declarations) {
            provide.add(dec);
          }
        }
      }
    });
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
          const id = (cur as unknown as { id: AstNode|null }).id;
          if(id){
            holdingIds.add(id);
            id._util.variableScope = [id];
            id._util.holdingIdType = cur.type === "ClassDeclaration" ? "Class" : "Function";
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
    if(["FunctionDeclaration", "ArrowFunctionExpression", "FunctionExpression"].includes(node.type)){
      const params = (node as unknown as { params: AstNode[] }).params;
      params.forEach(param => this._deepFindIdentifier(param, id => {
        holdingIds.add(id || node);
        id._util.variableScope = [id];
        id._util.holdingIdType = "Param";
      }))
    }
    holdingIds.forEach(holdingId => {
      const holdingIdName = holdingId.name!;
      const nodeSetOfIdName = holdingIdNameMap.get(holdingIdName) || new Set<AstNode>();
      nodeSetOfIdName.add(holdingId);
      holdingIdNameMap.set(holdingIdName, nodeSetOfIdName);
    });
  }

  private static isVarInit(node: AstNode){
    return node._util.parentProperty === 'init' && node._util.parent?.type === 'VariableDeclarator'
  }

  static isReturnArgument(node: AstNode){
    return node._util.parentProperty === 'argument' && node._util.parent?.type === 'ReturnStatement';
  }

  private static collectDependenceIds(node: AstNode){
    const { nodeCollection, dependenceIds, holdingIdNameMap } = node._util;
    nodeCollection.forEach(e => {
      this.findExportIdentifiers(e, id => dependenceIds.add(id));
      this.collectExpressionIdentifiers(e, id => dependenceIds.add(id));
    });
    for (const dependenceId of dependenceIds) {
      // todo 全局变量不处理 JSXIdentifier 的 开合标签 进行判断
      if(dependenceId._util.variableScope.length === 0){
        const sameNameIds = [...( holdingIdNameMap.get(dependenceId.name!) || [])];
        dependenceId._util.variableScope.push(...sameNameIds);
        const firstPick = sameNameIds[0];
        if(firstPick && firstPick._util.uuid !== dependenceId._util.uuid){
          firstPick._util.effectIds.add(dependenceId);
        }
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
      const { id, init } = (node as unknown as { init: AstNode, id: AstNode });
      if(init.type !== "CallExpression") return false;
      const { callee } = init as unknown as { callee: AstNode };
      return (callee.type === "Identifier") && (callee.name === "useMemo");
  }
  private static isUseCallbackVarDec(node: AstNode){
      if(node.type !== "VariableDeclarator") return false;
      const { id, init } = (node as unknown as { init: AstNode, id: AstNode });
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
            (fnNode._util.parent as unknown as { id: AstNode }).id._util.effectIds.add(id);
          }
          else if(fnNode._util.parentProperty === "right" && fnNode._util.parent?.type === "AssignmentExpression"){
            (fnNode._util.parent as unknown as { left: AstNode }).left._util.effectIds.add(id);
          }
          else if(fnNode._util.parentProperty === "value" && fnNode._util.parent?.type === "MethodDefinition"){
            (fnNode._util.parent as unknown as { key: AstNode }).key._util.effectIds.add(id);
          }
        }
        else if(fnNode.type === "FunctionDeclaration"){
          fnNode._util.effectIds.add(id);
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
    const idSet = new Set<AstNode>();
    this._deepFindIdentifier(id, ele => idSet.add(ele));
    const createdExpIdSet = new Set<AstNode>();
    ["Identifier", "ArrowFunctionExpression", "FunctionExpression"].includes(init.type) ? createdExpIdSet.add(init) : this.collectExpressionIdentifiers(init, id => createdExpIdSet.add(id));
    // 创建的 每个变量的 effectIds 集合为 createdExpIdSet
    for (const createdId of idSet) {
      createdId._util.effectIds = new Set([...createdExpIdSet, ...createdId._util.effectIds]);
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
    const idSetOfRight = new Set<AstNode>();
    this.collectExpressionIdentifiers(right, id => idSetOfRight.add(id));
    // todo 右边的 影响 左边的
    if(left.type === "Identifier"){
      const { left } = node as unknown as { left: AstNode };
      left._util.effectIds = new Set([...idSetOfRight, ...left._util.effectIds]);
    }
    else {
      const { left } = node as unknown as { left: AstNode };
      const idSetOfLeft = new Set<AstNode>();
      this.collectExpressionIdentifiers(left, id => idSetOfLeft.add(id));
      for (const id of idSetOfLeft) {
        id._util.effectIds = new Set([...idSetOfRight, ...id._util.effectIds]);
      }
    };
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
    if(node.type === "ExportNamedDeclaration" && Array.isArray(node.specifiers)){
      for (const specifier of node.specifiers) {
        if(specifier.type === "ExportSpecifier"){
          callback((specifier as unknown as { local: AstNode }).local);
        }
      }
    }
  }

  private static expressionTypeIsIdentifier(exp: AstNode|null): exp is AstNode & { type: "Identifier" } {
    return exp?.type === "Identifier";
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

  static deepFindIdOfExpression(exp: AstNode|null, callback: (identifier: AstNode) => void) {
    if (!exp || exp.type === "ThisExpression") {
      return;
    }
    this._deepFindIdOfExpression(exp, callback);
  }

  private static _deepFindIdOfExpression(exp: AstNode|null, callback: (identifier: AstNode) => void){
    if(!exp || exp.type === "ThisExpression"){
      return;
    }

    if(exp.type === "IfStatement"){
      const { test, alternate, consequent } = exp as unknown as { test: AstNode, consequent: AstNode, alternate: AstNode };
      test.type === 'Identifier' ? callback(test) : this._deepFindIdOfExpression(test, callback);
      this._deepFindIdOfExpression(consequent, callback);
      this._deepFindIdOfExpression(alternate, callback);
    }
    else if(exp.type === "TryStatement"){
      const { block, finalizer } = exp as unknown as { block: AstNode, finalizer: AstNode };
      this._deepFindIdOfExpression(block, callback);
      finalizer && this._deepFindIdOfExpression(finalizer, callback);
    }
    else if(exp.type === "SpreadElement"){
      const { argument } = (exp as unknown as { argument: AstNode });
      this.expressionTypeIsIdentifier(argument) && callback(argument);
    }
    else if(exp.type === "JSXSpreadChild"){
      const expression = (exp as unknown as { expression: AstNode }).expression;
      callback(expression);
    }
    else if(exp.type === "MemberExpression" || exp.type === "JSXMemberExpression"){
      const rootIdentifier = this.getRootIdentifierOfMemberExpression(exp);
      this.expressionTypeIsIdentifier(rootIdentifier) && callback(rootIdentifier);
    }
    else if(exp.type === "ObjectExpression"){
      const properties = (exp as unknown as { properties: AstNode[]}).properties;
      for (const property of properties) {
        if(property.type === "SpreadElement"){
          this._deepFindIdOfExpression(property, callback);
        }
        else {
          const value = (property as unknown as { value: AstNode}).value;
          this.expressionTypeIsIdentifier(value) ? callback(value) : this._deepFindIdOfExpression(value, callback);
        }
      }
    }
    else if(exp.type === "ArrayExpression"){
      const elements = (exp as unknown as { elements: AstNode[]}).elements;
      for (const element of elements) {
        this.expressionTypeIsIdentifier(element) ? callback(element) : this._deepFindIdOfExpression(element, callback);
      }
    }
    else if(exp.type === "ArrowFunctionExpression"){
      const body = (exp as unknown as { body: AstNode}).body;
      this.expressionTypeIsIdentifier(body) ? callback(body) : this._deepFindIdOfExpression(body, callback);
    }
    else if(exp.type === "CallExpression"){
      const callee = (exp as unknown as { callee: AstNode}).callee;
      this.expressionTypeIsIdentifier(callee) ? callback(callee) : this._deepFindIdOfExpression(callee, callback);

      const args = (exp as unknown as { arguments: AstNode[]}).arguments;
      for (const argument of args) {
        this.expressionTypeIsIdentifier(argument) ? callback(argument) : this._deepFindIdOfExpression(argument, callback);
      }
    }
    else if(exp.type === "AssignmentExpression" || exp.type === "BinaryExpression" || exp.type === "LogicalExpression"){
      const {left, right} = (exp as unknown as { left: AstNode, right: AstNode});
      [left, right].forEach(e => this.expressionTypeIsIdentifier(e) ? callback(e) : this._deepFindIdOfExpression(e, callback));
    }
    else if(exp.type === "UpdateExpression"){
      const argument = (exp as unknown as { argument: AstNode}).argument;
      this.expressionTypeIsIdentifier(argument) ? callback(argument) : this._deepFindIdOfExpression(argument, callback);
    }
    else if(exp.type === "SequenceExpression"){
      const {expressions} = (exp as unknown as { expressions: AstNode[]});
      for (const expression of expressions) {
        this.expressionTypeIsIdentifier(expression) ? callback(expression) : this._deepFindIdOfExpression(expression, callback);
      }
    }
    else if(exp.type === "ConditionalExpression"){
      const { test, consequent, alternate } = (exp as unknown as { test: AstNode, consequent: AstNode, alternate: AstNode });
      [test, consequent, alternate].forEach(e => this._deepFindIdOfExpression(e, callback));
    }
    else if(exp.type === "JSXExpressionContainer"){
      const { expression } = exp as unknown as { expression: AstNode};
      expression.name && callback(expression);
    }
    else if(exp.type === "JSXIdentifier" && exp._util.parent?.type !== "JSXAttribute"){
      callback(exp);
    }
    else if(exp.type === "JSXAttribute"){
      const value = (exp as unknown as { value: AstNode|null}).value;
      value && this._deepFindIdOfExpression(value, callback);
    }
    else if(exp.type === "JSXElement"){
      const openingElement = (exp as unknown as { openingElement: AstNode}).openingElement;
      this._deepFindIdOfExpression(openingElement, callback);
    }
    else if(exp.type === "JSXOpeningElement"){
      const { name, attributes } = exp as unknown as { name: AstNode, attributes: AstNode[] };
      this._deepFindIdOfExpression(name, callback);
      for (const attribute of attributes) {
        this._deepFindIdOfExpression(attribute, callback);
      }
    }
  }

  private static getRootIdentifierOfMemberExpression(memExp: AstNode): AstNode{
    if(memExp.type === "MemberExpression" || memExp.type === "JSXMemberExpression"){
      return this.getRootIdentifierOfMemberExpression((memExp as unknown as { object: AstNode}).object);
    }
    return memExp;
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
          const value = (property as unknown as { value: AstNode}).value;
          this._deepFindIdentifier(value, callback);
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

  private static isValidArrayNodeCollect(astNode: any): astNode is AstNode[] {
    return Array.isArray(astNode) && astNode.some(v => typeof v?.type === 'string')
  }

  private static isValidNodeCollect(astNode: AstNode): astNode is AstNode {
    return typeof astNode?.type === 'string';
  }

  static windowProperties = windowProperties
  static intrinsicElements = intrinsicElements
  static standardAttributes = standardAttributes

  static isUntrackedId(id: AstNode){
    return id._util.variableScope.length === 0 && !this.isPropertyOfGlobal(id) && !this.isIntrinsicElement(id) && !this.isStandardAttribute(id)
  }
  static isPropertyOfGlobal(node: AstNode): boolean {
    return node.type === "Identifier" && !node._util.variableScope.length && this.windowProperties.includes(node.name!);
  }

  static isIntrinsicElement(node: AstNode){
    return (node.type === "JSXIdentifier" && node._util.parent?.type && ["JSXOpeningElement", "JSXClosingElement"].includes(node._util.parent.type) && this.intrinsicElements.includes(node.name!))
  }

  static isStandardAttribute(node: AstNode){
    return (node._util.parent!.type === "JSXAttribute" && this.standardAttributes.includes(node.name!))
  }

  static getTopScopeNodesByLineNumberRange(mapFileLineToNodeSet: Map<number, Set<AstNode>>, lineNumberStart: number, lineNumberEnd: number){
    const nodeSet = new Set<AstNode>();
    for (let i = lineNumberStart; i <= lineNumberEnd; i++) {
      const astNode = mapFileLineToNodeSet.get(i);
      if(!astNode){
        continue;
      }
      for(const nodeItem of astNode){
        const { startLine, endLine } = nodeItem._util;
        if(startLine >= lineNumberStart && endLine <= lineNumberEnd){
          nodeSet.add(nodeItem);
        }
      }
    }
    const collections = [...nodeSet].map(e => e._util.nodeCollection).flat();
    return [...nodeSet].filter(e => !collections.includes(e));
  }

  static getTopScopeNodesByLineNumber(mapFileLineToNodeSet: Map<number, Set<AstNode>>, lineNumber: number){
    const astNode = mapFileLineToNodeSet.get(lineNumber);
    const lineOfNodes = [...new Set(astNode)].filter((e: AstNode) => {
      const { startLine, endLine } = e._util;
      return startLine === lineNumber && endLine === lineNumber;
    });
    const collections = [...lineOfNodes].map(e => e._util.nodeCollection).flat();

    return lineOfNodes.filter(e => !collections.includes(e));
  }

  static isSubNodeOfVariableDeclarator(node: AstNode){
    const { ancestors } = node._util;
    const typeList = ancestors.map(e => e.type);
    const index = typeList.lastIndexOf("VariableDeclarator");
    if(index === -1){
      return false;
    }
    return ancestors.slice(index).every(ancestor => ["Identifier", "ObjectPattern", "ArrayPattern"].includes(ancestor.type));
  }

  static createScopeContent(node: AstNode){
    return [node._util.filePath,":", node._util.startLine, "-", node._util.endLine, ":[", node.name || (node as any).value,"]"].join("")
  }
};