import os from 'node:os';
import type { PlatformInfo } from '../types.js';

/** Detect the current OS/arch in Minecraft/Adoptium terms. */
export function detectPlatform(): PlatformInfo {
  const platform = os.platform();
  const arch = os.arch();

  let mcOs: PlatformInfo['os'];
  switch (platform) {
    case 'win32':
      mcOs = 'windows';
      break;
    case 'darwin':
      mcOs = 'osx';
      break;
    default:
      mcOs = 'linux';
      break;
  }

  let mcArch: PlatformInfo['arch'];
  switch (arch) {
    case 'arm64':
      mcArch = 'arm64';
      break;
    case 'ia32':
      mcArch = 'x86';
      break;
    default:
      mcArch = 'x64';
      break;
  }

  return { os: mcOs, arch: mcArch };
}

/** The classpath separator for the current OS (`;` on Windows, `:` elsewhere). */
export function classpathSeparator(): string {
  return os.platform() === 'win32' ? ';' : ':';
}

/** Name of the java executable for the current OS (windowless variant on Windows). */
export function javaExecName(useJavaw = true): string {
  if (os.platform() === 'win32') return useJavaw ? 'javaw.exe' : 'java.exe';
  return 'java';
}
