import {collectFeatures, getAllFeatures} from './features.js';
import {isSubsetOf} from './set-ops.js';
import BrowserCluster from './clusters.js';

const clusterFeatures = browsers => {
  const result = [],
    allFeatures = getAllFeatures();

  let browsersCopy = browsers.map(
    item =>
      new BrowserCluster(
        item.browser,
        item.version,
        item.users,
        collectFeatures(item.browser, item.version, allFeatures)
      )
  );

  // sorting ascending on a number of features, then on users
  browsersCopy.sort((a, b) => a.features.size - b.features.size || a.users - b.users);

  // extract clusters with the same set of features
  while (browsersCopy.length) {
    const current = browsersCopy.pop();
    browsersCopy = browsersCopy.filter(item => {
      if (item.features.size !== current.features.size) return true;
      if (isSubsetOf(item.features, current.features)) {
        current.addBrowser(item.browser, item.version, item.users);
        return false;
      }
      return true;
    });
    result.push(current);
  }

  // sort cluster descending by users and normalize results
  result.sort((a, b) => b.users - a.users);
  result.forEach(item => item.normalize());

  return result;
};

export default clusterFeatures;
