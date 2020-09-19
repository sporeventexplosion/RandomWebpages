((window, document) => {
  const toNode = v => v instanceof Node ? v : document.createTextNode(v);
  const createElement = (name, attrs, ...children) => {
    const el = document.createElement(name);
    attrs && Object.keys(attrs).forEach(k => {
      const v = attrs[k];
      if (k.slice(0,2) === 'on' && k.length > 2) {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (typeof v !== 'boolean') {
        el.setAttribute(k, v);
      } else if (v) {
        el.setAttribute(k, '');
      }
    });
    children.forEach(child => {
      if (Array.isArray(child)) {
        child.forEach(subchild => {
          el.appendChild(toNode(subchild));
        });
      } else {
        el.appendChild(toNode(child));
      }
    });
    return el;
  };
  const e = createElement;

  const collectString = (iter) => {
    let str = '';
    for (const piece of iter) {
      str += piece;
    }
    return str;
  };

/**
  * Escape code types
  * <Esc>n.text
  * <Esc>n,text
  * <Esc>n:m,text
  */
  const tokenizeParagraph = function*(str) {
    let start = 0;
    let escape = false;
    for (let i = 0; i < str.length; i++) {
      if (escape) {
        const nmatch = /^[1-9]\d*/.exec(str.slice(i));
        if (nmatch === null) {
          throw new TypeError('Unsupported escape code');
        }
        const nstr = nmatch[0];
        if (nstr === null) {
          throw new TypeError('Unsupported escape code');
        }
        i += nstr.length;
        const n = parseInt(nstr);
        const mode = str[i];
        if (mode !== '.' && mode !== ',' && mode !== ':') {
          throw new TypeError('Unsupported escape code');
        }
        i++;
        if (mode === '.') {
          const type = 'hidden';
          const value = '\u3007'.repeat(n);
          const actual = str.slice(i, i + n);
          i += n;
          yield {type, value, actual};
        } else if (mode === ',') {
          const type = 'partial';
          const value = nstr;
          const actual = str.slice(i, i + n);
          i += n;
          yield {type, value, actual};
        } else if (mode === ':') {
          const mmatch = /^[1-9]\d*/.exec(str.slice(i));
          if (mmatch === null) {
            throw new TypeError('Unsupported escape code');
          }
          const mstr = mmatch[0];
          if (mstr === null) {
            throw new TypeError('Unsupported escape code');
          }
          i += mstr.length;
          const m = parseInt(mstr);
          if (m > n || str[i] !== ',') {
            throw new TypeError('Unsupported escape code');
          }
          i++;
          const type = 'partial';
          const actual = str.slice(i, i + n);
          const value = actual.slice(0, m);
          i += n;
          yield {type, value, actual};
        }
        start = i;
        escape = false;
      }
      if (str[i] === '\u001b') {
        if (i > start) {
          yield {type: 'regular', value: str.slice(start, i)};
        }
        escape = true;
      }
    }
    if (str.length > start) {
      yield {type: 'regular', value: str.slice(start)};
    }
  };
  window.tp = tokenizeParagraph;

  const stringParityIter = function*(str, parity) {
    let i = 0;
    for (const ch of str) {
      const n = ch.codePointAt(0);
      if (n == 0xa) {
        yield ch;
        i = 0;
      } else if (n >= 0x4e00 && n <= 0x9fff) {
        if (i % 2 === parity) {
          yield ch;
        } else {
          yield '\u001b1.' + ch;
        }
        i++;
      } else {
        yield ch;
      }
    }
  };

  const CJK_RUN_REGEX = /[\u4e00-\u9fff]+/g;

  const transformText = (mode, text) => {
    switch (mode) {
      case 'original':
        return text;
      case 'keep-0':
      case 'keep-1': {
        const parity = mode === 'keep-0' ? 0 : 1;
        return collectString(stringParityIter(text, parity));
      }
      case 'run-first-last':
        return text.replace(CJK_RUN_REGEX, match => {
          /* does not need to handle surrogate pairs */
          if (match.length <= 2) {
            return match;
          } else {
            return `${match[0]}\u001b${match.length - 2}.${match.slice(1, -1)}${match[match.length - 1]}`;
          }
        });
      case 'run-first-and-length':
        return text.replace(CJK_RUN_REGEX, match => match[0] + (match.length > 1 ? `\u001b${match.length - 1},${match.slice(1)}` : ''));
      case 'run-first':
        return text.replace(CJK_RUN_REGEX, match => `\u001b${match.length}:1,${match}`);
      case 'run-length':
        return text.replace(CJK_RUN_REGEX, match => '\u001b' + match.length.toString() + ',' + match);
      default:
        throw new TypeError(`Invalid mode ${mode}`);
    }
  };
  window.t = transformText;

  const MODES = [
    {id: 'original', name: 'Original'},
    {id: 'keep-0', name: 'Skip even'},
    {id: 'keep-1', name: 'Skip odd'},
    {id: 'run-first-last', name: 'First and last character of run'},
    {id: 'run-first-and-length', name: 'First character of run and length'},
    {id: 'run-first', name: 'First character of run'},
    {id: 'run-length', name: 'Run length'},
  ];

  const getStringId = (() => {
    const prefix = 'a-'
    let i = 0;
    return () => prefix + (i++).toString(36);
  })();

  class Component {
    build() {}
    unbuild() {}
  }
  class ModeSelector extends Component {
    constructor(modes, handleChange) {
      super();
      this.$el = null;
      this.modes = modes;
      this.handleChange = handleChange;
      this.mode = modes[0].id;
      this.original = modes[0].id;
      this.isViewingOriginal = false;
      this.disableViewOriginal = this.disableViewOriginal.bind(this);
    }
    disableViewOriginal() {
      if (this.isViewingOriginal) {
        this.handleChange(this.mode);
        this.isViewingOriginal = false;
      }
    }
    build() {
      const controlName = getStringId();
      document.addEventListener('mouseup', this.disableViewOriginal);
      document.addEventListener('blur', this.disableViewOriginal);
      this.$el = e('div', {class: 'mode-selector'},
        e('button', {
          onMousedown: () => {
            this.handleChange(this.original);
            this.isViewingOriginal = true;
          },
        }, 'View original'),
        this.modes.map(
          ({id, name}, i) => {
            const optionName = getStringId();
            return e('div', null,
              e('input', {
                type: 'radio',
                id: optionName,
                name: controlName,
                value: id,
                checked: i === 0,
                onInput: () => {
                  this.mode = id;
                  this.handleChange(id);
                },
              }),
              e('label', {for: optionName}, name),
            );
          }
        )
      );
      this.handleChange(this.modes[0].id);
      return this.$el;
    }
    unbuild() {
      document.removeEventListener('mouseup', this.onMouseup);
      document.removeEventListener('blur', this.onMouseup);
    }
  }
  const getParagraphNodes = (paragraph) => Array.from(
    tokenizeParagraph(paragraph),
    token => {
      if (token.type === 'regular') {
        return token.value;
      } else if (token.type === 'hidden') {
        return e('span', {class: 's-hidden', 'data-value': token.value, 'data-actual': token.actual}, token.value);
      } else if (token.type === 'partial') {
        return e('span', {class: 's-showable', 'data-value': token.value, 'data-actual': token.actual}, token.value);
      } else {
        throw new TypeError('Invalid token type');
      }
    });
  class ParagraphList extends Component {
    constructor() {
      super();
      this.$el = null;
      this.nodes = [];
      this.showHidden = this.showHidden.bind(this);
      this.disableShowHidden = this.disableShowHidden.bind(this);
      this.shownFragments = new Set();
    }
    build() {
      document.addEventListener('mouseup', this.disableShowHidden);
      document.addEventListener('blur', this.disableShowHidden);
      this.$el = e('div', {class: 'paragraph-list'});
      this.$el.addEventListener('mousedown', (e) => this.showHidden(e.target));
      return this.$el;
    }
    unbuild() {
      document.removeEventListener('mouseup', this.disableShowHidden);
      document.removeEventListener('blur', this.disableShowHidden);
      this.shownFragments.clear();
    }
    showHidden($frag) {
      if ($frag instanceof HTMLSpanElement && typeof $frag.dataset.actual === 'string') {
        this.shownFragments.add($frag);
        $frag.textContent = $frag.dataset.actual;
        $frag.classList.add('s-shown');
      }
    }
    disableShowHidden() {
      for (const $frag of this.shownFragments) {
        $frag.classList.remove('s-shown');
        $frag.textContent = $frag.dataset.value;
      }
      this.shownFragments.clear();
    }
    updateParagraph(text, $node) {
      $node.textContent = '';
      getParagraphNodes(text).forEach($x => $node.appendChild(toNode($x)));
    }
    update(paragraphs) {
      let i;
      for (i = 0; i < paragraphs.length; i++) {
        const text = paragraphs[i];
        if (i >= this.nodes.length) {
          const $node = e('p', null);
          this.updateParagraph(text, $node);
          this.nodes.push([text, $node]);
          this.$el.appendChild($node);
        } else if (this.nodes[i][0] !== text) {
          this.nodes[i][0] = text;
          this.updateParagraph(text, this.nodes[i][1]);
        }
      }
      while (this.nodes.length > i) {
        this.nodes.pop()[1].remove();
      }
    }
  }
  class App extends Component {
    constructor() {
      super();
      this.text = '';
      this.mode = MODES[0].id;
      this.$el = null;
      this.$$paragraphList = null;
      this.$$modeSelector = null;
    }
    build() {
      this.$$paragraphList = new ParagraphList();
      const $pl = this.$$paragraphList.build();
      this.$$paragraphList.update([]);

      this.$$modeSelector = new ModeSelector(MODES, (mode) => this.changeMode(mode));
      const $ms = this.$$modeSelector.build();

      this.$el = e('div', null,
        e('h1', null, 'Chinese Memorizer'),
        e('textarea', {autofocus: true, class: 'input-area', onInput: (e) => this.handleInput(e.target.value)}),
        $ms,
        $pl,
      );
      return this.$el;
    }
    unbuild() {
      this.$$paragraphList.unbuild();
      this.$$modeSelector.unbuild();
    }
    handleInput(value) {
      this.text = value;
      this.updateText();
    }
    changeMode(mode) {
      this.mode = mode;
      this.updateText();
    }
    updateText() {
      // remove all instances of <esc> for easier processing
      this.$$paragraphList.update(transformText(this.mode, this.text.replace(/\u001b/g, '')).split('\n'));
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    document.body.appendChild(app.build());
  });
})(window, document);
