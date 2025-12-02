const fileContent = `<template>
  <div id="app">
    <router-view>{{ desc}}}</router-view>
    <h2>你已经到底了</h2>
  </div>
</template>

<script>
export const a = 1;
export default {
  name: "App",
  data() {
    return {};
  }
};
</script>
<style> 
h2 {
 font-size: 20px;
}
</style>
`;
import FileUtil from "../../../../src/util/ast_util/FileUtil";
import { AstUtil } from "../../../../src/util/ast_util/AstKit";
import {AstNode} from "../../../../src/util/ast_util/AstUtil";
import {extractEffectedExportMemberByLineRange} from "../../../../src/util/report_util/filterEffectedExportMember";



const filePath = 'eg.vue';
const mapUuidToNode = new Map<string, AstNode>();
const mapPathToNodeSet = new Map<string, Set<AstNode>>();
const mapFileLineToNodeSet = new Map<number, Set<AstNode>>();

const astResult = FileUtil.parseFile(filePath, fileContent);
const astNode: AstNode|null = astResult[1] as any;


if(astNode){
  AstUtil.deepFirstTravel(astNode as any, filePath, mapUuidToNode, mapFileLineToNodeSet, mapPathToNodeSet);
  const programNode = (astNode as any);

  test('not found variable names:', () => {
    const names = [...programNode._util.dependenceIds].filter(e => AstUtil.isUntrackedId(e)).map((e: any) => e.name);
    expect(names).toEqual(['desc']);
  });

  test("exported member from line 1 to line 3", () => {
    expect(extractEffectedExportMemberByLineRange(mapFileLineToNodeSet, 1, 3, filePath)).toEqual(['default'])
  });

  test("exported member from line 9 to line 9", () => {
    expect(extractEffectedExportMemberByLineRange(mapFileLineToNodeSet, 9, 9, filePath)).toEqual(['a'])
  });

  test("exported member from line 10 to line 10", () => {
    const names = extractEffectedExportMemberByLineRange(mapFileLineToNodeSet, 10, 10, filePath);
    expect(names).toEqual(['default'])
  });
  test("exported member from line 17 to line 18", () => {
    const names = extractEffectedExportMemberByLineRange(mapFileLineToNodeSet, 17, 18, filePath);
    expect(names).toEqual(['default'])
  });
}