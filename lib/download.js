const fs = require('fs')
const path = require('path')
const axios = require('axios')

// 根URL据下载视频 / 音频
const downloadResource = async ({ url, referer, folder, title, type }) => {
  const target = path.join(folder, `${title}.${type}`)
  if (fs.existsSync(target)) {
    console.log(`视频 ${title} 已存在`)
    return Promise.resolve()
  }
  const res = await axios.get(url, {
    headers: {
      referer,
    },
    responseType: 'stream',
  })
  const writer = fs.createWriteStream(target)
  res.data.pipe(writer)
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
}

// 拼接下载时所需的referer字段
const getRefererByBvid = (bvid) => `https://www.bilibili.com/video/${bvid}`

// 根据bvid获取视频标题
const getTitleByBvid = async (bvid) => {
  const res = await axios.get('https://api.bilibili.com/x/web-interface/view', {
    params: {
      bvid,
    },
  })
  return res.data.data.title
}

// 根据bvid获取cid数组
const getCidByBvid = async (bvid) => {
  const res = await axios.get('https://api.bilibili.com/x/web-interface/view', {
    params: {
      bvid,
    },
  })
  return res.data.data.pages.map((item) => item.cid)
}

// 根据bvid获取视频下载地址数组
const getDownloadPathById = async (bvid, type) => {
  const cidList = await getCidByBvid(bvid)
  const result = []
  for (const cid of cidList) {
    const params = {
      bvid,
      cid,
      qn: 112,
    }
    // 下载音频
    if (type === 'mp3') {
      params.fnval = 16
    }
    const res = await axios.get('https://api.bilibili.com/x/player/playurl', {
      params,
    })
    result.push(
      type === 'mp3'
        ? res.data.data.dash.audio[0].baseUrl
        : res.data.data.durl[0].url
    )
  }
  return result
}

// 根据bvid下载视频/音频，默认目录为根目录下的resource文件夹
const downloadVideoByBvid = async ({ bvid, title, folder, type }) => {
  const downloadList = await getDownloadPathById(bvid, type)
  for (const downloadPath of downloadList) {
    await downloadResource({
      url: downloadPath,
      referer: getRefererByBvid(bvid),
      folder,
      title,
      type,
    })
  }
}

// 根据UP主首页获取mid
const getMidByUrl = (url) => {
  const reg = /space.bilibili.com\/(?<mid>\d+)/
  return url.match(reg).groups?.mid
}

// 根据up主mid获取视频主页地址
const getHomeUrl = (mid, currentPage, keyword) =>
  `https://api.bilibili.com/x/space/arc/search?mid=${mid}&ps=30&pn=${currentPage}&keyword=${encodeURIComponent(keyword)}`

// 获取up主视频列表
const getVideoByHome = async (mid, currentPage, keyword) => {
  const url = getHomeUrl(mid, currentPage, keyword)
  try {
    const res = await axios.get(url)
    const {
      data: {
        data: {
          list: { vlist },
          page: { count }
        }
      }
    } = res

    return {
      vlist,
      count
    }
  } catch (e) {
    throw e
  }
}

// 获取up主所有视频
const getAllVideoByHome = async (mid, currentPage, keyword) => {
  let result = {
    vlist: [],
    count: 0
  }
  let cur = 1
  while (true) {
    try {
      const { vlist, count } = await getVideoByHome(mid, cur, keyword)

      if (vlist.length === 0) {
        return result
      }
      cur++
      result.vlist = result.vlist.concat(vlist)
      result.count = count
    } catch (e) {
      console.error(e)
      throw e
    }
  }
}

const saveByJson = (filepath, data) => {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
  return true
}
const readByJson = filepath => {
  const res = fs.readFileSync(filepath)
  return JSON.parse(res)
}

// 下载列表所有视频
const downloadAllVideo = async (vlist, folder, type = 'mp4') => {
  // 如果目录不存在，则创建
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder)
  }

  let successCount = 0
  
  try {
    for (let i = 0 i < vlist.length i++) {
      const { bvid, title, download } = vlist[i]

      if (download) {
        console.log(`第${i + 1}个视频已经下载过，本次跳过下载该视频：${title}.${type}`)
        continue
      }
      console.log(`开始下载第${i + 1}个视频：${title}.${type}`)
      await downloadVideoByBvid({
        bvid,
        title,
        folder,
        type,
      })
      console.log(`第${i + 1}个视频下载成功：${title}.${type}`)
      vlist[i].download = true
      successCount++
    }
    return {
      vlist,
      successCount
    }
  } catch (e) {
    console.error(e)
    return {
      vlist,
      successCount
    }
  }
}

// 根据UP主页地址下载所有视频
const downloadByHomePath = async ({ url, type, folder }) => {
  const mid = getMidByUrl(url)
  if (!mid) {
    console.error(
      '输入的UP主页地址有误，请至少包含 space.bilibili.com/32816619 的形式'
    )
    return
  }
  // 如果目录不存在，则创建
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder)
  }
  let cur = 1
  while (true) {
    try {
      const res = await axios.get(getHomeUrl(mid, cur))
      const {
        data: {
          data: {
            list: { vlist },
          },
        },
      } = res
      if (vlist.length === 0) {
        return
      }
      const { author } = vlist[0]
      console.log(`开始下载UP主『${author}』的第${cur++}页视频`)
      for (let i = 0 i < vlist.length i++) {
        const { bvid, title } = vlist[i]
        console.log(`[${i}/${vlist.length}] ${title}下载中`)
        await downloadVideoByBvid({
          bvid,
          title,
          folder,
          type,
        })
      }
    } catch (e) {
      console.error(e)
      return
    }
  }
}

// 根据视频URL下载视频
const downloadByVedioPath = async ({ url, type, folder }) => {
  const urlList = url.split('/')
  const bvid = urlList[urlList.length - 1].split('?')[0]
  const title = await getTitleByBvid(bvid)
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder)
  }
  return downloadVideoByBvid({ bvid, title, type, folder })
}

module.exports = { 
  getAllVideoByHome,
  downloadAllVideo,
  saveByJson,
  readByJson,
  downloadByHomePath, 
  downloadByVedioPath 
}
