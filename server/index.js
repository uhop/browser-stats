import {formatInteger, formatNumber} from './formatters.js';
import {build} from './h.js';

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

export const stringify = version =>
  version.major +
  '.' +
  version.minor +
  '.' +
  version.patch +
  (version.build ? '.' + version.build : '') +
  (version.prerelease ? '-' + prerelease : '') +
  (version.buildMeta ? '+' + buildMeta : '');

const makeBrowserTable = data => {
  let currentBrowserIndex = 0;
  const table = [
    'table.browser-list.frame0',
    ['thead', ['tr', ['th.right', '#'], ['th', 'Browser'], ['th', 'Version'], ['th.right', 'Users']]],
    [
      'tbody',
      data.frames.map((frame, index) =>
        frame.browsers.map(item => [
          'tr',
          {className: ['browser-item', ...listBrowserFrameClasses(index, data.frames.length)]},
          ['td.right', formatInteger(++currentBrowserIndex)],
          ['td', item.browser],
          ['td', stringify(item.version)],
          ['td.right', formatInteger(item.users)]
        ])
      )
    ]
  ];
  return build([['p', `The list of known browsers (${formatInteger(currentBrowserIndex)}):`], table]);
};

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

const makeSelectedFeatures = data => {
  if (!data.features) return;

  let currentBrowserIndex = 0;
  const table = unsupported => [
    'table.unknown-browser-list',
    ['thead', ['tr', ['th.right', '#'], ['th', 'Browser'], ['th.right', 'Users']]],
    [
      'tbody',
      Object.entries(unsupported).map(([name, value]) => [
        'tr.unknown-browser-item',
        ['td.right', formatInteger(++currentBrowserIndex)],
        ['td', name],
        ['td.right', formatInteger(value)]
      ])
    ]
  ];

  return build(
    Object.entries(data.features).map(([featureName, {users, unsupported}]) => {
      const keys = Object.keys(unsupported);
      return [
        [
          'h3',
          ['a', {href: 'https://caniuse.com/' + featureName, title: data.featureTitles[featureName]}, featureName],
          ': ' + data.featureTitles[featureName]
        ],
        [
          'p',
          `This feature is supported by ${formatInteger(users)} users (${formatNumber(
            (users / data.stats.adjustedTotalUsers) * 100,
            {decimals: 2}
          )}%).`
        ],
        [
          'details',
          ['summary', `The list of browsers that do not support this feature (${formatInteger(keys.length)})`],
          table(unsupported)
        ]
      ];
    })
  );
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

  const tabs = buildTabs({
    'Features (list)': makeList(data),
    'Features (table)': makeTable(data),
    Browsers: makeBrowserTable(data),
    'Unknown browsers': makeUnknownBrowserTable(data),
    'Selected features': makeSelectedFeatures(data)
  });

  root.appendChild(tabs);
};

document.addEventListener('DOMContentLoaded', main);
