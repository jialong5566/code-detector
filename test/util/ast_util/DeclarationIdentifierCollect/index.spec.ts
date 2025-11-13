import FileUtil from "../../../../src/util/ast_util/FileUtil";
import { AstUtil } from "../../../../src/util/ast_util/AstKit";
import {AstNode} from "../../../../src/util/ast_util/AstUtil";

const fileContent = `
function fn(){
}
class cls{}
enum EnumDec {
    NONE = 'NONE',
    SQL = 'SQL',
    INPUT = 'INPUT',
    QUERY = 'QUERY',
    LIST = 'LIST',
    MEMBER = 'MEMBER',
}
interface Itf {
  A: V
}
type Tp = {};
export function fnExport(){}
export default function(){}
export class clsExport{}
const mutA = 1;
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
  const names = [...programNode._util.holdingIds].map((e: any) => e.name);
  test('collect variable names:', () => {
    expect(names).toEqual(['fn', 'cls', 'EnumDec', 'Itf', 'Tp', 'fnExport', 'clsExport','mutA','mutB']);
  });
}