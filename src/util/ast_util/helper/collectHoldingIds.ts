import { AstNode } from "../AstUtil";
import {EXPORT_DECLARATION_TYPES, FUNCTION_TYPES } from "../SHARED_CONSTANTS";
import collectDeclarationIdentifiers from "./collectDeclarationIdentifiers";
import collectImportDeclarationIdentifiers from "./collectImportDeclarationIdentifiers";
import collectVariableDeclarationIdentifiers from "./collectVariableDeclarationIdentifiers";
import deepSearchParamsIdentifier from "./deepSearchParamsIdentifier";

export default function collectHoldingIds(node: AstNode & { body: AstNode|null}){
  // 持有的 identifier ： fn的参数、导入声明、其他声明
  const { holdingIds, holdingIdNameMap } = node._util;
  if(FUNCTION_TYPES.includes(node.type)){
    // fn的参数
    const { params, id } = node as unknown as { params: AstNode[], id: AstNode|null };
    if(Array.isArray(params) && params.length > 0){
      params.forEach(param => deepSearchParamsIdentifier(param, id => {
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
  collectImportDeclarationIdentifiers(node, id => {
    holdingIds.add(id);
    id._util.variableScope = [id];
    id._util.holdingIdType = "Import";
  });
  // body 是 BlockStatement 或者 Program， 遍历 body 的子节点
  if(["BlockStatement", "Program"].includes(node.type)){
    const body = (node as unknown as { body: AstNode[] }).body;
    Array.isArray(body) && body.forEach(bodyChild => {
      // 变量声明
      collectVariableDeclarationIdentifiers(bodyChild, id => {
        holdingIds.add(id);
        id._util.variableScope = [id];
        id._util.holdingIdType = "Variable";
      });
      // 函数、类、枚举、接口、类型别名声明
      if(EXPORT_DECLARATION_TYPES.includes(bodyChild.type as any)){
        collectDeclarationIdentifiers(bodyChild, id => {
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
            collectVariableDeclarationIdentifiers(declaration, id => {
              holdingIds.add(id);
              id._util.variableScope = [id];
              id._util.holdingIdType = "Variable";
            });
          }
          else{
            collectDeclarationIdentifiers(declaration, id => {
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