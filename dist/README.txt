面料换算工具 · Windows 单文件版

双击 面料换算工具.exe 即可打开（使用的是系统自带 Edge 的应用窗口，无地址栏）。
首次运行会把页面释放到 %LOCALAPPDATA%\FabricConverter\index.html，之后覆盖同名文件即可更新。

页面内容与 index.html 完全一致，纯本地运算，不联网、不写注册表。
如需卸载：删除 exe 和 %LOCALAPPDATA%\FabricConverter 目录即可。

重新打包：node tools/build-exe.mjs
