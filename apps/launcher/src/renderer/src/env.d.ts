/// <reference types="vite/client" />
import type { BalumbaApi } from '../../shared/ipc';

declare global {
  interface Window {
    balumba: BalumbaApi;
  }
}

export {};
