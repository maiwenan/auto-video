const fs = require('fs')
const path = require('path')
const axios = require('axios')
const async = require('async')
const {
  createBrowser,
  createPage,
  destroyBrowser
} = require('./puppeteer')
const { getPageListByBvid } = require('./bilibili')
const { getVideoTitle } = require('./utils')

const LOG_PATH = path.resolve(__dirname, '../logs')
let browser = null
let pageTab = null

const getBvidUrl = (bvid, page) => {
  let url = `https://www.bilibili.com/video/${bvid}`

  if (page !== undefined) {
    url += `?p=${page}`
  }
  return url
}

const getDownloadUrl = async (bvid, page, retry = true) => {
  const url = 'https://bilibili.iiilab.com/'
  const apiUrl = 'https://service0.iiilab.com/video/web/bilibili'

  try {
    if (!browser) {
      browser = await createBrowser()
      pageTab = await createPage(browser, url)
    }
    const bvidUrl = getBvidUrl(bvid, page)
    const promise = new Promise(resolve => {
      pageTab.on('response', async res => {
        const url = res.url()

        if (url.indexOf(apiUrl) !== -1) {
          resolve()
        }
      })
    })

    await pageTab.type('.link-input', bvidUrl)
    await pageTab.click('.btn-default')
    await promise
    await pageTab.waitForSelector('.btn-success', {
      timeout: 0
    })
    await pageTab.waitForTimeout(3000)
    const href = await pageTab.$eval('.btn-success', el => {
      return el.href
    })
    await pageTab.click('.btn-danger')

    return href
  } catch (e) {
    if (pageTab) {
      await pageTab.screenshot({
        path: path.resolve(LOG_PATH, `${Date.now()}.png`)
      })
      if (retry) {
        await pageTab.reload()
        const url = await getDownloadUrl(bvid, page, false)
        return url
      }
    }
    throw e
  }
}

const downloadByUrl = async (url, task, target) => {
  const { bvid, page } = task
  const title = getVideoTitle(bvid, page)
  const filepath = path.join(target, title)

  if (fs.existsSync(filepath)) {
    console.log(`视频 ${title} 已存在`)
    return Promise.resolve()
  }
  const res = await axios.get(url, {
    responseType: 'stream',
  })
  const writer = fs.createWriteStream(filepath)

  res.data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(filepath))
    writer.on('error', reject)
  })
}

const concurrencyDownload = async (list, target, concurrency = 3) => {
  let result = {}

  try {
    const downloadQueue = async.queue(async task => {
      const { url, bvid, title, page } = task
      let newTask = { bvid, title, page }

      try {
        const startTime = Date.now()
        console.log(`开始下载 ${title} 视频...`)
        const filepath = await downloadByUrl(url, task, target)
        const seconds = (Date.now() - startTime) / 1000
        console.log(`下载 ${title} 视频成功：${filepath} ，耗时：${seconds}秒`)

        newTask.download = true
      } catch (e) {
        newTask.download = false
        console.error(`下载 ${title} 视频失败！`)
        console.error(e)
      }
      result[bvid] = result[bvid] ? result[bvid].concat(newTask) : [ newTask ]
    }, concurrency)
    const urlQueue = async.queue(async task => {
      const { bvid, title, page, hasPageList } = task

      try {
        if (hasPageList) {
          console.log(`开始获取 ${bvid} 的视频列表...`)
          const pageList = await getPageListByBvid(bvid)
          console.log(`成功获取 ${bvid} 的视频列表，一共 ${pageList.length} 个`)

          for (let i = 0; i < pageList.length; i++) {
            const { part, page } = pageList[i]
            console.log(`开始获取 ${part} 视频的下载地址...`)
            const url = await getDownloadUrl(bvid, page)
            console.log(`获取 ${part} 视频的下载地址成功：${url}`)

            downloadQueue.push({
              bvid,
              page,
              title: part,
              url
            })
          }
        } else {
          console.log(`开始获取 ${title} 视频的下载地址...`)
          const url = await getDownloadUrl(bvid, page)
          console.log(`获取 ${title} 视频的下载地址成功：${url}`)

          downloadQueue.push({ ...task, url })
        }
      } catch (e) {
        console.error(`获取 ${title} 视频的下载地址失败！`)
        console.error(e)
      }
    }, 1)
  
    urlQueue.push(list)
    await urlQueue.drain()
    await downloadQueue.drain()
  } catch (e) {
    console.error(e)
  }

  return result
}

const autoDownload = async (list, target, concurrency = 3) => {
  let result = {}

  list = [ ...list ]
  while (true) {
    const curList = list.splice(0, concurrency)
    if (curList.length > 0) {
      const res = await concurrencyDownload(curList, target, concurrency)
      result = {
        ...result,
        ...res
      }
    } else {
      await closeBrowser()
      return result
    }
  }
}

const closeBrowser = async () => {
  pageTab = null
  await destroyBrowser(browser)
  browser = null
}

module.exports = {
  getDownloadUrl,
  downloadByUrl,
  autoDownload,
  closeBrowser
}