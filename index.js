const path = require('path')
const { getAllVideoByHome } = require('./lib/bilibili')
const {
  autoDownload
} = require('./lib/iiilab')
const {
  autoSend,
  createPublishTime
} = require('./lib/wx')
const {
  readByJson,
  saveByJson,
  getVideoTitle
} = require('./lib/utils')
const videoDir = path.resolve(__dirname, 'videos')
const dataDir = path.resolve(__dirname, 'data')

async function getData(mid, title, hasPageList = true) {
  const dataPath = path.resolve(dataDir, `${title || mid}.json`)
  const res = await getAllVideoByHome(mid, title)

  res.vlist = res.vlist.map(item => {
    return {
      download: false,
      title: item.title,
      bvid: item.bvid,
      hasPageList
    }
  })
  saveByJson(dataPath, res)
  return dataPath
}

async function download(dataPath, count = Infinity) {
  const data = readByJson(dataPath)
  try {
    const vlist = data.vlist.filter(item => !item.download).slice(0, count)
    const result = await autoDownload(vlist, videoDir)
    let successCount = 0
    let failCount = 0

    Object.keys(result).forEach(bvid => {
      const index = data.vlist.findIndex(item => item.bvid === bvid)
      const list = result[bvid]

      data.vlist.splice(index, 1, ...list)
      list.forEach(({ download }) => {
        if (download) {
          successCount++
        } else {
          failCount++
        }
      })
    })

    saveByJson(dataPath, data)
    console.log(`本次一共${successCount}个视频下载成功，${failCount}个视频下载失败！`)
  } catch (e) {
    console.error(e)
  }
}

async function publish(dataPath, count = Infinity) {
  const data = readByJson(dataPath)
  try {
    const vlist = data.vlist.filter(item => !item.send && item.download).slice(0, count).map(item => {
      const { bvid, page } = item

      return {
        ...item,
        videoPath: path.resolve(videoDir, getVideoTitle(bvid, page))
      }
    })
    const successList = await autoSend(vlist)
    const total = successList.length

    data.vlist.forEach(item => {
      if (successList.indexOf(item.bvid) !== -1) {
        item.send = true
      }
    })
    saveByJson(dataPath, data)
    console.log(`本次一共${total}个视频发送成功，${vlist.length - total}个视频发送失败！`)
  } catch (e) {
    console.error(e)
  }
}

async function publishTime(dataPath, dateTime, times) {
  
  const data = readByJson(dataPath)
  try {
    const vlist = data.vlist.filter(item => !item.send && item.download)

    vlist.forEach(item => {
      // item.title = item.title.replace(/(\d+-\d+)/, str => `【命中注定我爱你 ${str}】`)
      item.title = `${item.title} #笑傲江湖`
    })
    createPublishTime(vlist, dateTime, times)
    saveByJson(dataPath, data)
  } catch (e) {
    console.error(e)
  }
}

// const dataPath = path.resolve(dataDir, '放羊的星星.json')
const dataPath = path.resolve(dataDir, '笑傲江湖.json')
publish(dataPath)
// download(dataPath)
// publishTime(dataPath, '2022-05-30', ['00:00', '08:09', '12:00', '18:00', '20:00', '22:00'])
// publishTime(dataPath, '2022-05-30', ['08:09', '12:00', '18:00', '22:00'])
// getData('75638900', '绿光森林')
// getData('287549943', '笑傲江湖')