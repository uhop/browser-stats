import fs from 'node:fs';

import Chain from 'stream-chain';
import Parser from 'stream-csv-as-json/Parser.js';
import StreamValues from 'stream-json/streamers/StreamValues.js';

import takeWhile from 'stream-chain/utils/takeWhile.js';

import removeRows from './removeRows.js';
import asObjects from './asObjects.js';
import {known, translate} from './browsers.js';
import {difference, intersectionInPlace} from './set-ops.js';
import {getAllFeatureTitles, hasFeatureByName} from './features.js';

import BrowserCluster from './clusters.js';
import clusterVersions from './cluster-versions.js';
import clusterFeatures from './cluster-features.js';

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
      takeWhile(data => !/^\w+\sIndex/i.test(data.value[0])),
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
    globalResults.stats.uniqueBrowsers = browsers.length;
    console.log('Unique browsers: ', browsers.length);

    console.log('\nStarting clustering browsers by features...');
    const browserClusters = clusterFeatures(browsers);
    globalResults.stats.uniqueBrowserClusters = browserClusters.length;
    console.log('Unique browser clusters: ', browserClusters.length);

    let previousFeatures = null,
      currentFeatures = null,
      currentUsers = 0,
      currentBrowsers = [];

    browserClusters.forEach(item => {
      const {browser, version, users, features, cluster} = item;

      if (currentFeatures) {
        intersectionInPlace(currentFeatures, features);
      } else {
        currentFeatures = new Set(features);
      }

      REPORT_FEATURES.forEach(name => {
        let feature = globalResults.features[name];
        if (!feature) {
          feature = globalResults.features[name] = {users: 0, unsupported: []};
        }
        if (hasFeatureByName(browser, version, name)) {
          feature.users += users;
        } else {
          feature.unsupported.push({browser, version, users, cluster});
        }
      });

      currentBrowsers.push({browser, version, users, cluster});
      currentUsers += users;

      for (const ratio = currentUsers / adjustedTotalUsers; ratio >= percentage[0]; percentage.shift()) {
        console.log('\nPERCENTAGE:', (percentage[0] * 100).toFixed(2));

        const frame = {users: currentUsers, browsers: currentBrowsers};

        // feature arithmetics
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

        // create a frame cluster
        const frameCluster = new BrowserCluster();
        if (globalResults.frames.length) {
          frameCluster.addCluster(globalResults.frames[globalResults.frames.length - 1].cluster);
        }
        currentBrowsers.forEach(({cluster}) => frameCluster.addCluster(cluster));
        frameCluster.normalize();
        frame.cluster = frameCluster.cluster;

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

    resolve(true);
  });
main().then(
  () => console.log('DONE.'),
  error => console.error('ERROR:', error)
);
