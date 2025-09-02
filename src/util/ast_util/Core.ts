import {range} from 'lodash-es';
import FileUtil, {extensions, FileSegment, MapFilePathToDetail} from "./FileUtil";
import AstFeatUtil, {AstFeatNode, MapHashKeyToAstNodeSet} from "./AstFeatUtil";

export default class Core {
  static createMarkdownFile(result: { list: { content: string, location: string }[], hashKey: string }[]){
    let str = "# 共找到" + result.length + "组相似内容\n";
    result.forEach((item, i) => {
      const { list, hashKey } = item;

      const depth = hashKey.split(":")[0];
      str += `## 第${i + 1}组, 共${ list.length}段, 匹配深度 ${depth}\n`;
      list.forEach(({ content, location }, index) => {
        const filepath = location.split(/\s+/)[0];
        let ext = extensions.find(e => filepath.includes(e));
        ext = ext?.slice(1)||''
        str += `### 第${index + 1}段\n> ${location}\n\`\`\`${ext}\n${content}\n\`\`\`\n\n`;
      });
    });
    return str;
  }
  static investigate(fileList: FileSegment[]){
    const mapFilePathToDetail = FileUtil.createMapFilePathToDetail(fileList);
    const [mapHashKeyToTopLevelNode, nodeTypeSet, errorList] = this.createMapHashKeyToAstNodeSet(fileList);
    const { nodeGroupList } = this.getListOfNodeGroup(mapHashKeyToTopLevelNode);
    const nodeContentGroupList = this.getListOfGroup(mapFilePathToDetail, nodeGroupList);
    return {
      errorList,
      nodeTypeSet,
      nodeContentGroupList,
      nodeGroupList,
      countList: nodeContentGroupList.map(e => e.nodeCount).sort((a, b) => a - b),
      depthList: nodeContentGroupList.map(e => e.depth).sort((a, b) => b - a)
    };
  }

  static getFileContentByLine(map: MapFilePathToDetail, filePath: string, start: number, end: number){
    const fixedStart = Math.max(start - 1, 0);
    const content = map.get(filePath)!.lines.slice(fixedStart, end ).join("\n");
    const location =  `${filePath}: from line ${start} to line ${end}`;
    return { location, content };
  }

  static getListOfGroup(mapFilePathToDetail: MapFilePathToDetail, validFullNodeList: ReturnType<typeof Core.getListOfNodeGroup>['nodeGroupList']){
    const listOfGroup:  {
      list: { astNode: AstFeatNode,location: string, content: string }[],
      listOfNodeInfo: (typeof validFullNodeList)[number]["listOfNodeInfo"],
      nodeCount: number,
      depth: number,
      hashKey: string
    }[] = [];
    const locationStrSet = new Set();
    for (const item of validFullNodeList) {
      const { listOfNodeInfo } = item;
      const newList = listOfNodeInfo.map(({ rootNode, edgeNodeCollection }) => {
        const { filePath, startLine, endLine } = rootNode._util;
        const linesNums = range(startLine, endLine + 1);
        const edgeNodesLines: number[] = edgeNodeCollection.map(edgeNode => {
          const { startLine: itemStartLine, endLine: itemEndLine } = edgeNode._util;
          // todo
          if(itemStartLine === startLine || itemEndLine === endLine){
            return [];
          }
          return (itemStartLine + 1 >= itemEndLine) ? [] : range(itemStartLine + 1, itemEndLine);
        }).flat();
        const listOfRatedContent: { linesNums: number[], lines: string[], rate: number }[] = [
          {
            linesNums: [],
            lines: [],
            rate: 0
          }
        ];
        const lines = mapFilePathToDetail.get(filePath)?.lines || [];

        if(edgeNodesLines.length > 0){
          for (let i = startLine; i <= endLine; i++) {
            const flag = edgeNodesLines.includes(i);
            const rate = flag ? 1 : 0;
            let lastRatedContent = listOfRatedContent[listOfRatedContent.length - 1];
            if(lastRatedContent.rate !== rate){
              listOfRatedContent.push(lastRatedContent = {
                linesNums: [],
                lines: [],
                rate
              });
            }
            lastRatedContent.lines.push(lines[i - 1]);
            lastRatedContent.linesNums.push(i);
          }
        }
        else {
          listOfRatedContent.push({ linesNums, lines: lines.slice(Math.max((startLine - 1), 0), endLine), rate: 0 })
        }
        const { location, content } = this.getFileContentByLine(mapFilePathToDetail, filePath, startLine, endLine);
        return { location, content, astNode: rootNode, listOfRatedContent };
      });
      const locationStr = newList.map(e => e.location).join();
      if(!locationStrSet.has(locationStr)){
        locationStrSet.add(locationStr);
        const { nodeCount, depth, hashKey, listOfNodeInfo } = item;
        listOfGroup.push({
          nodeCount,
          depth,
          hashKey,
          listOfNodeInfo,
          list: newList
        });
      }
    }
    return listOfGroup;
  }

  static createMapHashKeyToAstNodeSet(fileList: FileSegment[]){
    const mapHashKeyToTopLevelNode: MapHashKeyToAstNodeSet = new Map();
    const nodeTypeSet = new Set<string>();
    const errorList: string[] = [];
    fileList.forEach(file => {
      const { filePath, fileContent } = file;
      const [errorMsg, parsedNode] = FileUtil.parseFile(filePath, fileContent);
      if(parsedNode){
        AstFeatUtil.deepFirstTravel(parsedNode as any, {
          mapHashKeyToTopLevelNode,
          nodeTypeSet
        }, filePath);
      }
      else if(errorMsg) {
        errorList.push(errorMsg)
      }
    });

    AstFeatUtil.deleteSameSubSetPartial(mapHashKeyToTopLevelNode);
    return [mapHashKeyToTopLevelNode, nodeTypeSet, errorList] as const;
  }

  static getListOfNodeGroup(mapHashKeyToNodeSet: MapHashKeyToAstNodeSet){
    const nodeGroupList: {
      list: AstFeatNode[],
      listOfNodeInfo: ReturnType<typeof AstFeatUtil.spreadSubNode>,
      nodeCount: number,
      depth: number,
      hashKey: string
    }[] = [];
    const countPartialSet = new Set<number>();
    const depthSet = new Set<number>();
    for (const [hashKey, nodeSet] of mapHashKeyToNodeSet) {
      // 相似片段 最少 2个
      if(nodeSet.size < 2){
        continue;
      }
      const baseNode = [...nodeSet][0];
      let nodeCount = 0;
      const index = hashKey.indexOf(":");
      const depth = Number(hashKey.slice(0, index));
      depthSet.add(depth);
      const baseDepth = baseNode._util.depth;
      nodeCount = baseNode._util.nodeCollection.filter(n => (n._util.depth - baseDepth) <= depth).length;
      countPartialSet.add(nodeCount);

      const listOfNodeInfo = AstFeatUtil.spreadSubNode(nodeSet, depth);

      nodeGroupList.push({
        list: [...nodeSet],
        listOfNodeInfo,
        nodeCount,
        depth,
        hashKey
      });
    }

    const countList = [...countPartialSet].sort((a, b) => a - b);
    const depthList = [...depthSet].sort((a, b) => a - b)
    return {
      nodeGroupList,
      countList,
      depthList
    };
  }
};