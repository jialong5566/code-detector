// 提供类型的 标识符【导入标识符，变量、函数、类的声明，函数形参，全局变量】
// 使用类型的 标识符【表达式中，表达式声明】
// 引起变化的 表达式【赋值表达式，更新表达式，调用表达式】
import {join} from "path";
import getAstKitByFilePath from "../ast_util/getAstKitByFilePath";
import AstUtil, {AstNode} from "../ast_util/AstUtil";
import {GitDiffDetail} from "../format_git_diff_content";

type BlockReportKind = "Import"|"Declaration"|"Assignment"|"SelfUpdate"|"Invoke"|"Other"|"Never";
type EffectItem = {
  causeBy: AstNode,
  effects: AstNode[],
}
export type BlockReport = {
  kind: BlockReportKind,
  diff_txt: string[];
  topAdded: AstNode[],
  topRemoved: AstNode[],
  added: string[],
  addedNotUsed: string[],
  addedNotFound: string[],
  addedEffects: EffectItem[],
  removed: string[],
  removedStillUsing: string[],
  removedEffects: EffectItem[],
};

const createBlockReport = (kind: BlockReport["kind"]): BlockReport => ({
  kind,
  diff_txt: [],
  topAdded: [],
  topRemoved: [],
  added: [],
  addedNotUsed: [],
  addedNotFound: [],
  addedEffects: [],
  removed: [],
  removedStillUsing: [],
  removedEffects: [],
});

const findOrCreateBlockReport = (blockReports: BlockReport[], kind: BlockReport["kind"], fromHead?: boolean): BlockReport => {
  if (fromHead){
    for(let i = blockReports.length - 1; i >= 0; i--){
      if(blockReports[i].kind === kind){
        return blockReports[i];
      }
    }
  }
  if(blockReports.at(-1)?.kind === kind || (kind === "Other" && blockReports.at(-1)?.kind.startsWith("Other:"))){
    return blockReports.at(-1)!;
  }
  return createBlockReport(kind);
}

type Arg = {
  gitDiffItem: GitDiffDetail,
  absPathPrefix: string,
  blockReports: BlockReport[],
}
export default function codeBlockDetect(arg: Arg){
  const { gitDiffItem, absPathPrefix, blockReports } = arg;
  const { filePath, startLineOfNew, items, startLineOfOld } = gitDiffItem;
  const { mapFileLineToNodeSet, mapUuidToNode } = getAstKitByFilePath(filePath, absPathPrefix);
  const filePathOfOld = join(process.cwd(), '..', 'source', filePath);
  const { mapFileLineToNodeSet: mapFileLineToNodeSetOld } = getAstKitByFilePath(filePathOfOld, absPathPrefix);
  // 当前文件的 根AST
  const programNode = mapUuidToNode.get("Program")!;
  const lineNumberStartNew = Number(startLineOfNew);
  const lineNumberEndNew = lineNumberStartNew + items.filter(item => item.startsWith("+")).length - 1;
  const lineNumberStartOld = Number(startLineOfOld);
  const lineNumberEndOld = lineNumberStartOld + items.filter(item => item.startsWith("-")).length - 1;
  // 获取从 startLineOfNew 到 lineNumberEndNew 的所有 新增的 顶层节点
  const addNodes = AstUtil.getTopScopeNodesByLineNumberRange(mapFileLineToNodeSet, lineNumberStartNew, lineNumberEndNew);
  // 获取从 startLineOfOld 到 lineNumberEndOld 的所有 删除的 顶层节点
  const removeNodes = AstUtil.getTopScopeNodesByLineNumberRange(mapFileLineToNodeSetOld, lineNumberStartOld, lineNumberEndOld);

  iterateNodes(addNodes, "add", { blockReports, programNode });
  iterateNodes(removeNodes, "remove", { blockReports, programNode });
  const lastReport = blockReports.at(-1);
  if(lastReport){
    lastReport.diff_txt = items;
    lastReport.topAdded = addNodes;
    lastReport.topRemoved = removeNodes;
  }
  blockReports.push(createBlockReport('Never'));
};

function getPathsOfNode(topScopeNodes: AstNode[]): string[]{
  const paths = [];
  for (const topScopeNode of topScopeNodes) {
    const nodeCollection = topScopeNode._util.nodeCollection;
    for(const nodeItem of nodeCollection){
      if(nodeItem.type.endsWith("Identifier") || nodeItem.type.endsWith("Literal")){
        paths.push(AstUtil.getNodePath(nodeItem));
      }
    }
  }
  return [...new Set(paths)];
}

function mapNodePath(list: BlockReport['addedEffects']){
  return list.map(item => ({ ...item, effects: item.effects.map(ele => ({ ele, path: AstUtil.getNodePath(ele) })) }))
}

function filterBySamePathAndLen(list:  {effects: {path: string, ele: AstNode}[], causeBy: AstNode}[], sameEffectsPaths: string[]){
  return list.map(e => ({ ...e, effects: e.effects.filter(item => !sameEffectsPaths.includes(item.path))})).filter(e => e.effects.length)
}

function extractEffectItem(list: {effects: {path: string, ele: AstNode}[], causeBy: AstNode}[]){
  return list.map(e => ({ ...e, effects: e.effects.map(item => item.ele) }))
}

function pushBlockReport(blockReports: BlockReport[], blockReport: BlockReport, programNode: AstNode){
  const sameNames = blockReport.added.filter(path => blockReport.removed.includes(path));
  if(sameNames.length){
    (['added', 'removed'] as const).forEach(key => {
      blockReport[key] = blockReport[key].filter(path => !sameNames.includes(path));
    });
  }

  const addedEffectsList = mapNodePath(blockReport.addedEffects);
  const removedEffectsList = mapNodePath(blockReport.removedEffects);
  const addedEffectsPaths = addedEffectsList.map(item => item.effects.map(({ path }) => path)).flat();
  const removedEffectsPaths = removedEffectsList.map(item => item.effects.map(({ path }) => path)).flat();
  const sameEffectsPaths = addedEffectsPaths.filter(path => removedEffectsPaths.includes(path));
  if(sameEffectsPaths.length){
    const addedEffects = filterBySamePathAndLen(addedEffectsList, sameEffectsPaths);
    const removedEffects = filterBySamePathAndLen(removedEffectsList, sameEffectsPaths);

    blockReport.addedEffects = extractEffectItem(addedEffects);
    blockReport.removedEffects = extractEffectItem(removedEffects);
  }
  if(!blockReports.includes(blockReport) && Object.entries(blockReport).filter(e => e[0] !== 'kind').some(e => e[1].length)){
    blockReports.push(blockReport);
  }
};

function iterateNodes(topScopeNodes: AstNode[], operation: "add"|"remove", extra: { blockReports: BlockReport[], programNode: AstNode }){
  for (const topScopeNode of topScopeNodes) {
    // 导入声明处理
    if(["ImportDeclaration", "ImportSpecifier", "ImportDefaultSpecifier"].includes(topScopeNode.type)){
      detectImport({ topScopeNode, operation, extra });
    }
    else if(["VariableDeclaration", "VariableDeclarator"].includes(topScopeNode.type) || AstUtil.isSubNodeOfVariableDeclarator(topScopeNode)){
      detectVariableDeclaration({ topScopeNode, operation, extra });
    }
    else if(["FunctionDeclaration", "ClassDeclaration"].includes(topScopeNode.type)){
      detectFnClsDeclaration({ topScopeNode, operation, extra });
    }

    else if(["UnaryExpression", "UpdateExpression"].includes(topScopeNode.type)){
      detectUpdateEffectExp({ topScopeNode, operation, extra });
    }
    else if(["CallExpression"].includes(topScopeNode.type)){
      detectFnCallExp({ topScopeNode, operation, extra });
    }
    else if(["AssignmentExpression"].includes(topScopeNode.type)){
      detectAssignmentEffectExp({ topScopeNode, operation, extra });
    }
    else if(["ExpressionStatement"].includes(topScopeNode.type)){
      const { expression } = topScopeNode as unknown as { expression: AstNode };
      iterateNodes([expression], operation, extra);
    }
    else {
      detectOther({ topScopeNode, operation, extra });
    }
  }
}

function detectOther(arg: {
  topScopeNode: AstNode,
  operation: "add"|"remove",
  extra: Parameters<typeof iterateNodes>[2],
}){
  const { topScopeNode, operation, extra: { blockReports, programNode } } = arg;
  const blockReport = findOrCreateBlockReport(blockReports, "Other");
  const { added, removed } = blockReport;
  const nodePaths = getPathsOfNode(topScopeNode._util.nodeCollection);
  (operation === 'add' ? added : removed).push(...nodePaths);
  blockReport.kind = ("Other:" + topScopeNode.type) as BlockReport['kind'];
  pushBlockReport(blockReports, blockReport, programNode);
}



function detectImport(arg: {
  topScopeNode: AstNode,
  operation: "add"|"remove",
  extra: Parameters<typeof iterateNodes>[2],
}){
  const { topScopeNode, operation, extra: { blockReports, programNode } } = arg;
  const blockReport = findOrCreateBlockReport(blockReports, "Import");
  const { added, removed, addedEffects, removedEffects } = blockReport;
  const specifiers = topScopeNode.type === "ImportDeclaration" ? (topScopeNode as unknown as { specifiers: AstNode[] }).specifiers : [topScopeNode as AstNode & { local: AstNode }];
  if(Array.isArray(specifiers)){
    specifiers.forEach(s => {
      const { local } = s as AstNode & { local: AstNode };
      (operation === 'add' ? added : removed).push(local.name!);
      (operation === 'add' ? addedEffects : removedEffects).push({ causeBy: local, effects: [...local._util.effectIds] });
    });
  }
  pushBlockReport(blockReports, blockReport, programNode);
}

function detectFnClsDeclaration(arg: {
  topScopeNode: AstNode,
  operation: "add"|"remove",
  extra: Parameters<typeof iterateNodes>[2],
}){
  const { topScopeNode, operation, extra: { blockReports, programNode } } = arg;
  const blockReport = findOrCreateBlockReport(blockReports, "Declaration");
  const { added, removed, addedEffects, removedEffects } = blockReport;
  const { id } = topScopeNode as unknown as { id: AstNode };
  (operation === 'add' ? added : removed).push(id.name!);
  (operation === 'add' ? addedEffects : removedEffects).push({ causeBy: id, effects: [...id._util.effectIds] });
  pushBlockReport(blockReports, blockReport, programNode);
}

function insertPrefix(n: string, prefix: string, sep = ":"){
  return [prefix, n].join(sep);
}

function detectVariableDeclaration(arg: {
  topScopeNode: AstNode,
  operation: "add"|"remove",
  extra: Parameters<typeof iterateNodes>[2],
}){
  const { topScopeNode, operation, extra: { blockReports, programNode } } = arg;
  const blockReport = findOrCreateBlockReport(blockReports, "Declaration");

  const { added, removed, addedEffects, removedEffects } = blockReport;
  if(["VariableDeclaration", "VariableDeclarator"].includes(topScopeNode.type)){
    let declarations: { id: AstNode, init: AstNode }[] = [];
    if(topScopeNode.type === "VariableDeclarator"){
      declarations = [topScopeNode as any];
    }
    else {
      declarations = (topScopeNode as any).declarations;
    }
    if(Array.isArray(declarations)){
      for(const declaration of declarations){
        const { id, init } = declaration;
        if(id){
          id._util.nodeCollection.forEach(item => {
            if(item.type === "Identifier"){
              (operation === 'add' ? added : removed).push(insertPrefix(item.name!, "id"));
              (operation === 'add' ? addedEffects : removedEffects).push({ causeBy: item, effects: [...item._util.effectIds] });
            }
          });
        }
        // 收集等号后边的 表达式涉及的 id 集合
        const initIdSet = new Set<AstNode>();
        if(init && !["ArrowFunctionExpression", "FunctionExpression"].includes(init.type)){
          ["Identifier"].includes(init.type) ? initIdSet.add(init) : AstUtil.deepFindIdOfExpression(init, id => initIdSet.add(id));
          for(const initId of initIdSet){
            operation === 'add' ? blockReport.added.push(insertPrefix(initId.name!, "init")) : blockReport.removed.push(insertPrefix(initId.name!, "init"));
          }
        }
      }
    }
  }
  else {
    topScopeNode._util.nodeCollection.forEach(item => {
      if(item.type === "Identifier"){
        (operation === 'add' ? added : removed).push(insertPrefix(item.name!, "id"));
        (operation === 'add' ? addedEffects : removedEffects).push({ causeBy: item, effects: [...item._util.effectIds] });
      }
    });
  }

  pushBlockReport(blockReports, blockReport, programNode);
}

function detectUpdateEffectExp(arg: {
  topScopeNode: AstNode,
  operation: "add"|"remove",
  extra: Parameters<typeof iterateNodes>[2],
}){
  const { topScopeNode, operation, extra: { blockReports, programNode } } = arg;
  const blockReport = findOrCreateBlockReport(blockReports, "SelfUpdate");
  const { added, removed, addedEffects, removedEffects } = blockReport;
  const { argument: args } = topScopeNode as unknown as { argument: AstNode };
  const createdExpIdSet = new Set<AstNode>();
  AstUtil.deepFindIdOfExpression(args, id => createdExpIdSet.add(id));
  for(const createdExpId of createdExpIdSet){
    (operation === 'add' ? added : removed).push(createdExpId.name!);
    (operation === 'add' ? addedEffects : removedEffects).push({ causeBy: createdExpId, effects: [...createdExpId._util.effectIds] });
  }
  pushBlockReport(blockReports, blockReport, programNode);
}

function detectFnCallExp(arg: {
  topScopeNode: AstNode,
  operation: "add"|"remove",
  extra: Parameters<typeof iterateNodes>[2],
}) {
  const { topScopeNode, operation, extra: { blockReports, programNode } } = arg;
  const blockReport = findOrCreateBlockReport(blockReports, "Invoke");
  const { added, removed, addedEffects, removedEffects } = blockReport;
  const { callee, arguments: args } = topScopeNode as unknown as { callee: AstNode, arguments: AstNode[] };
  const argsIds = args.map(arg => arg._util.nodeCollection.filter(n => n.type === "Identifier")).flat();
  for (const argsId of argsIds) {
    (operation === 'add' ? added: removed).push(argsId.name!);
    (operation === 'add' ? addedEffects : removedEffects).push({ causeBy: argsId, effects: [...argsId._util.effectIds] });
  }

  const createdExpIdSet = new Set<AstNode>();
  AstUtil.deepFindIdOfExpression(callee, id => createdExpIdSet.add(id));
  for(const createdExpId of createdExpIdSet){
    (operation === 'add' ? added: removed).push(createdExpId.name!);
    (operation === 'add' ? addedEffects : removedEffects).push({ causeBy: createdExpId, effects: [...createdExpId._util.effectIds] });
  }
  pushBlockReport(blockReports, blockReport, programNode);
}

function detectAssignmentEffectExp(arg: {
  topScopeNode: AstNode,
  operation: "add"|"remove",
  extra: Parameters<typeof iterateNodes>[2],
}) {
  const {topScopeNode, operation, extra: { blockReports, programNode }} = arg;
  const blockReport = findOrCreateBlockReport(blockReports, "Assignment");
  const {added, removed, addedEffects, removedEffects} = blockReport;
  const {left, right} = topScopeNode as unknown as { left: AstNode, right: AstNode };
  const idSetLeft = new Set<AstNode>();
  ["Identifier"].includes(left.type) ? idSetLeft.add(left) : AstUtil.deepFindIdOfExpression(left, id => idSetLeft.add(id));
  for (const createdExp of idSetLeft) {
    (operation === 'add' ? added : removed).push(insertPrefix(createdExp.name!, "left"));
    (operation === 'add' ? addedEffects : removedEffects).push({ causeBy: createdExp, effects: [...createdExp._util.effectIds] });
  }
  const idSetRight = new Set<AstNode>();
  ["Identifier", "ArrowFunctionExpression", "FunctionExpression"].includes(right.type) ? idSetRight.add(right) : AstUtil.deepFindIdOfExpression(right, id => idSetRight.add(id));
  for (const createdExp of idSetRight) {
    (operation === 'add' ? added : removed).push(insertPrefix(createdExp.name!, "right"));
  }
  pushBlockReport(blockReports, blockReport, programNode);
}