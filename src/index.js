import fs from 'node:fs';

import Chain from 'stream-chain';
import Parser from 'stream-csv-as-json/Parser.js';
import StreamValues from 'stream-json/streamers/StreamValues.js';

import takeWhile from 'stream-chain/utils/takeWhile.js';

import removeRows from './removeRows.js';
import asObjects from './asObjects.js';
import {known, translate} from './browsers.js';
import {difference} from './set-ops.js';
import {collectFeatures, getAllFeatures, getAllFeatureTitles, hasFeatureByName} from './features.js';
import {compare, stringify} from './version.js';

const REPORT_PERCENTAGE = [0.95, 0.97, 0.99, 0.995, 0.997, 0.999];
const REPORT_FEATURES = ['es5', 'es6'];

const getNumber = s => parseInt(s.replace(/,/g, ''));

const percentage = [...REPORT_PERCENTAGE, 2].sort((a, b) => a - b);

// parsing arguments

const inputFileIndex = process.argv.indexOf('--input'),
  clusterIndex = process.argv.indexOf('--cluster');

if (
  inputFileIndex < 0 ||
  clusterIndex < 0 ||
  inputFileIndex + 1 >= process.argv.length ||
  clusterIndex + 1 >= process.argv.length
) {
  console.log('Use: node src/index.js --cluster (major|minor|none) --input data/raw.csv');
  process.exit(1);
}

const inputFileValue = process.argv[inputFileIndex + 1],
  clusterValue = process.argv[clusterIndex + 1];

const inputPath = new URL('../', import.meta.url),
  inputFileName = new URL(inputFileValue, inputPath),
  outputFileName = new URL('../server/output.json', import.meta.url);

// utilities

const getStats = () =>
  new Promise((resolve, reject) => {
    const knownBrowsers = [],
      unknownBrowsers = new Map();
    let unknownUsers = 0,
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
          const translatedBrowser = translate(browser, version);
          translatedBrowser.users = getNumber(data.Users);
          knownBrowsers.push(translatedBrowser);
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

const clusterVersions = (browsers, clusterLevel) => {
  // delete unnecessary version parts
  if (clusterLevel === 'major') {
    browsers.forEach(item => {
      item.version.minor = item.version.patch = item.version.build = 0;
      delete item.version.prerelease;
      delete item.version.buildMeta;
    });
  } else if (clusterLevel === 'minor') {
    browsers.forEach(item => {
      item.version.patch = item.version.build = 0;
      delete item.version.prerelease;
      delete item.version.buildMeta;
    });
  }

  // sort by versions
  browsers.sort((a, b) => compare(a.version, b.version));

  // cluster by versions
  const clusteredBrowsers = [];
  while (browsers.length) {
    const current = browsers.pop();
    while (browsers.length) {
      const top = browsers[browsers.length - 1];
      if (compare(current.version, top.version)) break;
      current.users += top.users;
      browsers.pop();
    }
    clusteredBrowsers.push(current);
  }

  // descending sort by users
  return clusteredBrowsers.sort((a, b) => b.users - a.users);
};

const main = () =>
  new Promise(async (resolve, reject) => {
    const stats = await getStats().catch(error => (reject(error), Promise.reject(error))),
      {knownBrowsers, unknownBrowsers, unknownUsers, totalUsers} = stats,
      adjustedTotalUsers = totalUsers - unknownUsers,
      globalResults = {stats: {...stats}, frames: [], features: {}, featureTitles: getAllFeatureTitles()};
    globalResults.stats.knownBrowsers = knownBrowsers.length;
    globalResults.stats.adjustedTotalUsers = adjustedTotalUsers;
    {
      const unknown = (globalResults.stats.unknownBrowsers = {});
      for (const [key, value] of unknownBrowsers) {
        unknown[key] = value;
      }
    }

    console.log('Total users:     ', totalUsers);
    console.log('Known browsers:  ', knownBrowsers.length);
    console.log('Unknown browsers:', unknownBrowsers.size);
    console.log('Unknown users:   ', unknownUsers, `(${((unknownUsers / totalUsers) * 100).toFixed(2)}%)`);
    console.log('Adjusted users:  ', adjustedTotalUsers);

    const browsers = clusterVersions(knownBrowsers, clusterValue);
    console.log('Unique browsers: ', browsers.length);

    let previousFeatures = null,
      currentFeatures = getAllFeatures(),
      currentUsers = 0,
      currentBrowsers = [];

    browsers.forEach(({browser, version, users}) => {
      currentFeatures = collectFeatures(browser, version, currentFeatures);

      REPORT_FEATURES.forEach(name => {
        let feature = globalResults.features[name];
        if (!feature) {
          feature = globalResults.features[name] = {users: 0, unsupported: {}};
        }
        if (hasFeatureByName(browser, version, name)) {
          feature.users += users;
        } else {
          feature.unsupported[browser + ' ' + stringify(version)] = users;
        }
      });

      currentBrowsers.push({browser, version, users});
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
    });

    // finish

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
  });
main().then(
  () => console.log('DONE.'),
  error => console.error('ERROR:', error)
);
