import {RelateUsageOfExport} from "../ast_util/helper/findRelateUsageOfExport";

export default function create_mmd(relatedExportUsage: RelateUsageOfExport[]){
    const fileList = relatedExportUsage.map(item => [item.filePath, ...item.importMemberAndFile.map(e => e.fromFile)]).flat();
    const fileListStr = fileList.join("\n");
    const linkList = relatedExportUsage.map(item => item.importMemberAndFile.map(e => `${e.fromFile} --> |${e.localName}>>>${item.exportMember}|${item.filePath}`)).flat();
    const linkListStr = linkList.join("\n");
    return `graph TD` + "\n" + fileListStr + "\n" + linkListStr;
}