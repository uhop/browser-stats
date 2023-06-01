import {compare} from './version.js';

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
  browsers.sort(
    (a, b) => (a.browser < b.browser ? -1 : b.browser < a.browser ? 1 : 0) || compare(a.version, b.version)
  );

  // cluster by versions
  const clusteredBrowsers = [];
  while (browsers.length) {
    const current = browsers.pop();
    while (browsers.length) {
      const top = browsers[browsers.length - 1];
      if (current.browser !== top.browser || compare(current.version, top.version)) break;
      current.users += top.users;
      browsers.pop();
    }
    clusteredBrowsers.push(current);
  }

  // descending sort by users
  return clusteredBrowsers.sort((a, b) => b.users - a.users);
};

export default clusterVersions;
