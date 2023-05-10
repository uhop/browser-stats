import lite from 'caniuse-lite';

import {isValid, parse, match, compare} from './version.js';

// mapping browser names from Google Analytics to "Can I use..."
const browsers = Object.assign(Object.create(null), {
  Chrome: 'chrome',
  Safari: 'safari',
  Edge: 'edge',
  Firefox: 'firefox',
  'Samsung Internet': 'samsung',
  'Android Webview': 'chrome',
  'Safari (in-app)': 'ios_saf',
  Opera: 'opera',
  'Android Browser': 'android',
  'UC Browser': 'and_uc',
  'Internet Explorer': 'ie'
});

// mapping WebKit to Safari versions (for past 7 years)
const webkitToSafariVersions = Object.assign(Object.create(null), {
  '602.1.50': '10.0',
  '602.2.14': '10.0.1',
  '602.3.12': '10.0.2',
  '602.4.8': '10.0.3',
  '603.1.30': '10.1',
  '603.2.4': '10.1.1',
  '603.3.8': '10.1.2',
  '604.2.4': '11',
  '605.1.33': '11.1',
  '606.1.36': '12.0',
  '607.1.40': '12.1',
  '608.2.11': '13',
  '610.2.11': '14.0',
  '610.3.7.1.9': '14.0.2',
  '610.4.3.1.4': '14.0.3',
  '611.1.21.161.7': '14.1',
  '611.2.7.1.4': '14.1.1',
  '611.3.10.1.5': '14.1.2',
  '612.1.29': '15.0',
  '612.2.9': '15.1',
  '612.3.6': '15.2',
  '613.1.17': '15.4',
  '613.2.7': '15.5',
  '614.3.7.1.5': '16.2'
});

const findVersionIndex = (version, versions) => {
  let index = -1,
    indexVersion = null;
  for (let i = 0; i < versions.length; ++i) {
    const v = versions[i];
    if (match(version, v)) return i;
    const [lowerVersion] = v.split('-'),
      candidateVersion = parse(lowerVersion);
    if (compare(candidateVersion, version) <= 0 && (!indexVersion || compare(indexVersion, candidateVersion) < 0)) {
      index = i;
      indexVersion = candidateVersion;
    }
  }
  return index;
};

export const known = (browser, version) => {
  if (!(browser in browsers) || !isValid(version)) return false;
  browser = browsers[browser];
  version = parse(version);
  if (browser === 'safari' && findVersionIndex(version, Object.keys(webkitToSafariVersions)) >= 0) return true;
  const versions = lite.agents[browser].versions.filter(v => v && isValid(v));
  if (browser === 'edge' && findVersionIndex(version, versions) < 0)
  console.log(browser, version, findVersionIndex(version, versions), versions);
  return findVersionIndex(version, versions) >= 0;
};

export const translate = (browser, version) => {
  if (!(browser in browsers) || !isValid(version)) return false;
  browser = browsers[browser];
  version = parse(version);
  let useDefaultVersionAlgorithm = true;
  if (browser === 'safari') {
    const keys = Object.keys(webkitToSafariVersions),
      index = findVersionIndex(version, keys);
    if (index >= 0) {
      version = parse(webkitToSafariVersions[keys[index]]);
      useDefaultVersionAlgorithm = false;
    }
  }
  if (useDefaultVersionAlgorithm) {
    const versions = lite.agents[browser].versions.filter(v => v && isValid(v)),
      index = findVersionIndex(version, versions);
    if (index >= 0) {
      version = parse(versions[index]);
      useDefaultVersionAlgorithm = false;
    }
  }
  if (useDefaultVersionAlgorithm) throw new Error('Cannot find a browser');
  return {browser, version};
};
