param([switch]$NoBrowser, [switch]$ResetDemo)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$workerPath = Join-Path $PSScriptRoot 'local-server.mjs'
$url = 'http://127.0.0.1:3000/login'

# Windows closes the whole job when the terminal ends this PowerShell process.
$jobSource = @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public static class OlimpikJob
{
    [StructLayout(LayoutKind.Sequential)]
    private struct BasicLimits
    {
        public long ProcessTime, JobTime;
        public uint Flags;
        public UIntPtr MinimumWorkingSet, MaximumWorkingSet;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct IoCounters
    {
        public ulong Reads, Writes, Other, ReadBytes, WriteBytes, OtherBytes;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Limits
    {
        public BasicLimits Basic;
        public IoCounters Io;
        public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern SafeFileHandle CreateJobObject(IntPtr security, string name);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(SafeFileHandle job, int type, ref Limits info, uint size);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AssignProcessToJobObject(SafeFileHandle job, IntPtr process);

    public static SafeFileHandle Create()
    {
        SafeFileHandle job = CreateJobObject(IntPtr.Zero, null);
        if (job.IsInvalid) throw new Win32Exception();

        const uint killOnClose = 0x2000;
        const int extendedLimitInformation = 9;
        var limits = new Limits();
        limits.Basic.Flags = killOnClose;
        if (SetInformationJobObject(job, extendedLimitInformation, ref limits, (uint)Marshal.SizeOf(limits))) return job;

        var error = new Win32Exception();
        job.Dispose();
        throw error;
    }

    public static void Add(SafeFileHandle job, IntPtr process)
    {
        if (!AssignProcessToJobObject(job, process)) throw new Win32Exception();
    }
}
'@

function Stop-PreviousServers {
    $projectPath = [regex]::Escape($root.Replace('\', '/'))
    $worker = $projectPath + '/scripts/local-server\.mjs(?=["\s]|$)'
    $next = $projectPath + '/node_modules/next/dist/(?:bin/next(?:\.js)?"?\s+(?:dev|start)(?=\s|$)|server/lib/start-server\.js(?=["\s]|$))'
    $entryPoint = '^(?:"[^"]+"|\S+)\s+"?(?:' + $worker + '|' + $next + ')'
    $running = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
        $_.CommandLine -and ($_.CommandLine.Replace('\', '/') -replace '/\.bin/+\.\./', '/') -match $entryPoint
    } | Sort-Object @{ Expression = { $_.CommandLine -match 'start-server\.js' } }

    foreach ($entry in $running) {
        $process = Get-Process -Id $entry.ProcessId -ErrorAction SilentlyContinue
        if ($null -eq $process) { continue }
        try {
            Stop-Process -InputObject $process -ErrorAction Stop
            if (!$process.WaitForExit(5000)) { throw "Process $($entry.ProcessId) did not stop." }
        } catch {
            if (!$process.HasExited) { throw }
        } finally {
            $process.Dispose()
        }
    }
}

function Test-LocalLogin {
    $request = [System.Net.HttpWebRequest]::Create($url)
    $request.Proxy = $null
    $request.AllowAutoRedirect = $false
    $request.Timeout = 3000
    try {
        $response = $request.GetResponse()
        try { return $response.StatusCode -eq [System.Net.HttpStatusCode]::OK }
        finally { $response.Dispose() }
    } catch [System.Net.WebException] {
        if ($_.Exception.Response) { $_.Exception.Response.Dispose() }
        return $false
    }
}

$mutex = $null
$job = $null
$server = $null
$locked = $false
$failed = $false
try {
    $node = (Get-Command node.exe -CommandType Application | Select-Object -First 1).Source
    $projectKey = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($root.ToLowerInvariant()))
    $mutex = New-Object System.Threading.Mutex($false, "Local\Olimpik-$projectKey")
    try { $locked = $mutex.WaitOne(0) }
    catch [System.Threading.AbandonedMutexException] { $locked = $true }
    if (!$locked) { throw 'Olimpik is already starting in another terminal.' }

    Add-Type -TypeDefinition $jobSource
    Stop-PreviousServers

    $listener = New-Object System.Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 3000)
    $listener.ExclusiveAddressUse = $true
    try { $listener.Start() }
    catch [System.Net.Sockets.SocketException] { throw 'Port 3000 is unavailable. Close its listener and run start.bat again.' }
    finally { $listener.Stop() }

    $job = [OlimpikJob]::Create()
    $server = New-Object System.Diagnostics.Process
    $server.StartInfo.FileName = $node
    $server.StartInfo.Arguments = '"' + $workerPath + '"'
    $server.StartInfo.WorkingDirectory = $root
    $server.StartInfo.UseShellExecute = $false
    $server.StartInfo.RedirectStandardInput = $true
    [void]$server.Start()
    try {
        [OlimpikJob]::Add($job, $server.Handle)
        $server.StandardInput.WriteLine($(if ($ResetDemo) { 'reset-demo' } else { 'start' }))
    } finally {
        $server.StandardInput.Close()
    }

    $deadline = [DateTime]::UtcNow.AddMinutes(5)
    while (!(Test-LocalLogin)) {
        if ($server.WaitForExit(350)) { throw 'Olimpik stopped before opening the login page.' }
        if ([DateTime]::UtcNow -ge $deadline) { throw 'Timed out waiting for the local login page.' }
    }
    $mutex.ReleaseMutex()
    $locked = $false
    Write-Host "Olimpik: $url"
    if (!$NoBrowser) {
        try { Start-Process $url }
        catch { Write-Warning "Open $url in your browser." }
    }
    while (!$server.WaitForExit(250)) {}
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    $failed = $true
} finally {
    if ($job) { $job.Dispose() }
    if ($server) { $server.Dispose() }
    if ($locked) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
}

if ($failed) {
    if (!$NoBrowser) { [void](Read-Host 'Press Enter to close') }
    exit 1
}
