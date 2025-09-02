import {AST_NODE_FEATURE_LEVEL} from "./featureLevel";
import {AstFeatNode} from "../ast_util/AstFeatUtil";

export const astNodeFeatureExtractorMap = new Map([
  [
    AST_NODE_FEATURE_LEVEL.LOOSE,
    (a: AstFeatNode): string => a.type
  ],
  [
    AST_NODE_FEATURE_LEVEL.NORMAL,
    (n: AstFeatNode): string => {
      if(typeof n.name === 'object'){
        return n.type + ":" + n.name.name
      }
      else if(typeof n.name === 'string'){
        return n.type + ":" + n.name;
      }
      return n.type;
    }
  ],
  [
    AST_NODE_FEATURE_LEVEL.EXACT,
    (n: AstFeatNode): string => {
      if(typeof n.name === 'object'){
        return n.type + ":" + n.name.name
      }
      else if(typeof n.name === 'string'){
        return n.type + ":" + n.name;
      }
      else if(n.extra && "raw" in n.extra){
        return n.type + ':' + n.extra.raw;
      }
      return n.type;
    }
  ]
]);