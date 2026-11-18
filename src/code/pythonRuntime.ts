import loader from 'pyodide/pyodide.mjs?raw'
import core from 'pyodide/pyodide.asm.mjs?raw'

// Pass the original upstream JavaScript to the opaque worker. Vite's dev
// server otherwise transforms a regular fetch of the loader as an app module.
export const pythonScripts = {
  loader: new Blob([loader], { type: 'text/javascript' }),
  core: new Blob([core], { type: 'text/javascript' }),
}
