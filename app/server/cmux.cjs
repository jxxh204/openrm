// cmux.cjs (stub) — 원본은 사내 자체제작 병렬 세션 멀티플렉서(cmux, 비공개 도구) 제어용이라 OpenRM 코어에서 제외.
// term.cjs(순수 tmux+node-pty)는 이 모듈과 무관하게 정상 동작한다.
'use strict'
async function list() { return [] }
async function screen() { return { ok: false, error: 'disabled in OpenRM core' } }
async function send() { return { ok: false, error: 'disabled in OpenRM core' } }
async function key() { return { ok: false, error: 'disabled in OpenRM core' } }
async function claudeSessions() { return [] }
async function focusedCwd() { return null }
const CMUX = null

module.exports = { list, screen, send, key, claudeSessions, focusedCwd, CMUX }
