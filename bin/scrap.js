#!/usr/bin/env node
'use strict';
const scraper = require('website-scraper'), // Version 3+
  rimraf = require('rimraf'),
  fs = require('fs'),
  mv = require('mv'),
  path = require('path'),
  url = require('url'),
  isBinary = require('isbinaryfile');

/**
 * Find & load options file
 */
const optionsPath = path.join(process.cwd(), 'scrap-ghost.json');
let mOptions;
try {
  mOptions = require(optionsPath);
} catch (e) {
  throw new Error('Missing file scrap-ghost.json in current directory. See module documentation.')
}
try {

  console.log('Loaded JSON:');
  console.log(mOptions);
  const reqOptions = ['ghostURL', 'tmpFolder', 'staticFolder', 'publicURL'];
  reqOptions.map(opt => {
    if (!mOptions.hasOwnProperty(opt)) {
      throw new Error(`Missing value for: ${opt}`);
    }
  });
} catch (e) {
  throw e;
}

const
  ghostURL = mOptions['ghostURL'], // Your Ghost's local instance
  tmpFolder = mOptions['tmpFolder'], // Where to scrap it
  staticFolder = mOptions['staticFolder'], // Where to save it
  publicURL = mOptions['publicURL'], // Your Ghost's public url (with subfolder if needed)

  wsOptions = {
    urls: [ghostURL],
    directory: tmpFolder,
    recursive: true,
    prettifyUrls: true,
    filenameGenerator: 'bySiteStructure',

    request: {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/33.0.1750.117 Safari/537.36'
      }
    },

    /**
     * Only download files coming from the Ghost instance
     * @param url
     * @returns {boolean}
     */
    urlFilter: url => {
      const download = url.indexOf(ghostURL) === 0;
      if (download) {
        console.log(`Downloading ${url}`);
      }
      return download;
    },

    /**
     * Replace references of [ghostURL] by [publicURL] in non-binary files
     * @param resource
     */
    onResourceSaved: resource => {
      let path = tmpFolder + resource.filename;
      isBinary(path, (err, result) => {
        if (!result) {
          try {
            let data = fs.readFileSync(path, 'utf8');
            let result = data.replace(new RegExp(ghostURL, 'g'), publicURL);
            fs.writeFileSync(path, result, 'utf8');
          } catch (err) {
            console.error(err);
          }
        }
      })

    }
  };

/**
 * Delete tmp and static folders before scraping
 * @returns {Promise}
 */
function deleteFolders() {
  return new Promise((resolve, reject) => {
    rimraf(tmpFolder, e => {
      if (e) reject(e);
      rimraf(staticFolder, e => {
        if (e) reject(e);
        resolve();
      })
    })
  })
}

deleteFolders()
  .then(() => {
    console.log('Deleted old content');
    console.log('Scraping ' + ghostURL);
    return scraper(wsOptions)
  })
  .then(result => {
    // Move the site from the tmp folder to the static folder
    const domain = url.parse(ghostURL).host.replace(':', '_');
    mv(path.join(tmpFolder, domain), staticFolder, {mkdirp: true}, err => {
      if (err) {
        console.log(err)
      }
      console.log('Done!')
    })
  })
  .catch(err => {
    console.error(err.stack);
  });