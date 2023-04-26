import fs from 'node:fs';

import Chain from 'stream-chain';
import Parser from 'stream-csv-as-json/Parser.js';
import StreamValues from 'stream-json/streamers/StreamValues.js';

import takeWhile from 'stream-chain/utils/takeWhile.js';

import removeRows from './removeRows.js';
import asObjects from './asObjects.js';
import {known, translate} from './browsers.js';
import {difference, intersectionInPlace} from './set-ops.js';
import {collectFeatures, getAllFeatures} from './features.js';

const REPORT_PERCENTAGE = [0.95, 0.97, 0.99, 0.995, 0.997, 0.999];

const getNumber = s => parseInt(s.replace(/,/g, ''));

const percentage = [...REPORT_PERCENTAGE, 2].sort((a, b) => a - b);

const dataFileName = new URL('../data/raw.csv', import.meta.url);

const getStats = () =>
  new Promise((resolve, reject) => {
    const unknownBrowsers = new Map();
    let knownBrowsers = 0,
      unknownUsers = 0,
      totalUsers = 0;

    const pipeline = new Chain([
      fs.createReadStream(dataFileName),
      new Parser(),
      new StreamValues(),
      removeRows,
      takeWhile(data => data.value[0] !== 'Day Index'),
      asObjects(),
      data => {
        const browser = data.Browser,
          version = data['Browser Version'],
          users = getNumber(data.Users);
        if (!browser) {
          totalUsers = users;
          return Chain.none;
        }
        if (known(browser, version)) {
          ++knownBrowsers;
          return data;
        }
        unknownUsers += users;
        const key = browser + ' ' + version;
        if (unknownBrowsers.has(key)) {
          unknownBrowsers.set(key, unknownBrowsers.get(key) + users);
        } else {
          unknownBrowsers.set(key, users);
        }
        return Chain.none;
      }
    ]);

    pipeline.on('data', () => {});
    pipeline.on('error', error => reject(error));
    pipeline.on('end', () =>
      resolve({
        knownBrowsers,
        unknownBrowsers,
        unknownUsers,
        totalUsers
      })
    );
  });

const main = () =>
  new Promise(async (resolve, reject) => {
    const {knownBrowsers, unknownBrowsers, unknownUsers, totalUsers} = await getStats().catch(
      error => (reject(error), Promise.reject(error))
    ),
    adjustedTotalUsers = totalUsers - unknownUsers;

    console.log('Total users:     ', totalUsers);
    console.log('Known browsers:  ', knownBrowsers);
    console.log('Unknown browsers:', unknownBrowsers.size);
    console.log('Unknown users:   ', unknownUsers, `(${((unknownUsers / totalUsers) * 100).toFixed(2)}%)`);
    console.log('Adjusted users:  ', adjustedTotalUsers);

    let previousFeatures = null,
      currentFeatures = getAllFeatures(),
      currentUsers = 0;

    const pipeline = new Chain([
      fs.createReadStream(dataFileName),
      new Parser(),
      new StreamValues(),
      removeRows,
      takeWhile(data => data.value[0] !== 'Day Index'),
      asObjects(),
      data => (data.Browser && known(data.Browser, data['Browser Version']) ? data : Chain.none),
      data => {
        const {browser, version} = translate(data.Browser, data['Browser Version']),
          users = getNumber(data.Users),
          features = collectFeatures(browser, version, currentFeatures);

        currentFeatures = features;
        // !currentFeatures.size && console.log(browser, version, features.size);

        currentUsers += users;
        // console.log(currentUsers / adjustedTotalUsers, percentage[0]);
        for (const ratio = currentUsers / adjustedTotalUsers; ratio >= percentage[0]; percentage.shift()) {
          console.log('\nPERCENTAGE:', (percentage[0] * 100).toFixed(2));

          if (previousFeatures) {
            const removedFeatures = difference(previousFeatures, currentFeatures);
            removedFeatures.size && console.log('REMOVED:', Array.from(removedFeatures).join(', '));
            const addedFeatures = difference(currentFeatures, previousFeatures);
            addedFeatures.size && console.log('ADDED:', Array.from(addedFeatures).join(', '));
            !removedFeatures.size && !addedFeatures.size && console.log('NO CHANGES');
          } else {
            console.log('AVAILABLE:', Array.from(currentFeatures).join(', '));
          }

          previousFeatures = new Set(currentFeatures);
        }

        return data;
      }
    ]);

    pipeline.on('data', () => {});
    pipeline.on('error', error => reject(error));
    pipeline.on('end', () => {
      if (!previousFeatures) {
        console.log('\nPERCENTAGE:', ((currentUsers / adjustedTotalUsers) * 100).toFixed(2));
        console.log('AVAILABLE:', Array.from(currentFeatures).join(', '));
      }
      if (unknownBrowsers.size) {
        console.log('\nUNKNOWN BROWSERS:');
        for (const [key, value] of unknownBrowsers) {
          console.log(key, value);
        }
      }
      resolve(true);
    });
  });
main().then(
  () => console.log('DONE.'),
  error => console.error('ERROR:', error)
);
