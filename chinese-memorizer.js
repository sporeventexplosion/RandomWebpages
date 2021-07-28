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
  const [__setKorean, onKorean, removeOnKorean] = (() => {
    const set = new Set();
    const onKorean = (fn) => {
      set.add(fn);
    };
    const removeOnKorean = (fn) => {
      set.delete(fn);
    };
    const setKorean = () => {
      for (const handler of set) {
        handler();
      }
    };
    return [setKorean, onKorean, removeOnKorean];
  })();
  window.korean = __setKorean;

/**
  * Escape code types
  * <Esc>n.text
  * <Esc>n,text
  * <Esc>n:m,text
  * <Esc>n:m.textprompt
  */
  const tokenizeParagraph = function* (str) {
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
          const submode = str[i]
          if ((submode !== '.' && submode !== ',') || (submode === ',' && m > n)) {
            throw new TypeError('Unsupported escape code');
          }
          i++;
          const type = 'partial';
          if (submode === ',') {
            const actual = str.slice(i, i + n);
            const value = actual.slice(0, m);
            i += n;
            yield {type, value, actual};
          } else {
            const actual = str.slice(i, i + n);
            i += n;
            const value = str.slice(i, i + m);
            i += m;
            yield {type, value, actual};
          }
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

  const stringParityIter = function* (str, parity) {
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
  const HANGUL_S_RUN_REGEX = /[\ua300-\ud7a3]+/g;
  const KOREAN_SENTENCE_END_REGEX = /[.!?](?:\r?\n)*/g;

  const koreanWordIter = function* (text, resetByLine = true) {
    // we need to create a copy of the regex so the state of multiple generators don't clash
    const regex = new RegExp(HANGUL_S_RUN_REGEX);
    let i = 0;
    let pos = 0;
    let lastNewline = -1;
    let match;
    while (match = regex.exec(text)) {
      if (match.index > pos) {
        const frag = text.slice(pos, match.index);
        yield [-1, frag];
        if (frag.indexOf('\n') !== -1) {
          // reset counter upon encountering newline
          i = 0;
        }
      }
      yield [i, match[0]];
      pos = regex.lastIndex;
      i++;
    }
    if (pos < text.length) {
      yield [-1, text.slice(pos)];
    }
  };

  const koreanSentenceIter = function* (text) {
    const regex = new RegExp(KOREAN_SENTENCE_END_REGEX)
    let pos = 0;
    while (regex.exec(text)) {
      yield text.slice(pos, regex.lastIndex);
      pos = regex.lastIndex;
    }
    if (pos < text.length) {
      yield text.slice(pos);
    }
  };


  const koreanTransformBy = function* (fn, iter) {
    for (const [index, text] of iter) {
      if (index === -1) {
        yield text;
      } else {
        yield fn(text, index);
      }
    }
  };

  var KOREAN_LETTERS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
  var koreanGetFirstLetter = text => KOREAN_LETTERS[Math.floor((text.codePointAt(0)-44032)/588)];

  const toRunLengthEscape = (text) => '\u001b' + text.length.toString() + ',' + text;

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
        return text.replace(CJK_RUN_REGEX, match => match[0] + (match.length > 1 ? toRunLengthEscape(match.slice(1)) : ''));
      case 'run-first':
        return text.replace(CJK_RUN_REGEX, match => `\u001b${match.length}:1,${match}`);
      case 'run-last': {
        return text.replace(CJK_RUN_REGEX, match => {
          if (match.length < 2) {
            return match;
          }
          return toRunLengthEscape(match.slice(0, -1)) + match[match.length - 1];
        });
      }
      case 'run-length':
        return text.replace(CJK_RUN_REGEX, match => toRunLengthEscape(match));
      case 'ko-keep-0':
      case 'ko-keep-1': {
        const parity = mode === 'ko-keep-0' ? 0 : 1;
        return collectString(koreanTransformBy((match, i) => i % 2 === parity ? match : toRunLengthEscape(match), koreanWordIter(text)));
      }
      case 'ko-first-syllable-of-word-and-length':
        return collectString(koreanTransformBy(match => match[0] + (match.length > 1 ? toRunLengthEscape(match.slice(1)) : ''), koreanWordIter(text)));
      case 'ko-first-letter-of-word-and-length':
        return collectString(koreanTransformBy(match => {
          const prompt = koreanGetFirstLetter(match) + (match.length > 1 ? match.length.toString() : '');
          return `\u001b${match.length}:${prompt.length}.${match}${prompt}`
        }, koreanWordIter(text)));
      case 'ko-first-letter-of-word':
        return collectString(koreanTransformBy(match => `\u001b${match.length}:1.${match}${koreanGetFirstLetter(match)}`, koreanWordIter(text)));
      case 'ko-word-length':
        return collectString(koreanTransformBy(match => toRunLengthEscape(match), koreanWordIter(text, false)));
      case 'ko-first-word-of-sentence':
        return collectString(function* (){
          for (const sentence of koreanSentenceIter(text)) {
            yield* koreanTransformBy((match, i) => i === 0 ? match : `\u001b${match.length}:1.${match}*`, koreanWordIter(sentence));
          }
        }());
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
    {id: 'run-last', name: 'Last character of run'},
    {id: 'run-length', name: 'Run length'},
  ];

  const KOREAN_MODES = [
    {id: 'original', name: 'Original'},
    {id: 'ko-keep-0', name: 'Change even to length'},
    {id: 'ko-keep-1', name: 'Change odd to length'},
    {id: 'ko-first-syllable-of-word-and-length', name: 'First syllable of word and length'},
    {id: 'ko-first-letter-of-word-and-length', name: 'First letter of word and length'},
    {id: 'ko-first-letter-of-word', name: 'First letter of word'},
    {id: 'ko-word-length', name: 'Word length'},
    {id: 'ko-first-word-of-sentence', name: 'First word of sentence'},
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
      this.$options = null;
      this.modes = modes;
      this.handleChange = handleChange;
      this.mode = modes[0].id;
      this.original = modes[0].id;
      this.isViewingOriginal = false;
      this.viewOriginal = this.viewOriginal.bind(this);
      this.disableViewOriginal = this.disableViewOriginal.bind(this);
      this.toKorean = this.toKorean.bind(this);
      this.isKorean = false;
    }
    viewOriginal() {
      this.handleChange(this.original);
      this.isViewingOriginal = true;
    }
    disableViewOriginal() {
      if (this.isViewingOriginal) {
        this.handleChange(this.mode);
        this.isViewingOriginal = false;
      }
    }
    toKorean() {
      if (this.isKorean) {
        return;
      }
      this.isKorean = true;

      this.modes = KOREAN_MODES;
      this.mode = this.modes[0].id;
      this.original = this.modes[0].id;
      const $next = this.$options.length >= 1
        ? this.$options[this.$options.length - 1].nextSibling 
        : null;
      this.$options.forEach($x => $x.remove());
      const $nextOptions = this.getRadioOptions();
      $nextOptions.forEach($x => this.$el.insertBefore($x, $next));
      this.isViewingOriginal = false;
      this.handleChange(this.mode);
    }
    getRadioOptions() {
      const controlName = getStringId();
      return this.modes.map(
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
      );
    }
    build() {
      const controlName = getStringId();
      document.addEventListener('mouseup', this.disableViewOriginal);
      document.addEventListener('touchend', this.disableViewOriginal);
      document.addEventListener('blur', this.disableViewOriginal);
      onKorean(this.toKorean);
      this.$options = this.getRadioOptions(),
      this.$el = e('div', {class: 'mode-selector'},
        e('button', {
          onMousedown: this.viewOriginal,
          onTouchstart: this.viewOriginal,
        }, 'View original'),
        this.$options,
      );
      this.handleChange(this.modes[0].id);
      return this.$el;
    }
    unbuild() {
      document.removeEventListener('mouseup', this.disableViewOriginal);
      document.removeEventListener('touchend', this.disableViewOriginal);
      document.removeEventListener('blur', this.disableViewOriginal);
      removeOnKorean(this.toKorean);
      this.$el = null;
      this.$options = null;
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
      this.isTouch = false;
      this.nodes = [];
      this.showHidden = this.showHidden.bind(this);
      this.onTouchStart = this.onTouchStart.bind(this);
      this.onMouseDown = this.onMouseDown.bind(this);
      this.onDocumentMouseUp = this.onDocumentMouseUp.bind(this);
      this.disableShowHidden = this.disableShowHidden.bind(this);
      this.shownFragments = new Set();
    }
    build() {
      document.addEventListener('blur', this.disableShowHidden);
      document.addEventListener('mousedown', this.disableShowHidden);
      document.addEventListener('mouseup', this.onDocumentMouseUp);
      this.$el = e('div', {class: 'paragraph-list'});
      this.$el.addEventListener('mousedown', (e) => this.onMouseDown(e));
      this.$el.addEventListener('touchstart', (e) => this.onTouchStart(e));
      return this.$el;
    }
    unbuild() {
      document.removeEventListener('blur', this.disableShowHidden);
      document.removeEventListener('mousedown', this.disableShowHidden);
      document.removeEventListener('mouseup', this.onDocumentMouseUp);
      this.shownFragments.clear();
      this.$el = null;
    }
    showHidden(e) {
      if (this.shownFragments.size === 0) {
        const $frag = e.target;
        if ($frag instanceof HTMLSpanElement && typeof $frag.dataset.actual === 'string') {
          this.shownFragments.add($frag);
          $frag.textContent = $frag.dataset.actual;
          $frag.classList.add('s-shown');
        }
      } else {
        this.disableShowHidden();
      }
    }
    onTouchStart(e) {
      e.stopPropagation();
      this.isTouch = true;
      this.showHidden(e);
    }
    onMouseDown(e) {
      e.stopPropagation();
      if (!this.isTouch) {
        this.showHidden(e);
      }
    }
    onDocumentMouseUp(e) {
      if (!this.isTouch) {
        this.disableShowHidden();
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
    update(rawParagraphs) {
      const paragraphs = rawParagraphs.filter(p => !/^\s?$/.test(p));
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
        e('textarea', {autofocus: true, spellcheck: 'false', class: 'input-area', onInput: (e) => this.handleInput(e.target.value)}),
        $ms,
        $pl,
      );
      return this.$el;
    }
    unbuild() {
      this.$$paragraphList.unbuild();
      this.$$modeSelector.unbuild();
      this.$el = null;
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
