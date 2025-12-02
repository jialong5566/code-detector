import FileUtil from "../../../../src/util/ast_util/FileUtil";
import { AstUtil } from "../../../../src/util/ast_util/AstKit";
import {AstNode} from "../../../../src/util/ast_util/AstUtil";

const fileContent = `
let mutA, mutB;
const singleVariable = test;
const [
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
...other] = test
`;

const mapUuidToNode = new Map<string, AstNode>();
const mapPathToNodeSet = new Map<string, Set<AstNode>>();
const mapFileLineToNodeSet = new Map<number, Set<AstNode>>();

const astResult = FileUtil.parseFile('eg.ts', fileContent);
const astNode: AstNode|null = astResult[1] as any;
if(astNode){
  AstUtil.deepFirstTravel(astNode as any, 'eg.ts', mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet);
  const programNode = (astNode as any)?.program;
  const paramsNames = [...new Set(programNode._util.children.map((c: any) => [...c._util.holdingIds]).flat().map((e: any) => e.name))];

  test('collect variable names:', () => {
    expect(paramsNames).toEqual(['mutA','mutB','singleVariable','firstParams', 'deconstruction', 'item1', 'defaultInObject', 'item2', 'defaultInArray', 'other']);
  });
}