import {compare} from './version.js';

const dedupeVersions = versions => versions.filter((version, index) => !index || compare(version, versions[index - 1]));

class BrowserCluster {
  constructor(browser, version, users, features) {
    this.browser = browser;
    this.version = version;
    this.users = users;
    this.features = features;
    this.cluster = browser && version ? {[browser]: [version]} : {};
  }

  get size() {
    return Object.values(this.cluster).reduce((acc, values) => acc + values.length, 0);
  }

  addBrowser(browser, version, users) {
    const versions = this.cluster[browser];
    if (Array.isArray(versions)) {
      versions.push(version);
    } else {
      this.cluster[browser] = [version];
    }

    if (!this.browser) {
      this.browser = browser;
      this.version = version;
    }

    this.users += users;
    return this;
  }

  addCluster(cluster, users) {
    Object.entries(cluster).forEach(([browser, versions]) => {
      versions.forEach(version => this.addBrowser(browser, version, 0));
    });
    this.users += users;
    return this;
  }

  normalize() {
    if (this.browser) {
      Object.values(this.cluster).forEach(versions => dedupeVersions(versions.sort((a, b) => -compare(a, b))));
      // get the highest version of a browser
      this.version = this.cluster[this.browser][0];
    }
    return this;
  }
}

export default BrowserCluster;
