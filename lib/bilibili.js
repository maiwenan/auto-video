const axios = require('axios')

// 根据UP主首页获取mid
const getMidByUrl = (url) => {
  const reg = /space.bilibili.com\/(?<mid>\d+)/
  return url.match(reg).groups?.mid
}

// 根据up主mid获取视频主页地址
const getHomeUrl = (mid, currentPage, keyword) => {
  let url = `https://api.bilibili.com/x/space/arc/search?mid=${mid}&ps=30&pn=${currentPage}`

  if (keyword) {
    url += `&keyword=${encodeURIComponent(keyword)}`
  }
  return url
}
  

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

const getPageListByBvid = async (bvid) => {
  const res = await axios.get('https://api.bilibili.com/x/player/pagelist', {
    params: {
      bvid,
      json: 'json'
    },
  })
  return res.data.data
}

// 获取up主所有视频
const getAllVideoByHome = async (mid, keyword) => {
  let result = {
    vlist: [],
    count: 0
  }
  let cur = 1
  while (true) {
    try {
      const { vlist, count } = await getVideoByHome(mid, cur, keyword)

      if (vlist.length === 0) {
        result.vlist.reverse()
        return result
      }
      cur++
      result.vlist = result.vlist.concat(vlist)
      result.count += count
    } catch (e) {
      console.error(e)
      throw e
    }
  }
}

module.exports = { 
  getAllVideoByHome,
  getPageListByBvid
}
