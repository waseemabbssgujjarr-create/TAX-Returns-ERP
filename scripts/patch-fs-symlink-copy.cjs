/**
 * Preload for Next.js standalone on Windows: copy files/dirs when symlink creation fails.
 * Linux cPanel builds use native symlinks; this preload is harmless there.
 */
const fs = require('node:fs')
const path = require('node:path')

async function copyRecursive(src, dest) {
  const stat = await fs.promises.lstat(src)
  if (stat.isDirectory()) {
    await fs.promises.mkdir(dest, { recursive: true })
    for (const name of await fs.promises.readdir(src)) {
      await copyRecursive(path.join(src, name), path.join(dest, name))
    }
    return
  }
  await fs.promises.mkdir(path.dirname(dest), { recursive: true })
  await fs.promises.copyFile(src, dest)
}

const origSymlink = fs.promises.symlink.bind(fs.promises)

fs.promises.symlink = async function symlinkCopyFallback(target, linkpath, type) {
  try {
    return await origSymlink(target, linkpath, type)
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? err.code : null
    if (code === 'EPERM' || code === 'ENOTSUP' || code === 'EEXIST') {
      const src = path.isAbsolute(target)
        ? target
        : path.resolve(path.dirname(linkpath), target)
      await copyRecursive(src, linkpath)
      return
    }
    throw err
  }
}
