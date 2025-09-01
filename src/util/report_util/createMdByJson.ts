import {createDetectReport, DetectReport} from "../report_util";

const mapReportType: Record<DetectReport["type"], string> = {
  modify: '修改',
  add: '新增',
  delete: '删除'
};


export function createMdByJson(report: ReturnType<typeof createDetectReport>){
  return report.map(reportItemToMd).join('\n\n\n');
}

function reportItemToMd(report: ReturnType<typeof createDetectReport>[number]){
  const { filePath, filesDependsOnMe, type, dangerIdentifiers, blockReports } = report;
  return [
      `## ${filePath}`,
      `- 类型: ${mapReportType[type]}`,
      filesDependsOnMe.length > 0 ? `- 依赖${filePath}的文件` : '',
      ...filesDependsOnMe.map((file, i) => `${i + 1}. ${file}`),
      dangerIdentifiers.length > 0 ? `- 重点检查使用的变量` : '',
      dangerIdentifiers.length > 0 ? `> ${dangerIdentifiers.join(', ')}` : '',
      blockReports.length > 0 ? `### 代码块分析` : '',
      ...blockReports.map(blockReportToMd),
  ].filter(Boolean).join("\n\n");
}

function blockReportToMd(block: ReturnType<typeof createDetectReport>[number]['blockReports'][number]){
  const {
    kind,
    diff_txt,
    added,
    addedEffects,
    removed,
    removedEffects,
  } = block;
  return [
      `#### 修改分类: ${kind}`,
      `- 原始diff内容`,
      `\`\`\`txt\n${diff_txt.join('\n')}\n\`\`\``,
      added.length > 0 ? `- 新增标识符` : '',
      added.length > 0 ? `> ${added.join(', ')}` : '',
      addedEffects.length > 0 ? `- 新增标识符影响` : '',
      addedEffects.map(({ causeBy, effects}) => `> ${causeBy}相关: ${effects.join()}`).join('\n\n'),
      removed.length > 0 ? `- 删除标识符` : '',
      removed.length > 0 ? `> ${removed.join(', ')}` : '',
      removedEffects.length > 0 ? `- 删除标识符影响` : '',
      removedEffects.map(({ causeBy, effects}) => `> ${causeBy}相关: ${effects.join()}`).join('\n\n'),
  ].filter(Boolean).join("\n\n");
}