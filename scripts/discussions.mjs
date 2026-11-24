import { mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const pageSize = 8
const maxBodyBytes = 12_000

class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function readPost(request) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw new RequestError(415, '请使用 JSON 提交讨论。')
  }
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBodyBytes) throw new RequestError(413, '这条内容太长了。')
    chunks.push(chunk)
  }
  let value
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new RequestError(400, '讨论内容格式有误。') }
  const name = typeof value?.name === 'string' ? value.name.trim() : ''
  const body = typeof value?.body === 'string' ? value.body.trim() : ''
  if (!body || body.length > 1500 || name.length > 24 || /[\r\n]/.test(name)) {
    throw new RequestError(400, '署名最多 24 个字符，内容需要 1 至 1500 个字符。')
  }
  if (typeof value.id !== 'string' || !/^[a-f0-9]{32}$/.test(value.id)) {
    throw new RequestError(400, '提交标识有误，请重新编辑后再发。')
  }
  if (value.parent !== null && (!Number.isSafeInteger(value.parent) || value.parent <= 0)) {
    throw new RequestError(400, '请选择要回复的讨论。')
  }
  return { id: value.id, parent: value.parent, name: name || '访客', body }
}

function listPosts(db, room, before) {
  const threads = db.prepare(`SELECT id, name, body, created FROM posts
    WHERE room = ? AND parent IS NULL AND id < ? ORDER BY id DESC LIMIT ?`).all(room, before, pageSize + 1)
  const more = threads.length > pageSize
  if (more) threads.pop()
  return {
    threads: threads.map(thread => ({ ...thread, ...listReplies(db, room, thread.id, Number.MAX_SAFE_INTEGER, 3) })),
    nextBefore: more ? threads.at(-1).id : null,
  }
}

function listReplies(db, room, parent, before, limit) {
  const replies = db.prepare(`SELECT id, name, body, created FROM posts WHERE room = ? AND parent = ?
    AND id < ? ORDER BY id DESC LIMIT ?`).all(room, parent, before, limit + 1)
  const more = replies.length > limit
  if (more) replies.pop()
  return { replies: replies.reverse(), olderRepliesBefore: more ? replies[0].id : null }
}

function savePost(db, room, post) {
  const existing = db.prepare('SELECT id, room, parent, name, body FROM posts WHERE nonce = ?').get(post.id)
  if (existing) {
    if (existing.room !== room || existing.parent !== post.parent || existing.name !== post.name || existing.body !== post.body) {
      throw new RequestError(409, '此次提交已使用，请重新编辑后再发。')
    }
    return false
  }
  if (post.parent !== null) {
    const thread = db.prepare('SELECT id FROM posts WHERE room = ? AND id = ? AND parent IS NULL').get(room, post.parent)
    if (!thread) throw new RequestError(404, '本章找不到这条讨论。')
  }
  db.prepare('INSERT INTO posts (room, nonce, parent, name, body, created) VALUES (?, ?, ?, ?, ?, ?)')
    .run(room, post.id, post.parent, post.name, post.body, new Date().toISOString())
  return true
}

const catalogModule = '/src/data/workspaceCourses.ts'
const manifest = 'discussion-chapters.json'

function roomIds(courses) {
  return courses.flatMap(course => course.lessons.map(lesson => course.id + '/' + lesson.id))
}

export function chapterDiscussions() {
  let root
  let opening
  const rates = new Map()
  let windowEnd = 0

  function database() {
    return opening ??= import('node:sqlite').then(({ DatabaseSync }) => {
      const dir = resolve(root, process.env.LEARNVERSE_DISCUSSION_DIR || '.learnverse')
      mkdirSync(dir, { recursive: true })
      const db = new DatabaseSync(resolve(dir, 'discussions.sqlite'))
      try {
        db.exec(`PRAGMA busy_timeout = 3000;
          CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY, room TEXT NOT NULL, nonce TEXT NOT NULL UNIQUE,
            parent INTEGER, name TEXT NOT NULL, body TEXT NOT NULL, created TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS posts_by_room ON posts(room, parent, id);`)
      } catch (error) {
        db.close()
        throw error
      }
      return db
    }).catch(error => { opening = undefined; throw error })
  }

  async function handle(req, res, next, getRooms) {
    if (!req.url?.startsWith('/api/discussions/')) return next()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    try {
      const url = new URL(req.url, 'http://localhost')
      const room = url.pathname.slice('/api/discussions/'.length)
      if (!(await getRooms()).has(room)) throw new RequestError(404, '找不到这个章节。')
      if (req.method === 'GET') {
        const before = Number(url.searchParams.get('before') ?? Number.MAX_SAFE_INTEGER)
        if (!Number.isSafeInteger(before) || before < 1) throw new RequestError(400, '分页位置无效。')
        const db = await database()
        if (url.searchParams.has('thread')) {
          const thread = Number(url.searchParams.get('thread'))
          if (!Number.isSafeInteger(thread) || !db.prepare('SELECT id FROM posts WHERE room = ? AND parent IS NULL AND id = ?').get(room, thread)) {
            throw new RequestError(404, '本章找不到这条讨论。')
          }
          return res.end(JSON.stringify(listReplies(db, room, thread, before, 12)))
        }
        return res.end(JSON.stringify(listPosts(db, room, before)))
      }
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST')
        throw new RequestError(405, '不支持此操作。')
      }
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
        throw new RequestError(403, '请从本学习站提交讨论。')
      }
      const post = await readPost(req)
      const db = await database()
      if (Date.now() >= windowEnd) {
        rates.clear()
        windowEnd = Date.now() + 60_000
      }
      const address = req.socket.remoteAddress
      if ((rates.get(address) ?? 0) >= 20) throw new RequestError(429, '发言较频繁，请稍等一分钟再试。')
      db.exec('BEGIN IMMEDIATE')
      try {
        if (savePost(db, room, post)) rates.set(address, (rates.get(address) ?? 0) + 1)
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
      res.end(JSON.stringify({ saved: true }))
    } catch (error) {
      res.statusCode = error instanceof RequestError ? error.status : 503
      res.end(JSON.stringify({ error: error instanceof RequestError ? error.message : '讨论服务暂时无法读写，请稍后重试。' }))
    }
  }

  function attach(server, getRooms) {
    server.middlewares.use((req, res, next) => handle(req, res, next, getRooms))
    server.httpServer?.once('close', () => {
      opening?.then(db => db.close()).catch(() => {})
      opening = undefined
    })
  }
  return {
    name: 'learnverse-chapter-discussions',
    configResolved(config) { root = config.root },
    configureServer(server) {
      let cachedCourses, rooms
      attach(server, async () => {
        const { workspaceCourses } = await server.ssrLoadModule(catalogModule)
        if (cachedCourses !== workspaceCourses) {
          cachedCourses = workspaceCourses
          rooms = new Set(roomIds(workspaceCourses))
        }
        return rooms
      })
    },
    async generateBundle() {
      // Use Vite's TypeScript resolver once at build time to produce the same room list for preview.
      const { createServer } = await import('vite')
      const reader = await createServer({
        configFile: false, root, appType: 'custom', logLevel: 'error',
        server: { middlewareMode: true, hmr: false, watch: null },
        optimizeDeps: { noDiscovery: true, include: [] },
      })
      try {
        const { workspaceCourses } = await reader.ssrLoadModule(catalogModule)
        this.emitFile({ type: 'asset', fileName: manifest, source: JSON.stringify(roomIds(workspaceCourses)) })
      } finally { await reader.close() }
    },
    configurePreviewServer(server) {
      let rooms
      attach(server, async () => {
        if (!rooms) rooms = new Set(JSON.parse(await readFile(resolve(root, server.config.build.outDir, manifest), 'utf8')))
        return rooms
      })
    },
  }
}
