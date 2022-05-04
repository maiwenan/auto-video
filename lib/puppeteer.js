const puppeteer = require('puppeteer')

module.exports = {
  async createBrowser() {
    const browser = await puppeteer.launch({
      headless: process.env.NODE_ENV === 'production',
      executablePath: 'C:\\Users\\Gridsum\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
      args: [ 
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ],
      ignoreDefaultArgs: [ '--enable-automation' ]
    })
    
    return browser
  },
  async createPage(browser, url) {
    const page = await browser.newPage()
    await page.setViewport({
      width: 1366,
      height: 600
    })
    await page.goto(url)
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, {
        webdriver: () => undefined
      })
    })

    return page
  },
  async destroyBrowser(browser) {
    if (browser) {
      const pages = await browser.pages()

      await Promise.all(pages.map(page => page.close()))
      await browser.close()
    }
  }
}

