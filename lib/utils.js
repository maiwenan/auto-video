const fs = require('fs')

const saveByJson = (filepath, data) => {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
  return true
}
const readByJson = filepath => {
  const res = fs.readFileSync(filepath)
  return JSON.parse(res)
}
const getVideoTitle = (bvid, page) => {
  return `${bvid + (page ? `_${page}` : '')}.mp4`
}

module.exports = { 
  saveByJson,
  readByJson,
  getVideoTitle
}