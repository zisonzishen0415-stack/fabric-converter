// 打包 Windows 单文件 exe
// 用法：node tools/build-exe.mjs   （或 npm run build:exe）
// 依赖：Windows 自带的 .NET Framework 4.x 编译器（csc.exe），无网络、无 npm 依赖
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const w = (p) => join(ROOT, p);

const CANDIDATES = [
  'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe',
  'C:/Windows/Microsoft.NET/Framework/v4.0.30319/csc.exe',
];
const csc = CANDIDATES.find(existsSync);
if (!csc) {
  console.error('找不到 csc.exe（.NET Framework 4.x），无法打包 exe。');
  process.exit(1);
}

// 1. 图标（没有就现生成）
if (!existsSync(w('tools/app.ico'))) {
  execFileSync(process.execPath, [w('tools/icon.mjs')], { stdio: 'inherit' });
}

// 2. 校验页面自检通过
execFileSync(process.execPath, [w('test/check.mjs')], { stdio: 'inherit' });

// 3. 编译（先输出 ASCII 名，再改名为中文名，避免控制台编码问题）
mkdirSync(w('dist'), { recursive: true });
const ascii = w('dist/FabricConverter.exe');
execFileSync(csc, [
  '/nologo', '/codepage:65001', '/target:winexe', '/optimize+', '/platform:anycpu',
  '/win32icon:' + w('tools/app.ico'),
  '/r:System.Windows.Forms.dll',
  '/resource:' + w('index.html') + ',FabricConverter.index.html',
  '/out:' + ascii,
  w('tools/Program.cs'),
], { stdio: 'inherit' });

const named = w('dist/面料换算工具.exe');
rmSync(named, { force: true });
renameSync(ascii, named);

// 4. 冒烟测试：--extract-only 只释放页面、不开浏览器
execFileSync(named, ['--extract-only']);
const unpacked = join(process.env.LOCALAPPDATA, 'FabricConverter', 'index.html');
const same = readFileSync(unpacked).equals(readFileSync(w('index.html')));
if (!same) {
  console.error('冒烟测试失败：释放出来的页面和 index.html 不一致');
  process.exit(1);
}

const kb = (statSync(named).size / 1024).toFixed(0);
writeFileSync(w('dist/README.txt'),
  [
    '面料换算工具 · Windows 单文件版',
    '',
    '双击 面料换算工具.exe 即可打开（使用的是系统自带 Edge 的应用窗口，无地址栏）。',
    '首次运行会把页面释放到 %LOCALAPPDATA%\\FabricConverter\\index.html，之后覆盖同名文件即可更新。',
    '',
    '页面内容与 index.html 完全一致，纯本地运算，不联网、不写注册表。',
    '如需卸载：删除 exe 和 %LOCALAPPDATA%\\FabricConverter 目录即可。',
    '',
    '重新打包：node tools/build-exe.mjs',
    '',
  ].join('\r\n'), 'utf8');

console.log('\n打包完成：dist/面料换算工具.exe（' + kb + ' KB）');
console.log('冒烟测试通过：%LOCALAPPDATA%\\FabricConverter\\index.html 与 index.html 一致');
