
const url = "https://en.wikipedia.org/wiki/List_of_countries_and_dependencies_by_population"

const scratchSsId = '1b6i5PEZ2IYStML3r9161u1dXioylYCp1stWvwB7k1qo'


const pdfMarginsPayload = {
  variables: {
    url,
    "options": {
      "paperFormat": "letter",
      "landscape": true,
      "pdfMargin": {
        "top": 6,
        "bottom": 6,
        "left": 10,
        "right": 10
      }
    }
  },
  query: `
    query ($options: PdfOptionsInput, $url: URL!) {
      page(url: $url) {
        pdf(options: $options ) {
          base64Bytes
          mimeType
        }
      }
    }`
}

const rateLimitPayload = {
  variables: {
    url,
  },
  query: `    
    query ($url: URL!) {
      page (url: $url) {
        url { href }
      }
    }
  `
}
const briefScreenshotPayload = {
  variables: {
    url,
  },
  query: `
    query ($url: URL!) {
      page (url: $url) {
        url { href }
        screenshot {
          mimeType
          base64Bytes
        }
      }
    }`,
};

const screenshotPayload = {
  variables: {
    url,
  },
  query: `
    query ($url: URL!) {
      page (url: $url) {
        url { href }
        screenshot {
          mimeType
          base64Bytes
          dataUri
          viewport {
            deviceScaleFactor
            height
            width
            hasTouch
            isMobile
            isLandscape
          }
        }
      }
    }`,
};

const pdfPayload = {
  variables: {
    url,
  },
  query: `
    query ($url: URL!) {
      page (url: $url) {
        url { href }
        pdf {
          mimeType
          base64Bytes
          viewport {
            deviceScaleFactor
            height
            width
            hasTouch
            isMobile
            isLandscape
          }
        }
      }
    }`,
};

const elementsPayload = {
  variables: {
    selector: 'table',
    url
  },
  query: `
      query ($url: URL!, $selector: Value!)
    {
      page (url: $url) {
        url { href }
        elements (selector: $selector) {
          selector
          count
          elements {
            name
            type
            id
            attributes 
          }
        }
      }
    }
  `
};

const evalPayload = {
  variables: {
    code: `(selector) => {
        const elements = document.querySelectorAll (selector)
        return Array.from(elements)
          .map (element=>({
            src: element.src
          }))
        }
    `,
    arg: 'img',
    url
  },
  query: `
    query ($url: URL!, $arg: JSON, $code: String!) {
      page (url: $url) {
        url { href }
        eval (code: $code, arg: $arg) {
          result
        }
      }
    }
  `
}

const tablesPayload = {
  variables: {
    url,
    "selector": "table"
  },
  query: `
    query ($url: URL!, $selector: Value!) {
      page(url: $url) {
        url { href }
        tables(selector: $selector) {
          selector
          count
          tables {
            headers 
            rows
          }
        }
      }
    }
  `
}

const testRateLimit = () => {
  const loop = 20
  for (let i = 0; i < loop; i++) {
    const { url } = test({ payload: rateLimitPayload })
    console.log(url)
  }
}

const testBriefScreenshot = () => {
  const { url, screenshot } = test({ payload: briefScreenshotPayload, prop: 'screenshot' })
  return toDrive("brief screenshot", url.href, screenshot)
}

const testScreenshot = () => {
  const { url, screenshot } = test({ payload: screenshotPayload, prop: 'screenshot' })
  return toDrive("screenshot", url.href, screenshot)
}

const testElements = () => {
  const { elements } = test({ payload: elementsPayload, prop: 'elements' })
  console.log(elements)
}

const testEval = () => {
  const { eval } = test({ payload: evalPayload, prop: 'eval' })
  console.log(eval.result)
}

const testTables = () => {
  const { tables, url } = test({ payload: tablesPayload, prop: 'tables' })
  console.log(tables)
  toSheet({ url, tables, id: scratchSsId })
}

const toSheet = ({ url, tables, id }) => {

  const ss = SpreadsheetApp.openById(id)
  return tables.tables.map((table, i) => {
    const name = `${cleanerName(url.href)}-${i}`
    const sheet = ss.getSheetByName(name) ||
      ss.insertSheet().setName(name)
    sheet.clearContents()
    const values = table.headers.concat(table.rows)
    const maxWidth = values.reduce((p, c) => Math.max(p, c.length), 0)
    const paddedValues = values.map(
      v => v.concat(Array.from({ length: maxWidth - v.length }))
    )
    sheet
      .getRange(1, 1)
      .offset(0, 0, paddedValues.length, maxWidth)
      .setValues(paddedValues)
    return sheet
  })

}
const testPdf = () => {
  const { pdf } = test({ payload: pdfPayload, prop: 'pdf' })
  return toDrive("pdf", url, pdf)
}

const testPdfMargins = () => {
  const { pdf } = test({ payload: pdfMarginsPayload, prop: 'pdf' })
  return toDrive("pdf-with-margins", "margins-"+ url, pdf)
}

const test = ({ payload, prop }) => {

  const getApiKey = () => getProp("gql-puppet-api-key")
  const getApiEndpoint = () => getProp("gql-puppet-endpoint")

  const headers = {
    "x-gql-puppet-api-key": getApiKey()
  }

  // do the fetch
  const response = UrlFetchApp.fetch(getApiEndpoint(), {
    payload: JSON.stringify(payload),
    contentType: "application/json",
    muteHttpExceptions: true,
    headers,
    method: "POST"
  })

  // check we got some data
  const data = getData(response)

  if (prop && !data?.page?.[prop]) {
    throw ("no data received:");
  }

  return data.page

};


// make sure we have a success code
const checkResponse = (response) => {
  const code = response.getResponseCode()
  if (code !== 200) {
    if (code === 429) {
      console.log('rate limit exceeeded')
      console.log(response.getHeaders())
    }
    throw 'failed:' + response.getContentText()
  }
}

// extract and parse the gql response
const getData = (response) => {
  checkResponse(response)
  const { data, errors } = JSON.parse(response.getContentText())
  if (errors) {
    throw 'failed query:' + JSON.stringify(errors)

  }
  if (!data) {
    throw 'no data from query:' + JSON.stringify(query)
  }
  return data
}

const testAll = () => {
  testTables()
  testScreenshot()
  testPdf()
  testElements()
  testEval()
}



// utils
const toDrive = (prop, url, data) => {
  const file = DriveApp.createFile(blobber(cleanerName(url), data))
  console.log('wrote', prop, 'to', file.getName())
}
const isUndefined = (value) => typeof value === typeof undefined
const isNull = (value) => value === null
const isNU = (value) => isNull(value) || isUndefined(value)

// make blobs from base64
const makeBlob = ({ base64Bytes, mimeType }) =>
  Utilities.newBlob(Utilities.base64Decode(base64Bytes), mimeType)

// tuen b64 to blob and derive a name from url && mimetype
const blobber = (name, { base64Bytes, mimeType }) =>
  makeBlob({ base64Bytes, mimeType })
    .setName(`${name}.${mimeType.replace(/.*\//, "")}`)

// derive a name from url
const cleanerName = (name) => name.replace(/\//g, "-").replace(/\./g, "-")

// api key & endpoint for cloud run
const getStore = () => PropertiesService.getScriptProperties()
const getProp = (prop) => {
  const value = getStore().getProperty(prop)
  if (isNU(value)) throw 'expected value for property ' + prop
  return value
}
