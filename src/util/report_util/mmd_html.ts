import {writeFileSync} from "fs";

export default function mmd_html(filePath: string, mmd_content: string){
    const content = `<!doctype html>
<html lang="en">
<body>
<pre class="mermaid">
${mmd_content}
</pre>
<script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
</script>
</body>
</html>`
    writeFileSync(filePath, content);
}