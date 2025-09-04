# js-code-detector

## 说明
- 重复代码检测工具, 支持 React、Vue 项目
- git分支对比报告, 目前适用于 umi4.x 版本的项目


## 重复代码检测使用
- 项目安装 **js-code-detector**
- package.json 中添加 scripts 命令 ```sameCodeDetect```, 例如：```"same": "sameCodeDetect"```
- 执行该命令可在当前项目目录下生成报告, ```npm run same```

## git分支对比报告使用
- 项目安装 **js-code-detector**
- package.json 中添加 scripts 命令 ```gitDiffDetect```, 例如：```"detect": "gitDiffDetect"```
- 执行该命令可在当前项目目录下生成报告, ```npm run detect```

## 重复代码检测报告说明
1.所有相似的代码片段为一组，每组有2个及以上的代码片段
2.每组代码片段都有对应的文件路径，以及所在的行范围


## git分支对比报告说明
- 文件路径
- 改动类型 add remove modify
- 依赖当前文件的文件
- 危险标识符（包括 1、找不到定义的， 2、函数的参数是一个函数，并进行调用的）
- 区块报告（每个diff块产生一个报告）
  - 区块类型，目前把重点的类型单独提取处理，包括 "Import"|"Declaration"|"Assignment"|"SelfUpdate"|"Invoke"
  - 区块的原始改动内容
  - 增加的标识符
  - 增加的标识符的影响
    - 增加的标识符的来源
    - 影响到的标识符的位置


## LICENSE

MIT
