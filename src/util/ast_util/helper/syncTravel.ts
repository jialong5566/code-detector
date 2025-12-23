import { AstNode } from "../AstUtil";
import {EXPORT_DECLARATION_TYPES, FUNCTION_TYPES, INVALID_NODE_KEY} from "../SHARED_CONSTANTS";
import isValidNodeCollect from "./isValidNodeCollect";
import isValidArrayNodeCollect from "./isValidArrayNodeCollect";
import createAstNodeExt from "./createAstNodeExt";
import deepSearchParamsIdentifier from "./deepSearchParamsIdentifier";
import updateImportedAndExportedMember from "./updateImportedAndExportedMember";
import updateLoc from "./updateLoc";
import {intrinsicElements} from "../intrinsicElements";

type Extra = {
  visitedNodeSet: Set<AstNode>,
  filePath: string,
  mapUuidToNode: Map<string, AstNode>,
  mapFileLineToNodeSet: Map<number, Set<AstNode>>,
  mapPathToNodeSet: Map<string, Set<AstNode>>,
  upstreamIdentifiers: AstNode[],
}

export default function syncTravel(astNode: AstNode, extra: Extra, travelFn: (astNode: AstNode) => void){
  if(!astNode) return;
  extra.upstreamIdentifiers = extra.upstreamIdentifiers || [];
  const { visitedNodeSet, filePath } = extra;
  astNode._util = createAstNodeExt({ filePath });
  visitedNodeSet.add(astNode);
  if(shouldWideTravel(astNode)){
    wideTravel([astNode], extra, travelFn);
  }
  else {
    deepTravel(astNode, extra, travelFn);
  }
}

function wideTravel(wideTravelNodeList: AstNode[], extra: Extra, travelFn: (astNode: AstNode) => void){
  const { visitedNodeSet, filePath } = extra;
  const wideTravelNodes: AstNode[] = [];
  for (const wideTravelNode of wideTravelNodeList) {
    if(!shouldWideTravel(wideTravelNode)){
      deepTravel(wideTravelNode, extra, travelFn );
      continue;
    }
    const { children: childrenOfChild } = wideTravelNode._util;
    Object.keys(wideTravelNode).forEach(childKey => {
      if (INVALID_NODE_KEY.includes(childKey)) return;
      // @ts-ignore
      const childValue = wideTravelNode[childKey];
      if(isValidNodeCollect(childValue) && !visitedNodeSet.has(childValue)){
        visitedNodeSet.add(childValue);
        childValue._util = createAstNodeExt({
          filePath,
          parent: wideTravelNode,
          parentProperty: childKey,
          indexOfProperty: null,
          ancestors: [...wideTravelNode._util.ancestors, wideTravelNode],
          ...childValue._util as any
        });
        childrenOfChild.push(childValue);
        wideTravelNodes.push(childValue);
      }
      else if(isValidArrayNodeCollect(childValue)){
        childValue.forEach((childInArray, index) => {
          if (visitedNodeSet.has(childInArray) || !isValidNodeCollect(childInArray)) return;
          visitedNodeSet.add(childInArray);
          childInArray._util = createAstNodeExt({
            filePath,
            parent: wideTravelNode,
            parentProperty: childKey,
            indexOfProperty: index,
            ancestors: [...wideTravelNode._util.ancestors, wideTravelNode],
            ...childInArray._util as any
          });
          childrenOfChild.push(childInArray);
          wideTravelNodes.push(childInArray);
        });
      }
    });
  }
  const { hoistedNodeList, notHoistedNodes } = resortNodes(wideTravelNodes);
  const holdingIdentifiers: AstNode[] = [...extra.upstreamIdentifiers];

  const importIdentifiers = new Set<AstNode>();
  // 收集导入声明、提升的声明、导出的提升声明
  for(const ele of hoistedNodeList){
    collectHoldingIdentifiers(ele, identifier => {
      holdingIdentifiers.push(identifier);
      // todo _util注入
    }, identifier => importIdentifiers.add(identifier));
  }
  for(const ele of wideTravelNodes){
    if(notHoistedNodes.includes(ele)){
      collectHoldingIdentifiers(ele, identifier => holdingIdentifiers.push(identifier), identifier => void 0);
    }
    const mergedExtra = { ...extra, upstreamIdentifiers: [...holdingIdentifiers] };
    const holdingIdentifierSet = new Set(holdingIdentifiers);
    ele._util.holdingIds = holdingIdentifierSet;// ?? todo remove
    if(shouldWideTravel(ele)){
      wideTravel([ele], mergedExtra, travelFn);
    }
    else {
      deepTravel(ele, mergedExtra, travelFn );
    }
    if(!ele._util.uuid){
      updateLoc(ele, extra);
    }
    if(ele.type === "Program"){
      // todo
      console.log("需要处理兜底 Programs");
    }
    addIdentifiersToAncestors([ele], ele._util.ancestors);
  }
  importIdentifiers.forEach(identifier => {
    identifier._util.holdingIdType = "Import";
  });
}

function deepTravel(deepTravelNode: AstNode, extra: Extra, travelFn: (astNode: AstNode) => void){
  const { upstreamIdentifiers } = extra;
  const holdingIdentifiers = [...upstreamIdentifiers];
  // 函数类型 进行 参数收集
  // todo 函数参数 属于动态依赖
  const paramIdentifierSet = new Set<AstNode>();
  if(FUNCTION_TYPES.includes(deepTravelNode.type)){
    const params = (deepTravelNode as unknown as { params: AstNode[] }).params;
    Array.isArray(params) && params.forEach(param => {
      deepSearchParamsIdentifier(param, identifier => {
        holdingIdentifiers.push(identifier);
        paramIdentifierSet.add(identifier);
      });
    });
  }
  updateVariableScopeAndOccupation(deepTravelNode, holdingIdentifiers);
  const { visitedNodeSet, filePath } = extra;
  const { children } = deepTravelNode._util;
  const ancestors = [...deepTravelNode._util.ancestors, deepTravelNode];

  Object.keys(deepTravelNode).forEach(childKey => {
    if (INVALID_NODE_KEY.includes(childKey)) return;
    const commonNodeExt = {
      parentProperty: childKey,
      filePath,
      parent: deepTravelNode,
      ancestors
    }
    // @ts-ignore
    const childValue = deepTravelNode[childKey];
    if(isValidNodeCollect(childValue) && !visitedNodeSet.has(childValue)){
      visitedNodeSet.add(childValue);
      childValue._util = createAstNodeExt({
        indexOfProperty: null,
        ...commonNodeExt,
        ...childValue._util as any
      });
      children.push(childValue);
    }
    else if(isValidArrayNodeCollect(childValue)){
      childValue.forEach((childInArray, index) => {
        if (visitedNodeSet.has(childInArray) || !isValidNodeCollect(childInArray)) return;
        visitedNodeSet.add(childInArray);
        childInArray._util = createAstNodeExt({
          indexOfProperty: index,
          ...commonNodeExt,
          ...childInArray._util as any
        });
        children.push(childInArray);
      });
    }
  });
  const mergedExtra = { ...extra, upstreamIdentifiers: holdingIdentifiers };
  for(const child of children){
    if(shouldWideTravel(child)){
      wideTravel([child], mergedExtra, travelFn);
    }
    else {
      deepTravel(child, mergedExtra, travelFn);
    }
    if(child.type === "Program"){
      (child as unknown as  { body: AstNode[] }).body.forEach(bodyElement => updateImportedAndExportedMember(bodyElement, child));
    }
    if(!child._util.uuid){
      updateLoc(child, extra);
    }
    addIdentifiersToAncestors([child], ancestors);
  }
  paramIdentifierSet.forEach(paramIdentifier => {
    paramIdentifier._util.holdingIdType = "Param";
  });
  // 注入依赖 我用了谁
  const injectSet = new Set([...deepTravelNode._util.dependenceIds].filter(e => isValidIdentifierOrJSXIdentifier(e)).map(e => e._util.variableScope[0]).filter(Boolean).filter(e => upstreamIdentifiers.includes(e)));
  deepTravelNode._util.inject = injectSet;
  // 影响面 谁用了我
  for (const injectNode of injectSet) {
    if(!injectNode._util){
      // todo 不优雅
      injectNode._util = { provide: new Set() } as any;
    }
    injectNode._util.provide.add(deepTravelNode);
  }
  travelFn(deepTravelNode);
}

/* -------- 以下为辅助函数 ---------- */

function resortNodes(nodes: AstNode[]){
  const hoistedNodeList: AstNode[] = [];
  for (const astNode of nodes) {
    if(["ImportDeclaration", "FunctionDeclaration", "TSEnumDeclaration", "TSInterfaceDeclaration", "TSTypeAliasDeclaration"].includes(astNode.type)){
      hoistedNodeList.push(astNode);
    }
    if(["ExportNamedDeclaration", "ExportDefaultDeclaration"].includes(astNode.type)){
      const decType = (astNode as any).declaration?.type;
      const decId = (astNode as any).declaration?.id;
      if(["FunctionDeclaration", "TSEnumDeclaration", "TSInterfaceDeclaration", "TSTypeAliasDeclaration"].includes(decType) && decId){
        hoistedNodeList.push(astNode);
      }
    }
  }
  const notHoistedNodes: AstNode[] = nodes.filter(node => !hoistedNodeList.includes(node));
  return {
    hoistedNodeList,
    notHoistedNodes,
  };
}


function shouldWideTravel(astNode: AstNode){
  return ["BlockStatement", "Program"].includes(astNode.type);
}

function updateHoldingIdMap(holdingIdentifiers: AstNode[], holdingIdNameMap: Map<string, Set<AstNode>>){
  [...holdingIdentifiers].reverse().forEach(holdingId => {
    const holdingIdName = holdingId.name!;
    if(typeof holdingIdName !== "string") return;
    const nodeSetOfIdName = holdingIdNameMap.get(holdingIdName) || new Set<AstNode>();
    nodeSetOfIdName.add(holdingId);
    holdingIdNameMap.set(holdingIdName, nodeSetOfIdName);
  });
}

function collectHoldingIdentifiers(ele: AstNode, callback: (n: AstNode) => void, importCallback: (n: AstNode) => void){
  // 收集导出
  if(ele.type === "ImportDeclaration"){
    const specifiers = (ele as unknown as { specifiers: AstNode[] }).specifiers;
    for (const specifier of specifiers) {
      const local = (specifier as unknown as { local: AstNode }).local;
      callback(local);
      importCallback(local);
    }
  }
  // 收集声明
  if(EXPORT_DECLARATION_TYPES.includes(ele.type as any)){
    const id = (ele as unknown as { id: AstNode }).id;
    if(id){
      callback(id);
    }
  }
  if(EXPORT_DECLARATION_TYPES.includes((ele as any).declaration?.type)){
    const id = (ele as unknown as { declaration: { id?: AstNode } }).declaration?.id;
    if(id){
      callback(id);
    }
  }
  if(ele.type === "VariableDeclaration"){
    Array.from(new Set((ele as unknown as { declarations: AstNode[] }).declarations)).forEach(declaration => {
      const id = (declaration as unknown as { id: AstNode }).id;
      if(id){
        deepSearchParamsIdentifier(id, callback);
      }
    });
  }
  if((ele as any).declaration && (ele as any).declaration.type === "VariableDeclaration"){
    Array.from(new Set((ele as unknown as { declaration: { declarations: AstNode[] } }).declaration.declarations)).forEach(declaration => {
      const id = (declaration as unknown as { id: AstNode }).id;
      if(id){
        deepSearchParamsIdentifier(id, callback);
      }
    });
  }
}


function isValidIdentifierOrJSXIdentifier(node: AstNode){
  if(node.type === "Identifier" && !isImportedOrExported(node) && !isLiteralPropertyNode(node)){
    return true;
  }
  else if(node.type === "JSXIdentifier" && isJsxElementIdentifier(node)){
    if(isJsxElementNameIdentifier(node)){
      return !intrinsicElements.includes(node.name as string);
    }
    return true;
  }
  return false;
}

function updateVariableScopeAndOccupation(deepTravelNode: AstNode, holdingIdentifiers: AstNode[]){
  const holdingIdentifierSet = new Set(holdingIdentifiers);
  deepTravelNode._util.holdingIds = holdingIdentifierSet;
  updateHoldingIdMap(holdingIdentifiers, deepTravelNode._util.holdingIdNameMap);
  const nodeName = deepTravelNode.name;
  if(typeof nodeName !== 'string'){
    return;
  }
  const valid = isValidIdentifierOrJSXIdentifier(deepTravelNode);
  if(!valid){
    return;
  }
  !holdingIdentifierSet.has(deepTravelNode) && deepTravelNode._util.ancestors.forEach(ancestor => {
    ancestor._util.dependenceIds.add(deepTravelNode);
  });
  deepTravelNode._util.variableScope = [...(deepTravelNode._util.holdingIdNameMap.get(nodeName) || [])];
  const firstPick = deepTravelNode._util.variableScope[0];
  if(firstPick && firstPick !== deepTravelNode){
    if(firstPick._util){
      if(!firstPick._util.occupation){
        firstPick._util.occupation = new Set();
      }
      firstPick._util.occupation.add(deepTravelNode);
    }
    else {
      console.log(deepTravelNode._util.filePath, deepTravelNode.loc?.start.line, deepTravelNode.type, deepTravelNode.name);
    }
  }
}

function isLiteralPropertyNode(exp: AstNode){
  return (exp._util.parentProperty === "property" || exp._util.parentProperty === "key") && !exp._util.parent?.computed
}

function isJsxElementNameIdentifier(deepTravelNode: AstNode) {
  return (deepTravelNode._util.parentProperty === "name" && typeof deepTravelNode.name === "string");
}

function isJsxElementIdentifier(deepTravelNode: AstNode){
  return deepTravelNode._util.parent?.type !== "JSXAttribute" || isJsxElementNameIdentifier(deepTravelNode);
}

function isImportedOrExported(deepTravelNode: AstNode){
  return deepTravelNode._util.parentProperty === "imported" || deepTravelNode._util.parentProperty === "exported";
}

function addIdentifiersToAncestors(children: AstNode[], ancestors: AstNode[]) {
  for (const child of children) {
    ancestors.forEach(ancestor => {
      !ancestor._util.nodeCollection.includes(child) && ancestor._util.nodeCollection.push(child);
    });
  }
}