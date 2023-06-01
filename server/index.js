import {formatInteger, formatNumber} from './formatters.js';
import {build} from './h.js';

const getClusterSize = cluster => Object.values(cluster).reduce((acc, values) => acc + values.length, 0);

export const stringify = version =>
  version.major +
  (version.minor || version.patch || version.build ? '.' + version.minor : '') +
  (version.patch || version.build ? '.' + version.patch : '') +
  (version.build ? '.' + version.build : '') +
  (version.prerelease ? '-' + prerelease : '') +
  (version.buildMeta ? '+' + buildMeta : '');

const makeHeader = (root, data) => {
  const totalUnknownBrowsers = Object.keys(data.stats.unknownBrowsers).length;
  build(
    [
      'section',
      [
        'p',
        {
          $: {
            innerHTML: `Statistics: found ${formatInteger(
              data.stats.knownBrowsers + totalUnknownBrowsers
            )} distinct browsers &mdash; ${formatInteger(data.stats.knownBrowsers)} known and ${formatInteger(
              totalUnknownBrowsers
            )} unknown browsers. After clustering we found ${formatInteger(data.stats.uniqueBrowsers)} unique browsers.`
          }
        }
      ],
      [
        'p',
        `The unknown browsers cover ${formatInteger(data.stats.unknownUsers)} users (${formatNumber(
          (data.stats.unknownUsers / data.stats.totalUsers) * 100,
          {decimals: 2}
        )}%). The users of unknown browsers will be ignored.`
      ],
      ['p', `The data below cover ${formatInteger(data.stats.adjustedTotalUsers)} users with known browsers.`]
    ],
    root
  );
};

const makeInput = (type, name, value, labelText, active) => [
  'label',
  ['input', {type, name, value, $: {checked: !!active}}],
  typeof labelText == 'string' ? ' ' + labelText : labelText
];

const makeRadioButton = (name, value, labelText, active) => makeInput('radio', name, value, labelText, active);

const formControl = event => {
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
};

const makeControls = (root, data) => {
  build(
    [
      'section',
      [
        'form.feature-control',
        {submit: event => event.preventDefault(), change: formControl},
        [
          'fieldset',
          ['legend', 'Percentage of users'],
          ...data.frames.map((frame, index) =>
            makeRadioButton(
              'frame',
              'frame' + index,
              `${formatNumber((frame.users / data.stats.adjustedTotalUsers) * 100, {decimals: 2})}% (${formatInteger(
                frame.users
              )} users)`,
              !index
            )
          )
        ],
        [
          'fieldset',
          ['legend', 'Show features'],
          makeRadioButton('visibility', 'both', 'show all features', true),
          makeRadioButton('visibility', 'available', 'available only'),
          makeRadioButton('visibility', 'missing', 'missing only')
        ]
      ]
    ],
    root
  );
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

const makeList = data => {
  const featureFrames = calcFeatureFrames(data);
  return build([
    'section',
    [
      'p.feature-list.frame0',
      data.frames[0].available.map(featureName => [
        `span.feature-item${listFrameClasses(featureName, featureFrames)
          .map(name => '.' + name)
          .join('')}`,
        ['a', {href: 'https://caniuse.com/' + featureName, title: data.featureTitles[featureName] || ''}, featureName]
      ])
    ]
  ]);
};

const makeTable = data => {
  const featureFrames = calcFeatureFrames(data);
  return build([
    'section',
    [
      'table.feature-list.frame0',
      ['thead', ['tr', ['th', 'Feature name'], ['th', 'Description']]],
      [
        'tbody',
        data.frames[0].available.map(featureName => [
          'tr',
          {className: ['feature-item', ...listFrameClasses(featureName, featureFrames)]},
          [
            'td',
            [
              'a',
              {href: 'https://caniuse.com/' + featureName, title: data.featureTitles[featureName] || ''},
              featureName
            ]
          ],
          ['td', data.featureTitles[featureName] || '']
        ])
      ]
    ]
  ]);
};

const listBrowserFrameClasses = (from, to) => {
  const results = [];
  for (let i = from; i < to; ++i) {
    results.push('frame' + i);
  }
  return results;
};

const makeBrowserTable = data => {
  let currentBrowserIndex = 0;
  const table = [
    'table.browser-list.frame0',
    ['thead', ['tr', ['th.right', '#'], ['th', 'Browser'], ['th', 'Versions'], ['th.right', 'Users']]],
    [
      'tbody',
      data.frames.map((frame, index) =>
        frame.browsers.map(item => {
          const browsers = Object.keys(item.cluster);
          return browsers.map((browser, browserIndex) =>
            browserIndex
              ? [
                  'tr',
                  {className: ['browser-item', ...listBrowserFrameClasses(index, data.frames.length)]},
                  ['td', browser],
                  ['td', item.cluster[browser].map(stringify).join(', ')]
                ]
              : [
                  'tr',
                  {className: ['browser-item', ...listBrowserFrameClasses(index, data.frames.length)]},
                  ['td.right', {rowspan: browsers.length}, formatInteger(++currentBrowserIndex)],
                  ['td', browser],
                  ['td', item.cluster[browser].map(stringify).join(', ')],
                  ['td.right', {rowspan: browsers.length}, formatInteger(item.users)]
                ]
          );
        })
      )
    ]
  ];
  return build([['p', `The list of known browsers (${formatInteger(currentBrowserIndex)}):`], table]);
};

const makeClusterTable = (data, index) => {
  const frame = data.frames[index];
  let currentBrowserIndex = 0;
  const table = [
    'table.unknown-browser-list',
    ['thead', ['tr', ['th.right', '#'], ['th', 'Browser'], ['th', 'Versions']]],
    [
      'tbody',
      Object.entries(frame.cluster).map(([browser, versions]) => [
        'tr',
        ['td.right', formatInteger(++currentBrowserIndex)],
        ['td', browser],
        ['td', versions.map(stringify).join(', ')]
      ])
    ]
  ];
  return build([
    'section.frame-cluster.frame' + index,
    [
      'p',
      `The following cluster of browsers (${formatInteger(getClusterSize(frame.cluster))}) covers ${formatInteger(
        frame.users
      )} (${formatNumber((frame.users / data.stats.adjustedTotalUsers) * 100, {decimals: 2})}%) users:`
    ],
    table
  ]);
};

const makeClusterTables = data =>
  build(['section.browser-list.frame0', ...data.frames.map((_, index) => makeClusterTable(data, index))]);

const makeUnknownBrowserTable = data => {
  let currentBrowserIndex = 0;
  const table = [
    'table.unknown-browser-list',
    ['thead', ['tr', ['th.right', '#'], ['th', 'Browser'], ['th.right', 'Users']]],
    [
      'tbody',
      Object.keys(data.stats.unknownBrowsers).map(name => [
        'tr.unknown-browser-item',
        ['td.right', formatInteger(++currentBrowserIndex)],
        ['td', name],
        ['td.right', formatInteger(data.stats.unknownBrowsers[name])]
      ])
    ]
  ];
  return build([['p', `The list of unknown browsers (${formatInteger(currentBrowserIndex)}):`], table]);
};

const makeSelectedFeatures = (data, featureName, users, unsupported) => {
  const table = unsupported => {
    let currentBrowserIndex = 0;
    return [
      'table.unknown-browser-list',
      ['thead', ['tr', ['th.right', '#'], ['th', 'Browser'], ['th', 'Versions'], ['th.right', 'Users']]],
      [
        'tbody',
        unsupported.map(({cluster, users}) => {
          const browsers = Object.keys(cluster);
          return browsers.map((browser, index) =>
            index
              ? ['tr.unknown-browser-item', ['td', browser], ['td', cluster[browser].map(stringify).join(', ')]]
              : [
                  'tr.unknown-browser-item',
                  ['td.right', {rowspan: browsers.length}, formatInteger(++currentBrowserIndex)],
                  ['td', browser],
                  ['td', cluster[browser].map(stringify).join(', ')],
                  ['td.right', {rowspan: browsers.length}, formatInteger(users)]
                ]
          );
        })
      ]
    ];
  };

  return build([
    '',
    [
      'h3',
      ['a', {href: 'https://caniuse.com/' + featureName, title: data.featureTitles[featureName]}, featureName],
      ': ' + data.featureTitles[featureName]
    ],
    [
      'p',
      `This feature is supported by ${formatInteger(users)} (${formatNumber(
        (users / data.stats.adjustedTotalUsers) * 100,
        {decimals: 2}
      )}%) users.`
    ],
    ['p', `The list of browser clusters that do not support this feature (${formatInteger(unsupported.length)}):`],
    table(unsupported)
  ]);
};

const buildTabs = tabs => {
  const form = build(['form.tabs', {submit: event => event.preventDefault()}]);
  let counter = 0;
  for (const [name, dom] of Object.entries(tabs)) {
    build(
      [
        [
          'input.tab',
          {type: 'radio', name: 'tabs', value: 'tab' + counter, $: {checked: !counter}, id: 'tab' + counter}
        ],
        ['label.tab', {for: 'tab' + counter}, name],
        ['section.tab', dom]
      ],
      form
    );
    ++counter;
  }
  return form;
};

const makeError = root =>
  build(
    [
      'section',
      [
        'p',
        {
          $: {
            innerHTML:
              'There is no <code>output.json</code>. ' +
              'Please download the data file from Google Analytics and run <code>npm start</code> first.'
          }
        }
      ]
    ],
    root
  );

const main = async () => {
  const root = document.getElementById('app'),
    data = await appDataPromise;

  if (!data) return makeError(root);

  makeHeader(root, data);
  makeControls(root, data);

  const tabs = {
    'Features (list)': makeList(data),
    'Features (table)': makeTable(data),
    Browsers: makeBrowserTable(data),
    Cluster: makeClusterTables(data),
    'Unknown browsers': makeUnknownBrowserTable(data)
  };

  if (data.features) {
    Object.entries(data.features).forEach(([featureName, {users, unsupported}]) => {
      tabs['Feature: ' + featureName] = makeSelectedFeatures(data, featureName, users, unsupported);
    });
  }

  root.appendChild(buildTabs(tabs));
};

document.addEventListener('DOMContentLoaded', main);
