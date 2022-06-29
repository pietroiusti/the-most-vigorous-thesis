const https = require('node:https');
const http = require('node:http');
const fs = require('node:fs');
const jsdom = require('jsdom');
const pdf = require('pdf-page-counter');
const { JSDOM } = jsdom;

// return page number of single pdf
async function getPdfPages(path) {
  return new Promise((resolve, reject) => {
    let pdfLink = 'https://www.tdx.cat' + path;

    if ( ! isValidUrl(pdfLink) )
      throw new Error('???invalid url: ' + pdfLink);

    if (pdfLink.indexOf('.jpg') !== -1)
      throw new Error('??? jpg');

    https.get(pdfLink, (res) => {
      if (res.statusCode === 200) {
        const filepath = './pdfs/' + pdfLink.replace('https://www.tdx.cat/', '').replace(/\//g, '_');
        const file = fs.createWriteStream(filepath);
        res.pipe(file);

        file.on('finish', () => {
          let dataBuffer = fs.readFileSync(filepath);
          pdf(dataBuffer).then(data => {
            resolve(data.numpages);
          }).then(() => {
            fs.unlink(filepath, (err) => {
              if (err) throw err;
              //console.log('File successfully removed: ' + filepath);
            });
          });
        });

        res.on('end', () => {
          //??
        });
      } else {
        throw new Error('??? not 200');
      }
    });
  });  
}

// return sum of pages of several pdfs
async function sumPdfPages(links) {
  let total = 0;
  for (let i = 0; i < links.length; i++) {
    //console.log(links[i].firstElementChild.href);
    let pdfPages = await getPdfPages(links[i].firstElementChild.href);
    total += pdfPages;
  }
  return total;
}

async function getPages(thesisPage) {
  return new Promise((resolve, reject) => {

    const dom = new JSDOM(thesisPage);
    const document = dom.window.document;

    //throw new Error('this is my error');

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
    } else {
      //console.log('doing the links ways');
      let arr = [];
      let fileLinks = document.getElementsByClassName('file-link');
      //GET PDFS, SUM THEIR PAGE NUMBERS, AND RESOLVE PROMISE      
      let total = sumPdfPages(fileLinks);
      resolve(total);
    }
  });
}

function getThesis(path, thesisNum, nTry=0, e=null) {
  if (nTry >= 9) {
    let errorEntity = {path, thesisNum, nTry, error: e};
    appendToFile('./foobar_5.txt', errorEntity);
    return;
  }

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
          let pages = await getPages(rawData);
          let entity = {path, thesisNum, pages, nTry};
          appendToFile('./foobar_5.txt', entity);
        } catch(e) {
          getThesis(path, thesisNum, nTry+1, e.message);
        }
      });
    } else { // not 200
      getThesis(path, thesisNum, nTry+1, 'not 200');
    }
  }).on('error', (e) => {
    getThesis(path, thesisNum, nTry+1, e);
  });
}

//getThesis('/handle/10803/2257#page=12', 'foo');

//getThesis('/handle/10803/283441', 'foo');
//getThesis('/handle/10803/2257', 'foo');

function getThesesFromList(path, listNum, nTry=0, e) {
  if (nTry >= 9) {
    console.log('Error. ???');
    let errorEntity = {path, listNum, nTry, error: e};
    appendToFile('./log-error-5.txt', errorEntity);
    return;
  }

  let options = {
    hostname: 'www.tdx.cat',
    path: path, // '/discover?locale-attribute=en'
  };

  https.get(options, (res) => {
    //console.log(`STATUS: ${res.statusCode}`);
    //console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    if (res.statusCode == 200) {
      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', (chunk) => {rawData += chunk; });
      res.on('end', () => {
        
        try {
          const dom = new JSDOM(rawData);
          const document = dom.window.document;
          let items = document.getElementsByClassName('ds-artifact-item');

          for (let i = 0; i < items.length; i++) {
            let itemLink = items[i].firstElementChild.firstElementChild.firstElementChild.href;

            if (!itemLink) { // SOME ITEMS HAVE A FUCKING IMAGE AT THE BEGINNING WTF
              itemLink = items[i].firstElementChild.firstElementChild.href;
            }

            if (itemLink) {
              let thesisNum = ((5 * listNum) + i) - 4 ;
              getThesis(itemLink, thesisNum);
            } else { // !itemLink
              getThesesFromList(path, listNum, nTry+1, '??? falsy itemLink');
            }

          }
        } catch(e) {
          getThesesFromList(path, listNum, nTry+1, e);
        }
      });
    } else { // not 200
      getThesesFromList(path, listNum, nTry+1, 'not 200. statusCode: '+res.statusCode);
    }
  }).on('error', (e) => {
    getThesesFromList(path, listNum, nTry+1, e);
  });
}
//getThesesFromList('/discover?scope=&rpp=10&page=3&group_by=none&etal=0&ocult=0', 'foo');

async function getAll() {
  for (let i = 1; i < 7372; i++) {
    //if (i % 3 == 0) {
    await sleep(1500);
    //}
    let path = 'https://www.tdx.cat/discover?locale-attribute=en&order=asc&rpp=5&sort_by=dc.date.issued_dt&page=' +i+ '&group_by=none&etal=0&ocult=0';
     //let path = 'https://www.tdx.cat/discover?locale-attribute=en&order=asc&rpp=5&sort_by=score&page=' +i+ '&group_by=none&etal=0&ocult=0';
    getThesesFromList(path, i, 0);
  }
}
getAll(); //#######************{[()]}p*****************######

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
