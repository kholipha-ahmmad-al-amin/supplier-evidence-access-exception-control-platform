import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class AtomicJsonStore {
  constructor(filePath) { this.filePath = filePath; }
  async read() { try { return JSON.parse(await readFile(this.filePath, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return { cases: [] }; throw error; } }
  async write(snapshot) { await mkdir(dirname(this.filePath), { recursive: true }); const temporaryPath = `${this.filePath}.tmp`; await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8'); await rename(temporaryPath, this.filePath); }
}
