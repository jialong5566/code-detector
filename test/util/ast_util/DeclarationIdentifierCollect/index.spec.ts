import FileUtil from "../../../../src/util/ast_util/FileUtil";
import { AstUtil } from "../../../../src/util/ast_util/AstKit";
import {AstNode} from "../../../../src/util/ast_util/AstUtil";

const fileContent = `
import React, { useRef as Ref } from "./react";
import  * as All from "react";
export function fnExport(){}
export default function(){}
function fn(){
}
class cls{}
export class clsExport{}
export enum EnumDecExport {
    NONE = 'NONE',
    SQL = 'SQL',
    INPUT = 'INPUT',
    QUERY = 'QUERY',
    LIST = 'LIST',
    MEMBER = 'MEMBER',
}
enum EnumDec {
    NONE = 'NONE',
    SQL = 'SQL',
    INPUT = 'INPUT',
    QUERY = 'QUERY',
    LIST = 'LIST',
    MEMBER = 'MEMBER',
}
export interface ItfExport {
  A: V
}
interface Itf {
  A: V
}
export type TpExport = {};

type Tp = {};

const mutA = 1;
export { mutA as mutB };
const mutB = 2;
`;

const mapUuidToNode = new Map<string, AstNode>();
const mapPathToNodeSet = new Map<string, Set<AstNode>>();
const mapFileLineToNodeSet = new Map<number, Set<AstNode>>();

const astResult = FileUtil.parseFile('eg.ts', fileContent);
const astNode: AstNode|null = astResult[1] as any;
if(astNode){
  AstUtil.deepFirstTravel(astNode as any, 'eg.ts', mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet);
  const programNode = (astNode as any)?.program;
  const names = [...new Set(programNode._util.children.map((c: any) => [...c._util.holdingIds]).flat().map((e: any) => e.name))];
  test('collect variable names:', () => {
    expect(names.sort()).toEqual(['React', 'Ref','All','fn','fnExport', 'cls',  'clsExport','EnumDec', 'EnumDecExport', 'Itf', 'ItfExport', 'Tp', 'TpExport', 'mutA','mutB'].sort());
  });
}