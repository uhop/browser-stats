// copied from https://github.com/heya/dom under BSD-3 and slightly modified

// create.js

export const namespaces = {
  svg: 'http://www.w3.org/2000/svg',
  xlink: 'http://www.w3.org/1999/xlink',
  ev: 'http://www.w3.org/2001/xml-events',
  xml: 'http://www.w3.org/XML/1998/namespace'
};

const parseName = /^(?:(\w+)\:)?([^\s\.#]*)/,
  parseSelector = /[\.#][^\s\.#]+/g;

export function assignStyle(node, styles) {
  for (const [key, value] of Object.entries(styles)) {
    if (key === '$') {
      setStyle(node, value);
    } else {
      node.style[key] = value;
    }
  }
  return node;
}

export function setStyle(node, styles) {
  for (const [key, value] of Object.entries(styles)) {
    if (key === '$') {
      assignStyle(node, value);
    } else {
      node.style.setProperty(key, value);
    }
  }
  return node;
}

export function setData(node, dataset) {
  for (const [key, value] of Object.entries(dataset)) {
    node.dataset[key] = value;
  }
  return node;
}

const addListener = (node, name, value) => {
  if (name.substring(0, 2) == 'on') {
    name = name.substring(2);
  }
  node.addEventListener(name, value, false);
};

export function setProps(node, props, options) {
  for (const [key, value] of Object.entries(props)) {
    switch (key) {
      case '$':
        setAttrs(node, value, options);
        break;
      case 'style':
        if (typeof value == 'string') {
          node.style.cssText = value;
        } else {
          setStyle(node, value);
        }
        break;
      case 'dataset':
        setData(node, value);
        break;
      case 'class':
      case 'className':
        node.className = Array.isArray(value) ? value.join(' ') : value;
        break;
      case '$ref':
        if (typeof value == 'function') {
          props.$ref(node);
        } else if (typeof value == 'object' && value) {
          value.ref = node;
        }
        break;
      default:
        if (typeof value == 'function') {
          addListener(node, key, value);
        } else {
          node[key] = value;
        }
        break;
    }
  }
  return node;
}
export const setProperties = setProps;

export function setAttrs(node, attributes, options) {
  for (const [key, value] of Object.entries(attributes)) {
    switch (key) {
      case '$':
        if (options && typeof options.setComponentProperties == 'function' && node.tagName.indexOf('-') > 0) {
          options.setComponentProperties(node, value, options);
        } else {
          setProps(node, value, options);
        }
        break;
      case 'style':
        if (typeof value == 'string') {
          node.style.cssText = value;
        } else {
          setStyle(node, value);
        }
        break;
      case 'class':
      case 'className':
        node.className = Array.isArray(value) ? value.join(' ') : value;
        break;
      case '$ref':
        if (typeof value == 'function') {
          attributes.$ref(node);
        } else if (typeof value == 'object' && value) {
          value.ref = node;
        }
        break;
      default:
        const name = parseName.exec(key);
        if (name && name[1]) {
          if (value !== null) {
            node.setAttributeNS(namespaces[name[1]], name[2], value);
          } else {
            node.removeAttributeNS(namespaces[name[1]], name[2]);
          }
          break;
        }
        if (typeof value == 'function') {
          addListener(node, key, value);
        } else if (value !== null) {
          node.setAttribute(key, value);
        } else {
          node.removeAttribute(key);
        }
        break;
    }
  }
  return node;
}
export const setAttributes = setAttrs;

export const createText = (text, parent, options) => {
  let doc = (options && options.document) || document;
  if (parent) {
    if (parent.nodeType === 9) {
      doc = parent;
      parent = null;
    } else {
      doc = parent.ownerDocument || doc;
    }
  }
  const node = doc.createTextNode(text);
  if (parent && parent.nodeType === 1) {
    parent.appendChild(node);
  }
  return node;
};

export const create = (tag, attributes, parent, ns, options) => {
  let doc = (options && options.document) || document;
  if (parent) {
    if (parent.nodeType === 9) {
      doc = parent;
      parent = null;
    } else {
      doc = parent.ownerDocument || doc;
    }
  }

  // create an element
  const name = parseName.exec(tag);
  ns = name[1] || ns;

  const node = ns ? doc.createElementNS(namespaces[ns], name[2] || 'div') : doc.createElement(name[2] || 'div');

  if (name[0].length < tag.length) {
    // add selector's classes and ids
    tag.substring(name[0].length).replace(parseSelector, function (match) {
      switch (match.charAt(0)) {
        case '.':
          node.classList.add(match.substring(1));
          break;
        case '#':
          node.id = match.substring(1);
          break;
      }
      return '';
    });
  }

  if (attributes) {
    setAttrs(node, attributes, options);
  }

  if (parent && parent.nodeType === 1) {
    parent.appendChild(node);
  }
  return node;
};

// build.js

const textTypes = {string: 1, number: 1, boolean: 1};

export const build = (vdom, parent, options) => {
  let doc = (options && options.document) || document,
    node;
  const stack = [parent, vdom, null];

  if (parent) {
    if (parent.nodeType === 9) {
      doc = parent;
      parent = null;
    } else {
      doc = parent.ownerDocument || doc;
    }
  }

  while (stack.length) {
    const ns = stack.pop(),
      element = stack.pop();
    parent = stack.pop();
    node = null;

    // deref element
    while (typeof element == 'function') {
      element = element(options);
    }

    if (!Array.isArray(element)) {
      // make a specialty node
      if (textTypes[typeof element] || element instanceof Date || element instanceof RegExp) {
        // text
        node = doc.createTextNode(element.toString());
      } else if (!element) {
        // skip
      } else if (typeof element.appendChild == 'function') {
        // node
        node = element;
      } else if (parent && typeof element == 'object') {
        // attributes
        setAttrs(parent, element, options);
      }
      // add it to a parent
      if (node && parent) {
        parent.appendChild(node);
      }
      continue;
    }

    // array: element or children
    let tag = element[0];
    // deref tag
    while (typeof tag == 'function') {
      tag = tag(options);
    }
    // make a node
    if (typeof tag == 'string') {
      // tag
      node = create(tag, null, doc, ns, options);
    } else if (tag && typeof tag.appendChild == 'function') {
      // node
      node = tag;
      tag = node.tagName;
    } else if (Array.isArray(tag)) {
      // children
      if (element.length > 1 && !parent) {
        parent = doc.createDocumentFragment();
      }
      node = parent;
    }
    let from = 0;
    if (node && node !== parent) {
      // redefine a default namespace for children
      switch (tag.toLowerCase()) {
        case 'svg':
          ns = 'svg';
          break;
        case 'foreignobject':
          ns = null;
          break;
      }
      // add children
      stack.push(parent, node, ns);
      from = 1;
    }
    // add children to the stack in the reverse order
    for (let i = element.length; i > from; ) {
      stack.push(node, element[--i], ns);
    }
  }

  return parent || node;
};

// fromHtml.js

export const fromHtml = (html, options) => {
  const doc = (options && options.document) || document,
    context = (options && options.context) || doc.body,
    range = doc.createRange();
  range.selectNode(context);
  return range.createContextualFragment(html);
};

// place.js

export const place = (node, refNode, position) => {
  // position values:
  //   a positive number: indicates where to insert node as a child of refNode
  //   a negative number: like above but counts from the last child backward
  //   "before":  inserts node before refNode
  //   "after":   inserts node after refNode
  //   "replace": replaces refNode with node
  //   "only":    removes all children of refNode and appends node
  //   "first":   inserts node as the first child of refNode
  //   "last":    inserts node as the last child of refNode
  //   anything else is equivalent to "last"

  // the idea with numbers is that node becomes the position-th child
  // examples: 0 - node is the first child, -1 - node is the last child

  if (typeof position == 'number') {
    const children = refNode.childNodes;
    if (position < 0) position = children.length + position + 1;
    if (!children.length || children.length <= position) {
      refNode.appendChild(node);
    } else {
      refNode.insertBefore(node, children[position < 0 ? 0 : position]);
    }
    return node;
  }

  const parent = refNode.parentNode;
  switch (position) {
    case 'before':
      if (parent) {
        parent.insertBefore(node, refNode);
      }
      break;
    case 'after':
      if (parent) {
        parent.insertBefore(node, refNode.nextSibling);
      }
      break;
    case 'replace':
      if (parent) {
        parent.replaceChild(node, refNode);
      }
      break;
    case 'only':
      refNode.innerHTML = '';
      refNode.appendChild(node);
      break;
    case 'first':
      refNode.insertBefore(node, refNode.firstChild);
      break;
    default: // last
      refNode.appendChild(node);
  }
  return node;
};

// hyperscript.js

// implementing hyperscript (see https://github.com/dominictarr/hyperscript)
export const h = (node, ...children) => {
  if (typeof node == 'string') {
    node = create(node);
  }
  for (const child of children) {
    if (textTypes[typeof child] || child instanceof Date || child instanceof RegExp) {
      node.appendChild(node.ownerDocument.createTextNode(child.toString()));
    } else if (!child) {
      // skip
    } else if (Array.isArray(child)) {
      h(node, ...child);
    } else if (typeof child.appendChild == 'function') {
      node.appendChild(child);
    } else {
      setProps(node, child);
    }
  }
  return node;
};
export const hyperscript = h;
