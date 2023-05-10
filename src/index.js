import fs from 'node:fs';

import Chain from 'stream-chain';
import Parser from 'stream-csv-as-json/Parser.js';
import StreamValues from 'stream-json/streamers/StreamValues.js';

import takeWhile from 'stream-chain/utils/takeWhile.js';

import removeRows from './removeRows.js';
import asObjects from './asObjects.js';
import {known, translate} from './browsers.js';
import {difference} from './set-ops.js';
import {collectFeatures, getAllFeatures, getAllFeatureTitles} from './features.js';

const REPORT_PERCENTAGE = [0.95, 0.97, 0.99, 0.995, 0.997, 0.999];
const REPORT_FEATURES = ['es5', 'es6'];

const getNumber = s => parseInt(s.replace(/,/g, ''));

const percentage = [...REPORT_PERCENTAGE, 2].sort((a, b) => a - b);

const inputFileName = new URL('../data/raw.csv', import.meta.url),
  outputFileName = new URL('../server/output.json', import.meta.url);

const getStats = () =>
  new Promise((resolve, reject) => {
    const unknownBrowsers = new Map();
    let knownBrowsers = 0,
      unknownUsers = 0,
      totalUsers = 0;

    const pipeline = new Chain([
      fs.createReadStream(inputFileName),
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
    const stats = await getStats().catch(error => (reject(error), Promise.reject(error))),
      {knownBrowsers, unknownBrowsers, unknownUsers, totalUsers} = stats,
      adjustedTotalUsers = totalUsers - unknownUsers,
      globalResults = {stats, frames: [], features: {}, featureTitles: getAllFeatureTitles()};
    globalResults.stats.adjustedTotalUsers = adjustedTotalUsers;
    {
      const unknown = (globalResults.stats.unknownBrowsers = {});
      for (const [key, value] of unknownBrowsers) {
        unknown[key] = value;
      }
    }

    console.log('Total users:     ', totalUsers);
    console.log('Known browsers:  ', knownBrowsers);
    console.log('Unknown browsers:', unknownBrowsers.size);
    console.log('Unknown users:   ', unknownUsers, `(${((unknownUsers / totalUsers) * 100).toFixed(2)}%)`);
    console.log('Adjusted users:  ', adjustedTotalUsers);

    let previousFeatures = null,
      currentFeatures = getAllFeatures(),
      currentUsers = 0,
      currentBrowsers = [];

    const pipeline = new Chain([
      fs.createReadStream(inputFileName),
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

        REPORT_FEATURES.forEach(name => {
          let feature = globalResults.features[name];
          if (!feature) {
            globalResults.features[name] = feature = {users: 0, unsupported: {}};
          }
          if (currentFeatures.has(name)) {
            feature.users += users;
          } else {
            feature.unsupported[data.Browser + ' ' + data['Browser Version']] = users;
          }
        });

        currentBrowsers.push({
          originalBrowserName: data.Browser,
          originalBrowserVersion: data['Browser Version'],
          browser,
          version,
          users
        });

        currentUsers += users;

        for (const ratio = currentUsers / adjustedTotalUsers; ratio >= percentage[0]; percentage.shift()) {
          console.log('\nPERCENTAGE:', (percentage[0] * 100).toFixed(2));

          const frame = {users: currentUsers, browsers: currentBrowsers};
          if (previousFeatures) {
            const removedFeatures = difference(previousFeatures, currentFeatures);
            removedFeatures.size && console.log('REMOVED:', Array.from(removedFeatures).join(', '));
            const addedFeatures = difference(currentFeatures, previousFeatures);
            addedFeatures.size && console.log('ADDED:', Array.from(addedFeatures).join(', '));
            !removedFeatures.size && !addedFeatures.size && console.log('NO CHANGES');

            frame.removed = Array.from(removedFeatures);
            frame.added = Array.from(addedFeatures);
          } else {
            console.log('AVAILABLE:', Array.from(currentFeatures).join(', '));

            frame.available = Array.from(currentFeatures);
          }
          globalResults.frames.push(frame);

          currentBrowsers = [];
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
        globalResults.frames.push({
          users: currentUsers,
          browsers: currentBrowsers,
          available: Array.from(currentFeatures)
        });
      }

      fs.writeFileSync(outputFileName, JSON.stringify(globalResults, null, 2));

      resolve(true);
    });
  });
main().then(
  () => console.log('DONE.'),
  error => console.error('ERROR:', error)
);
