import FileUtil from "../../../../src/util/ast_util/FileUtil";
import { AstUtil } from "../../../../src/util/ast_util/AstKit";
import {AstNode} from "../../../../src/util/ast_util/AstUtil";

const fileContent = `
function run(
firstParams, 
{ 
  [computed]: deconstruction, 
  arrayInObject: [item1], 
  defaultInObject = {}
},
[
  { 
    property: [item2]
  }, 
  defaultInArray = []
], 
...other
){}`;

const mapUuidToNode = new Map<string, AstNode>();
const mapPathToNodeSet = new Map<string, Set<AstNode>>();
const mapFileLineToNodeSet = new Map<number, Set<AstNode>>();

const astResult = FileUtil.parseFile('eg.ts', fileContent);
const astNode: AstNode|null = astResult[1] as any;
if(astNode){
  AstUtil.deepFirstTravel(astNode as any, 'eg.ts', mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet);
  const fn = (astNode as any)?.program?.body[0];
  const names = [...fn._util.holdingIds].map((e: any) => e.name);
  test('collect function params names:', () => {
    expect(names).toEqual(['firstParams', 'deconstruction', 'item1', 'defaultInObject', 'item2', 'defaultInArray', 'other', 'run']);
  });
}