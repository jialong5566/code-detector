import * as babelParse from "@babel/parser";
import * as vueParse from "vue-eslint-parser";
import {AstFeatNode} from "./AstFeatUtil";
import fs from "fs";


export const extensionsOfJs = ['.js', '.jsx', '.ts', '.tsx'];
export const extensions = [...extensionsOfJs, '.vue'];

export type MapFilePathToDetail = Map<string, FileSegment & { lines: string[] }>

const commonParsePlugins: any = [
  'jsx',
  'typescript',
  'asyncDoExpressions',
  'decimal',
  'decorators',
  'decoratorAutoAccessors',
  'deferredImportEvaluation',
  'destructuringPrivate',
  'doExpressions',
  'explicitResourceManagement',
  'exportDefaultFrom',
  'functionBind',
  'functionSent',
  'importAttributes',
  'importReflection',
  'moduleBlocks',
  ['optionalChainingAssign', {
    version: '2023-07'
  }],
  'partialApplication',
  ['pipelineOperator', {
    proposal: 'hack',
    topicToken: "^^",
  }],
  'recordAndTuple',
  'sourcePhaseImports',
  'throwExpressions',
];

export type FileSegment = {
  filePath: string;
  fileContent: string;
};
export default class FileUtil {
  static parseVue(filePath: string, fileContent: string){
    return vueParse.parse(fileContent, {
      vueFeatures: {
        styleCSSVariableInjection: false,
        filter: false
      },
      parser: {
        parse: (...arg: any[]) => {
          // @ts-ignore
          const ast = babelParse.parse(...arg);
          return ast.program;
        }
      },
      range: true,
      ranges: true,
      sourceType: 'module', // 指定源代码类型，这里是模块
      filePath,
      ecmaVersion: "latest",
      "ecmaFeatures": {
        "globalReturn": true,
        "impliedStrict": true,
        "jsx": true,
        "tsx": true
      },
      plugins: commonParsePlugins
    });
  }

  static parseJsxLike(filePath: string, fileContent: string){
    return babelParse.parse(fileContent, {
      ranges: true,
      allowReturnOutsideFunction: true,
      allowImportExportEverywhere: true,
      sourceType: 'module',
      sourceFilename: filePath,
      plugins: commonParsePlugins
    });
  }

  static createMapFilePathToDetail(list: FileSegment[]): MapFilePathToDetail{
    return new Map(list.map(({ filePath, fileContent}) => {
      const lines = fileContent.split("\n");
      return [
          filePath,
        {
          lines,
          filePath,
          fileContent,
        }
      ];
    }));
  }

  static parseFile(filePath: string, fileContent: string): [string, Omit<AstFeatNode, '_util'>|null]{
    try {
      if(filePath.endsWith('.vue')){
        return ["", this.parseVue(filePath, fileContent)];
      }
      else if(extensionsOfJs.some(ext => filePath.endsWith(ext))){
        return ["", this.parseJsxLike(filePath, fileContent)];
      }
    }
    catch (e) {
      // @ts-ignore
      return [filePath + "解析AST出错: " + e.message, null]
    }

    return ["", null];
  }

  static getASTByFilePath(filePath: string){
    const existFlag = fs.existsSync(filePath);
    if(existFlag){
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return this.parseFile(filePath, fileContent)[1];
    }
    console.warn("文件不存在: " + filePath);
    return null;
  }
}