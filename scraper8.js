const https = require('node:https');
//const http = require('node:http');
const fs = require('node:fs');
const jsdom = require('jsdom');
const pdf = require('pdf-page-counter');
const { JSDOM } = jsdom;


//TODO: store data only if they are not in the foobar file already?

// return page number of single pdf
function getPdfPagesFromPdf(path) {
  return new Promise((resolve, reject) => {
    let pdfLink = 'https://www.tdx.cat' + path;

    if ( ! isValidUrl(pdfLink) ) {
      reject('??? invalid url: ' + pdfLink);
      // throw new Error('???invalid url: ' + pdfLink);
    }

    if (pdfLink.indexOf('.jpg') !== -1) {
      reject('??? jpg');
      //throw new Error('??? jpg');
    }

    https.get(pdfLink, (res) => {
      if (res.statusCode === 200) {

        const data = [];
        res.on('data', chunk => {
          data.push(chunk);
        });

        res.on('end', () => {
          let buffer = Buffer.concat(data);

          pdf(buffer).then(data => {
            resolve(data.numpages);
          }).catch(err=>{
            reject(err);
          });
        });
      } else {
        reject('status code: '+ res.statusCode);
      }
    }).on('error', (e) => {
      reject(e);
    });
  });
}
/* getPdfPages('/bitstream/handle/10803/677/01.SZA_1de1.pdf?sequence=1&isAllowed=y')
 *   .then(p => console.log(p)); */

// take lists of links to pdf, return sum of the pdfs' pages
async function sumPdfPages(links) {
  let total = 0;
  for (let i = 0; i < links.length; i++) {
    try {
      let pdfPages = await getPdfPagesFromPdf(links[i].firstElementChild.href);
      total += pdfPages;
    } catch(e) {
      return '??? catched error in sumPdfPages: ' + e;
    }
  }
  return total;
}

// Take thesis html page as raw data, return number thesis' number of
// pages
function getPagesFromRawData(thesisPage) {
  return new Promise((resolve, reject) => {

    const dom = new JSDOM(thesisPage);
    const document = dom.window.document;

    let sivo = document.getElementsByClassName('simple-item-view-other');
    let pages = null;
    if (sivo.length !== 0) {
      for (let i = 0; i < sivo.length; i++) {
        let txt = (sivo[i].lastElementChild.textContent).trim();
        //console.log(txt);
        if (/^[0-9]+ p./.test(txt)) {
          pages = txt;
          pages = pages.slice(0, pages.length-3);
          pages = Number(pages);
          break;
        }
      }
    }

    if (pages) {
      resolve(pages);
    } else {               // PLAN B //
                           //GET PDFS, SUM THEIR PAGE NUMBERS, AND RESOLVE PROMISE
      let arr = [];
      let fileLinks = document.getElementsByClassName('file-link');
      sumPdfPages(fileLinks).then(total => {
        resolve(total);
      }).catch(e => {
        reject(e);
      });
    }
  });
}

function getPages(path) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {// rejcect in case promised has not resolved after 3 mins
      reject('??? timeout');
    }, 240000)

    let options = {
      hostname: 'www.tdx.cat',
      path: path,
    };

    https.get(options, (res) => {
      if (res.statusCode === 200) {
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => {rawData += chunk; });
        res.on('end', async () => {
          try {
            let pages = await getPagesFromRawData(rawData);
            resolve(pages);
          } catch(e) {
            reject('??? ' + e);
          }
        });
      } else { // not 200
        reject('??? not 200');
      }
    }).on('error', (e) => {
      reject('??? error in getPages');
    });
  });
}

async function init() {
  for (let i = 1; i < 7377; i++) {
    let listNum = i;
    let path = 'https://tdx.cat/discover?order=asc&rpp=5&sort_by=dc.date.issued_dt&page='
              +i+
               '&group_by=none&etal=0&ocult=0&locale-attribute=en';

    https.get(path, res => {
      if (res.statusCode == 200) {
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => {rawData += chunk; });
        res.on('end', () => {
          const dom = new JSDOM(rawData);
          const document = dom.window.document;

          let items = document.getElementsByClassName('ds-artifact-item');

          for (let j = 0; j < items.length; j++) {
            let itemLink = items[j].firstElementChild.firstElementChild.firstElementChild.href;

            if (!itemLink) {
              itemLink = items[j].firstElementChild.firstElementChild.href;
            }

            let thesisNum = ((5 * listNum) + j) - 4;
            if (itemLink) {
              getPages(itemLink)
                .then( pages => {
                  let entity = {path: itemLink, n: thesisNum, pages, try: '1'};
                  appendToFile('./foobar_8.txt', entity);
                }).catch(e => {
                  // Retry once more
                  getPages(itemLink)
                    .then( pages => {
                      let entity = {path: itemLink, n: thesisNum, pages, try: '2 - success after: '+e};
                      appendToFile('./foobar_8.txt', entity);
                    }).catch(e => {
                      //Retry again for the third time
                      getPages(itemLink)
                        .then(pages => {
                          let entity = {path: itemLink, n: thesisNum, pages, try: '3 - success after: '+e};
                          appendToFile('./foobar_8.txt', entity);
                        }).catch(e => {
                          //Retry again for the fourth time
                          getPages(itemLink)
                            .then(pages => {
                              let entity = {path: itemLink, n: thesisNum, pages, try: '4 - success after: '+e};
                              appendToFile('./foobar_8.txt', entity);
                            }).catch(e => {
                              // Declare defeat
                              let entity = {path: itemLink, n: thesisNum, pages:null, error:e};
                              appendToFile('./foobar_8.txt', entity);
                            });
                        })
                    });
                });
            } else { // !itemLink
              let entity = {n: thesisNum, i, j, pages: null, error: '??? !itemlink'};
              appendToFile('./foobar_8.txt', entity);
            }
          }
        });
      } else { //not 200
        let entity = {listNum, error: 'not 200: '+res.statusCode};
        appendToFile('./log-error_8.txt', entity);
      }
    }).on('error', e => {
      let entity = {listNum, error: e};
      appendToFile('./log-error_8.txt', entity);
    });

    await sleep(2000);
  }
};

init();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isValidUrl(string) {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}

function appendToFile(filePath, entity) {
  fs.appendFile(filePath, JSON.stringify(entity)+',\n', function (err) {
    if (err) return console.log(err);
    console.log(filePath + ' written.');
    console.log(JSON.stringify(entity));
  });
}
