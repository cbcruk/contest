import { contextBridge, ipcRenderer } from 'electron'
import type { BufferMeta, LogLine, PokeBridge, RunResult } from '../shared/types'

const bridge: PokeBridge = {
  run: (code) => ipcRenderer.invoke('run', code) as Promise<RunResult>,
  goto: (url) => ipcRenderer.invoke('goto', url) as Promise<string>,
  listBuffers: () => ipcRenderer.invoke('buffers:list') as Promise<BufferMeta[]>,
  readBuffer: (id) => ipcRenderer.invoke('buffers:read', id) as Promise<string>,
  writeBuffer: (id, code) => ipcRenderer.invoke('buffers:write', id, code) as Promise<void>,
  createBuffer: (name) => ipcRenderer.invoke('buffers:create', name) as Promise<BufferMeta>,
  renameBuffer: (id, name) => ipcRenderer.invoke('buffers:rename', id, name) as Promise<void>,
  deleteBuffer: (id) => ipcRenderer.invoke('buffers:delete', id) as Promise<void>,
  shot: (out) => ipcRenderer.invoke('shot', out) as Promise<string>,
  onLog: (cb) => { ipcRenderer.on('log', (_e, line: LogLine) => cb(line)) },
  onUrl: (cb) => { ipcRenderer.on('url', (_e, url: string) => cb(url)) },
}

contextBridge.exposeInMainWorld('poke', bridge)
