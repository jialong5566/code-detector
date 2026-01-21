export default function findNoMatchExportMember(import2export: Record<string, string>, export2export: Record<string, string>, uselessImportMembers: string[]){
  const missingExportOfImport = Object.entries(import2export).filter(([, ele]) => ele.startsWith('src/') && !ele.endsWith('#*') && !export2export[ele]);
  return missingExportOfImport.map(([importFileAndMember, exportFileAndMember]) => {
    return {
      file: importFileAndMember.split('#')[0],
      member: importFileAndMember.split('#')[1],
      useless: uselessImportMembers.includes(importFileAndMember),
      from: {
        file: exportFileAndMember.split('#')[0],
        member: exportFileAndMember.split('#')[1],
      }
    };
  });
}