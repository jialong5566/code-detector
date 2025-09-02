# js-code-detector

[![NPM version](https://img.shields.io/npm/v/code-detector.svg?style=flat)](https://npmjs.com/package/code-detector)
[![NPM downloads](http://img.shields.io/npm/dm/code-detector.svg?style=flat)](https://npmjs.com/package/code-detector)

## Install

```bash
$ yarn install
```

```bash
$ npm run dev
$ npm run build
```

## 说明

包用于检测项目当前分支 与 master分支的差异，并出具报告，展示代码改动的影响
目前适用于 umi4.x 版本的项目

## 使用

1.项目安装 **js-code-detector**
2.package.json 中添加 scripts 命令 ```detect```
3.执行该命令可在当前项目目录下生成报告

## 报告说明
- filePath 文件路径
- type 改动类型 add remove modify
- filesDependsOnMe 依赖当前文件的文件
- dangerIdentifiers 危险标识符（包括 1、找不到定义的， 2、函数的参数是一个函数，并进行调用的）
- blockReports 区块报告（每个diff块产生一个报告）
  - kind 区块类型，目前把重点的类型单独提取处理，包括 "Import"|"Declaration"|"Assignment"|"SelfUpdate"|"Invoke"
  - diff 区块的原始改动内容
  - added 增加的标识符
  - addedEffects 增加的标识符的影响
    - causeBy 增加的标识符的来源
    - effects 影响到的标识符的位置


## LICENSE

MIT
