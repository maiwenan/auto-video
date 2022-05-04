const path = require('path')
const dayjs = require('dayjs')
const {
  createBrowser,
  createPage,
  destroyBrowser
} = require('./puppeteer')

const LOG_PATH = path.resolve(__dirname, '../logs')
const ENTRY_URL = 'https://channels.weixin.qq.com/platform'
const CREATE_URL = `${ENTRY_URL}/post/create`
const TIMES = [ '08:09', '11:50', '15:00', '17:50', '22:00' ]
let browser = null
let pageTab = null

const closeBrowser = async () => {
  if (pageTab) {
    await pageTab.waitForTimeout(60000)
  }
  pageTab = null
  await destroyBrowser(browser)
  browser = null
}

const openCreatePage = async () => {
  try {
    if (!browser) {
      browser = await createBrowser()
      pageTab = await createPage(browser, ENTRY_URL)
    }

    await pageTab.waitForSelector('#finder-uid-copy', {
      timeout: 0
    })
    await pageTab.waitForTimeout(1000)
    await pageTab.goto(CREATE_URL)
    await pageTab.waitForSelector('.post-edit-wrap')

    return pageTab
  } catch (e) {
    if (pageTab) {
      await pageTab.screenshot({
        path: path.resolve(LOG_PATH, `${Date.now()}.png`)
      })
    }
    throw e
  }
}

const createForm = async (videoPath, title, time, cover) => {
  const pageTab = await openCreatePage()

  try {
    const elHandle = await pageTab.$('.ant-upload input')

    await elHandle.uploadFile(videoPath)
    await pageTab.waitForSelector('.target .tag-inner', {
      timeout: 0
    })
    if (cover) {
      await pageTab.waitForTimeout(1000)
      await pageTab.click('.video-cover .finder-tag-wrap')
      await pageTab.waitForTimeout(500)
      await pageTab.$eval('.cover-control-wrap .ant-slider', (el, cover) => {
        cover = parseInt(cover)
  
        if (!!cover) {
          el.__vue__.onChange({sValue: cover})
        }
      }, cover)
      await pageTab.waitForTimeout(500)
      await pageTab.click('.cover-set-footer .weui-desktop-btn_primary')
      await pageTab.waitForTimeout(3000)
    }

    await pageTab.type('.input-editor', title)
    await pageTab.type('.weui-desktop-picker__date-time input', time)

    return pageTab
  } catch (e) {
    if (pageTab) {
      await pageTab.screenshot({
        path: path.resolve(LOG_PATH, `${Date.now()}.png`)
      })
    }
    throw e
  }
}

const createPublishTime = (list, times = TIMES) => {
  let date = dayjs()

  for (let i = 0; i < list.length; i++) {
    const index = i % times.length
    if (index === 0) {
      date = date.add(1, 'day')
    }
    const time = `${date.format('YYYY-MM-DD')} ${times[index]}`

    list[i].time = time
  }
  return list
}

const commitForm = async (videoPath, title, time, cover) => {
  const pageTab = await createForm(videoPath, title, time, cover)

  try {
    await pageTab.click('.weui-desktop-popover__target .weui-desktop-btn_primary')
    await pageTab.waitForTimeout(5000)
    await pageTab.goto(ENTRY_URL)
  } catch (e) {
    if (pageTab) {
      await pageTab.screenshot({
        path: path.resolve(LOG_PATH, `${Date.now()}.png`)
      })
    }
    throw e
  }
}

const autoSend = async list => {
  let successList = []

  try {
    for (let i = 0; i < list.length; i++) {
      const { videoPath, title, bvid, time, cover } = list[i]
      const startTime = Date.now()
  
      console.log(`开始发送第${i + 1}个视频：${title}`)
      await commitForm(videoPath, title, time, cover)
      const seconds = (Date.now() - startTime) / 1000
      console.log(`发送第${i + 1}个视频成功，耗时：${seconds}秒`)
      successList.push(bvid)
    }
  } catch (e) {
    console.error(e)
  }
  await closeBrowser()

  return successList
}

module.exports = {
  autoSend,
  createPublishTime
}