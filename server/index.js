import {formatInteger, formatNumber} from './formatters.js';

const h = (tag = 'span') => document.createElement(tag);

const makeHeader = (root, data) => {
  const totalUnknownBrowsers = Object.keys(data.stats.unknownBrowsers).length,
    section = h('section'),
    p1 = h('p'),
    p2 = h('p');

  p1.innerHTML = `Statistics: found ${formatInteger(
    data.stats.knownBrowsers + totalUnknownBrowsers
  )} distinct browsers &mdash;
    ${formatInteger(data.stats.knownBrowsers)} known and ${formatInteger(
    totalUnknownBrowsers
  )} unknown browsers. The unknown browsers cover ${formatInteger(data.stats.unknownUsers)} users (${formatNumber(
    (data.stats.unknownUsers / data.stats.totalUsers) * 100,
    {decimals: 2}
  )}%). The latter browsers and users will be ignored.`;

  p2.innerHTML = `The data below cover ${formatInteger(data.stats.adjustedTotalUsers)} users with known browsers.`;

  section.append(p1, p2);
  root.append(section);
};

const listFrameClasses = (featureName, featureFrames) =>
  featureFrames.map((frame, index) => (frame.has(featureName) ? 'frame' + index : '')).filter(item => item);

const calcFeatureFrames = data => {
  let currentFeatures = null;
  return data.frames.map(frame => {
    currentFeatures = new Set(frame.available || currentFeatures);
    if (frame.added && frame.added.length) {
      for (const name of frame.added) {
        currentFeatures.add(name);
      }
    }
    if (frame.removed && frame.removed.length) {
      for (const name of frame.removed) {
        currentFeatures.delete(name);
      }
    }
    return currentFeatures;
  });
};

const makeList = (root, data) => {
  const featureFrames = calcFeatureFrames(data);

  const p = h('p');
  p.className = 'feature-list frame0';
  p.innerHTML = data.frames[0].available
    .map(
      featureName =>
        `<span class="feature-item ${listFrameClasses(featureName, featureFrames).join(' ')}"><a href="${
          'https://caniuse.com/' + featureName
        }" title="${data.featureTitles[featureName] || ''}">${featureName}</a></span>`
    )
    .join(' ');

  const section = h('section');
  section.append(p);
  root.append(section);
};

const makeTable = (root, data) => {
  const featureFrames = calcFeatureFrames(data);

  const table = h('table');
  table.className = 'feature-list frame0';
  table.innerHTML =
    '<thead><tr><th>Feature name</th><th>Description</th></tr></thead><tbody>' +
    data.frames[0].available
      .map(
        featureName =>
          `<tr class="feature-item ${listFrameClasses(featureName, featureFrames).join(' ')}"><td><a href="${
            'https://caniuse.com/' + featureName
          }" title="${data.featureTitles[featureName] || ''}">${featureName}</a></td><td>${
            data.featureTitles[featureName] || ''
          }</td></tr>`
      )
      .join('') +
    '</tbody>';

  const section = h('section');
  section.style.display = 'none';
  section.append(table);
  root.append(section);
};

const listBrowserFrameClasses = (from, to) => {
  const results = [];
  for (let i = from; i < to; ++i) {
    results.push('frame' + i);
  }
  return results;
};

const makeBrowserTable = (root, data) => {
  const featureFrames = calcFeatureFrames(data);

  const table = h('table');
  table.className = 'browser-list frame0';

  let currentBrowserIndex = 0;
  table.innerHTML =
    '<thead><tr><th class="right">#</th><th>Original browser name</th><th>Original browser version</th><th>Browser</th><th>Version</th><th class="right">Users</th></tr></thead><tbody>' +
    data.frames
      .map((frame, index) =>
        frame.browsers
          .map(
            item =>
              `<tr class="browser-item ${listBrowserFrameClasses(index, data.frames.length).join(
                ' '
              )}"><td class="right">${formatInteger(++currentBrowserIndex)}</td><td>${
                item.originalBrowserName
              }</td><td>${item.originalBrowserVersion}</td><td>${item.browser}</td><td>${item.version.major}.${
                item.version.minor
              }.${item.version.patch}.${item.version.build}</td><td class="right">${formatInteger(
                item.users
              )}</td></tr>`
          )
          .join('')
      )
      .join('') +
    '</tbody>';

  const section = h('section'),
    details = h('details'),
    summary = h('summary');
  summary.innerHTML = `The list of known browsers (${formatInteger(currentBrowserIndex)})`;
  details.append(summary, table);
  section.append(details);
  root.append(section);
};

const makeUnknownBrowserTable = (root, data) => {
  const table = h('table');
  table.className = 'unknown-browser-list frame0';

  let currentBrowserIndex = 0;
  table.innerHTML =
    '<thead><tr><th class="right">#</th><th>Browser</th><th class="right">Users</th></tr></thead><tbody>' +
    Object.keys(data.stats.unknownBrowsers)
      .map(
        name =>
          `<tr class="unknown-browser-item"><td class="right">${formatInteger(
            ++currentBrowserIndex
          )}</td><td>${name}</td><td class="right">${formatInteger(data.stats.unknownBrowsers[name])}</td></tr>`
      )
      .join('') +
    '</tbody>';

  const section = h('section'),
    details = h('details'),
    summary = h('summary');
  summary.innerHTML = `The list of unknown browsers (${formatInteger(currentBrowserIndex)})`;
  details.append(summary, table);
  section.append(details);
  root.append(section);
};

const makeInput = (type, name, value, labelText, active) => {
  const input = h('input');
  input.type = type;
  input.name = name;
  input.value = value;
  input.checked = !!active;

  const label = h('label');
  label.append(input);
  if (typeof labelText == 'string') {
    label.append(document.createTextNode(' ' + labelText));
  } else if (labelText) {
    label.append(labelText);
  }
  return label;
};

const makeRadioButton = (name, value, labelText, active) => makeInput('radio', name, value, labelText, active);
const makeCheckbox = (name, value, labelText, active) => makeInput('checkbox', name, value, labelText, active);

const makeControls = (root, data) => {
  const form = h('form'),
    f1 = h('fieldset'),
    f2 = h('fieldset');
  form.append(f1, f2);
  form.className = 'feature-control';

  const l1 = h('legend');
  l1.innerHTML = 'Percentage of users';
  f1.append(l1);

  const switchFrames = data.frames.map((frame, index) =>
    makeRadioButton(
      'frame',
      'frame' + index,
      `${formatNumber((frame.users / data.stats.adjustedTotalUsers) * 100, {decimals: 2})}% (${formatInteger(
        frame.users
      )} users)`,
      !index
    )
  );
  f1.append(...switchFrames);

  const l2 = h('legend');
  l2.innerHTML = 'Show features';
  f2.append(l2);

  const blankLine = h();
  blankLine.innerHTML = '&nbsp;';

  f2.append(
    makeRadioButton('visibility', 'both', 'show all features', true),
    makeRadioButton('visibility', 'available', 'available only'),
    makeRadioButton('visibility', 'missing', 'missing only'),
    blankLine,
    makeCheckbox('table', 'yes', 'show as table')
  );

  form.addEventListener('change', event => {
    const target = event.target;
    if (target.tagName !== 'INPUT') return;
    const roots = document.querySelectorAll('.feature-list');
    if (!roots.length) return;
    if (target.type === 'radio') {
      if (target.name === 'frame') {
        const oldFrames = Array.from(roots[0].classList).filter(name => /^frame\d+$/.test(name));
        [...roots, ...document.querySelectorAll('.browser-list')].forEach(root => {
          root.classList.remove(...oldFrames);
          root.classList.add(target.value);
        });
        return;
      }
      if (target.name === 'visibility') {
        switch (target.value) {
          case 'available':
            Array.from(roots).forEach(root => {
              root.classList.remove('hide-available');
              root.classList.add('hide-missing');
            });
            break;
          case 'missing':
            Array.from(roots).forEach(root => {
              root.classList.remove('hide-missing');
              root.classList.add('hide-available');
            });
            break;
          default:
            Array.from(roots).forEach(root => {
              root.classList.remove('hide-available', 'hide-missing');
            });
            break;
        }
        return;
      }
    }
    if (target.type === 'checkbox') {
      if (target.name === 'table') {
        Array.from(roots).forEach(root => {
          const section = root.closest('section');
          if (!section) return;
          if (root.tagName === 'TABLE') {
            section.style.display = target.checked ? 'block' : 'none';
          } else {
            section.style.display = target.checked ? 'none' : 'block';
          }
        });
      }
    }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
  });

  const section = h('section');
  section.append(form);
  root.append(section);
};

const makeError = root => {
  const p = h('p');
  p.innerHTML =
    'There is no <code>output.json</code>. ' +
    'Please download the data file from Google Analytics and run <code>npm start</code> first.';

  const section = h('section');
  section.append(p);
  root.append(section);
};

const main = async () => {
  const root = document.getElementById('app'),
    data = await appDataPromise;

  if (!data) return makeError(root);

  makeHeader(root, data);
  makeControls(root, data);

  {
    const h2 = h('h2');
    h2.innerHTML = 'Features';
    root.append(h2);
  }
  makeList(root, data);
  makeTable(root, data);

  {
    const h2 = h('h2');
    h2.innerHTML = 'Browsers';
    root.append(h2);
  }
  makeBrowserTable(root, data);

  {
    const h2 = h('h2');
    h2.innerHTML = 'Unknown browsers';
    root.append(h2);
  }
  makeUnknownBrowserTable(root, data);
};

document.addEventListener('DOMContentLoaded', main);
