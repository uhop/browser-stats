import lite from 'caniuse-lite';

import {parse, match} from './version.js';

const hasFeature = (browser, version, {stats}) => {
  if (!(browser in stats)) return false;
  const versions = stats[browser];
  for (const key in versions) {
    if (key === 'TP' || !match(version, key)) continue;
    return versions[key] === 'y';
  }
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
