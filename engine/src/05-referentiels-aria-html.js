// ─────────────────────────────────────────────
// Référentiels ARIA / HTML
// ─────────────────────────────────────────────

const ARIA_ROLES = new Set([
  'alert', 'alertdialog', 'application', 'article', 'banner', 'blockquote', 'button', 'caption',
  'cell', 'checkbox', 'code', 'columnheader', 'combobox', 'comment', 'complementary', 'contentinfo',
  'definition', 'deletion', 'dialog', 'directory', 'document', 'emphasis', 'feed', 'figure', 'form',
  'generic', 'grid', 'gridcell', 'group', 'heading', 'img', 'image', 'insertion', 'link', 'list', 'listbox',
  'listitem', 'log', 'main', 'mark', 'marquee', 'math', 'menu', 'menubar', 'menuitem',
  'menuitemcheckbox', 'menuitemradio', 'meter', 'navigation', 'none', 'note', 'option',
  'paragraph', 'presentation', 'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup',
  'rowheader', 'scrollbar', 'search', 'searchbox', 'sectionfooter', 'sectionheader', 'separator',
  'slider', 'spinbutton', 'status', 'strong', 'subscript', 'suggestion', 'superscript', 'switch',
  'tab', 'table', 'tablist', 'tabpanel', 'term', 'textbox', 'time', 'timer', 'toolbar', 'tooltip',
  'tree', 'treegrid', 'treeitem',
  'graphics-document', 'graphics-object', 'graphics-symbol',
  'doc-abstract', 'doc-acknowledgments', 'doc-afterword', 'doc-appendix', 'doc-backlink',
  'doc-biblioentry', 'doc-bibliography', 'doc-biblioref', 'doc-chapter', 'doc-colophon',
  'doc-conclusion', 'doc-cover', 'doc-credit', 'doc-credits', 'doc-dedication', 'doc-endnote',
  'doc-endnotes', 'doc-epigraph', 'doc-epilogue', 'doc-errata', 'doc-example', 'doc-footnote',
  'doc-foreword', 'doc-glossary', 'doc-glossref', 'doc-index', 'doc-introduction', 'doc-noteref',
  'doc-notice', 'doc-pagebreak', 'doc-pagefooter', 'doc-pageheader', 'doc-pagelist', 'doc-part',
  'doc-preface', 'doc-prologue', 'doc-pullquote', 'doc-qna', 'doc-subtitle', 'doc-tip', 'doc-toc',
]);

const ABSTRACT_ROLES = new Set([
  'command', 'composite', 'input', 'landmark', 'range', 'roletype', 'section', 'sectionhead',
  'select', 'structure', 'widget', 'window',
]);

const ARIA_ATTRIBUTES = new Set([
  'aria-activedescendant', 'aria-atomic', 'aria-autocomplete', 'aria-braillelabel',
  'aria-brailleroledescription', 'aria-busy', 'aria-checked', 'aria-colcount', 'aria-colindex',
  'aria-colindextext', 'aria-colspan', 'aria-controls', 'aria-current', 'aria-describedby',
  'aria-description', 'aria-details', 'aria-disabled', 'aria-dropeffect', 'aria-errormessage',
  'aria-expanded', 'aria-flowto', 'aria-grabbed', 'aria-haspopup', 'aria-hidden', 'aria-invalid',
  'aria-keyshortcuts', 'aria-label', 'aria-labelledby', 'aria-level', 'aria-live', 'aria-modal',
  'aria-multiline', 'aria-multiselectable', 'aria-orientation', 'aria-owns', 'aria-placeholder',
  'aria-posinset', 'aria-pressed', 'aria-readonly', 'aria-relevant', 'aria-required',
  'aria-roledescription', 'aria-rowcount', 'aria-rowindex', 'aria-rowindextext', 'aria-rowspan',
  'aria-selected', 'aria-setsize', 'aria-sort', 'aria-valuemax', 'aria-valuemin', 'aria-valuenow',
  'aria-valuetext',
]);

const ARIA_TOKEN_VALUES = {
  'aria-atomic': ['true', 'false'],
  'aria-busy': ['true', 'false'],
  'aria-disabled': ['true', 'false'],
  'aria-hidden': ['true', 'false', 'undefined'],
  'aria-modal': ['true', 'false'],
  'aria-multiline': ['true', 'false'],
  'aria-multiselectable': ['true', 'false'],
  'aria-readonly': ['true', 'false'],
  'aria-required': ['true', 'false'],
  'aria-expanded': ['true', 'false', 'undefined'],
  'aria-selected': ['true', 'false', 'undefined'],
  'aria-checked': ['true', 'false', 'mixed', 'undefined'],
  'aria-pressed': ['true', 'false', 'mixed', 'undefined'],
  'aria-current': ['page', 'step', 'location', 'date', 'time', 'true', 'false'],
  'aria-invalid': ['true', 'false', 'grammar', 'spelling'],
  'aria-live': ['off', 'polite', 'assertive'],
  'aria-haspopup': ['false', 'true', 'menu', 'listbox', 'tree', 'grid', 'dialog'],
  'aria-autocomplete': ['none', 'inline', 'list', 'both'],
  'aria-orientation': ['horizontal', 'vertical', 'undefined'],
  'aria-sort': ['ascending', 'descending', 'none', 'other'],
};

const ARIA_IDREF_ATTRIBUTES = [
  'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-flowto',
  'aria-activedescendant', 'aria-errormessage', 'aria-details',
];

/** Rôles devant être contenus dans un parent précis (contexte requis ARIA 1.2). */
const REQUIRED_CONTEXT = {
  tab: ['tablist'],
  listitem: ['list', 'directory'],
  option: ['listbox', 'group'],
  menuitem: ['menu', 'menubar', 'group'],
  menuitemcheckbox: ['menu', 'menubar', 'group'],
  menuitemradio: ['menu', 'menubar', 'group'],
  treeitem: ['tree', 'group'],
  row: ['table', 'grid', 'treegrid', 'rowgroup'],
  cell: ['row'],
  gridcell: ['row'],
  columnheader: ['row'],
  rowheader: ['row'],
};

/** Rôles devant contenir au moins un élément d'un rôle précis. */
const REQUIRED_OWNED = {
  tablist: ['tab'],
  list: ['listitem'],
  listbox: ['option', 'group'],
  menu: ['menuitem', 'menuitemcheckbox', 'menuitemradio', 'group'],
  menubar: ['menuitem', 'menuitemcheckbox', 'menuitemradio', 'group'],
  radiogroup: ['radio'],
  tree: ['treeitem', 'group'],
};

/** États obligatoires pour un rôle posé sur un élément non natif. */
const REQUIRED_STATES = {
  checkbox: { attrs: ['aria-checked'], native: 'input[type="checkbox"]' },
  switch: { attrs: ['aria-checked'], native: null },
  radio: { attrs: ['aria-checked'], native: 'input[type="radio"]' },
  menuitemcheckbox: { attrs: ['aria-checked'], native: null },
  menuitemradio: { attrs: ['aria-checked'], native: null },
  slider: { attrs: ['aria-valuenow'], native: 'input[type="range"]' },
  combobox: { attrs: ['aria-expanded'], native: 'select' },
  scrollbar: { attrs: ['aria-controls', 'aria-valuenow'], native: null },
  heading: { attrs: ['aria-level'], native: 'h1,h2,h3,h4,h5,h6' },
};

const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem', 'menuitemcheckbox',
  'menuitemradio', 'option', 'slider', 'spinbutton', 'textbox', 'searchbox', 'combobox', 'treeitem',
]);

const NATIVE_INTERACTIVE_SELECTOR = 'a[href], button, input, select, textarea, summary, details, audio[controls], video[controls], [contenteditable=""], [contenteditable="true"]';

const ISO_639_1 = new Set(('aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy '
  + 'da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii '
  + 'ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr '
  + 'ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl '
  + 'sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu')
  .split(' '));

function isValidLangCode(value) {
  const code = normalizedText(value);
  if (!/^[a-z]{2,3}(-[a-z0-9]{1,8})*$/i.test(code)) return false;
  const primary = code.split('-')[0].toLowerCase();
  return primary.length === 3 || ISO_639_1.has(primary);
}

const AUTOCOMPLETE_FIELDS = new Set([
  'name', 'honorific-prefix', 'given-name', 'additional-name', 'family-name', 'honorific-suffix',
  'nickname', 'username', 'new-password', 'current-password', 'one-time-code', 'organization-title',
  'organization', 'street-address', 'address-line1', 'address-line2', 'address-line3',
  'address-level4', 'address-level3', 'address-level2', 'address-level1', 'country', 'country-name',
  'postal-code', 'cc-name', 'cc-given-name', 'cc-additional-name', 'cc-family-name', 'cc-number',
  'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-csc', 'cc-type', 'transaction-currency',
  'transaction-amount', 'language', 'bday', 'bday-day', 'bday-month', 'bday-year', 'sex', 'url',
  'photo', 'tel', 'tel-country-code', 'tel-national', 'tel-area-code', 'tel-local',
  'tel-local-prefix', 'tel-local-suffix', 'tel-extension', 'email', 'impp',
]);
const AUTOCOMPLETE_CONTACT_FIELDS = new Set([
  'tel', 'tel-country-code', 'tel-national', 'tel-area-code', 'tel-local', 'tel-local-prefix',
  'tel-local-suffix', 'tel-extension', 'email', 'impp',
]);

function isValidAutocomplete(value) {
  const tokens = normalizedText(value).toLowerCase().split(' ').filter(Boolean);
  if (!tokens.length) return false;
  if (tokens.length === 1 && (tokens[0] === 'on' || tokens[0] === 'off')) return true;
  let i = 0;
  if (tokens[i] && tokens[i].startsWith('section-')) i++;
  if (tokens[i] === 'shipping' || tokens[i] === 'billing') i++;
  if (['home', 'work', 'mobile', 'fax', 'pager'].includes(tokens[i])) {
    i++;
    if (!AUTOCOMPLETE_CONTACT_FIELDS.has(tokens[i])) return false;
  }
  if (!AUTOCOMPLETE_FIELDS.has(tokens[i])) return false;
  i++;
  if (tokens[i] === 'webauthn') i++;
  return i === tokens.length;
}

const PERSONAL_FIELD_HINTS = [
  { re: /e-?mail|courriel/, token: 'email' },
  { re: /phone|t[ée]l[ée]phone|\btel\b|mobile|portable/, token: 'tel' },
  { re: /pr[ée]nom|first.?name|given.?name/, token: 'given-name' },
  { re: /\bnom\b|last.?name|family.?name|surname/, token: 'family-name' },
  { re: /code.?postal|postal|zip/, token: 'postal-code' },
  { re: /adresse|address|street/, token: 'street-address' },
  { re: /ville|city|commune/, token: 'address-level2' },
];

const GENERIC_LINK_LABELS = new Set([
  'cliquez ici', 'cliquer ici', 'ici', 'lire la suite', 'en savoir plus', 'savoir plus', 'plus',
  'suite', 'voir', 'voir plus', 'lien', 'click here', 'here', 'read more', 'more', 'learn more',
  'details', 'detail', 'decouvrir', 'acceder',
]);

const OFFICE_DOC_RE = /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf|epub)(\?|#|$)/i;
