const https = require('node:https');
const fs = require('node:fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

function getThesis1(path) {
  return new Promise( (resolve, reject) => {
    let options = {
      hostname: 'www.tdx.cat',
      path: path,
    };
    https.get(options, (res) => {
      //console.log(`STATUS: ${res.statusCode}`);
      //console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', (chunk) => {rawData += chunk; });
      res.on('end', () => {
        //console.log(rawData);
        const dom = new JSDOM(rawData);
        const document = dom.window.document;

        let authors = document.getElementsByClassName('simple-item-view-authors');
        
        if (authors.length !== 0) {
          authors = authors[0].textContent.trim();
        } else {
          authors = 'NOT FOUND: authors.length === 0';
        }

        let sivo = document.getElementsByClassName('simple-item-view-other');
        let pages;
        if (sivo.length !== 0) {
          pages = findPagesIndex(document.getElementsByClassName('simple-item-view-other'));
        } else {
          pages = 'NOT FOUND: sivo.length === 0';
        }

        //let pages = findPagesIndex(document.getElementsByClassName('simple-item-view-other'));

        let entity = {authors, pages, uri: options.hostname + options.path};
        resolve(entity);
      });
    }).on('error', (e) => {
      console.error(`Error: ${e.message}`);
      reject();
    });
  });
}

// ''this item is restricted''
/* getThesis1('/handle/10803/668642')
 *   .then((t) => {
 *     console.log(t);
 *   });
 * 
 * getThesis1('/handle/10803/674616')
 *   .then((t) => {
 *     console.log(t);
 *   });        
 * 
 * getThesis1('/handle/10803/668776')
 *   .then((t) => {
 *     console.log(t);
 *   }); */

function findPagesIndex(itemsVO) {
  result = '???';
  for (let i = 0; i < itemsVO.length; i++) {
    let txt = (itemsVO[i].lastElementChild.textContent).trim();
    //console.log(txt);
    if (/^[0-9]+ p./.test(txt)) {
      result = txt;
    }
  }
  return result;
}

function getThesis0(path) {
  return new Promise( (resolve, reject) => {
    let options = {
      hostname: 'www.tdx.cat',
      path: path,
    };
    https.get(options, (res) => {
      //console.log(`STATUS: ${res.statusCode}`);
      //console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', (chunk) => {rawData += chunk; });
      res.on('end', () => {
          //console.log(rawData);
          const dom = new JSDOM(rawData);
          const document = dom.window.document;
          let authors = document.getElementsByClassName('simple-item-view-authors')[0].textContent.trim();
          let pages = (document.getElementsByClassName('simple-item-view-other')[7].lastElementChild.textContent).trim();
          let entity = {authors, pages};
          resolve(entity);
      });
    }).on('error', (e) => {
      console.error(`Error: ${e.message}`);
      reject();
    });
  });
}
// USE:
/* getThesis('/handle/10803/283965?locale-attribute=en')
 *   .then( (thesisData) => {
 *     console.log(thesisData);
 *   }); */
// OR:
/* (async function foo() {
 *   let thesisData = await getThesis('/handle/10803/283965?locale-attribute=en');
 *   console.log(thesisData);
 * })(); */

function getThesesFromList (path) {
  return new Promise( (resolve, reject) => {

    let options = {
      hostname: 'www.tdx.cat',
      path: path, // '/discover?locale-attribute=en'
    };

    https.get(options, (res) => {
      //console.log(`STATUS: ${res.statusCode}`);
      //console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

      res.setEncoding('utf8');
      let rawData = '';

      res.on('data', (chunk) => {rawData += chunk; });

      res.on('end', async () => {

        try {
          //console.log(rawData);
          let result = [];

          const dom = new JSDOM(rawData);
          const document = dom.window.document;

          let items = document.getElementsByClassName('ds-artifact-item');

          let theses = await getThesesFromListHelper(items);

          //console.log(theses);
          //return theses; // <---------------------?????!!!!!!!!!!
          resolve(theses);


        } catch(e) {
          console.error(e.message);
        }
      });
    }).on('error', (e) => {
      console.error(`Error: ${e.message}`);
    });

  });
}

async function getThesesFromListHelper(items) {
  try {
    let result = [];
    for (let i = 0; i < items.length; i++) {
      let itemLink = items[i].firstElementChild.firstElementChild.firstElementChild.href;
      //thesisData = 'foo'; // <--- to be deleted

      console.log('waiting for item ' + i);
      let thesisData = await getThesis1(itemLink);
      console.log('got item ' + i + '!');

      result.push(thesisData);
    }
    //console.log('from helper: ' + JSON.stringify(result));
    return result;
  } catch(e) {
    console.error(e);
  }
}




async function getAll() {
  //let final = [];
  for (let i = 1; i < 369; i++) {
    console.log('********* GETTING DATA FROM LIST ' +i+ '*********');
    let path = 'https://www.tdx.cat/discover?locale-attribute=en&order=desc&rpp=5&sort_by=dc.date.issued_dt&page=' +i+ '&group_by=none&etal=0&ocult=0';
    let t = await getThesesFromList(path);
    //final.concat(t);
    let obj = {
      listNum:  i,
      theses: t,
    };

    fs.appendFile('./foo.txt', JSON.stringify(obj) + ',\n', function (err) {
      if (err) return console.log(err);
      console.log('foo.txt written.');
    });
  }

  // WRITE TO FILE

  /* fs.writeFile('./foo.txt', JSON.stringify(final), function (err) {
   *   if (err) return console.log(err);
   *   console.log('foo.txt written.');
   * }); */

}
getAll();

// WRITE TO FILE
/* fs = require('fs');
 * fs.writeFile('./foo.txt', JSON.stringify(final), function (err) {
 *   if (err) return console.log(err);
 *   console.log('foo.txt written.');
 * }); */

async function foo () {
  let bar = await getThesesFromList('');
  console.log(bar);
};
//foo();

//getThesesFromList('https://www.tdx.cat/discover?order=desc&rpp=5&sort_by=score&page=1&group_by=none&etal=0&ocult=0'); // 5 per page, by relevance

//getThesesFromList('https://www.tdx.cat/discover?order=desc&rpp=100&sort_by=dc.date.issued_dt&page=1&group_by=none&etal=0&ocult=0'); //100 per page, by date (desc)
