import lite from 'caniuse-lite';

import {parse, getRange, match, compare} from './version.js';

const hasFeature = (browser, version, {stats}) => {
  if (!(browser in stats)) return false;
  const versions = stats[browser];
  let highestVersion = null;
  for (const key in versions) {
    if (key === 'TP') continue;
    const range = getRange(key),
      hasFeature = versions[key].charAt(0) === 'y';
    if (!highestVersion || compare(highestVersion, range[range.length - 1]) < 0) {
      highestVersion = hasFeature ? range[range.length - 1] : null;
    }
    if (match(version, range)) return hasFeature;
  }
  if (highestVersion) return compare(highestVersion, version) <= 0;
  return false;
};

export const getAllFeatures = () => new Set(Object.keys(lite.features));

export const collectFeatures = (browser, version, features = getAllFeatures()) => {
  if (typeof version == 'string') {
    version = parse(version);
  }
  const result = new Set();
  for (const name of features.keys()) {
    const feature = lite.feature(lite.features[name]);
    if (hasFeature(browser, version, feature)) {
      result.add(name);
    }
  }
  return result;
};

export const getAllFeatureTitles = () => {
  const result = {};
  for (const name of Object.keys(lite.features)) {
    result[name] = lite.feature(lite.features[name]).title;
  }
  return result;
};

export const hasFeatureByName = (browser, version, featureName) => {
  if (typeof version == 'string') {
    version = parse(version);
  }
  const feature = lite.feature(lite.features[featureName]);
  return hasFeature(browser, version, feature);
};
