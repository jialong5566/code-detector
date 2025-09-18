import {createDetectReport, DetectReport} from "../report_util";

const mapReportType: Record<DetectReport["type"], string> = {
  modify: '修改',
  add: '新增',
  delete: '删除'
};


export function createMdByJson(report: ReturnType<typeof createDetectReport>){
  const allFiles =  `# 文件汇总\n${report.map(r => `- ${r.filePath}`).join('\n')}\n\n`;
  return allFiles + report.map(reportItemToMd).join('\n\n\n');
}

function reportItemToMd(report: ReturnType<typeof createDetectReport>[number]){
  const { filePath, filesDependsOnMe, type, dangerIdentifiers, undefinedIdentifiers, blockReports } = report;
  return [
      `## ${filePath}`,
      `### 类型: ${mapReportType[type]}`,
      filesDependsOnMe.length > 0 ? `### 所影响的文件(重要性由高到低)\n${filesDependsOnMe.map((files, index) =>files.map(file =>("  ").repeat(index) + `- ${file}`)).flat().join('\n')}` : '',
      undefinedIdentifiers.length > 0 ? `### 未定义的变量\n> ${undefinedIdentifiers.map(e => `**${e}**`).join(', ')}` : '',
      dangerIdentifiers.length > 0 ? `### 重点检查使用的变量\n> ${dangerIdentifiers.join(', ')}` : '',
      blockReports.length > 0 ? `### 对比分析 共${blockReports.length}处` : '',
      ...blockReports.map(blockReportToMd),
  ].filter(Boolean).join("\n\n");
}

function blockReportToMd(block: ReturnType<typeof createDetectReport>[number]["blockReports"][number], index: number){
  const {
    diff_txt,
    infos
  } = block;
  return [
    `### 对比${index + 1}分析`,
    `- 原始diff内容\n\`\`\`txt\n${diff_txt.join('\n')}\n\`\`\``,
    ...infos.map(blockReportInfoItemToMd),
  ].filter(Boolean).join("\n\n");
}

function blockReportInfoItemToMd(info: ReturnType<typeof createDetectReport>[number]["blockReports"][number]["infos"][number], index: number){
  const {
    causeBy,
    effects
  } = info;
  return [
    `#### 序号${index + 1}`,
    effects.length > 0 ? `#### ${causeBy}\n- 影响：\n${effects.map(e => `> ${e}`).join('\n')}` : '',
  ].filter(Boolean).join("\n\n");
}