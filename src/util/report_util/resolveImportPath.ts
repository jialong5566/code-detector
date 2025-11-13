/**
 * 通用路径拼接函数
 * 替代Node.js的path.join，适用于所有环境
 */
function joinPath(...paths: string[]) {
  // 处理绝对路径标记（/或\）
  const isAbsolute = paths.some(path =>
      path.startsWith('/') || path.startsWith('\\') ||
      (path.length >= 2 && path[1] === ':') // 处理Windows路径如C:
  );

  // 合并所有路径片段并规范化分隔符
  let joined = paths
      .filter(Boolean) // 过滤空值
      .join('/')
      .replace(/[\\/]+/g, '/'); // 统一使用/作为分隔符

  // 如果是绝对路径且在Windows系统上，确保驱动器号后的正确格式
  if (isAbsolute && joined.length >= 2 && joined[1] === ':') {
    joined = joined[0] + ':' + joined.slice(2);
  }

  // 处理路径中的.和..
  const segments = joined.split('/');
  const result = [];

  for (const segment of segments) {
    if (segment === '.') continue;
    if (segment === '..') {
      if (result.length && result[result.length - 1] !== '..') {
        result.pop();
      } else if (!isAbsolute) {
        result.push('..');
      }
    } else {
      result.push(segment);
    }
  }

  // 重建路径
  let finalPath = result.join('/');

  // 保持绝对路径特性
  if (isAbsolute && !finalPath.startsWith('/') && !(finalPath.length >= 2 && finalPath[1] === ':')) {
    finalPath = '/' + finalPath;
  }

  return finalPath;
}

/**
 * 获取目录路径
 * 替代Node.js的path.dirname
 */
function getDirName(filePath: string) {
  const normalized = filePath.replace(/[\\/]+/g, '/');
  const lastSlashIndex = normalized.lastIndexOf('/');

  // 没有找到斜杠，返回当前目录
  if (lastSlashIndex === -1) return '.';

  // 处理根目录情况
  if (lastSlashIndex === 0) {
    // 对于/root这种形式，返回/
    return normalized[0] === '/' ? '/' : '.';
  }

  return normalized.slice(0, lastSlashIndex);
}

/**
 * 解析导入路径为全路径，支持相对路径
 * @param {Object} alias - 路径别名配置对象
 * @param {string} importPath - 导入路径
 * @param {string} currentFilePath - 当前文件的绝对路径（已处理）
 * @param {string[]} [extensions=['.js', '.ts', '.jsx', '.tsx']] - 可能的文件扩展名
 * @returns {Object} 包含全路径和是否为外部路径的对象
 */
export default function resolveImportPath(alias: Record<string, string>, importPath: string, currentFilePath: string, extensions = ['.js', '.ts', '.jsx', '.tsx']) {
  // 处理相对路径
  if (importPath.startsWith('.')) {
    // 获取当前文件所在的目录
    const currentDir = getDirName(currentFilePath);
    // 计算相对路径对应的绝对路径
    const absolutePath = joinPath(currentDir, importPath);

    // 生成可能的全路径（带扩展名和index文件）
    const possiblePaths: string[] = [absolutePath];

    // 添加带扩展名的路径
    extensions.forEach(ext => {
      possiblePaths.push(`${absolutePath}${ext}`);
    });

    // 添加index文件路径
    extensions.forEach(ext => {
      possiblePaths.push(joinPath(absolutePath, `index${ext}`));
    });

    return {
      fullPath: possiblePaths,
      isExternal: false
    };
  }

  // 检查是否为外部路径（不匹配任何alias）
  const isExternal = !Object.keys(alias).some(aliasKey => {
    // 处理带$的精确匹配（如dva$）
    if (aliasKey.endsWith('$')) {
      return importPath === aliasKey.slice(0, -1);
    }
    // 检查路径是否以别名开头且后面是/或路径结束
    return importPath === aliasKey || importPath.startsWith(`${aliasKey}/`);
  });

  if (isExternal) {
    return {
      fullPath: null,
      isExternal: true
    };
  }

  // 找到匹配的alias
  let matchedAlias: string|null = null;
  let matchedKey = '';

  // 优先匹配精确匹配（带$的）
  Object.entries(alias).forEach(([key, value]) => {
    if (key.endsWith('$') && importPath === key.slice(0, -1)) {
      matchedAlias = value;
      matchedKey = key.slice(0, -1);
    }
  });

  // 如果没有找到精确匹配，找前缀匹配
  if (!matchedAlias) {
    Object.entries(alias).forEach(([key, value]) => {
      if (!key.endsWith('$') && (importPath === key || importPath.startsWith(`${key}/`))) {
        matchedAlias = value;
        matchedKey = key;
      }
    });
  }

  // 构建基础路径
  let basePath: string|null;
  if (importPath === matchedKey) {
    basePath = matchedAlias;
  } else {
    const relativePath = importPath.slice(matchedKey.length + 1);
    basePath = joinPath(matchedAlias!, relativePath);
  }

  // 生成可能的全路径（带扩展名和index文件）
  const possiblePaths: string[] = [basePath!];

  // 添加带扩展名的路径
  extensions.forEach(ext => {
    possiblePaths.push(`${basePath}${ext}`);
  });

  // 添加index文件路径
  extensions.forEach(ext => {
    possiblePaths.push(joinPath(basePath!, `index${ext}`));
  });

  return {
    fullPath: possiblePaths,
    isExternal: false
  };
}