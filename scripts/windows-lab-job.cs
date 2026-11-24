using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;

internal static class LearnverseJob
{
    private const uint JobTime = 0x00000004;
    private const uint ActiveProcessLimit = 0x00000008;
    private const uint JobMemoryLimit = 0x00000200;
    private const uint KillOnClose = 0x00002000;
    private const int ExtendedLimitInformation = 9;
    private const uint ExtendedStartupInfoPresent = 0x00080000;
    private const uint UseStdHandles = 0x00000100;
    private static readonly UIntPtr HandleListAttribute = new UIntPtr(0x00020002U);
    private static readonly UIntPtr JobListAttribute = new UIntPtr(0x0002000DU);

    [StructLayout(LayoutKind.Sequential)]
    private struct BasicLimits
    {
        public long PerProcessUserTime;
        public long PerJobUserTime;
        public uint Flags;
        public UIntPtr MinimumWorkingSet;
        public UIntPtr MaximumWorkingSet;
        public uint ActiveProcesses;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JobLimits
    {
        public BasicLimits Basic;
        public ulong ReadOperations, WriteOperations, OtherOperations;
        public ulong ReadBytes, WriteBytes, OtherBytes;
        public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct StartupInfo
    {
        public uint Size;
        public IntPtr Reserved, Desktop, Title;
        public uint X, Y, Width, Height, Columns, Rows, Fill, Flags;
        public ushort ShowWindow, ReservedCount;
        public IntPtr ReservedBytes, Stdin, Stdout, Stderr;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct StartupInfoEx
    {
        public StartupInfo Startup;
        public IntPtr Attributes;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInfo
    {
        public IntPtr Process, Thread;
        public uint ProcessId, ThreadId;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(IntPtr job, int kind, ref JobLimits limits, uint length);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CreateProcess(string application, StringBuilder command, IntPtr processAttributes,
        IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment, string directory,
        ref StartupInfoEx startup, out ProcessInfo process);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, uint flags, ref UIntPtr size);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, UIntPtr attribute, IntPtr value,
        UIntPtr size, IntPtr previous, IntPtr returnSize);
    [DllImport("kernel32.dll")]
    private static extern void DeleteProcThreadAttributeList(IntPtr list);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetExitCodeProcess(IntPtr process, out uint code);
    [DllImport("kernel32.dll")]
    private static extern IntPtr GetStdHandle(int identifier);
    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);

    private static void Require(bool condition)
    {
        if (!condition) throw new Win32Exception(Marshal.GetLastWin32Error());
    }

    private static string Resolve(string command)
    {
        if (Path.HasExtension(command) && !command.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("A native executable is required.");
        if (!Path.HasExtension(command)) command += ".exe";
        if (Path.GetFileName(command) != command || Path.IsPathRooted(command)) return Path.GetFullPath(command);
        foreach (string entry in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(';'))
        {
            string folder = entry.Trim().Trim('"');
            if (!Path.IsPathRooted(folder)) continue;
            string candidate = Path.Combine(folder, command);
            if (File.Exists(candidate)) return candidate;
        }
        throw new FileNotFoundException("Executable not found on PATH.", command);
    }

    private static string Quote(string argument)
    {
        // Windows argv doubles backslashes before a quote or the closing delimiter.
        return "\"" + Regex.Replace(argument, "(\\\\*)(\"|$)", match =>
            match.Groups[1].Value + match.Groups[1].Value + (match.Groups[2].Value == "\"" ? "\\\"" : "")) + "\"";
    }

    private static int Main(string[] args)
    {
        var process = new ProcessInfo();
        IntPtr job = IntPtr.Zero;
        IntPtr attributes = IntPtr.Zero;
        IntPtr handleList = IntPtr.Zero;
        IntPtr jobList = IntPtr.Zero;
        bool initialized = false;
        try
        {
            if (args.Length == 0) throw new ArgumentException("Missing executable.");
            uint wallDeadline;
            if (!UInt32.TryParse(Environment.GetEnvironmentVariable("LEARNVERSE_JOB_WALL_MS"), out wallDeadline)
                || wallDeadline == 0 || wallDeadline > 60000)
                throw new ArgumentException("Invalid native task deadline.");
            Environment.SetEnvironmentVariable("LEARNVERSE_JOB_WALL_MS", null);
            args[0] = Resolve(args[0]);
            job = CreateJobObject(IntPtr.Zero, null);
            Require(job != IntPtr.Zero);
            var limits = new JobLimits {
                Basic = new BasicLimits {
                    Flags = JobTime | ActiveProcessLimit | JobMemoryLimit | KillOnClose,
                    PerJobUserTime = TimeSpan.FromSeconds(20).Ticks,
                    ActiveProcesses = 16,
                },
                JobMemory = new UIntPtr(768U * 1024U * 1024U),
            };
            Require(SetInformationJobObject(job, ExtendedLimitInformation, ref limits, (uint)Marshal.SizeOf(typeof(JobLimits))));
            var stdio = new StartupInfo {
                Size = (uint)Marshal.SizeOf(typeof(StartupInfoEx)), Flags = UseStdHandles,
                Stdin = GetStdHandle(-10), Stdout = GetStdHandle(-11), Stderr = GetStdHandle(-12),
            };
            var size = UIntPtr.Zero;
            InitializeProcThreadAttributeList(IntPtr.Zero, 2, 0, ref size);
            Require(size != UIntPtr.Zero);
            attributes = Marshal.AllocHGlobal(new IntPtr((long)size.ToUInt64()));
            Require(InitializeProcThreadAttributeList(attributes, 2, 0, ref size));
            initialized = true;

            handleList = Marshal.AllocHGlobal(IntPtr.Size * 3);
            Marshal.WriteIntPtr(handleList, 0, stdio.Stdin);
            Marshal.WriteIntPtr(handleList, IntPtr.Size, stdio.Stdout);
            Marshal.WriteIntPtr(handleList, IntPtr.Size * 2, stdio.Stderr);
            Require(UpdateProcThreadAttribute(attributes, 0, HandleListAttribute, handleList,
                new UIntPtr((uint)(IntPtr.Size * 3)), IntPtr.Zero, IntPtr.Zero));

            jobList = Marshal.AllocHGlobal(IntPtr.Size);
            Marshal.WriteIntPtr(jobList, job);
            // Associate the child during creation so cancellation cannot strand an unassigned process.
            Require(UpdateProcThreadAttribute(attributes, 0, JobListAttribute, jobList,
                new UIntPtr((uint)IntPtr.Size), IntPtr.Zero, IntPtr.Zero));
            var startup = new StartupInfoEx { Startup = stdio, Attributes = attributes };
            var command = new StringBuilder(String.Join(" ", Array.ConvertAll(args, Quote)));
            Require(CreateProcess(args[0], command, IntPtr.Zero, IntPtr.Zero, true, ExtendedStartupInfoPresent,
                IntPtr.Zero, null, ref startup, out process));
            uint wait = WaitForSingleObject(process.Process, wallDeadline);
            if (wait == 258) return 124; // Backup deadline if the server stops supervising the job.
            Require(wait == 0);
            uint code;
            Require(GetExitCodeProcess(process.Process, out code));
            return unchecked((int)code);
        }
        catch (Exception error)
        {
            Console.Error.WriteLine("LEARNVERSE native launcher: " + error.Message);
            return 125;
        }
        finally
        {
            if (job != IntPtr.Zero) CloseHandle(job);
            if (process.Thread != IntPtr.Zero) CloseHandle(process.Thread);
            if (process.Process != IntPtr.Zero) CloseHandle(process.Process);
            if (initialized) DeleteProcThreadAttributeList(attributes);
            if (attributes != IntPtr.Zero) Marshal.FreeHGlobal(attributes);
            if (handleList != IntPtr.Zero) Marshal.FreeHGlobal(handleList);
            if (jobList != IntPtr.Zero) Marshal.FreeHGlobal(jobList);
        }
    }
}
