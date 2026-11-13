using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

[assembly: AssemblyTitle("面料换算工具")]
[assembly: AssemblyDescription("面料报价换算：公斤价 / 米价 / 码价 / 克重 / 门幅 / 空差")]
[assembly: AssemblyProduct("FabricConverter")]
[assembly: AssemblyCompany("")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

// 单文件 exe：把 index.html 内嵌进来，运行时释放到 %LOCALAPPDATA%\FabricConverter，
// 再用系统自带的 Edge / Chrome 以「应用窗口」（无地址栏）打开。
static class Program
{
    const string AppDir = "FabricConverter";
    const string PageName = "index.html";

    [STAThread]
    static int Main(string[] args)
    {
        try
        {
            string dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppDir);
            Directory.CreateDirectory(dir);
            string page = Path.Combine(dir, PageName);

            byte[] built = ReadResource(PageName);
            if (built == null) return Fail("内置页面缺失，exe 可能损坏。");

            if (!File.Exists(page) || !SameBytes(File.ReadAllBytes(page), built))
                File.WriteAllBytes(page, built);

            foreach (string arg in args)
                if (arg == "--extract-only") return 0;

            Launch(page);
            return 0;
        }
        catch (Exception ex)
        {
            return Fail(ex.Message);
        }
    }

    // 优先用 Edge/Chrome 的应用窗口模式，都没有才交给默认浏览器
    static void Launch(string page)
    {
        string url = new Uri(page).AbsoluteUri;
        string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string[] browsers =
        {
            Path.Combine(pf86, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf,   @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf,   @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(pf86, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(local, @"Google\Chrome\Application\chrome.exe"),
        };

        foreach (string exe in browsers)
        {
            if (!File.Exists(exe)) continue;
            ProcessStartInfo psi = new ProcessStartInfo(exe);
            psi.Arguments = "--app=\"" + url + "\" --window-size=1000,860";
            psi.UseShellExecute = false;
            Process.Start(psi);
            return;
        }

        ProcessStartInfo fallback = new ProcessStartInfo(url);
        fallback.UseShellExecute = true;
        Process.Start(fallback);
    }

    static byte[] ReadResource(string name)
    {
        Assembly asm = Assembly.GetExecutingAssembly();
        foreach (string full in asm.GetManifestResourceNames())
        {
            if (!full.EndsWith(name, StringComparison.OrdinalIgnoreCase)) continue;
            using (Stream s = asm.GetManifestResourceStream(full))
            using (MemoryStream ms = new MemoryStream())
            {
                s.CopyTo(ms);
                return ms.ToArray();
            }
        }
        return null;
    }

    static bool SameBytes(byte[] a, byte[] b)
    {
        if (a.Length != b.Length) return false;
        for (int i = 0; i < a.Length; i++) if (a[i] != b[i]) return false;
        return true;
    }

    static int Fail(string msg)
    {
        MessageBox.Show(msg, "面料换算工具", MessageBoxButtons.OK, MessageBoxIcon.Error);
        return 1;
    }
}
