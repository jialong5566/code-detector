import FileUtil from "../../../../src/util/ast_util/FileUtil";
import { AstUtil } from "../../../../src/util/ast_util/AstKit";
import {AstNode} from "../../../../src/util/ast_util/AstUtil";

const fileContent = `
import React, { useRef as Ref } from "./react";
import  * as All from "react";
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
...other] = test;
const obj = {
  [computed]: test,
  shorthand,
};
const element = <div {...props} style={styleObject}>
  <Select>{children}</Select>
</div>

export { mutA as MUT_A, mutB };
`;

const mapUuidToNode = new Map<string, AstNode>();
const mapPathToNodeSet = new Map<string, Set<AstNode>>();
const mapFileLineToNodeSet = new Map<number, Set<AstNode>>();

const astResult = FileUtil.parseFile('eg.ts', fileContent);
const astNode: AstNode|null = astResult[1] as any;
if(astNode){
  AstUtil.deepFirstTravel(astNode as any, 'eg.ts', mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet);
  const programNode = (astNode as any)?.program;
  const names = [...programNode._util.dependenceIds].map((e: any) => e.name);
  const singleVariable = [...programNode._util.holdingIds].find((e: any) => e.name === 'singleVariable')?._util.parent;
  if(singleVariable){
    console.log(singleVariable.type, [...singleVariable._util.dependenceIds].map((e: any) => AstUtil.getShortNodeMsg(e)));
  }

  test('collect variable names:', () => {
    expect([...new Set(names)]).toEqual(['test', 'computed', 'shorthand', 'props', 'styleObject', 'Select','children', 'mutA', 'mutB']);
  });
}