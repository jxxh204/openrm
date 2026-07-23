// devusers.cjs (stub) — 원본의 원격 dev서버 자동로그인 테스트 계정 기능은 사내 인프라 결합이 강해 OpenRM 코어에서 제외.
'use strict'
function list() { return [] }
function getCreds() { return null }
function add() { return { ok: false, error: 'disabled in OpenRM core' } }
function saveLogin() {}
function remove() { return { ok: true } }
function tokenList() { return [] }
function getToken() { return null }
function envApiDomain() { return null }
function setActiveEnvToken() { return { ok: false, error: 'disabled in OpenRM core' } }
function setEnvApiDomain() { return { ok: false, error: 'disabled in OpenRM core' } }
function setEnvMswMocking() { return { ok: false, error: 'disabled in OpenRM core' } }
function envMswMocking() { return false }
function portShops() { return {} }
function setPortShop() {}

module.exports = { list, getCreds, add, saveLogin, remove, tokenList, getToken, envApiDomain, setActiveEnvToken, setEnvApiDomain, setEnvMswMocking, envMswMocking, portShops, setPortShop }
