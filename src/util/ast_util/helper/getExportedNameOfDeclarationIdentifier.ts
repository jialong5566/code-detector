import {AstNode} from "../AstUtil";

export default function getExportedNameOfDeclarationIdentifier(id: AstNode){
  const occupationInExport = [...id._util.occupation].filter(op => (["ExportSpecifier", "ExportDefaultDeclaration"] as any[]).includes(op._util.parent?.type));
  for (const op of occupationInExport) {
    const occupationParentType = op._util.parent?.type;
    if(occupationParentType === "ExportSpecifier"){
      return (op._util.parent as any).exported.name;
    }
    if(occupationParentType === "ExportDefaultDeclaration"){
      return "default";
    }
  }
}