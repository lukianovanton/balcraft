/**
 * Build the JVM args to launch a NeoForge dedicated server.
 * The installer produces an args file with RELATIVE library paths, so the
 * process must run with cwd = serverDir.
 */
export function buildServerArgs(argsFile: string, maxRamMb: number, minRamMb = 1024): string[] {
  return [
    `-Xmx${maxRamMb}M`,
    `-Xms${minRamMb}M`,
    // Aikar-style GC flags trimmed to the essentials for smoother tick times.
    '-XX:+UseG1GC',
    '-XX:+ParallelRefProcEnabled',
    '-XX:MaxGCPauseMillis=200',
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:+DisableExplicitGC',
    '-XX:G1HeapRegionSize=8M',
    '-Dfml.readTimeout=180',
    `@${argsFile}`,
    'nogui',
  ];
}
