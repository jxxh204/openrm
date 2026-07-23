// preview.cjs (stub) — 원본의 웹뷰 프리뷰/원격 dev서버 리버스 프록시(요소 피커·웹뷰 디버깅)는
// 모바일 하이브리드 앱 디버깅에 특화된 기능이라 OpenRM 코어에서 제외(CommandPage와 함께 제외).
'use strict'
const PROXY_PORT = 0
function start() {}
function getTarget() { return null }
function setTarget() { return null }
function setRemote() {}
function clearRemote() {}
function setAuth() {}
function setLocalToken() {}
function clearLocalToken() {}
function setOnSignin() {}
function getMode() { return { remote: false, origin: null } }
async function candidatePorts() { return [] }

module.exports = { start, getTarget, setTarget, setRemote, clearRemote, setAuth, setLocalToken, clearLocalToken, setOnSignin, getMode, candidatePorts, PROXY_PORT }
