import {AstNode} from "../AstUtil";

export default function getTopScopeNodesByLineNumberRange(mapFileLineToNodeSet: Map<number, Set<AstNode>>, lineNumberStart: number, lineNumberEnd: number, loose = false){
  const nodeSet = new Set<AstNode>();
  for (let i = lineNumberStart; i <= lineNumberEnd; i++) {
    const astNode = mapFileLineToNodeSet.get(i);
    if(!astNode){
      continue;
    }
    let added = false;
    for(const nodeItem of astNode){
      const { startLine, endLine } = nodeItem._util;
      if(startLine >= lineNumberStart && endLine <= lineNumberEnd){
        if(!["File", "Program"].includes(nodeItem.type)){
          nodeSet.add(nodeItem);
        }
        added = true;
      }
    }
    if(!added && loose){
      const firstNode = [...astNode][0];
      if(!["File", "Program"].includes(firstNode.type)){
        nodeSet.add(firstNode);
      }
    }
  }
  const collections = [...nodeSet].map(e => e._util.nodeCollection).flat();
  return [...nodeSet].filter(e => !collections.includes(e));
}