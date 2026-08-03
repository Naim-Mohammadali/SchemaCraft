"use strict";
const RECORD_DRAFT_AUTOSAVE_MS = 5 * 60 * 1000;
const BUILDER_AUTOSAVE_MS = 60 * 1000;
const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;
const DRAFT_STORAGE_KEY = "generic-data-entry-draft-v1";
const CLIENT_LOG_STORAGE_KEY = "generic-data-entry-client-log-v1";

const MAX_QUEUED_CLIENT_LOGS = 20;
const DRAFT_INPUT_DELAY_MS = 1200;
const FIELD_TYPE_LABELS = {
  text: "نص قصير",
  textarea: "نص طويل",
  number: "رقم",
  select: "قائمة خيارات",
  checkbox: "مربع اختيار",
  checkbox_group: "مجموعة اختيارات",
  yes_no: "نعم / لا",
  date_gregorian: "تاريخ ميلادي",
  date_hijri: "تاريخ هجري",
  date_persian: "تاريخ هجري شمسي",
  file: "ملف أو مرفق",
  system_record_code: "معرّف السجل",
  system_created_at: "تاريخ الإنشاء",
  system_updated_at: "تاريخ آخر تعديل",
};
const SYSTEM_FIELD_TYPES = new Set([
  "system_record_code",
  "system_created_at",
  "system_updated_at",
]);
const RELATED_PERSON_MODE_SOURCE_PREFIX = "related_person_mode:";
const RELATED_PERSON_MODE_OPTIONS = [
  { id: "existing", label: "لديه سجل", active: true },
  { id: "manual", label: "ليس لديه سجل", active: true },
];
const OPERATOR_LABELS = {
  equals: "يساوي",
  not_equals: "لا يساوي",
  contains: "يحتوي على",
  not_contains: "لا يحتوي على",
  greater_than: "أكبر من",
  greater_or_equal: "أكبر من أو يساوي",
  less_than: "أصغر من",
  less_or_equal: "أصغر من أو يساوي",
  before: "قبل",
  after: "بعد",
  on_or_before: "في أو قبل",
  on_or_after: "في أو بعد",
  not_empty: "غير فارغ",
  empty: "فارغ",
};

const CONDITION_OPERATORS_BY_TYPE = {
  text: [
    "equals",
    "not_equals",
    "contains",
    "not_contains",
    "empty",
    "not_empty",
  ],
  textarea: [
    "equals",
    "not_equals",
    "contains",
    "not_contains",
    "empty",
    "not_empty",
  ],
  number: [
    "equals",
    "not_equals",
    "greater_than",
    "greater_or_equal",
    "less_than",
    "less_or_equal",
    "empty",
    "not_empty",
  ],
  select: ["equals", "not_equals", "empty", "not_empty"],
  yes_no: ["equals", "not_equals", "empty", "not_empty"],
  checkbox: ["equals", "not_equals"],
  checkbox_group: ["contains", "not_contains", "empty", "not_empty"],
  date_gregorian: [
    "equals",
    "not_equals",
    "before",
    "after",
    "on_or_before",
    "on_or_after",
    "empty",
    "not_empty",
  ],
  date_hijri: [
    "equals",
    "not_equals",
    "before",
    "after",
    "on_or_before",
    "on_or_after",
    "empty",
    "not_empty",
  ],
  date_persian: [
    "equals",
    "not_equals",
    "before",
    "after",
    "on_or_before",
    "on_or_after",
    "empty",
    "not_empty",
  ],
  file: ["empty", "not_empty"],
};
const CALENDAR_MONTH_NAMES = {
  date_gregorian: [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ],
  date_hijri: [
    "محرّم",
    "صفر",
    "ربيع الأول",
    "ربيع الآخر",
    "جمادى الأولى",
    "جمادى الآخرة",
    "رجب",
    "شعبان",
    "رمضان",
    "شوّال",
    "ذو القعدة",
    "ذو الحجة",
  ],
  date_persian: [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند",
  ],
};
const CALENDAR_SUFFIXES = {
  date_gregorian: "ميلادي",
  date_hijri: "هجري",
  date_persian: "هجري شمسي",
};

const state = {
  builderCategoryObserver: null,
  activeBuilderCategoryId: null,
  headerResizeObserver: null,
  viewportPaintFrame: null,
  viewportPaintResetFrame: null,
  keyboardNavigationPending: false,
  categoryObserverTimer: null,
  recordDirty: false,
  draftDebounceTimer: null,
  restoringDraft: false,
  serverOffline: false,
  schema: null,
  draftSchema: null,
  mode: "entry",
  dirty: false,
  savingSchema: false,
  savingRecord: false,
  searching: false,
  searchFieldIds: null,
  searchMatches: [],
  searchResultIndex: 0,
  searchResultsTruncated: false,
  loadingRecord: false,
  backingUp: false,
  selectedRecordCode: null,
  currentRecordArchived: false,
  currentRecordMetadata: {
    record_code: "",
    created_at: "",
    updated_at: "",
  },
  suppressReset: false,
  editingCategoryId: null,
  editingFieldCategoryId: null,
  editingFieldId: null,
  conditionTargetType: null,
  conditionTargetId: null,
  categoryDialogCommitted: false,
  categoryConditionsSnapshot: null,
  categoryDirtyBeforeOpen: false,
  fieldDialogCommitted: false,
  fieldConditionsSnapshot: null,
  fieldDirtyBeforeOpen: false,
  editingConditionId: null,
  categoryMarkersDraft: [],
  editingMarkerId: null,
  optionFilterDraft: null,
  fieldOptionsDraft: [],
  authMode: "unlock",
  authSubmitting: false,
  filePartsDraft: [],
  toastTimer: null,
  heartbeatTimer: null,
  draftTimer: null,
  builderAutosaveTimer: null,
  closing: false,
};

const elements = {
  appHeader: document.querySelector(".app-header"),
  page: document.querySelector(".page"),
  appTitle: document.getElementById("app-title"),
  appDescription: document.getElementById("app-description"),
  entryModeButton: document.getElementById("entry-mode-button"),
  builderModeButton: document.getElementById("builder-mode-button"),
  closeButton: document.getElementById("close-app-button"),
  builderCloseButton: document.getElementById("builder-close-app-button"),
  status: document.getElementById("app-status"),
  statusText: document.getElementById("app-status-text"),
  startupError: document.getElementById("startup-error"),
  startupErrorMessage: document.getElementById("startup-error-message"),
  entryView: document.getElementById("entry-view"),
  builderView: document.getElementById("builder-view"),
  appWorkspace: document.getElementById("app-workspace"),
  categoryNavigator: document.getElementById("category-navigator"),
  categoryNavTitle: document.getElementById("category-nav-title"),
  entryActionRail: document.getElementById("entry-action-rail"),
  builderActionRail: document.getElementById("builder-action-rail"),
  entryRecordActions: document.getElementById("entry-record-actions"),
  emptySchemaPanel: document.getElementById("empty-schema-panel"),
  openBuilderButton: document.getElementById("open-builder-button"),
  searchPanel: document.getElementById("search-panel"),
  searchTitle: document.getElementById("search-title"),
  chooseSearchFieldsButton: document.getElementById(
    "choose-search-fields-button",
  ),
  chooseSearchFieldsText: document.getElementById("choose-search-fields-text"),
  searchCollapseButton: document.getElementById("search-collapse-button"),
  searchFieldsEmpty: document.getElementById("search-fields-empty"),
  searchFields: document.getElementById("search-fields"),
  searchButton: document.getElementById("search-button"),
  clearSearchButton: document.getElementById("clear-search-button"),
  includeArchivedSearch: document.getElementById("include-archived-search"),
  searchButtonText: document.getElementById("search-button-text"),
  searchSpinner: document.getElementById("search-spinner"),
  searchResults: document.getElementById("search-results"),
  searchSummary: document.getElementById("search-summary"),
  searchResultPager: document.getElementById("search-result-pager"),
  previousSearchResult: document.getElementById("previous-search-result"),
  nextSearchResult: document.getElementById("next-search-result"),
  searchResultPosition: document.getElementById("search-result-position"),
  recordForm: document.getElementById("record-form"),
  recordCode: document.getElementById("record-code"),
  attachmentGallery: document.getElementById("attachment-gallery"),
  attachmentGalleryGrid: document.getElementById("attachment-gallery-grid"),
  mainSections: document.getElementById("main-sections"),
  unanchoredRelatedArea: document.getElementById("unanchored-related-area"),
  unanchoredRelatedSections: document.getElementById(
    "unanchored-related-sections",
  ),
  saveNote: document.getElementById("save-note"),
  draftStatus: document.getElementById("draft-status"),
  saveRecordButton: document.getElementById("save-record-button"),
  saveButtonText: document.getElementById("save-button-text"),
  saveSpinner: document.getElementById("save-spinner"),
  resetFormButton: document.getElementById("reset-form-button"),
  resetButtonText: document.getElementById("reset-button-text"),
  archiveRecordButton: document.getElementById("archive-record-button"),
  archiveButtonText: document.getElementById("archive-button-text"),
  deleteRecordButton: document.getElementById("delete-record-button"),
  deleteButtonText: document.getElementById("delete-button-text"),
  settingTitle: document.getElementById("setting-title"),
  settingSingular: document.getElementById("setting-singular"),
  settingPlural: document.getElementById("setting-plural"),
  settingPrimaryColor: document.getElementById("setting-primary-color"),
  categoryCount: document.getElementById("category-count"),
  fieldCount: document.getElementById("field-count"),
  recordCount: document.getElementById("record-count"),
  builderCategories: document.getElementById("builder-categories"),
  noCategoriesMessage: document.getElementById("no-categories-message"),
  builderConditions: document.getElementById("builder-conditions"),
  noConditionsMessage: document.getElementById("no-conditions-message"),
  builderSaveState: document.getElementById("builder-save-state"),
  backupButton: document.getElementById("backup-button"),
  discardSchemaButton: document.getElementById("discard-schema-button"),
  saveSchemaButton: document.getElementById("save-schema-button"),
  saveSchemaText: document.getElementById("save-schema-text"),
  schemaSpinner: document.getElementById("schema-spinner"),
  searchFieldsDialog: document.getElementById("search-fields-dialog"),
  searchFieldOptions: document.getElementById("search-field-options"),
  selectAllSearchFieldsButton: document.getElementById(
    "select-all-search-fields-button",
  ),
  clearAllSearchFieldsButton: document.getElementById(
    "clear-all-search-fields-button",
  ),
  resetSearchFieldsButton: document.getElementById(
    "reset-search-fields-button",
  ),
  applySearchFieldsButton: document.getElementById(
    "apply-search-fields-button",
  ),
  categoryPlacementWrapper: document.getElementById(
    "category-placement-wrapper",
  ),
  categoryPlacement: document.getElementById("category-placement"),
  categoryDialog: document.getElementById("category-dialog"),
  categoryDialogTitle: document.getElementById("category-dialog-title"),
  categoryLabel: document.getElementById("category-label"),
  categoryKind: document.getElementById("category-kind"),
  categoryParent: document.getElementById("category-parent"),
  categoryDescription: document.getElementById("category-description"),
  categoryRepeatableOptions: document.getElementById(
    "category-repeatable-options",
  ),
  addCategoryConditionButton: document.getElementById(
    "add-category-condition-button",
  ),
  categoryConditionsList: document.getElementById("category-conditions-list"),
  categoryAddLabel: document.getElementById("category-add-label"),
  categoryAnchor: document.getElementById("category-anchor"),
  categoryAutoStart: document.getElementById("category-auto-start"),
  categoryRelatedPerson: document.getElementById("category-related-person"),
  markerLabel: document.getElementById("marker-label"),
  markerDisplayText: document.getElementById("marker-display-text"),
  markerColor: document.getElementById("marker-color"),
  markerRule: document.getElementById("marker-rule"),
  addMarkerButton: document.getElementById("add-marker-button"),
  addMarkerButtonText: document.getElementById("add-marker-button-text"),
  categoryMarkersList: document.getElementById("category-markers-list"),
  confirmCategoryButton: document.getElementById("confirm-category-button"),
  addFieldConditionButton: document.getElementById(
    "add-field-condition-button",
  ),
  fieldConditionsList: document.getElementById("field-conditions-list"),
  fieldDialog: document.getElementById("field-dialog"),
  fieldDialogTitle: document.getElementById("field-dialog-title"),
  fieldLabel: document.getElementById("field-label"),
  fieldType: document.getElementById("field-type"),
  fieldPlaceholder: document.getElementById("field-placeholder"),
  fieldWidth: document.getElementById("field-width"),
  fieldOptionsWrapper: document.getElementById("field-options-wrapper"),
  fieldOptions: document.getElementById("field-options"),
  fieldRequired: document.getElementById("field-required"),
  fieldUniqueWrapper: document.getElementById("field-unique-wrapper"),
  fieldUnique: document.getElementById("field-unique"),
  fieldSearchableWrapper: document.getElementById("field-searchable-wrapper"),
  fieldSearchable: document.getElementById("field-searchable"),
  fieldSearchMatchWrapper: document.getElementById(
    "field-search-match-wrapper",
  ),
  fieldSearchMatch: document.getElementById("field-search-match"),
  fieldResultWrapper: document.getElementById("field-result-wrapper"),
  fieldShowResult: document.getElementById("field-show-result"),
  fieldTitleWrapper: document.getElementById("field-title-wrapper"),
  fieldResultTitle: document.getElementById("field-result-title"),
  relatedPersonFieldEditor: document.getElementById(
    "related-person-field-editor",
  ),
  relatedPersonSourceField: document.getElementById(
    "related-person-source-field",
  ),
  optionFilterEditor: document.getElementById("option-filter-editor"),
  optionFilterSource: document.getElementById("option-filter-source"),
  optionFilterMatrix: document.getElementById("option-filter-matrix"),
  fieldValidationEditor: document.getElementById("field-validation-editor"),
  textValidationFields: document.getElementById("text-validation-fields"),
  numberValidationFields: document.getElementById("number-validation-fields"),
  dateValidationFields: document.getElementById("date-validation-fields"),
  validationMinLength: document.getElementById("validation-min-length"),
  validationMaxLength: document.getElementById("validation-max-length"),
  validationPattern: document.getElementById("validation-pattern"),
  validationMinNumber: document.getElementById("validation-min-number"),
  validationMaxNumber: document.getElementById("validation-max-number"),
  validationIntegerOnly: document.getElementById("validation-integer-only"),
  validationMinDate: document.getElementById("validation-min-date"),
  validationMaxDate: document.getElementById("validation-max-date"),
  validationCompareField: document.getElementById("validation-compare-field"),
  validationCompareOperator: document.getElementById(
    "validation-compare-operator",
  ),
  fileNamingEditor: document.getElementById("file-naming-editor"),
  fileNamingMode: document.getElementById("file-naming-mode"),
  fileProfileImageWrapper: document.getElementById(
    "file-profile-image-wrapper",
  ),
  fileProfileImage: document.getElementById("file-profile-image"),
  fileTemplateEditor: document.getElementById("file-template-editor"),
  filePartPrefix: document.getElementById("file-part-prefix"),
  filePartSuffix: document.getElementById("file-part-suffix"),
  filePartField: document.getElementById("file-part-field"),
  addFilePartButton: document.getElementById("add-file-part-button"),
  filePartsList: document.getElementById("file-parts-list"),
  confirmFieldButton: document.getElementById("confirm-field-button"),
  conditionDialog: document.getElementById("condition-dialog"),
  conditionDialogTitle: document.getElementById("condition-dialog-title"),
  conditionTargetLabel: document.getElementById("condition-target-label"),
  conditionSource: document.getElementById("condition-source"),
  conditionOperator: document.getElementById("condition-operator"),
  conditionGroup: document.getElementById("condition-group"),
  conditionNegate: document.getElementById("condition-negate"),
  conditionValueWrapper: document.getElementById("condition-value-wrapper"),
  conditionValueControl: document.getElementById("condition-value-control"),
  confirmConditionButton: document.getElementById("confirm-condition-button"),
  builderAuthDialog: document.getElementById("builder-auth-dialog"),
  builderAuthTitle: document.getElementById("builder-auth-title"),
  builderAuthNote: document.getElementById("builder-auth-note"),
  currentPasswordWrapper: document.getElementById("current-password-wrapper"),
  currentBuilderPassword: document.getElementById("current-builder-password"),
  builderPassword: document.getElementById("builder-password"),
  confirmPasswordWrapper: document.getElementById("confirm-password-wrapper"),
  confirmBuilderPassword: document.getElementById("confirm-builder-password"),
  confirmBuilderAuthButton: document.getElementById(
    "confirm-builder-auth-button",
  ),
  confirmBuilderAuthText: document.getElementById("confirm-builder-auth-text"),
  builderAuthSpinner: document.getElementById("builder-auth-spinner"),
  toast: document.getElementById("toast"),
  builderSidebarAddCategoryButton: document.getElementById(
    "builder-sidebar-add-category-button",
  ),

  builderCategoryNavList: document.getElementById("builder-category-nav-list"),
};

// Search belongs to the upper part of the left action rail in entry mode.
elements.entryActionRail.prepend(elements.searchPanel);

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function actionIcon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("action-icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#icon-${name}`);
  svg.append(use);
  return svg;
}

function randomDefinitionId(prefix) {
  const bytes = new Uint8Array(6);
  window.crypto.getRandomValues(bytes);
  return `${prefix}_${[...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function activeOptions(field) {
  return (field?.options || []).filter((option) => option.active !== false);
}

function optionForValue(field, value) {
  const text = String(value ?? "");
  return (
    (field?.options || []).find(
      (option) => option.id === text || option.label === text,
    ) || null
  );
}

function optionIdForValue(field, value) {
  return optionForValue(field, value)?.id || String(value ?? "");
}

function optionLabelForValue(field, value) {
  return optionForValue(field, value)?.label || String(value ?? "");
}

function optionSourceTokens(field) {
  if (field?.type === "checkbox") {
    return [
      { id: "true", label: "محدد" },
      { id: "false", label: "غير محدد" },
    ];
  }
  return activeOptions(field);
}

function generateRecordCode() {
  const firstCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const otherCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(8);
  window.crypto.getRandomValues(bytes);
  let code = firstCharacters[bytes[0] % firstCharacters.length];
  for (let index = 1; index < bytes.length; index += 1) {
    code += otherCharacters[bytes[index] % otherCharacters.length];
  }
  return code;
}

function allCategories(schema = state.draftSchema) {
  return schema?.categories || [];
}

function allFields(schema = state.draftSchema) {
  return allCategories(schema).flatMap((category) =>
    category.fields.map((field) => ({ category, field })),
  );
}

function isSystemField(field) {
  return SYSTEM_FIELD_TYPES.has(field?.type);
}

function relatedPersonModeSourceId(categoryId) {
  return `${RELATED_PERSON_MODE_SOURCE_PREFIX}${categoryId}`;
}

function relatedPersonModeCategory(
  sourceId,
  schema = state.draftSchema,
) {
  if (!String(sourceId || "").startsWith(RELATED_PERSON_MODE_SOURCE_PREFIX)) {
    return null;
  }
  const categoryId = String(sourceId).slice(
    RELATED_PERSON_MODE_SOURCE_PREFIX.length,
  );
  const category = categoryById(categoryId, schema);
  return category?.kind === "repeatable" && category.related_person_enabled
    ? category
    : null;
}

function relatedPersonModeField(category) {
  if (
    category?.kind !== "repeatable" ||
    !category.related_person_enabled
  ) {
    return null;
  }
  return {
    id: relatedPersonModeSourceId(category.id),
    label: "هل لديه سجل؟",
    type: "yes_no",
    options: RELATED_PERSON_MODE_OPTIONS,
  };
}

function categoryById(categoryId, schema = state.draftSchema) {
  return allCategories(schema).find((category) => category.id === categoryId);
}

function categoryChildren(categoryId, schema = state.draftSchema) {
  return allCategories(schema).filter(
    (category) => (category.parent_category_id || null) === categoryId,
  );
}

function categoryDescendantIds(categoryId, schema = state.draftSchema) {
  const descendants = new Set();
  const visit = (parentId) => {
    for (const child of categoryChildren(parentId, schema)) {
      if (descendants.has(child.id)) {
        continue;
      }
      descendants.add(child.id);
      visit(child.id);
    }
  };
  visit(categoryId);
  return descendants;
}

function orderedCategoryTree(schema = state.draftSchema) {
  const categories = allCategories(schema);
  const ids = new Set(categories.map((category) => category.id));
  const visited = new Set();
  const result = [];

  const visit = (category, depth = 0) => {
    if (!category || visited.has(category.id)) {
      return;
    }
    visited.add(category.id);
    result.push({ category, depth });
    categoryChildren(category.id, schema).forEach((child) => {
      visit(child, depth + 1);
    });
  };

  categories
    .filter(
      (category) =>
        !category.parent_category_id || !ids.has(category.parent_category_id),
    )
    .forEach((category) => visit(category));

  categories.forEach((category) => visit(category));
  return result;
}

function fieldById(fieldId, schema = state.draftSchema) {
  const field = allFields(schema).find(
    ({ field: candidate }) => candidate.id === fieldId,
  )?.field;
  if (field) {
    return field;
  }
  const category = relatedPersonModeCategory(fieldId, schema);
  return relatedPersonModeField(category);
}

function fieldCategory(fieldId, schema = state.draftSchema) {
  return (
    allFields(schema).find(({ field }) => field.id === fieldId)?.category ||
    relatedPersonModeCategory(fieldId, schema)
  );
}

function mainFields(schema = state.draftSchema) {
  return allCategories(schema)
    .filter((category) => category.kind === "main")
    .flatMap((category) => category.fields);
}

function setStatus(kind, text) {
  elements.status.className = `status status-${kind}`;
  elements.statusText.textContent = text;
}

function showToast(message, type = "success") {
  window.clearTimeout(state.toastTimer);

  elements.toast.textContent = message;
  elements.toast.className = `toast toast-${type}`;

  elements.toast.setAttribute("role", type === "error" ? "alert" : "status");

  if (typeof elements.toast.showPopover === "function") {
    /*
     * Hide and reopen it so it becomes the newest
     * top-layer element, above the active dialog.
     */
    if (elements.toast.matches(":popover-open")) {
      elements.toast.hidePopover();
    }

    elements.toast.showPopover();
  } else {
    // Fallback for an older browser.
    elements.toast.hidden = false;
  }

  state.toastTimer = window.setTimeout(() => {
    if (
      typeof elements.toast.hidePopover === "function" &&
      elements.toast.matches(":popover-open")
    ) {
      elements.toast.hidePopover();
    } else {
      elements.toast.hidden = true;
    }
  }, 5000);
}

function showStartupError(message) {
  elements.startupErrorMessage.textContent = message;
  elements.startupError.hidden = false;
  setStatus("error", "تعذّر فتح التطبيق");
}

async function responseJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "حدث خطأ غير معروف.");
  }
  return body;
}
function createClientLogEntry(category, error, details = "") {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error || "Unknown error");

  const stack = error instanceof Error ? error.stack || "" : "";

  return {
    level: "error",
    category: String(category || "browser").slice(0, 80),
    message: message.slice(0, 4000),
    location: [details, stack].filter(Boolean).join("\n").slice(0, 4000),
    occurred_at: new Date().toISOString(),
  };
}

function readQueuedClientLogs() {
  try {
    const raw = localStorage.getItem(CLIENT_LOG_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.slice(-MAX_QUEUED_CLIENT_LOGS) : [];
  } catch (_error) {
    return [];
  }
}

function writeQueuedClientLogs(entries) {
  try {
    if (!entries.length) {
      localStorage.removeItem(CLIENT_LOG_STORAGE_KEY);
      return;
    }

    localStorage.setItem(
      CLIENT_LOG_STORAGE_KEY,
      JSON.stringify(entries.slice(-MAX_QUEUED_CLIENT_LOGS)),
    );
  } catch (_error) {
    // Logging must never interrupt the application.
  }
}

function queueClientLog(entry) {
  const queued = readQueuedClientLogs();
  queued.push(entry);
  writeQueuedClientLogs(queued);
}

async function sendClientLog(entry) {
  const response = await fetch("/api/client-log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(entry),
    keepalive: true,
  });

  if (!response.ok) {
    throw new Error("Client log request failed");
  }
}

function reportClientError(category, error, details = "") {
  const entry = createClientLogEntry(category, error, details);

  sendClientLog(entry).catch(() => {
    queueClientLog(entry);
  });
}

async function flushClientLogs() {
  const queued = readQueuedClientLogs();

  if (!queued.length) {
    return;
  }

  writeQueuedClientLogs([]);

  const failed = [];

  for (const entry of queued) {
    try {
      await sendClientLog(entry);
    } catch (_error) {
      failed.push(entry);
    }
  }

  if (failed.length) {
    writeQueuedClientLogs(failed);
  }
}
function attributeSafe(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(String(value));
  }
  return String(value).replace(/["\\]/g, "\\$&");
}

function entityName(plural = false, schema = state.schema) {
  if (!schema) {
    return plural ? "السجلات" : "سجل";
  }
  return plural ? schema.app.entity_plural : schema.app.entity_singular;
}

function mixHex(first, second, weight) {
  const parse = (value) => [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
  const a = parse(first);
  const b = parse(second);
  const mixed = a.map((value, index) =>
    Math.round(value * (1 - weight) + b[index] * weight),
  );
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function relativeLuminance(color) {
  const channels = [1, 3, 5].map((index) => {
    const value = Number.parseInt(color.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first, second) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const light = Math.max(firstLuminance, secondLuminance);
  const dark = Math.min(firstLuminance, secondLuminance);
  return (light + 0.05) / (dark + 0.05);
}

function contrastText(background) {
  return contrastRatio(background, "#172033") >=
    contrastRatio(background, "#FFFFFF")
    ? "#172033"
    : "#FFFFFF";
}

function readableAccent(color) {
  let candidate = color;
  while (contrastRatio(candidate, "#FFFFFF") < 4.5) {
    candidate = mixHex(candidate, "#000000", 0.12);
  }
  return candidate;
}

function applyAppIdentity(schema) {
  document.documentElement.dir = "rtl";
  document.documentElement.lang = "ar";
  document.title = schema.app.title;
  elements.appTitle.textContent = schema.app.title;
  elements.appDescription.textContent = `صمّم الحقول والفئات، ثم أدخل ${schema.app.entity_plural} وابحث فيها محليًا.`;
  elements.searchTitle.textContent = `البحث عن ${schema.app.entity_singular}`;
  const root = document.documentElement.style;
  const primary = schema.app.primary_color;
  const primaryDark = mixHex(primary, "#000000", 0.22);
  root.setProperty("--primary", primary);
  root.setProperty("--primary-contrast", contrastText(primary));
  root.setProperty("--primary-dark", primaryDark);
  root.setProperty("--primary-dark-contrast", contrastText(primaryDark));
  root.setProperty("--primary-ink", readableAccent(primary));
  root.setProperty("--primary-soft", mixHex(primary, "#FFFFFF", 0.88));
  root.setProperty("--bg", "#F4F7FB");
  root.setProperty("--surface", "#FFFFFF");
  elements.builderModeButton.hidden = false;
  elements.openBuilderButton.hidden = false;
  const unlocked = Boolean(
    schema.builder_access?.unlocked || schema.developer_mode,
  );
  elements.builderModeButton.title = unlocked
    ? "المصمّم مفتوح"
    : "المصمّم مقفل بكلمة مرور";
}

function hasConfiguredFields(schema = state.schema) {
  return allFields(schema).length > 0;
}

function switchMode(mode, force = false) {
  if (
    mode === "builder" &&
    !state.schema?.builder_access?.unlocked &&
    !state.schema?.developer_mode
  ) {
    openBuilderAuthDialog(
      state.schema?.builder_access?.configured ? "unlock" : "initialize",
    );
    return;
  }
  if (
    mode === "entry" &&
    state.mode === "builder" &&
    state.dirty &&
    !force &&
    !window.confirm(
      "توجد تغييرات غير محفوظة في التصميم. هل تريد مغادرة المصمّم؟",
    )
  ) {
    return;
  }
  state.mode = mode;
  elements.appWorkspace.dataset.mode = mode;
  elements.entryView.hidden = mode !== "entry";
  elements.builderView.hidden = mode !== "builder";
  elements.entryActionRail.hidden = mode !== "entry";
  elements.builderActionRail.hidden = mode !== "builder";
  elements.closeButton.hidden = mode !== "entry";
  elements.entryModeButton.classList.toggle(
    "mode-button-active",
    mode === "entry",
  );
  elements.builderModeButton.classList.toggle(
    "mode-button-active",
    mode === "builder",
  );
  if (mode === "builder") {
    renderBuilder();
  } else {
    refreshCategoryNavigation();
  }

  updateStickyHeaderOffset();
  scheduleViewportPaintRecovery(true);
}

function markDirty() {
  state.dirty = true;
  elements.builderSaveState.dataset.dirty = "true";
  elements.builderSaveState.textContent = "توجد تغييرات غير محفوظة.";
  elements.saveSchemaButton.disabled = state.savingSchema;
  elements.discardSchemaButton.disabled = state.savingSchema;
}

function markClean() {
  state.dirty = false;
  elements.builderSaveState.dataset.dirty = "false";
  elements.builderSaveState.textContent = "لا توجد تغييرات غير محفوظة.";
  elements.saveSchemaButton.disabled = state.savingSchema;
  elements.discardSchemaButton.disabled = state.savingSchema;
}

function syncSettingsToDraft() {
  if (!state.draftSchema) {
    return;
  }
  state.draftSchema.app.title = elements.settingTitle.value.trim();
  state.draftSchema.app.entity_singular = elements.settingSingular.value.trim();
  state.draftSchema.app.entity_plural = elements.settingPlural.value.trim();
  state.draftSchema.app.direction = "rtl";
  state.draftSchema.app.primary_color = elements.settingPrimaryColor.value;
  state.draftSchema.app.background_color = "#F4F7FB";
  state.draftSchema.app.surface_color = "#FFFFFF";
}

function renderBuilder() {
  if (!state.draftSchema) {
    return;
  }
  const draft = state.draftSchema;
  elements.settingTitle.value = draft.app.title;
  elements.settingSingular.value = draft.app.entity_singular;
  elements.settingPlural.value = draft.app.entity_plural;
  elements.settingPrimaryColor.value = draft.app.primary_color;
  elements.categoryCount.textContent = String(draft.categories.length);
  elements.fieldCount.textContent = String(allFields(draft).length);
  elements.recordCount.textContent = String(
    state.schema?.stats?.record_count || 0,
  );
  renderBuilderCategories();
  renderBuilderConditions();
  if (state.dirty) {
    markDirty();
  } else {
    markClean();
  }
}

function builderActionButton(
  label,
  action,
  id,
  extraClass = "",
  iconName = "",
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `button button-icon ${extraClass}`.trim();
  const automaticIcon = {
    "move-category-up": "up",
    "move-field-up": "up",
    "move-category-down": "down",
    "move-field-down": "down",
    "edit-category": "edit",
    "edit-field": "edit",
    "edit-condition": "edit",
    "delete-category": "trash",
    "delete-field": "trash",
    "delete-condition": "trash",
  }[action];
  button.append(actionIcon(iconName || automaticIcon || "edit"));
  button.dataset.builderAction = action;
  button.dataset.itemId = id;
  button.title = label;
  button.setAttribute("aria-label", label);
  return button;
}
function updateStickyHeaderOffset() {
  const headerHeight = elements.appHeader
    ? Math.ceil(elements.appHeader.getBoundingClientRect().height)
    : 0;

  document.documentElement.style.setProperty(
    "--app-header-height",
    `${headerHeight}px`,
  );
}

function installStickyHeaderTracking() {
  updateStickyHeaderOffset();

  if (elements.appHeader && "ResizeObserver" in window) {
    state.headerResizeObserver?.disconnect();
    state.headerResizeObserver = new ResizeObserver(() => {
      updateStickyHeaderOffset();
    });
    state.headerResizeObserver.observe(elements.appHeader);
  }

  window.addEventListener("resize", updateStickyHeaderOffset);
}

function scheduleViewportPaintRecovery(forcePaint = false) {
  if (state.viewportPaintFrame !== null) {
    window.cancelAnimationFrame(state.viewportPaintFrame);
  }

  state.viewportPaintFrame = window.requestAnimationFrame(() => {
    state.viewportPaintFrame = null;
    updateStickyHeaderOffset();

    if (!forcePaint || !elements.appHeader) {
      return;
    }

    if (state.viewportPaintResetFrame !== null) {
      window.cancelAnimationFrame(state.viewportPaintResetFrame);
    }

    // Move the existing compositor layer by an imperceptible amount for one
    // frame. This forces Chromium to repaint the header without changing its
    // size, position, or visible design.
    elements.appHeader.style.transform = "translate3d(0, 0, 0.0001px)";
    if (elements.page) {
      const scrollTop = elements.page.scrollTop;
      void elements.page.offsetHeight;
      elements.page.scrollTop = scrollTop;
    }

    state.viewportPaintResetFrame = window.requestAnimationFrame(() => {
      state.viewportPaintResetFrame = null;
      elements.appHeader.style.transform = "";
    });
  });
}

function installViewportPaintRecovery() {
  const recover = () => scheduleViewportPaintRecovery(true);

  window.addEventListener("focus", recover);
  window.addEventListener("pageshow", recover);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      recover();
    }
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Tab") {
        state.keyboardNavigationPending = true;
      }
    },
    true,
  );

  document.addEventListener(
    "focusin",
    (event) => {
      if (!state.keyboardNavigationPending) {
        return;
      }
      state.keyboardNavigationPending = false;

      const target = event.target;
      if (
        elements.page &&
        target instanceof HTMLElement &&
        elements.page.contains(target)
      ) {
        const pageRect = elements.page.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        if (
          targetRect.top < pageRect.top ||
          targetRect.bottom > pageRect.bottom
        ) {
          target.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
      }
      scheduleViewportPaintRecovery(true);
    },
    true,
  );
}

function navigationSchema() {
  return state.mode === "builder" ? state.draftSchema : state.schema;
}

function navigationTarget(categoryId) {
  const prefix =
    state.mode === "builder" ? "builder-category" : "entry-category";

  return document.getElementById(`${prefix}-${categoryId}`);
}

function categoryTargetIsVisible(target) {
  return Boolean(target && !target.closest("[hidden]"));
}

function setActiveBuilderCategory(categoryId) {
  state.activeBuilderCategoryId = categoryId || null;

  elements.builderCategoryNavList
    .querySelectorAll("[data-builder-category-nav]")
    .forEach((button) => {
      button.classList.toggle(
        "category-nav-button-active",
        button.dataset.builderCategoryNav === categoryId,
      );
    });
}

function scrollToBuilderCategory(categoryId) {
  const target = navigationTarget(categoryId);

  if (!categoryTargetIsVisible(target)) {
    return;
  }

  setActiveBuilderCategory(categoryId);

  target.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  target.focus({
    preventScroll: true,
  });

  target.classList.remove("category-navigation-highlight");
  void target.offsetWidth;
  target.classList.add("category-navigation-highlight");

  window.setTimeout(() => {
    target.classList.remove("category-navigation-highlight");
  }, 1600);
}

function scrollToBuilderSection(targetId) {
  const target = document.getElementById(targetId);
  if (!target) {
    return;
  }
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.focus({ preventScroll: true });
  target.classList.remove("category-navigation-highlight");
  void target.offsetWidth;
  target.classList.add("category-navigation-highlight");
}

function createNavigationButton(label, clickHandler, extraClass = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `category-nav-button ${extraClass}`.trim();
  button.textContent = label;
  button.addEventListener("click", clickHandler);
  return button;
}

function appendCategoryNavigationTree(container, schema) {
  const categories = schema?.categories || [];
  const categoryIds = new Set(categories.map((category) => category.id));
  const visited = new Set();

  const appendNode = (category, parent) => {
    if (!category || visited.has(category.id)) {
      return;
    }
    visited.add(category.id);

    const children = categoryChildren(category.id, schema);
    const node = document.createElement("div");
    node.className = "category-nav-node";
    node.dataset.categoryNavNode = category.id;

    const row = document.createElement("div");
    row.className = "category-nav-row";

    if (children.length) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "category-nav-toggle";
      toggle.textContent = "▾";
      toggle.setAttribute("aria-label", `طي فئة ${category.label}`);
      toggle.setAttribute("aria-expanded", "true");
      row.append(toggle);

      const childList = document.createElement("div");
      childList.className = "category-nav-children";
      children.forEach((child) => appendNode(child, childList));
      toggle.addEventListener("click", () => {
        const expanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!expanded));
        toggle.textContent = expanded ? "◂" : "▾";
        toggle.setAttribute(
          "aria-label",
          `${expanded ? "توسيع" : "طي"} فئة ${category.label}`,
        );
        childList.hidden = expanded;
      });

      const button = createNavigationButton(category.label, () => {
        scrollToBuilderCategory(category.id);
      });
      button.dataset.builderCategoryNav = category.id;
      row.append(button);
      node.append(row, childList);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "category-nav-toggle-spacer";
      row.append(spacer);
      const button = createNavigationButton(category.label, () => {
        scrollToBuilderCategory(category.id);
      });
      button.dataset.builderCategoryNav = category.id;
      row.append(button);
      node.append(row);
    }

    parent.append(node);
  };

  categories
    .filter(
      (category) =>
        !category.parent_category_id ||
        !categoryIds.has(category.parent_category_id),
    )
    .forEach((category) => appendNode(category, container));
  categories.forEach((category) => appendNode(category, container));
}

function renderBuilderCategoryNavigator() {
  elements.builderCategoryNavList.replaceChildren();

  const schema = navigationSchema();
  const categories = schema?.categories || [];
  const builderMode = state.mode === "builder";

  elements.categoryNavTitle.textContent = builderMode
    ? "أقسام المصمّم"
    : "فئات السجل";
  elements.builderSidebarAddCategoryButton.hidden = !builderMode;
  elements.builderCategoryNavList.setAttribute(
    "aria-label",
    builderMode ? "فئات التطبيق" : "فئات السجل",
  );

  if (builderMode) {
    const builderSections = [
      ["ملخص المصمّم", "builder-intro-panel"],
      ["هوية التطبيق", "builder-identity-panel"],
      ["الفئات والحقول", "builder-categories-panel"],
    ];
    builderSections.forEach(([label, targetId]) => {
      const button = createNavigationButton(
        label,
        () => scrollToBuilderSection(targetId),
        "builder-section-nav-button",
      );
      elements.builderCategoryNavList.append(button);
    });

    if (categories.length) {
      const tree = document.createElement("div");
      tree.className = "category-nav-tree builder-category-nav-tree";
      appendCategoryNavigationTree(tree, schema);
      elements.builderCategoryNavList.append(tree);
    }

    const conditionsButton = createNavigationButton(
      "شروط الظهور",
      () => scrollToBuilderSection("builder-conditions-panel"),
      "builder-section-nav-button",
    );
    elements.builderCategoryNavList.append(conditionsButton);
    setActiveBuilderCategory(state.activeBuilderCategoryId);
    return;
  }

  if (!categories.length) {
    const empty = document.createElement("p");
    empty.className = "category-nav-empty";
    empty.textContent = "لا توجد فئات للتنقل بينها.";
    elements.builderCategoryNavList.append(empty);
    return;
  }

  const tree = document.createElement("div");
  tree.className = "category-nav-tree";
  appendCategoryNavigationTree(tree, schema);
  elements.builderCategoryNavList.append(tree);
  syncEntryCategoryNavigatorVisibility();
}

function syncEntryCategoryNavigatorVisibility() {
  if (state.mode !== "entry") {
    return;
  }

  let firstVisibleId = null;

  const nodes = [
    ...elements.builderCategoryNavList.querySelectorAll(
      "[data-category-nav-node]",
    ),
  ];

  nodes.forEach((node) => {
    const button = node.querySelector(":scope > .category-nav-row [data-builder-category-nav]");
      const categoryId = button.dataset.builderCategoryNav;
      const target = document.getElementById(`entry-category-${categoryId}`);
      const visible = categoryTargetIsVisible(target);

      button.dataset.categoryTargetVisible = String(visible);
      button.disabled = !visible;

      if (visible && !firstVisibleId) {
        firstVisibleId = categoryId;
      }
  });

  [...nodes].reverse().forEach((node) => {
    const ownButton = node.querySelector(
      ":scope > .category-nav-row [data-builder-category-nav]",
    );
    const ownVisible = ownButton?.dataset.categoryTargetVisible === "true";
    const childVisible = [...node.querySelectorAll(":scope > .category-nav-children > [data-category-nav-node]")]
      .some((child) => !child.hidden);
    node.hidden = !ownVisible && !childVisible;
  });

  const activeButton = elements.builderCategoryNavList.querySelector(
    `[data-builder-category-nav="${attributeSafe(
      state.activeBuilderCategoryId || "",
    )}"]:not(:disabled)`,
  );

  if (!activeButton) {
    setActiveBuilderCategory(firstVisibleId);
  }
}

function observeBuilderCategories() {
  if (state.builderCategoryObserver) {
    state.builderCategoryObserver.disconnect();
    state.builderCategoryObserver = null;
  }

  if (!("IntersectionObserver" in window)) {
    return;
  }

  const selector =
    state.mode === "builder" ? ".builder-category" : "[data-entry-category]";

  const targets = [...document.querySelectorAll(selector)].filter(
    categoryTargetIsVisible,
  );

  if (!targets.length) {
    return;
  }

  state.builderCategoryObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter(
          (entry) =>
            entry.isIntersecting && categoryTargetIsVisible(entry.target),
        )
        .sort(
          (first, second) => second.intersectionRatio - first.intersectionRatio,
        );

      if (!visible.length) {
        return;
      }

      setActiveBuilderCategory(visible[0].target.dataset.categoryId);
    },
    {
      root: null,
      rootMargin: "-15% 0px -65% 0px",
      threshold: [0, 0.1, 0.3, 0.6, 1],
    },
  );

  targets.forEach((target) => {
    state.builderCategoryObserver.observe(target);
  });
}

function scheduleCategoryObservation() {
  window.clearTimeout(state.categoryObserverTimer);
  state.categoryObserverTimer = window.setTimeout(observeBuilderCategories, 40);
}

function refreshCategoryNavigation() {
  renderBuilderCategoryNavigator();
  scheduleCategoryObservation();
}

function renderBuilderCategories() {
  elements.builderCategories.replaceChildren();
  elements.noCategoriesMessage.hidden = state.draftSchema.categories.length > 0;

  state.draftSchema.categories.forEach((category, categoryIndex) => {
    const card = document.createElement("article");

    card.className = "builder-category";
    card.dataset.categoryId = category.id;
    card.dataset.navigationCategory = category.id;
    card.id = `builder-category-${category.id}`;
    if (category.parent_category_id) {
      card.dataset.parentCategoryId = category.parent_category_id;
    }

    card.tabIndex = -1;

    const heading = document.createElement("div");
    heading.className = "builder-category-heading";
    const titleBlock = document.createElement("div");
    const titleRow = document.createElement("div");
    titleRow.className = "category-title-row";
    const title = document.createElement("strong");
    title.textContent = category.label;
    const badge = document.createElement("span");
    badge.className = "kind-badge";
    badge.textContent = category.kind === "main" ? "رئيسية" : "متكررة";
    titleRow.append(title, badge);
    const parentCategory = categoryById(category.parent_category_id);
    if (parentCategory) {
      const parentBadge = document.createElement("span");
      parentBadge.className = "kind-badge parent-kind-badge";
      parentBadge.textContent = `ضمن ${parentCategory.label}`;
      titleRow.append(parentBadge);
    }
    const description = document.createElement("p");
    description.className = "builder-category-description";
    description.textContent =
      category.description ||
      (category.kind === "main"
        ? "تظهر مرة واحدة في السجل."
        : "تسمح بإضافة عدة بطاقات مرتبطة بالسجل.");
    titleBlock.append(titleRow, description);
    if ((category.row_markers || []).length) {
      const markerSummary = document.createElement("div");
      markerSummary.className = "builder-marker-summary";
      for (const marker of category.row_markers) {
        const markerBadge = document.createElement("span");
        markerBadge.className = "row-marker-badge";
        markerBadge.textContent = marker.display_text || `# ${marker.label}`;
        markerBadge.style.setProperty("--marker-color", marker.color);
        markerBadge.style.setProperty(
          "--marker-text",
          contrastText(marker.color),
        );
        markerBadge.style.color = marker.color;
        markerSummary.append(markerBadge);
      }
      titleBlock.append(markerSummary);
    }

    const actions = document.createElement("div");
    actions.className = "builder-actions";
    const up = builderActionButton("↑", "move-category-up", category.id);
    const down = builderActionButton("↓", "move-category-down", category.id);
    up.disabled = categoryIndex === 0;
    down.disabled = categoryIndex === state.draftSchema.categories.length - 1;
    actions.append(
      up,
      down,
      builderActionButton("تعديل", "edit-category", category.id),
      builderActionButton(
        "حذف",
        "delete-category",
        category.id,
        "button-danger-quiet",
      ),
    );
    heading.append(titleBlock, actions);

    const fields = document.createElement("div");
    fields.className = "builder-fields";
    category.fields.forEach((field, fieldIndex) => {
      const row = document.createElement("div");
      row.className = "builder-field-row";
      row.dataset.fieldId = field.id;
      const summary = document.createElement("div");
      summary.className = "field-summary";
      const fieldName = document.createElement("strong");
      fieldName.textContent = field.label;
      const fieldMeta = document.createElement("span");
      const flags = [
        FIELD_TYPE_LABELS[field.type],
        field.required ? "مطلوب" : "",
        field.unique ? "فريد" : "",
        field.image_display === "profile" ? "صورة شخصية" : "",
        field.option_filter ? "قائمة مترابطة" : "",
        Object.values(field.validation || {}).some(
          (value) => value !== null && value !== "" && value !== false,
        )
          ? "قيود تحقق"
          : "",
        field.searchable ? "قابل للبحث" : "",
        field.show_in_results ? "يظهر في النتائج" : "",
      ].filter(Boolean);
      fieldMeta.textContent = flags.join(" · ");
      summary.append(fieldName, fieldMeta);

      const fieldActions = document.createElement("div");
      fieldActions.className = "builder-actions";
      const fieldUp = builderActionButton("↑", "move-field-up", field.id);
      const fieldDown = builderActionButton("↓", "move-field-down", field.id);
      fieldUp.dataset.categoryId = category.id;
      fieldDown.dataset.categoryId = category.id;
      fieldUp.disabled = fieldIndex === 0;
      fieldDown.disabled = fieldIndex === category.fields.length - 1;
      const edit = builderActionButton("تعديل", "edit-field", field.id);
      const remove = builderActionButton(
        "حذف",
        "delete-field",
        field.id,
        "button-danger-quiet",
      );
      edit.dataset.categoryId = category.id;
      remove.dataset.categoryId = category.id;
      fieldActions.append(fieldUp, fieldDown, edit, remove);
      row.append(summary, fieldActions);
      fields.append(row);
    });

    const addWrapper = document.createElement("div");
    addWrapper.className = "builder-add-field";
    const addField = document.createElement("button");
    addField.type = "button";
    addField.className = "button button-secondary";
    addField.append(actionIcon("plus"), document.createTextNode("إضافة حقل"));
    addField.dataset.builderAction = "add-field";
    addField.dataset.categoryId = category.id;
    addWrapper.append(addField);
    card.append(heading, fields, addWrapper);
    elements.builderCategories.append(card);
  });
  if (state.mode === "builder") {
    refreshCategoryNavigation();
  }
}

function fieldQualifiedLabel(fieldId, schema = state.draftSchema) {
  const field = fieldById(fieldId, schema);
  const category = fieldCategory(fieldId, schema);
  return field && category
    ? `${category.label} ← ${field.label}`
    : "عنصر محذوف";
}

function targetQualifiedLabel(
  targetType,
  targetId,
  schema = state.draftSchema,
) {
  if (targetType === "category") {
    return `الفئة: ${categoryById(targetId, schema)?.label || "محذوفة"}`;
  }
  return `الحقل: ${fieldQualifiedLabel(targetId, schema)}`;
}

function conditionDisplayValue(condition) {
  if (["empty", "not_empty"].includes(condition.operator)) {
    return "";
  }

  const source = fieldById(condition.source_field_id, state.draftSchema);

  if (!source) {
    return String(condition.value || "");
  }

  if (source.type === "checkbox") {
    return condition.value === "true" ? "محدد" : "غير محدد";
  }

  if (["select", "yes_no", "checkbox_group"].includes(source.type)) {
    return optionLabelForValue(source, condition.value);
  }

  return String(condition.value || "");
}

function conditionSummaryText(condition) {
  const sourceLabel = fieldQualifiedLabel(condition.source_field_id);

  const operator = OPERATOR_LABELS[condition.operator] || condition.operator;

  const value = conditionDisplayValue(condition);

  const valueText = ["empty", "not_empty"].includes(condition.operator)
    ? ""
    : ` «${value}»`;

  const negate = condition.negate ? "ليس صحيحًا أن " : "";

  return `${negate}${sourceLabel} ` + `${operator}${valueText}`;
}

function conditionsGrouped(rules) {
  const groups = new Map();

  rules.forEach((condition) => {
    const groupId =
      condition.group_id ||
      `legacy-${condition.target_type}-${condition.target_id}`;

    if (!groups.has(groupId)) {
      groups.set(groupId, []);
    }

    groups.get(groupId).push(condition);
  });

  return groups;
}
function createConditionRuleRow(condition) {
  const row = document.createElement("div");
  row.className = "condition-row";

  const expression = document.createElement("div");
  expression.className = "condition-expression";
  expression.textContent = conditionSummaryText(condition);

  const actions = document.createElement("div");
  actions.className = "builder-actions";

  const edit = builderActionButton(
    "تعديل الشرط",
    "edit-condition",
    condition.id,
    "",
    "edit",
  );

  const remove = builderActionButton(
    "حذف الشرط",
    "delete-condition",
    condition.id,
    "button-danger-quiet",
    "trash",
  );

  edit.addEventListener("click", (event) => {
    event.stopPropagation();
    openConditionDialog(condition.id);
  });

  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteCondition(condition.id);
  });

  actions.append(edit, remove);
  row.append(expression, actions);

  return row;
}

function appendConditionGroups(container, rules) {
  const groups = conditionsGrouped(rules);

  [...groups.values()].forEach((groupRules, groupIndex) => {
    if (groupIndex > 0) {
      const separator = document.createElement("div");

      separator.className = "condition-or-separator";
      separator.textContent = "أو — OR";

      container.append(separator);
    }

    const group = document.createElement("section");
    group.className = "condition-group-card";

    const heading = document.createElement("div");
    heading.className = "condition-group-heading";

    const title = document.createElement("strong");
    title.textContent = `المجموعة ${groupIndex + 1}`;

    const relation = document.createElement("span");
    relation.textContent = "جميع شروط هذه المجموعة: AND";

    heading.append(title, relation);
    group.append(heading);

    groupRules.forEach((condition) => {
      group.append(createConditionRuleRow(condition));
    });

    container.append(group);
  });
}

function renderBuilderConditions() {
  elements.builderConditions.replaceChildren();

  const conditions = state.draftSchema.conditions || [];

  elements.noConditionsMessage.hidden = conditions.length > 0;

  const targets = new Map();

  conditions.forEach((condition) => {
    const key = `${condition.target_type}:` + `${condition.target_id}`;

    if (!targets.has(key)) {
      targets.set(key, []);
    }

    targets.get(key).push(condition);
  });

  const orderedTargetKeys = [];

  for (const { category } of orderedCategoryTree(state.draftSchema)) {
    orderedTargetKeys.push(`category:${category.id}`);
    for (const field of category.fields) {
      orderedTargetKeys.push(`field:${field.id}`);
    }
  }

  for (const key of orderedTargetKeys) {
    const rules = targets.get(key);
    if (!rules) {
      continue;
    }

    rules.forEach((condition) => {
      const card = createConditionRuleRow(condition);
      card.setAttribute(
        "aria-label",
        targetQualifiedLabel(condition.target_type, condition.target_id),
      );
      elements.builderConditions.append(card);
    });
  }
}

function renderTargetConditionEditor(targetType, targetId, container) {
  container.replaceChildren();

  const rules = conditionsFor(targetType, targetId, state.draftSchema);

  if (!rules.length) {
    const empty = document.createElement("div");
    empty.className = "builder-empty";
    empty.textContent = "لا توجد شروط ظهور لهذا العنصر.";

    container.append(empty);
    return;
  }

  appendConditionGroups(container, rules);
}

function renderCategoryConditionEditor() {
  renderTargetConditionEditor(
    "category",
    state.editingCategoryId,
    elements.categoryConditionsList,
  );
}

function renderFieldConditionEditor() {
  renderTargetConditionEditor(
    "field",
    state.editingFieldId,
    elements.fieldConditionsList,
  );
}

function refreshConditionEditors() {
  renderBuilderConditions();

  if (elements.categoryDialog.open) {
    renderCategoryConditionEditor();
  }

  if (elements.fieldDialog.open) {
    renderFieldConditionEditor();
  }
}

function deleteCondition(conditionId) {
  state.draftSchema.conditions = state.draftSchema.conditions.filter(
    (condition) => condition.id !== conditionId,
  );

  markDirty();
  refreshConditionEditors();
}

function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = String(value);
  return node.innerHTML;
}

function moveArrayItem(array, index, change) {
  const nextIndex = index + change;
  if (index < 0 || nextIndex < 0 || nextIndex >= array.length) {
    return false;
  }
  [array[index], array[nextIndex]] = [array[nextIndex], array[index]];
  return true;
}

function dataLossWarning(noun) {
  const count = state.schema?.stats?.record_count || 0;
  return count
    ? `يوجد ${count} سجل محفوظ. حذف ${noun} ثم حفظ التصميم سيحذف بياناته نهائيًا. هل تريد المتابعة؟`
    : `هل تريد حذف ${noun}؟`;
}

function removeReferencesToFields(fieldIds) {
  const ids = new Set(fieldIds);
  state.draftSchema.conditions = state.draftSchema.conditions.filter(
    (condition) =>
      !ids.has(condition.source_field_id) &&
      !(condition.target_type === "field" && ids.has(condition.target_id)),
  );
  state.draftSchema.categories.forEach((category) => {
    if (ids.has(category.anchor_field_id)) {
      category.anchor_field_id = null;
    }
    category.fields.forEach((field) => {
      if (field.type === "file") {
        field.file_naming.parts = field.file_naming.parts.filter(
          (part) => !ids.has(part.field_id),
        );
      }
      if (ids.has(field.option_filter?.source_field_id)) {
        field.option_filter = null;
      }
      if (ids.has(field.validation?.compare_field_id)) {
        field.validation.compare_field_id = null;
        field.validation.compare_operator = null;
      }
    });
  });
}

function handleBuilderAction(button) {
  const action = button.dataset.builderAction;
  const itemId = button.dataset.itemId;
  const categoryId = button.dataset.categoryId;

  if (action === "move-category-up" || action === "move-category-down") {
    const index = state.draftSchema.categories.findIndex(
      (category) => category.id === itemId,
    );
    if (
      moveArrayItem(
        state.draftSchema.categories,
        index,
        action.endsWith("up") ? -1 : 1,
      )
    ) {
      markDirty();
      renderBuilderCategories();
    }
    return;
  }
  if (action === "edit-category") {
    openCategoryDialog(itemId);
    return;
  }
  if (action === "delete-category") {
    const category = categoryById(itemId);
    if (
      !category ||
      !window.confirm(dataLossWarning(`الفئة "${category.label}"`))
    ) {
      return;
    }
    removeReferencesToFields(category.fields.map((field) => field.id));
    const relatedPersonModeSource = relatedPersonModeSourceId(itemId);
    state.draftSchema.conditions = state.draftSchema.conditions.filter(
      (condition) =>
        condition.source_field_id !== relatedPersonModeSource &&
        !(
          condition.target_type === "category" && condition.target_id === itemId
        ),
    );
    state.draftSchema.categories.forEach((candidate) => {
      if (candidate.parent_category_id === itemId) {
        candidate.parent_category_id = category.parent_category_id || null;
      }
    });
    state.draftSchema.categories = state.draftSchema.categories.filter(
      (candidate) => candidate.id !== itemId,
    );
    markDirty();
    renderBuilder();
    return;
  }
  if (action === "add-field") {
    openFieldDialog(categoryId);
    return;
  }
  if (action === "edit-field") {
    openFieldDialog(categoryId, itemId);
    return;
  }
  if (action === "delete-field") {
    const category = categoryById(categoryId);
    const field = fieldById(itemId);
    if (
      !category ||
      !field ||
      !window.confirm(dataLossWarning(`الحقل "${field.label}"`))
    ) {
      return;
    }
    removeReferencesToFields([itemId]);
    category.fields = category.fields.filter(
      (candidate) => candidate.id !== itemId,
    );
    markDirty();
    renderBuilder();
    return;
  }
  if (action === "move-field-up" || action === "move-field-down") {
    const category = categoryById(categoryId);
    const index =
      category?.fields.findIndex((field) => field.id === itemId) ?? -1;
    if (
      category &&
      moveArrayItem(category.fields, index, action.endsWith("up") ? -1 : 1)
    ) {
      markDirty();
      renderBuilderCategories();
    }
    return;
  }
  if (action === "edit-condition") {
    openConditionDialog(itemId);
    return;
  }
  if (action === "delete-condition") {
    deleteCondition(itemId);
    return;
  }
}

function fillMainFieldSelect(select, selectedValue = "", emptyLabel = "") {
  select.replaceChildren();
  if (emptyLabel) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = emptyLabel;
    select.append(empty);
  }
  for (const { category, field } of allFields().filter(
    ({ category, field }) =>
      category.kind === "main" &&
      field.type !== "file" &&
      !isSystemField(field),
  )) {
    const option = document.createElement("option");
    option.value = field.id;
    option.textContent = `${category.label} ← ${field.label}`;
    select.append(option);
  }
  select.value = selectedValue;
}

function resetMarkerEditor() {
  state.editingMarkerId = null;
  elements.markerLabel.value = "";
  elements.markerDisplayText.value = "";
  elements.markerColor.value = "#0F766E";
  elements.markerRule.value = "independent";
  elements.addMarkerButtonText.textContent = "إضافة وسم";
}

function renderCategoryMarkers() {
  elements.categoryMarkersList.replaceChildren();
  state.categoryMarkersDraft.forEach((marker) => {
    const row = document.createElement("div");
    row.className = "file-part-row";
    const preview = document.createElement("span");
    preview.className = "marker-builder-preview";
    const badge = document.createElement("span");
    badge.className = "row-marker-badge";
    badge.textContent = marker.display_text || `# ${marker.label}`;
    badge.style.setProperty("--marker-color", marker.color);
    badge.style.setProperty("--marker-text", contrastText(marker.color));
    const rule = document.createElement("small");
    rule.textContent =
      {
        independent: "مستقل",
        at_most_one: "مرة واحدة كحد أقصى",
        exactly_one_when_rows: "واحد عند وجود بطاقات",
        exactly_one_always: "واحد دائمًا",
      }[marker.rule] || "مستقل";
    preview.append(badge, rule);
    const actions = document.createElement("div");
    actions.className = "builder-actions";
    const edit = builderActionButton(
      "تعديل الوسم",
      "edit-marker",
      marker.id,
      "",
      "edit",
    );
    const remove = builderActionButton(
      "حذف الوسم",
      "delete-marker",
      marker.id,
      "button-danger-quiet",
      "trash",
    );
    edit.addEventListener("click", () => editMarker(marker.id));
    remove.addEventListener("click", () => deleteMarker(marker.id));
    actions.append(edit, remove);
    row.append(preview, actions);
    elements.categoryMarkersList.append(row);
  });
  if (!state.categoryMarkersDraft.length) {
    const empty = document.createElement("div");
    empty.className = "builder-empty";
    empty.textContent = "لا توجد وسوم لهذه الفئة.";
    elements.categoryMarkersList.append(empty);
  }
}

function editMarker(markerId) {
  const marker = state.categoryMarkersDraft.find(
    (item) => item.id === markerId,
  );
  if (!marker) return;
  state.editingMarkerId = markerId;
  elements.markerLabel.value = marker.label;
  elements.markerDisplayText.value = marker.display_text || "";
  elements.markerColor.value = marker.color || "#0F766E";
  elements.markerRule.value = marker.rule || "independent";
  elements.addMarkerButtonText.textContent = "تحديث الوسم";
}

function deleteMarker(markerId) {
  state.categoryMarkersDraft = state.categoryMarkersDraft.filter(
    (marker) => marker.id !== markerId,
  );
  if (state.editingMarkerId === markerId) resetMarkerEditor();
  renderCategoryMarkers();
}

function addOrUpdateMarker() {
  const label = elements.markerLabel.value.trim();
  if (!label) {
    showToast("أدخل اسم الوسم.", "error");
    return;
  }
  const duplicate = state.categoryMarkersDraft.some(
    (marker) =>
      marker.id !== state.editingMarkerId &&
      marker.label.trim().toLocaleLowerCase() === label.toLocaleLowerCase(),
  );
  if (duplicate) {
    showToast("اسم الوسم مستخدم داخل هذه الفئة.", "error");
    return;
  }
  let marker = state.categoryMarkersDraft.find(
    (item) => item.id === state.editingMarkerId,
  );
  if (!marker) {
    marker = { id: randomDefinitionId("mark") };
    state.categoryMarkersDraft.push(marker);
  }
  marker.label = label;
  marker.display_text = elements.markerDisplayText.value.trim() || `# ${label}`;
  marker.color = elements.markerColor.value;
  marker.rule = elements.markerRule.value;
  resetMarkerEditor();
  renderCategoryMarkers();
}
function appendPlacementOption(parent, value, label) {
  const option = document.createElement("option");

  option.value = value;
  option.textContent = label;

  parent.append(option);
}

function fillCategoryPlacementSelect() {
  elements.categoryPlacement.replaceChildren();

  const categories = state.draftSchema?.categories || [];

  const quickGroup = document.createElement("optgroup");

  quickGroup.label = "موضع سريع";

  appendPlacementOption(quickGroup, "start", "في بداية التطبيق");

  appendPlacementOption(quickGroup, "end", "في نهاية التطبيق");

  elements.categoryPlacement.append(quickGroup);

  if (categories.length) {
    const beforeGroup = document.createElement("optgroup");

    beforeGroup.label = "قبل فئة";

    categories.forEach((category) => {
      appendPlacementOption(
        beforeGroup,
        `before:${category.id}`,
        `قبل: ${category.label}`,
      );
    });

    const afterGroup = document.createElement("optgroup");

    afterGroup.label = "بعد فئة";

    categories.forEach((category) => {
      appendPlacementOption(
        afterGroup,
        `after:${category.id}`,
        `بعد: ${category.label}`,
      );
    });

    elements.categoryPlacement.append(beforeGroup, afterGroup);
  }

  elements.categoryPlacement.value = "end";
}

function fillCategoryParentSelect(category = null) {
  elements.categoryParent.replaceChildren();

  appendPlacementOption(elements.categoryParent, "", "بلا فئة أم");

  const excluded = category
    ? categoryDescendantIds(category.id, state.draftSchema)
    : new Set();
  if (category) {
    excluded.add(category.id);
  }

  for (const { category: candidate, depth } of orderedCategoryTree(
    state.draftSchema,
  )) {
    if (excluded.has(candidate.id)) {
      continue;
    }
    const indent = "— ".repeat(depth);
    appendPlacementOption(
      elements.categoryParent,
      candidate.id,
      `${indent}${candidate.label}`,
    );
  }

  elements.categoryParent.value = category?.parent_category_id || "";
}

function categoryInsertionIndex(placement) {
  const categories = state.draftSchema.categories;

  if (placement === "start") {
    return 0;
  }

  if (!placement || placement === "end") {
    return categories.length;
  }

  const separator = placement.indexOf(":");

  if (separator < 0) {
    return categories.length;
  }

  const mode = placement.slice(0, separator);

  const categoryId = placement.slice(separator + 1);

  const referenceIndex = categories.findIndex(
    (category) => category.id === categoryId,
  );

  if (referenceIndex < 0) {
    return categories.length;
  }

  return mode === "before" ? referenceIndex : referenceIndex + 1;
}
function openCategoryDialog(categoryId = null) {
  const category = categoryId ? categoryById(categoryId) : null;
  const creatingCategory = !category;
  elements.categoryPlacementWrapper.hidden = !creatingCategory;
  if (creatingCategory) {
    fillCategoryPlacementSelect();
  }
  state.editingCategoryId = category?.id || randomDefinitionId("cat");
  state.categoryDialogCommitted = false;
  state.categoryConditionsSnapshot = deepClone(state.draftSchema.conditions);
  state.categoryDirtyBeforeOpen = state.dirty;
  elements.categoryDialogTitle.textContent = category
    ? "تعديل فئة"
    : "إضافة فئة";
  elements.categoryLabel.value = category?.label || "";
  elements.categoryKind.value = category?.kind || "main";
  fillCategoryParentSelect(category);
  elements.categoryDescription.value = category?.description || "";
  elements.categoryAddLabel.value = category?.add_label || "";
  elements.categoryAutoStart.checked = Boolean(category?.auto_start);
  elements.categoryRelatedPerson.checked = Boolean(
    category?.related_person_enabled,
  );
  state.categoryMarkersDraft = deepClone(category?.row_markers || []);
  resetMarkerEditor();
  renderCategoryMarkers();
  fillMainFieldSelect(
    elements.categoryAnchor,
    category?.anchor_field_id || "",
    "في نهاية النموذج",
  );
  updateCategoryDialogType();
  renderCategoryConditionEditor();
  elements.categoryDialog.showModal();
  elements.categoryLabel.focus();
}

function updateCategoryDialogType() {
  const repeatable = elements.categoryKind.value === "repeatable";
  elements.categoryRepeatableOptions.hidden = !repeatable;
}

function saveCategoryFromDialog() {
  const label = elements.categoryLabel.value.trim();
  if (!label) {
    showToast("اسم الفئة مطلوب.", "error");
    elements.categoryLabel.focus();
    return;
  }
  const duplicate = state.draftSchema.categories.some(
    (category) =>
      category.id !== state.editingCategoryId &&
      category.label.trim().toLocaleLowerCase() === label.toLocaleLowerCase(),
  );
  if (duplicate) {
    showToast("اسم الفئة مستخدم مسبقًا.", "error");
    return;
  }

  const existing = state.editingCategoryId
    ? categoryById(state.editingCategoryId)
    : null;
  const kind = elements.categoryKind.value;
  if (
    existing &&
    existing.kind !== kind &&
    (state.schema?.stats?.record_count || 0) > 0
  ) {
    showToast("لا يمكن تغيير نوع فئة بعد وجود سجلات.", "error");
    return;
  }
  const category = existing || {
    id: state.editingCategoryId,
    fields: [],
  };
  category.label = label;
  category.description = elements.categoryDescription.value.trim();
  category.kind = kind;
  category.parent_category_id = elements.categoryParent.value || null;
  category.add_label =
    elements.categoryAddLabel.value.trim() || `إضافة ${label}`;
  category.auto_start =
    kind === "repeatable" && elements.categoryAutoStart.checked;
  category.related_person_enabled =
    kind === "repeatable" && elements.categoryRelatedPerson.checked;
  category.anchor_field_id =
    kind === "repeatable" ? elements.categoryAnchor.value || null : null;
  category.row_markers =
    kind === "repeatable" ? deepClone(state.categoryMarkersDraft) : [];
  if (!category.related_person_enabled) {
    const modeSourceId = relatedPersonModeSourceId(category.id);
    state.draftSchema.conditions = state.draftSchema.conditions.filter(
      (condition) => condition.source_field_id !== modeSourceId,
    );
    category.fields.forEach((field) => {
      delete field.related_person_source_field_id;
    });
  }
  const creatingCategory = !existing;

  if (creatingCategory) {
    const insertionIndex = categoryInsertionIndex(
      elements.categoryPlacement.value,
    );

    state.draftSchema.categories.splice(insertionIndex, 0, category);
  }
  state.categoryDialogCommitted = true;

  markDirty();
  renderBuilder();
  elements.categoryDialog.close();

  if (creatingCategory) {
    window.setTimeout(() => {
      scrollToBuilderCategory(category.id);
    }, 0);
  }
}

function availableFileNamingFields(categoryId) {
  return allFields().filter(
    ({ category, field }) =>
      field.type !== "file" &&
      !isSystemField(field) &&
      (category.kind === "main" || category.id === categoryId),
  );
}

function fillFileNamingFieldSelect() {
  elements.filePartField.replaceChildren();
  for (const { category, field } of availableFileNamingFields(
    state.editingFieldCategoryId,
  )) {
    const option = document.createElement("option");
    option.value = field.id;
    option.textContent = `${category.label} ← ${field.label}`;
    elements.filePartField.append(option);
  }
}

function reconcileFieldOptions() {
  const labels = elements.fieldOptions.value
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter((value, index, array) => value && array.indexOf(value) === index);
  const previous = state.fieldOptionsDraft || [];
  const used = new Set();
  state.fieldOptionsDraft = labels.map((label, index) => {
    let option = previous.find(
      (candidate) => candidate.label === label && !used.has(candidate.id),
    );
    if (!option && previous[index] && !used.has(previous[index].id)) {
      option = previous[index];
    }
    const result = option
      ? { ...option, label, active: option.active !== false }
      : { id: randomDefinitionId("opt"), label, active: true };
    used.add(result.id);
    return result;
  });
  return state.fieldOptionsDraft;
}

function compatibleOptionFilterSources(categoryId, fieldId) {
  return allFields().filter(
    ({ category, field }) =>
      field.id !== fieldId &&
      ["select", "yes_no", "checkbox"].includes(field.type) &&
      (category.kind === "main" || category.id === categoryId),
  );
}

function fillOptionFilterSource() {
  const selected = state.optionFilterDraft?.source_field_id || "";
  elements.optionFilterSource.replaceChildren();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "بدون تصفية";
  elements.optionFilterSource.append(empty);
  for (const { category, field } of compatibleOptionFilterSources(
    state.editingFieldCategoryId,
    state.editingFieldId,
  )) {
    const option = document.createElement("option");
    option.value = field.id;
    option.textContent = `${category.label} ← ${field.label}`;
    elements.optionFilterSource.append(option);
  }
  elements.optionFilterSource.value = selected;
  if (elements.optionFilterSource.value !== selected) {
    elements.optionFilterSource.value = "";
    state.optionFilterDraft = null;
  }
}

function parseOptionLines(value) {
  const result = [];
  const seen = new Set();

  String(value || "")
    .split(/\r?\n/)
    .map((label) => label.trim())
    .filter(Boolean)
    .forEach((label) => {
      const key = label.toLocaleLowerCase();

      if (!seen.has(key)) {
        seen.add(key);
        result.push(label);
      }
    });

  return result;
}
function syncTargetOptionsFromFilterText() {
  const labels = [];
  const seen = new Set();

  elements.optionFilterMatrix
    .querySelectorAll("textarea[data-source-token]")
    .forEach((textarea) => {
      parseOptionLines(textarea.value).forEach((label) => {
        const key = label.toLocaleLowerCase();

        if (!seen.has(key)) {
          seen.add(key);
          labels.push(label);
        }
      });
    });

  const previous = state.fieldOptionsDraft || [];
  const used = new Set();

  state.fieldOptionsDraft = labels.map((label, index) => {
    const key = label.toLocaleLowerCase();

    let option = previous.find(
      (candidate) =>
        candidate.label.toLocaleLowerCase() === key && !used.has(candidate.id),
    );

    if (!option && previous[index] && !used.has(previous[index].id)) {
      option = previous[index];
    }

    const result = option
      ? {
          ...option,
          label,
          active: option.active !== false,
        }
      : {
          id: randomDefinitionId("opt"),
          label,
          active: true,
        };

    used.add(result.id);
    return result;
  });

  elements.fieldOptions.value = state.fieldOptionsDraft
    .map((option) => option.label)
    .join("\n");
}

function renderOptionFilterMatrix() {
  elements.optionFilterMatrix.replaceChildren();

  const sourceId = elements.optionFilterSource.value;

  if (!sourceId) {
    elements.optionFilterMatrix.hidden = true;
    return;
  }

  elements.optionFilterMatrix.hidden = false;

  const source = fieldById(sourceId);

  if (!source) {
    elements.optionFilterMatrix.textContent = "الحقل المتحكم غير موجود.";
    return;
  }

  const sourceTokens = optionSourceTokens(source);

  if (!sourceTokens.length) {
    elements.optionFilterMatrix.textContent = "أضف خيارات للحقل المتحكم أولًا.";
    return;
  }

  const mappings = state.optionFilterDraft?.mappings || {};

  const targetById = new Map(
    (state.fieldOptionsDraft || []).map((option) => [option.id, option]),
  );

  const note = document.createElement("p");
  note.className = "dialog-note";
  note.textContent =
    "اكتب خيارات الحقل الحالي لكل قيمة من الحقل المتحكم، خيارًا واحدًا في كل سطر.";

  elements.optionFilterMatrix.append(note);

  for (const sourceOption of sourceTokens) {
    const row = document.createElement("div");
    row.className = "option-filter-row";

    const title = document.createElement("strong");
    title.textContent = sourceOption.label;

    const textarea = document.createElement("textarea");
    textarea.className = "control option-filter-textarea";

    textarea.rows = 4;
    textarea.dataset.sourceToken = sourceOption.id;
    textarea.placeholder = "اكتب خيارًا واحدًا في كل سطر";

    textarea.value = (mappings[sourceOption.id] || [])
      .map((optionId) => targetById.get(optionId)?.label)
      .filter(Boolean)
      .join("\n");

    textarea.addEventListener("input", syncTargetOptionsFromFilterText);

    row.append(title, textarea);
    elements.optionFilterMatrix.append(row);
  }
}
function collectOptionFilter() {
  const sourceId = elements.optionFilterSource.value;

  if (!sourceId) {
    return null;
  }

  syncTargetOptionsFromFilterText();

  const optionByLabel = new Map(
    state.fieldOptionsDraft.map((option) => [
      option.label.toLocaleLowerCase(),
      option,
    ]),
  );

  const mappings = {};

  elements.optionFilterMatrix
    .querySelectorAll("textarea[data-source-token]")
    .forEach((textarea) => {
      const token = textarea.dataset.sourceToken;

      mappings[token] = parseOptionLines(textarea.value)
        .map((label) => optionByLabel.get(label.toLocaleLowerCase())?.id)
        .filter(Boolean);
    });

  return {
    source_field_id: sourceId,
    mappings,
    unmatched: "none",
  };
}

function fillDateComparisonFields(field) {
  const selected = field?.validation?.compare_field_id || "";
  elements.validationCompareField.replaceChildren();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "بدون مقارنة";
  elements.validationCompareField.append(empty);
  const category = categoryById(state.editingFieldCategoryId);
  for (const {
    category: sourceCategory,
    field: candidate,
  } of allFields().filter(
    ({ category: sourceCategory, field: candidate }) =>
      candidate.id !== state.editingFieldId &&
      candidate.type === elements.fieldType.value &&
      (sourceCategory.kind === "main" || sourceCategory.id === category?.id),
  )) {
    const option = document.createElement("option");
    option.value = candidate.id;
    option.textContent = `${sourceCategory.label} ← ${candidate.label}`;
    elements.validationCompareField.append(option);
  }
  elements.validationCompareField.value = selected;
}

function loadValidation(field) {
  const validation = field?.validation || {};
  elements.validationMinLength.value = validation.min_length ?? "";
  elements.validationMaxLength.value = validation.max_length ?? "";
  elements.validationPattern.value = validation.pattern || "";
  elements.validationMinNumber.value = validation.min ?? "";
  elements.validationMaxNumber.value = validation.max ?? "";
  elements.validationIntegerOnly.checked = Boolean(validation.integer_only);
  elements.validationMinDate.value = validation.min_date || "";
  elements.validationMaxDate.value = validation.max_date || "";
  elements.validationCompareOperator.value =
    validation.compare_operator || "after";
  fillDateComparisonFields(field);
}

function optionalNumber(input) {
  return input.value.trim() === "" ? null : Number(input.value);
}

function collectValidation(type) {
  if (["text", "textarea"].includes(type)) {
    return {
      min_length: optionalNumber(elements.validationMinLength),
      max_length: optionalNumber(elements.validationMaxLength),
      pattern: elements.validationPattern.value.trim(),
    };
  }
  if (type === "number") {
    return {
      min: optionalNumber(elements.validationMinNumber),
      max: optionalNumber(elements.validationMaxNumber),
      integer_only: elements.validationIntegerOnly.checked,
    };
  }
  if (type.startsWith("date_")) {
    return {
      min_date: elements.validationMinDate.value.trim(),
      max_date: elements.validationMaxDate.value.trim(),
      compare_field_id: elements.validationCompareField.value || null,
      compare_operator: elements.validationCompareField.value
        ? elements.validationCompareOperator.value
        : null,
    };
  }
  return {};
}

function fillRelatedPersonSourceFields(selectedId = "") {
  const type = elements.fieldType.value;
  elements.relatedPersonSourceField.replaceChildren();
  appendBlankOption(
    elements.relatedPersonSourceField,
    "لا تنسخ قيمة تلقائيًا",
  );
  for (const { category, field } of allFields().filter(
    ({ category: candidateCategory, field: candidateField }) =>
      candidateCategory.kind === "main" &&
      candidateField.type === type &&
      candidateField.type !== "file" &&
      !isSystemField(candidateField),
  )) {
    const option = document.createElement("option");
    option.value = field.id;
    option.textContent = `${category.label} ← ${field.label}`;
    elements.relatedPersonSourceField.append(option);
  }
  elements.relatedPersonSourceField.value = selectedId;
}

function openFieldDialog(categoryId, fieldId = null) {
  state.editingFieldCategoryId = categoryId;

  const category = categoryById(categoryId);
  const field = fieldId ? fieldById(fieldId) : null;

  state.editingFieldId = field?.id || randomDefinitionId("fld");

  state.fieldDialogCommitted = false;
  state.fieldConditionsSnapshot = deepClone(state.draftSchema.conditions);
  state.fieldDirtyBeforeOpen = state.dirty;
  if (!category) {
    return;
  }
  elements.fieldDialogTitle.textContent = field
    ? `تعديل حقل — ${category.label}`
    : `إضافة حقل — ${category.label}`;
  elements.fieldLabel.value = field?.label || "";
  elements.fieldType.value = field?.type || "text";
  elements.fieldPlaceholder.value = field?.placeholder || "";
  elements.fieldWidth.value = field?.width || "normal";
  state.fieldOptionsDraft = deepClone(field?.options || []);
  elements.fieldOptions.value = state.fieldOptionsDraft
    .map((option) => option.label)
    .join("\n");
  elements.fieldRequired.checked = Boolean(field?.required);
  elements.fieldUnique.checked = Boolean(field?.unique);
  elements.fieldSearchable.checked = Boolean(field?.searchable);
  elements.fieldSearchMatch.value = field?.search_match || "contains";
  elements.fieldShowResult.checked = Boolean(field?.show_in_results);
  elements.fieldResultTitle.checked = Boolean(field?.result_title);
  fillRelatedPersonSourceFields(field?.related_person_source_field_id || "");
  elements.fileNamingMode.value = field?.file_naming?.mode || "original";
  elements.fileProfileImage.checked = field?.image_display === "profile";
  state.filePartsDraft = deepClone(field?.file_naming?.parts || []);
  state.optionFilterDraft = deepClone(field?.option_filter || null);
  fillFileNamingFieldSelect();
  fillOptionFilterSource();
  loadValidation(field);
  updateFieldDialogType();
  renderOptionFilterMatrix();
  renderFileParts();
  renderFieldConditionEditor();
  elements.fieldDialog.showModal();
  elements.fieldLabel.focus();
}

function updateFieldDialogType() {
  const type = elements.fieldType.value;
  const isFile = type === "file";
  const systemField = SYSTEM_FIELD_TYPES.has(type);
  const hasOptions = ["select", "checkbox_group"].includes(type);
  const searchable = !isFile && !systemField;
  const textType = ["text", "textarea"].includes(type);
  const numberType = type === "number";
  const dateType = type.startsWith("date_");
  const relatedPersonEligible = Boolean(
      categoryById(state.editingFieldCategoryId)?.kind === "repeatable" &&
      categoryById(state.editingFieldCategoryId)?.related_person_enabled &&
      !isFile &&
      !systemField,
  );
  const hasOptionFilterSource = Boolean(elements.optionFilterSource.value);
  elements.fieldOptionsWrapper.hidden = !hasOptions || hasOptionFilterSource;
  elements.optionFilterEditor.hidden = !hasOptions;
  elements.fieldPlaceholder.closest(".field").hidden = systemField;
  elements.fieldRequired.closest(".check-field").hidden = systemField;
  elements.fieldSearchableWrapper.hidden = isFile || systemField;
  elements.fieldUniqueWrapper.hidden =
    isFile || type === "checkbox" || systemField;
  elements.fieldSearchMatchWrapper.hidden =
    !searchable || !elements.fieldSearchable.checked;
  elements.fieldResultWrapper.hidden = isFile || systemField;
  elements.fieldTitleWrapper.hidden =
    isFile ||
    systemField ||
    categoryById(state.editingFieldCategoryId)?.kind !== "main" ||
    !elements.fieldShowResult.checked;
  elements.relatedPersonFieldEditor.hidden = !relatedPersonEligible;
  if (relatedPersonEligible) {
    const selectedSource = elements.relatedPersonSourceField.value;
    fillRelatedPersonSourceFields(selectedSource);
  } else {
    elements.relatedPersonSourceField.value = "";
  }
  elements.fileNamingEditor.hidden = !isFile;
  const profileImageEligible =
    isFile && categoryById(state.editingFieldCategoryId)?.kind === "main";
  elements.fileProfileImageWrapper.hidden = !profileImageEligible;
  if (!profileImageEligible) {
    elements.fileProfileImage.checked = false;
  }
  elements.fileTemplateEditor.hidden =
    !isFile || elements.fileNamingMode.value !== "template";
  elements.fieldConditionsList.closest(".dialog-subsection").hidden =
    systemField;
  elements.fieldValidationEditor.hidden =
    systemField || !(textType || numberType || dateType);
  elements.textValidationFields.hidden = !textType;
  elements.numberValidationFields.hidden = !numberType;
  elements.dateValidationFields.hidden = !dateType;
  if (isFile || systemField) {
    elements.fieldRequired.checked = false;
    elements.fieldSearchable.checked = false;
    elements.fieldShowResult.checked = false;
    elements.fieldResultTitle.checked = false;
    elements.fieldUnique.checked = false;
  }
  if (["yes_no", "select", "checkbox", "checkbox_group"].includes(type)) {
    elements.fieldSearchMatch.value = "exact";
  }
  if (dateType) {
    fillDateComparisonFields(fieldById(state.editingFieldId));
  }
  if (hasOptions) {
    fillOptionFilterSource();
    renderOptionFilterMatrix();
  }
}

function renderFileParts() {
  elements.filePartsList.replaceChildren();
  state.filePartsDraft.forEach((part, index) => {
    const row = document.createElement("div");
    row.className = "file-part-row";
    const preview = document.createElement("span");
    preview.className = "file-part-preview";
    const field = fieldById(part.field_id);
    const prefix = part.prefix || "";
    const suffix = part.suffix || "";
    preview.textContent =
      `${JSON.stringify(prefix)} + ` +
      `{${field?.label || "حقل محذوف"}} + ` +
      `${JSON.stringify(suffix)}`;
    const actions = document.createElement("div");
    actions.className = "builder-actions";
    const up = builderActionButton(
      "نقل إلى أعلى",
      "file-part-up",
      String(index),
      "",
      "up",
    );
    const down = builderActionButton(
      "نقل إلى أسفل",
      "file-part-down",
      String(index),
      "",
      "down",
    );
    const remove = builderActionButton(
      "حذف الجزء",
      "file-part-delete",
      String(index),
      "button-danger-quiet",
      "trash",
    );
    up.disabled = index === 0;
    down.disabled = index === state.filePartsDraft.length - 1;
    actions.append(up, down, remove);
    row.append(preview, actions);
    elements.filePartsList.append(row);
  });
  if (!state.filePartsDraft.length) {
    const empty = document.createElement("div");
    empty.className = "builder-empty";
    empty.textContent = "أضف الحقول التي تكوّن اسم الملف بالترتيب المطلوب.";
    elements.filePartsList.append(empty);
  }
}

function addFilePart() {
  if (!elements.filePartField.value) {
    showToast("لا يوجد حقل متاح لتسمية الملف.", "error");
    return;
  }

  state.filePartsDraft.push({
    field_id: elements.filePartField.value,
    prefix: elements.filePartPrefix.value,
    suffix: elements.filePartSuffix.value,
  });

  elements.filePartPrefix.value = "";
  elements.filePartSuffix.value = "";

  renderFileParts();
}

function handleFilePartAction(button) {
  const index = Number(button.dataset.itemId);
  const action = button.dataset.builderAction;
  if (action === "file-part-delete") {
    state.filePartsDraft.splice(index, 1);
  } else if (action === "file-part-up") {
    moveArrayItem(state.filePartsDraft, index, -1);
  } else if (action === "file-part-down") {
    moveArrayItem(state.filePartsDraft, index, 1);
  }
  renderFileParts();
}

function saveFieldFromDialog() {
  const category = categoryById(state.editingFieldCategoryId);
  if (!category) {
    return;
  }
  const label = elements.fieldLabel.value.trim();
  if (!label) {
    showToast("اسم الحقل مطلوب.", "error");
    elements.fieldLabel.focus();
    return;
  }
  if (
    category.fields.some(
      (field) =>
        field.id !== state.editingFieldId &&
        field.label.trim().toLocaleLowerCase() === label.toLocaleLowerCase(),
    )
  ) {
    showToast("اسم الحقل مستخدم داخل هذه الفئة.", "error");
    return;
  }

  const type = elements.fieldType.value;
  const systemField = SYSTEM_FIELD_TYPES.has(type);
  if (systemField && category.kind !== "main") {
    showToast("حقول معرّف السجل وتواريخه تضاف إلى فئة رئيسية فقط.", "error");
    return;
  }
  if (
    systemField &&
    allFields().some(
      ({ field }) => field.id !== state.editingFieldId && field.type === type,
    )
  ) {
    showToast("يوجد حقل آخر من نوع بيانات السجل نفسه.", "error");
    return;
  }
  let options = [];
  let optionFilter = null;
  if (type === "yes_no") {
    const previous = state.fieldOptionsDraft || [];
    options = ["نعم", "لا"].map(
      (optionLabel) =>
        previous.find((candidate) => candidate.label === optionLabel) || {
          id: randomDefinitionId("opt"),
          label: optionLabel,
          active: true,
        },
    );
  } else if (["select", "checkbox_group"].includes(type)) {
    if (elements.optionFilterSource.value) {
      optionFilter = collectOptionFilter();
      options = deepClone(state.fieldOptionsDraft);
    } else {
      options = reconcileFieldOptions();
    }
  }
  if (["select", "checkbox_group"].includes(type) && !options.length) {
    showToast("أضف خيارًا واحدًا على الأقل للحقل.", "error");
    return;
  }
  if (
    type === "file" &&
    elements.fileNamingMode.value === "template" &&
    !state.filePartsDraft.length
  ) {
    showToast("أضف جزءًا واحدًا على الأقل لصيغة اسم الملف.", "error");
    return;
  }
  if (
    type === "file" &&
    elements.fileProfileImage.checked &&
    allFields().some(
      ({ field }) =>
        field.id !== state.editingFieldId &&
        field.image_display === "profile",
    )
  ) {
    showToast("يوجد حقل آخر محدد بوصفه الصورة الشخصية.", "error");
    return;
  }

  const validation = collectValidation(type);
  if (
    validation.min_length != null &&
    validation.max_length != null &&
    validation.min_length > validation.max_length
  ) {
    showToast("الحد الأدنى لطول النص أكبر من الحد الأعلى.", "error");
    return;
  }
  if (
    validation.min != null &&
    validation.max != null &&
    validation.min > validation.max
  ) {
    showToast("الحد الأدنى للرقم أكبر من الحد الأعلى.", "error");
    return;
  }
  if (
    validation.min_date &&
    validation.max_date &&
    validation.min_date > validation.max_date
  ) {
    showToast("أقدم تاريخ مسموح يأتي بعد أحدث تاريخ مسموح.", "error");
    return;
  }
  if (validation.pattern) {
    try {
      new RegExp(validation.pattern);
    } catch (_error) {
      showToast("نمط التحقق النصي غير صالح.", "error");
      return;
    }
  }

  const existing = state.editingFieldId
    ? fieldById(state.editingFieldId)
    : null;
  if (
    existing &&
    existing.type !== type &&
    (state.schema?.stats?.record_count || 0) > 0 &&
    (existing.type === "file" || type === "file") &&
    !window.confirm(
      "تغيير الحقل من ملف أو إلى ملف سيمسح قيمه الحالية عند حفظ التصميم. هل تريد المتابعة؟",
    )
  ) {
    return;
  }

  const field = existing || {
    id: state.editingFieldId,
  };
  field.label = label;
  field.type = type;
  field.required = !systemField && elements.fieldRequired.checked;
  field.placeholder = systemField
    ? ""
    : elements.fieldPlaceholder.value.trim();
  field.width = elements.fieldWidth.value;
  field.options = options;
  field.searchable =
    type !== "file" && !systemField && elements.fieldSearchable.checked;
  field.search_match = elements.fieldSearchMatch.value;
  field.show_in_results =
    type !== "file" && !systemField && elements.fieldShowResult.checked;
  field.result_title =
    category.kind === "main" &&
    field.show_in_results &&
    elements.fieldResultTitle.checked;
  field.unique =
    type !== "file" &&
    type !== "checkbox" &&
    !systemField &&
    elements.fieldUnique.checked;
  field.validation = systemField ? {} : validation;
  field.option_filter = ["select", "checkbox_group"].includes(type)
    ? optionFilter
    : null;
  field.related_person_source_field_id =
    category.kind === "repeatable" && category.related_person_enabled
      ? elements.relatedPersonSourceField.value || null
      : null;

  if (type === "file") {
    field.image_display = elements.fileProfileImage.checked
      ? "profile"
      : null;
    field.file_naming = {
      mode: elements.fileNamingMode.value,
      parts: deepClone(state.filePartsDraft),
    };
  } else {
    delete field.image_display;
    delete field.file_naming;
  }
  if (!existing) {
    category.fields.push(field);
  }
  markDirty();
  renderBuilder();
  state.fieldDialogCommitted = true;
  elements.fieldDialog.close();
}

function conditionTargetCategory(targetType, targetId) {
  if (targetType === "category") {
    const existing = categoryById(targetId);

    if (existing) {
      return existing;
    }

    if (state.editingCategoryId === targetId) {
      return {
        id: targetId,
        kind: elements.categoryKind.value,
      };
    }

    return null;
  }

  const existing = fieldCategory(targetId);

  if (existing) {
    return existing;
  }

  if (state.editingFieldId === targetId) {
    return categoryById(state.editingFieldCategoryId);
  }

  return null;
}

function fillConditionSources(targetType, targetId, selected = "") {
  elements.conditionSource.replaceChildren();

  const targetCategory = conditionTargetCategory(targetType, targetId);

  if (targetType === "field") {
    const relatedPersonMode = relatedPersonModeField(targetCategory);
    if (relatedPersonMode) {
      const option = document.createElement("option");
      option.value = relatedPersonMode.id;
      option.textContent = `${targetCategory.label} ← ${relatedPersonMode.label}`;
      elements.conditionSource.append(option);
    }
  }

  for (const { category, field } of allFields()) {
    const allowed =
      field.id !== targetId &&
      !isSystemField(field) &&
      (category.kind === "main" || category.id === targetCategory?.id);

    if (!allowed) {
      continue;
    }

    const option = document.createElement("option");

    option.value = field.id;
    option.textContent = `${category.label} ← ${field.label}`;

    elements.conditionSource.append(option);
  }

  if (selected) {
    elements.conditionSource.value = selected;
  }
}

function fillConditionOperators(selected = "") {
  elements.conditionOperator.replaceChildren();

  const source = fieldById(elements.conditionSource.value);

  const operators = CONDITION_OPERATORS_BY_TYPE[source?.type] || [];

  operators.forEach((operator) => {
    const option = document.createElement("option");

    option.value = operator;
    option.textContent = OPERATOR_LABELS[operator] || operator;

    elements.conditionOperator.append(option);
  });

  if (selected && operators.includes(selected)) {
    elements.conditionOperator.value = selected;
  }
}

function fillConditionGroups(targetType, targetId, selected = "") {
  elements.conditionGroup.replaceChildren();

  const rules = conditionsFor(targetType, targetId, state.draftSchema);

  const groupIds = [
    ...new Set(
      rules.map(
        (condition) => condition.group_id || `legacy-${targetType}-${targetId}`,
      ),
    ),
  ];

  groupIds.forEach((groupId, index) => {
    const option = document.createElement("option");

    option.value = groupId;
    option.textContent = `المجموعة ${index + 1} — AND`;

    elements.conditionGroup.append(option);
  });

  const newGroup = document.createElement("option");

  newGroup.value = "__new_group__";
  newGroup.textContent = "مجموعة بديلة جديدة — OR";

  elements.conditionGroup.append(newGroup);

  if (selected && groupIds.includes(selected)) {
    elements.conditionGroup.value = selected;
  } else if (groupIds.length) {
    elements.conditionGroup.value = groupIds[0];
  } else {
    elements.conditionGroup.value = "__new_group__";
  }
}
function createConditionCalendarControl(type, initialValue = "") {
  const root = document.createElement("div");
  root.className = "calendar-control";

  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.dataset.conditionValue = "";

  const year = document.createElement("select");
  year.className = "control";

  const month = document.createElement("select");
  month.className = "control";

  const day = document.createElement("select");
  day.className = "control";

  appendBlankOption(year, "السنة");
  appendBlankOption(month, "الشهر");
  appendBlankOption(day, "اليوم");

  const [firstYear, lastYear] = calendarYearRange(type);

  for (let value = firstYear; value <= lastYear; value += 1) {
    const option = document.createElement("option");

    option.value = String(value);
    option.textContent = String(value);
    year.append(option);
  }

  CALENDAR_MONTH_NAMES[type].forEach((name, index) => {
    const option = document.createElement("option");

    option.value = String(index + 1).padStart(2, "0");
    option.textContent = name;

    month.append(option);
  });

  function synchronizeDays() {
    const previousDay = day.value;
    populateCalendarDays(
      day,
      maximumSelectableCalendarDay(type, year.value, month.value),
      previousDay,
    );

    hidden.value =
      year.value && month.value && day.value
        ? `${year.value}-${month.value}-${day.value}`
        : "";
  }

  installSelectAutoAdvance(day, {
    onChange: synchronizeDays,
    advance: () => month.focus(),
    requiredDigits: 2,
  });

  installSelectAutoAdvance(month, {
    onChange: synchronizeDays,
    advance: () => year.focus(),
    requiredDigits: 2,
  });

  installSelectAutoAdvance(year, {
    onChange: synchronizeDays,
    advance: () => elements.confirmConditionButton.focus(),
    requiredDigits: 4,
  });

  root.append(hidden, day, month, year);

  const [initialYear, initialMonth, initialDay] = String(
    initialValue || "",
  ).split("-");

  year.value = initialYear || "";
  month.value = initialMonth || "";

  synchronizeDays();

  day.value = initialDay || "";
  synchronizeDays();

  return root;
}

function currentConditionValue() {
  return (
    elements.conditionValueControl.querySelector("[data-condition-value]")
      ?.value || ""
  );
}

function renderConditionValueControl(initialValue = "") {
  elements.conditionValueControl.replaceChildren();

  const source = fieldById(elements.conditionSource.value);

  const operator = elements.conditionOperator.value;

  const requiresValue = !["empty", "not_empty"].includes(operator);

  elements.conditionValueWrapper.hidden = !requiresValue;

  if (!requiresValue || !source) {
    return;
  }

  if (["date_gregorian", "date_hijri", "date_persian"].includes(source.type)) {
    elements.conditionValueControl.append(
      createConditionCalendarControl(source.type, initialValue),
    );

    return;
  }

  let control;

  if (source.type === "checkbox") {
    control = document.createElement("select");
    control.className = "control";

    const checked = document.createElement("option");

    checked.value = "true";
    checked.textContent = "محدد";

    const unchecked = document.createElement("option");

    unchecked.value = "false";
    unchecked.textContent = "غير محدد";

    control.append(checked, unchecked);
  } else if (["select", "yes_no", "checkbox_group"].includes(source.type)) {
    control = document.createElement("select");
    control.className = "control";

    appendBlankOption(control, "— اختر —");

    (source.options || []).forEach((sourceOption) => {
      const option = document.createElement("option");

      option.value = sourceOption.id;
      option.textContent =
        sourceOption.active === false
          ? `${sourceOption.label} — غير نشط`
          : sourceOption.label;

      control.append(option);
    });
  } else {
    control = document.createElement("input");
    control.className = "control";

    if (source.type === "number") {
      control.type = "number";
      control.step = "any";
    } else {
      control.type = "text";
    }
  }

  control.dataset.conditionValue = "";

  if (["select", "yes_no", "checkbox_group"].includes(source.type)) {
    control.value = optionIdForValue(source, initialValue);
  } else {
    control.value = initialValue || "";
  }

  elements.conditionValueControl.append(control);
}
function openConditionDialog(
  conditionId = null,
  targetType = null,
  targetId = null,
) {
  const condition = conditionId
    ? state.draftSchema.conditions.find((item) => item.id === conditionId)
    : null;

  if (condition) {
    targetType = condition.target_type;
    targetId = condition.target_id;
  }

  if (!targetType || !targetId) {
    showToast("افتح الفئة أو الحقل الذي تريد إضافة الشرط إليه.", "error");
    return;
  }

  state.editingConditionId = conditionId;
  state.conditionTargetType = targetType;
  state.conditionTargetId = targetId;

  elements.conditionDialogTitle.textContent = condition
    ? "تعديل شرط ظهور"
    : "إضافة شرط ظهور";

  elements.conditionTargetLabel.textContent = editableTargetLabel(
    targetType,
    targetId,
  );

  fillConditionSources(targetType, targetId, condition?.source_field_id || "");

  if (!elements.conditionSource.options.length) {
    showToast("لا يوجد حقل متاح للتحكم في ظهور هذا العنصر.", "error");
    return;
  }

  fillConditionOperators(condition?.operator || "");

  fillConditionGroups(targetType, targetId, condition?.group_id || "");

  elements.conditionNegate.checked = Boolean(condition?.negate);

  renderConditionValueControl(condition?.value || "");

  elements.conditionDialog.showModal();
}

function saveConditionFromDialog() {
  const targetType = state.conditionTargetType;

  const targetId = state.conditionTargetId;

  const sourceId = elements.conditionSource.value;

  const operator = elements.conditionOperator.value;

  if (!targetType || !targetId || !sourceId || !operator) {
    showToast("بيانات شرط الظهور غير مكتملة.", "error");
    return;
  }

  const requiresValue = !["empty", "not_empty"].includes(operator);

  const value = requiresValue ? currentConditionValue() : "";

  if (requiresValue && String(value).trim() === "") {
    showToast("اختر أو أدخل قيمة الشرط.", "error");
    return;
  }

  const existing = state.editingConditionId
    ? state.draftSchema.conditions.find(
        (condition) => condition.id === state.editingConditionId,
      )
    : null;

  const condition = existing || {
    id: randomDefinitionId("cond"),
  };

  let groupId = elements.conditionGroup.value;

  if (groupId === "__new_group__") {
    groupId = randomDefinitionId("grp");
  }

  condition.target_type = targetType;
  condition.target_id = targetId;
  condition.source_field_id = sourceId;
  condition.operator = operator;
  condition.value = value;
  condition.group_id = groupId;
  condition.negate = elements.conditionNegate.checked;

  if (!existing) {
    state.draftSchema.conditions.push(condition);
  }

  if (targetType === "category") {
    const targetCategory = categoryById(targetId);

    const sourceCategory = fieldCategory(sourceId);

    if (
      targetCategory?.kind === "repeatable" &&
      !targetCategory.anchor_field_id &&
      sourceCategory?.kind === "main"
    ) {
      targetCategory.anchor_field_id = sourceId;
    }
  }

  markDirty();
  refreshConditionEditors();
  elements.conditionDialog.close();
}

function setSchemaSaving(saving) {
  state.savingSchema = saving;
  elements.saveSchemaButton.disabled = saving;
  elements.discardSchemaButton.disabled = saving;
  elements.backupButton.disabled = saving || state.backingUp;
  elements.schemaSpinner.hidden = !saving;
  elements.saveSchemaText.textContent = saving
    ? "جاري حفظ التصميم…"
    : "حفظ تصميم التطبيق";
}

async function saveSchema(options = {}) {
  const automatic = options.automatic === true;

  if (state.savingSchema || !state.draftSchema) {
    return false;
  }

  syncSettingsToDraft();

  if (
    !state.draftSchema.app.title ||
    !state.draftSchema.app.entity_singular ||
    !state.draftSchema.app.entity_plural
  ) {
    if (!automatic) {
      showToast("اسم التطبيق واسم السجل بالمفرد والجمع مطلوبة.", "error");
    }

    return false;
  }

  setSchemaSaving(true);

  try {
    const response = await fetch("/api/schema", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(state.draftSchema),
    });

    const schema = await responseJson(response);

    applyLoadedSchema(schema, {
      resetRecord: !automatic,
    });

    if (automatic) {
      const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      elements.builderSaveState.dataset.dirty = "false";
      elements.builderSaveState.textContent = `حُفظ التصميم تلقائيًا عند ${time}.`;
    } else {
      showToast("تم حفظ تصميم التطبيق وتحديث ملف Excel.");
    }

    return true;
  } catch (error) {
    reportClientError(automatic ? "schema-autosave" : "schema-save", error);
    if (automatic) {
      state.dirty = true;

      elements.builderSaveState.dataset.dirty = "true";
      elements.builderSaveState.textContent = `تعذّر الحفظ التلقائي: ${error.message}`;
    } else {
      showToast(error.message, "error");
    }

    return false;
  } finally {
    setSchemaSaving(false);
  }
}
async function autosaveBuilder() {
  if (
    state.closing ||
    state.mode !== "builder" ||
    !state.dirty ||
    state.savingSchema ||
    !state.draftSchema
  ) {
    return;
  }

  await saveSchema({
    automatic: true,
  });
}

async function createBackup() {
  if (state.backingUp || state.savingSchema) {
    return;
  }
  state.backingUp = true;
  elements.backupButton.disabled = true;
  try {
    const response = await fetch("/api/backup", { method: "POST" });
    const result = await responseJson(response);
    const download = document.createElement("a");
    download.href = result.download_url;
    download.download = result.filename;
    document.body.append(download);
    download.click();
    download.remove();
    showToast(`تم إنشاء النسخة الاحتياطية: ${result.filename}`);
  } catch (error) {
    reportClientError("backup-create", error);

    showToast(error.message, "error");
  } finally {
    state.backingUp = false;
    elements.backupButton.disabled = state.savingSchema;
  }
}

function discardSchemaChanges() {
  if (!state.dirty) {
    return;
  }
  if (!window.confirm("هل تريد تجاهل جميع تغييرات التصميم غير المحفوظة؟")) {
    return;
  }
  state.draftSchema = deepClone(state.schema);
  markClean();
  renderBuilder();
}

function conditionsFor(targetType, targetId, schema = state.schema) {
  return (schema.conditions || []).filter(
    (condition) =>
      condition.target_type === targetType && condition.target_id === targetId,
  );
}

function conditionValue(condition, mainValues, rowValues = null) {
  const sourceCategory = fieldCategory(condition.source_field_id, state.schema);
  if (
    sourceCategory?.kind === "repeatable" &&
    rowValues &&
    Object.prototype.hasOwnProperty.call(rowValues, condition.source_field_id)
  ) {
    return rowValues[condition.source_field_id];
  }
  return mainValues[condition.source_field_id] ?? "";
}

function normalizedComparison(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase();
}

function conditionValueIsEmpty(field, value) {
  if (field?.type === "checkbox_group") {
    return !Array.isArray(value) || value.length === 0;
  }

  if (field?.type === "file") {
    if (value && typeof value === "object") {
      return !(value.stored_path || value.upload);
    }

    return String(value || "").trim() === "";
  }

  return value == null || String(value).trim() === "";
}

function conditionMatches(condition, mainValues, rowValues = null) {
  const sourceField = fieldById(condition.source_field_id, state.schema);

  if (!sourceField) {
    return false;
  }

  const rawActual = conditionValue(condition, mainValues, rowValues);

  const operator = condition.operator;
  const expected = String(condition.value ?? "");

  const empty = conditionValueIsEmpty(sourceField, rawActual);

  let result = false;

  if (operator === "empty") {
    result = empty;
  } else if (operator === "not_empty") {
    result = !empty;
  } else if (empty) {
    result = false;
  } else if (sourceField.type === "checkbox") {
    const actual =
      rawActual === true ||
      ["true", "1", "نعم", "yes", "on"].includes(
        String(rawActual).toLocaleLowerCase(),
      )
        ? "true"
        : "false";

    result = operator === "equals" ? actual === expected : actual !== expected;
  } else if (["select", "yes_no"].includes(sourceField.type)) {
    const actual = optionIdForValue(sourceField, rawActual);

    result = operator === "equals" ? actual === expected : actual !== expected;
  } else if (sourceField.type === "checkbox_group") {
    const rawValues = Array.isArray(rawActual)
      ? rawActual
      : String(rawActual || "")
          .split(" | ")
          .map((item) => item.trim())
          .filter(Boolean);

    const actualIds = new Set(
      rawValues.map((item) => optionIdForValue(sourceField, item)),
    );

    result =
      operator === "contains"
        ? actualIds.has(expected)
        : !actualIds.has(expected);
  } else if (sourceField.type === "number") {
    const actualNumber = Number(rawActual);
    const expectedNumber = Number(expected);

    if (Number.isFinite(actualNumber) && Number.isFinite(expectedNumber)) {
      result =
        {
          equals: actualNumber === expectedNumber,
          not_equals: actualNumber !== expectedNumber,
          greater_than: actualNumber > expectedNumber,
          greater_or_equal: actualNumber >= expectedNumber,
          less_than: actualNumber < expectedNumber,
          less_or_equal: actualNumber <= expectedNumber,
        }[operator] ?? false;
    }
  } else if (sourceField.type.startsWith("date_")) {
    const actualDate = String(rawActual || "");

    result =
      {
        equals: actualDate === expected,
        not_equals: actualDate !== expected,
        before: actualDate < expected,
        after: actualDate > expected,
        on_or_before: actualDate <= expected,
        on_or_after: actualDate >= expected,
      }[operator] ?? false;
  } else {
    const actualText = normalizedComparison(rawActual);
    const expectedText = normalizedComparison(expected);

    result =
      {
        equals: actualText === expectedText,
        not_equals: actualText !== expectedText,
        contains: actualText.includes(expectedText),
        not_contains: !actualText.includes(expectedText),
      }[operator] ?? false;
  }

  return condition.negate ? !result : result;
}

function targetVisible(targetType, targetId, mainValues, rowValues = null) {
  const conditions = conditionsFor(targetType, targetId);

  if (!conditions.length) {
    return true;
  }

  const groups = new Map();

  conditions.forEach((condition) => {
    const groupId = condition.group_id || `legacy-${targetType}-${targetId}`;

    if (!groups.has(groupId)) {
      groups.set(groupId, []);
    }

    groups.get(groupId).push(condition);
  });

  return [...groups.values()].some((groupConditions) =>
    groupConditions.every((condition) =>
      conditionMatches(condition, mainValues, rowValues),
    ),
  );
}

function isPersianLeapYear(year) {
  return [1, 5, 9, 13, 17, 22, 26, 30].includes(year % 33);
}

function isHijriLeapYear(year) {
  return [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29].includes(year % 30);
}

function isGregorianLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function calendarMonthLength(type, year, month) {
  if (type === "date_gregorian") {
    if ([1, 3, 5, 7, 8, 10, 12].includes(month)) {
      return 31;
    }
    if (month === 2) {
      return isGregorianLeapYear(year) ? 29 : 28;
    }
    return 30;
  }
  if (type === "date_hijri") {
    if (month % 2 === 1) {
      return 30;
    }
    return month === 12 && isHijriLeapYear(year) ? 30 : 29;
  }
  if (month <= 6) {
    return 31;
  }
  if (month <= 11) {
    return 30;
  }
  return isPersianLeapYear(year) ? 30 : 29;
}

function appendBlankOption(select, label) {
  const option = document.createElement("option");
  option.value = "";
  option.textContent = label;
  select.append(option);
}

function calendarYearRange(type) {
  if (type === "date_gregorian") {
    return [1800, 2200];
  }
  if (type === "date_hijri") {
    return [1200, 1700];
  }
  return [1200, 1600];
}

function maximumSelectableCalendarDay(type, yearValue, monthValue) {
  const year = Number(yearValue);
  const month = Number(monthValue);

  if (!month) {
    return 31;
  }

  if (year) {
    return calendarMonthLength(type, year, month);
  }

  if (type === "date_gregorian") {
    if (month === 2) {
      return 29;
    }
    return [4, 6, 9, 11].includes(month) ? 30 : 31;
  }

  if (type === "date_hijri") {
    return month % 2 === 1 || month === 12 ? 30 : 29;
  }

  return month <= 6 ? 31 : 30;
}

function populateCalendarDays(daySelect, maximum, previousValue = "") {
  daySelect.replaceChildren();
  appendBlankOption(daySelect, "اليوم");

  for (let value = 1; value <= maximum; value += 1) {
    const option = document.createElement("option");
    const padded = String(value).padStart(2, "0");
    option.value = padded;
    option.textContent = padded;
    daySelect.append(option);
  }

  if (previousValue && Number(previousValue) <= maximum) {
    daySelect.value = String(previousValue).padStart(2, "0");
  }
}

function focusNextEntryField(currentControl) {
  const currentWrapper = currentControl.closest("[data-field-wrapper]");
  if (!currentWrapper || currentControl.dataset.scope === "search") {
    return;
  }

  const wrappers = [
    ...elements.recordForm.querySelectorAll("[data-field-wrapper]"),
  ];
  const currentIndex = wrappers.indexOf(currentWrapper);
  for (const wrapper of wrappers.slice(currentIndex + 1)) {
    if (wrapper.hidden || wrapper.closest("[hidden]")) {
      continue;
    }
    const next = wrapper.querySelector(
      '[data-calendar-day]:not([disabled]), [data-file-picker]:not([disabled]), select[data-value-control]:not([disabled]), textarea[data-value-control]:not([disabled]):not([readonly]), input[data-value-control]:not([type="hidden"]):not([disabled]):not([readonly])',
    );
    if (next) {
      window.setTimeout(() => next.focus(), 0);
      return;
    }
  }
}

function normalizedDigitKey(key) {
  const digitMaps = {
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
  };
  if (/^[0-9]$/.test(key)) {
    return key;
  }
  return digitMaps[key] ?? null;
}

function installSelectAutoAdvance(
  select,
  {
    onChange = () => {},
    advance = () => {},
    requiredDigits = 0,
  } = {},
) {
  let interaction = "";
  let typed = "";
  let lastTypedAt = 0;
  let advanceTimer = null;

  const cancelAdvance = () => {
    if (advanceTimer !== null) {
      window.clearTimeout(advanceTimer);
      advanceTimer = null;
    }
  };

  const resetTyping = () => {
    typed = "";
    lastTypedAt = 0;
  };

  const performAdvance = () => {
    cancelAdvance();
    if (!select.value || !select.isConnected) {
      return;
    }
    interaction = "";
    resetTyping();
    advance();
  };

  const scheduleAdvance = (delay = 0) => {
    cancelAdvance();
    advanceTimer = window.setTimeout(performAdvance, delay);
  };

  const selectTypedDateValue = (digits) => {
    const option = [...select.options].find((candidate) => {
      const valueDigits = String(candidate.value).replace(/\D/g, "");
      return valueDigits === digits;
    });
    if (!option) {
      return false;
    }
    select.value = option.value;
    interaction = "numeric-complete";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };

  select.addEventListener("pointerdown", () => {
    cancelAdvance();
    interaction = "pointer";
    resetTyping();
  });

  select.addEventListener("keydown", (event) => {
    cancelAdvance();

    if (event.key === "Tab" || event.key === "Escape") {
      interaction = "";
      resetTyping();
      return;
    }

    if (requiredDigits > 0) {
      const digit = normalizedDigitKey(event.key);
      if (digit !== null) {
        event.preventDefault();
        event.stopPropagation();

        const now = Date.now();
        if (now - lastTypedAt > 1200) {
          typed = "";
        }
        typed += digit;
        lastTypedAt = now;
        interaction = "numeric";

        if (typed.length === requiredDigits) {
          const completed = typed;
          resetTyping();
          if (!selectTypedDateValue(completed)) {
            // Invalid pairs stay on the same control and the next digit starts
            // a clean correction attempt.
            resetTyping();
            interaction = "numeric";
          }
        } else if (typed.length > requiredDigits) {
          typed = digit;
          lastTypedAt = now;
        }
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        interaction = "";
        resetTyping();
        if (event.key === "Delete" && select.value) {
          select.value = "";
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return;
      }
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (select.value) {
        scheduleAdvance(0);
      }
      return;
    }

    const printable =
      event.key.length === 1 &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey;

    if (printable) {
      const now = Date.now();
      if (now - lastTypedAt > 1000) {
        typed = "";
      }
      typed += event.key;
      lastTypedAt = now;
      interaction = "typing";
      return;
    }

    if (
      [
        "ArrowDown",
        "ArrowUp",
        "Home",
        "End",
        "PageDown",
        "PageUp",
      ].includes(event.key)
    ) {
      interaction = "navigation";
      resetTyping();
    }
  });

  select.addEventListener("change", () => {
    onChange();

    if (!select.value) {
      cancelAdvance();
      return;
    }

    if (interaction === "pointer" || interaction === "numeric-complete") {
      scheduleAdvance(0);
      return;
    }

    if (interaction === "typing" && requiredDigits === 0) {
      // Native select type-ahead can emit a change after its first letter.
      // Wait briefly so the user can finish typing the intended option.
      scheduleAdvance(650);
    }

    // Arrow-key navigation never moves focus by itself. Enter or Tab remains
    // fully under the user's control.
  });

  select.addEventListener("blur", () => {
    cancelAdvance();
    interaction = "";
    resetTyping();
  });
}

function fillCalendarDays(group) {
  const hidden = group.querySelector("[data-value-control]");
  const type = group.dataset.calendarType;
  const year = Number(group.querySelector("[data-calendar-year]").value);
  const month = Number(group.querySelector("[data-calendar-month]").value);
  const daySelect = group.querySelector("[data-calendar-day]");
  const previous = daySelect.value;
  populateCalendarDays(
    daySelect,
    maximumSelectableCalendarDay(type, year, month),
    previous,
  );
  syncCalendarDate(group, hidden);
}

function syncCalendarDate(
  group,
  hidden = group.querySelector("[data-value-control]"),
) {
  const type = group.dataset.calendarType;
  const year = group.querySelector("[data-calendar-year]").value;
  const month = group.querySelector("[data-calendar-month]").value;
  const day = group.querySelector("[data-calendar-day]").value;
  hidden.value = year && month && day ? `${year}-${month}-${day}` : "";
  const readable = group.parentElement?.querySelector(
    "[data-calendar-readable]",
  );
  if (readable) {
    const monthName = CALENDAR_MONTH_NAMES[type]?.[Number(month) - 1];
    readable.textContent =
      year && monthName && day
        ? `${Number(day)} ${monthName} ${year} ${CALENDAR_SUFFIXES[type]}`
        : "";
  }
  hidden.dispatchEvent(new Event("change", { bubbles: true }));
}

function createCalendarControl(field, scope, categoryId) {
  const group = document.createElement("div");
  group.className = "calendar-control";
  group.dataset.calendarType = field.type;
  const hidden = document.createElement("input");
  hidden.type = "hidden";
  setControlDataset(hidden, field, scope, categoryId);

  const year = document.createElement("select");
  year.className = "control";
  year.dataset.calendarYear = "";
  appendBlankOption(year, "السنة");
  const [firstYear, lastYear] = calendarYearRange(field.type);
  for (let value = firstYear; value <= lastYear; value += 1) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value);
    year.append(option);
  }

  const month = document.createElement("select");
  month.className = "control";
  month.dataset.calendarMonth = "";
  appendBlankOption(month, "الشهر");
  for (let index = 0; index < 12; index += 1) {
    const option = document.createElement("option");
    option.value = String(index + 1).padStart(2, "0");
    option.textContent = String(index + 1).padStart(2, "0");
    month.append(option);
  }

  const day = document.createElement("select");
  day.className = "control";
  day.dataset.calendarDay = "";
  populateCalendarDays(day, 31);

  installSelectAutoAdvance(day, {
    onChange: () => syncCalendarDate(group),
    advance: () => month.focus(),
    requiredDigits: 2,
  });
  installSelectAutoAdvance(month, {
    onChange: () => fillCalendarDays(group),
    advance: () => year.focus(),
    requiredDigits: 2,
  });
  installSelectAutoAdvance(year, {
    onChange: () => fillCalendarDays(group),
    advance: () => focusNextEntryField(hidden),
    requiredDigits: 4,
  });
  group.append(hidden, day, month, year);
  return { root: group, control: hidden };
}

function setControlDataset(control, field, scope, categoryId) {
  control.dataset.valueControl = "";
  control.dataset.fieldId = field.id;
  control.dataset.scope = scope;
  control.dataset.categoryId = categoryId;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result || "");
      const separator = result.indexOf(",");
      resolve(separator >= 0 ? result.slice(separator + 1) : result);
    });
    reader.addEventListener("error", () => {
      reject(new Error(`تعذّر قراءة الملف: ${file.name}`));
    });
    reader.readAsDataURL(file);
  });
}

function storedFilename(path) {
  return (
    String(path || "")
      .replace(/\\/g, "/")
      .split("/")
      .pop() || ""
  );
}

function refreshProfileImagePreview(hidden) {
  const root = hidden.closest(".attachment-control");
  const image = root?.querySelector("[data-profile-image-preview]");
  const empty = root?.querySelector("[data-profile-image-empty]");
  if (!image || !empty) {
    return;
  }

  if (hidden._profilePreviewUrl) {
    URL.revokeObjectURL(hidden._profilePreviewUrl);
    hidden._profilePreviewUrl = "";
  }

  let source = "";
  if (hidden._selectedFile) {
    source = URL.createObjectURL(hidden._selectedFile);
    hidden._profilePreviewUrl = source;
  } else if (hidden.value && isImageAttachment(hidden.value)) {
    source = attachmentApiUrl(hidden.value);
  }

  image.hidden = !source;
  empty.hidden = Boolean(source);
  image.src = source;
}

function refreshFileSummary(hidden) {
  const root = hidden.closest(".attachment-control");
  const summary = root.querySelector("[data-file-summary]");
  const open = root.querySelector("[data-open-file]");
  const remove = root.querySelector("[data-remove-file]");
  const file = hidden._selectedFile;
  const path = hidden.value;
  summary.textContent = file
    ? `ملف جديد: ${file.name}`
    : path
      ? `ملف محفوظ: ${storedFilename(path)}`
      : "";
  open.hidden = !path || Boolean(file);
  remove.hidden = !path && !file;
  summary.closest(".attachment-summary").hidden = !path && !file;
  refreshProfileImagePreview(hidden);
}

function createFileControl(field, scope, categoryId) {
  const root = document.createElement("div");
  root.className = "attachment-control";
  const profileImage = field.image_display === "profile" && scope !== "search";
  root.classList.toggle("profile-image-control", profileImage);
  const hidden = document.createElement("input");
  hidden.type = "hidden";
  setControlDataset(hidden, field, scope, categoryId);

  const picker = document.createElement("input");
  picker.type = "file";
  picker.className = "control";
  picker.dataset.filePicker = "";
  if (profileImage) {
    picker.accept = "image/*";
  }

  const preview = document.createElement("div");
  if (profileImage) {
    preview.className = "profile-image-preview-frame";
    const image = document.createElement("img");
    image.dataset.profileImagePreview = "";
    image.alt = field.label;
    image.hidden = true;
    const empty = document.createElement("span");
    empty.dataset.profileImageEmpty = "";
    empty.setAttribute("aria-hidden", "true");
    preview.append(image, empty);
  }
  const summary = document.createElement("div");
  summary.className = "attachment-summary";
  const summaryText = document.createElement("span");
  summaryText.dataset.fileSummary = "";
  const actions = document.createElement("div");
  actions.className = "attachment-actions";
  const open = document.createElement("button");
  open.type = "button";
  open.className = "button button-secondary";
  open.dataset.openFile = "";
  open.append(actionIcon("open"), document.createTextNode("فتح الملف"));
  open.hidden = true;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "button button-danger-quiet";
  remove.dataset.removeFile = "";
  remove.append(actionIcon("trash"), document.createTextNode("إزالة"));
  remove.hidden = true;
  actions.append(open, remove);
  summary.append(summaryText, actions);

  picker.addEventListener("change", () => {
    const file = picker.files?.[0] || null;
    const validProfileImage =
      !file ||
      !profileImage ||
      file.type.startsWith("image/") ||
      /\.(avif|bmp|gif|jpe?g|png|webp)$/i.test(file.name);
    if (!validProfileImage) {
      picker.value = "";
      hidden._selectedFile = null;
      showToast("اختر ملف صورة صالحًا للصورة الشخصية.", "error");
    } else if (file && file.size > MAX_ATTACHMENT_BYTES) {
      picker.value = "";
      hidden._selectedFile = null;
      showToast("حجم الملف يتجاوز 100 ميغابايت.", "error");
    } else {
      hidden._selectedFile = file;
    }
    refreshFileSummary(hidden);
  });
  open.addEventListener("click", () => {
    if (hidden.value) {
      window.open(attachmentApiUrl(hidden.value), "_blank", "noopener");
    }
  });
  remove.addEventListener("click", () => {
    hidden.value = "";
    hidden._selectedFile = null;
    picker.value = "";
    refreshFileSummary(hidden);
  });
  if (profileImage) {
    root.append(hidden, preview, picker, summary);
  } else {
    root.append(hidden, picker, summary);
  }
  refreshFileSummary(hidden);
  return { root, control: hidden };
}

function checkboxGroupValues(control) {
  return [
    ...control
      .closest(".checkbox-group-control")
      .querySelectorAll('input[type="checkbox"][data-option-id]:checked'),
  ].map((input) => input.dataset.optionId);
}

function syncCheckboxGroupControl(control) {
  control.value = JSON.stringify(checkboxGroupValues(control));
}

function controlValue(control) {
  const field = fieldById(control.dataset.fieldId, state.schema);
  if (field?.type === "checkbox") {
    return control.tagName === "SELECT" ? control.value : control.checked;
  }
  if (field?.type === "checkbox_group") {
    return checkboxGroupValues(control);
  }
  return control.value;
}

function createCheckboxGroupControl(field, scope, categoryId) {
  const root = document.createElement("div");
  root.className = "checkbox-group-control";
  const control = document.createElement("input");
  control.type = "hidden";
  setControlDataset(control, field, scope, categoryId);
  root.append(control);
  for (const optionValue of activeOptions(field)) {
    const label = document.createElement("label");
    label.className = "check-field checkbox-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.optionId = optionValue.id;
    const text = document.createElement("span");
    text.textContent = optionValue.label;
    label.append(input, text);
    root.append(label);
  }
  root.addEventListener("change", () => syncCheckboxGroupControl(control));
  syncCheckboxGroupControl(control);
  return { root, control };
}

function localDateTimeControlValue(value) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const pad = (number) => String(number).padStart(2, "0");
  return (
    `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-` +
    `${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
  );
}

function setSystemFieldValue(control, field) {
  const metadata = state.currentRecordMetadata || {};
  if (field.type === "system_record_code") {
    control.value = metadata.record_code || elements.recordCode.value || "";
    return;
  }
  const key =
    field.type === "system_created_at" ? "created_at" : "updated_at";
  control.value = localDateTimeControlValue(metadata[key]);
}

function refreshSystemFieldControls() {
  elements.recordForm
    .querySelectorAll("[data-value-control]")
    .forEach((control) => {
      const field = fieldById(control.dataset.fieldId, state.schema);
      if (isSystemField(field)) {
        setSystemFieldValue(control, field);
      }
    });
}

function createControl(field, scope, categoryId) {
  if (isSystemField(field)) {
    const control = document.createElement("input");
    control.className = "control system-field-control";
    control.readOnly = true;
    setControlDataset(control, field, scope, categoryId);
    if (field.type === "system_record_code") {
      control.type = "text";
      control.dir = "ltr";
    } else {
      control.type = "datetime-local";
      control.dir = "ltr";
    }
    setSystemFieldValue(control, field);
    return { root: control, control };
  }
  if (["date_gregorian", "date_hijri", "date_persian"].includes(field.type)) {
    return createCalendarControl(field, scope, categoryId);
  }
  if (field.type === "file") {
    return createFileControl(field, scope, categoryId);
  }
  if (field.type === "checkbox_group") {
    return createCheckboxGroupControl(field, scope, categoryId);
  }
  if (field.type === "checkbox") {
    if (scope === "search") {
      const control = document.createElement("select");
      control.className = "control";
      setControlDataset(control, field, scope, categoryId);
      appendBlankOption(control, "— الكل —");
      const checked = document.createElement("option");
      checked.value = "true";
      checked.textContent = "محدد";
      const unchecked = document.createElement("option");
      unchecked.value = "false";
      unchecked.textContent = "غير محدد";
      control.append(checked, unchecked);
      return { root: control, control };
    }
    const root = document.createElement("label");
    root.className = "check-field standalone-check";
    const control = document.createElement("input");
    control.type = "checkbox";
    setControlDataset(control, field, scope, categoryId);
    const text = document.createElement("span");
    text.textContent = field.placeholder || "تحديد";
    root.append(control, text);
    return { root, control };
  }

  const control =
    field.type === "textarea"
      ? document.createElement("textarea")
      : field.type === "select" || field.type === "yes_no"
        ? document.createElement("select")
        : document.createElement("input");
  control.className = "control";
  control.placeholder = field.placeholder || "";
  setControlDataset(control, field, scope, categoryId);

  if (control.tagName === "TEXTAREA") {
    control.rows = 3;
  } else if (control.tagName === "SELECT") {
    appendBlankOption(control, "— اختر —");
    for (const optionValue of activeOptions(field)) {
      const option = document.createElement("option");
      option.value = optionValue.id;
      option.textContent = optionValue.label;
      control.append(option);
    }
    if (scope !== "search") {
      installSelectAutoAdvance(control, {
        advance: () => focusNextEntryField(control),
      });
    }
  } else if (field.type === "number") {
    control.type = "number";

    if (field.validation?.integer_only) {
      control.step = "1";
    } else {
      control.step = "any";
    }

    if (field.validation?.min != null) {
      control.min = String(field.validation.min);
    }

    if (field.validation?.max != null) {
      control.max = String(field.validation.max);
    }
  } else {
    control.type = "text";
  }
  if (field.required && control.type !== "hidden") {
    control.required = true;
  }
  return { root: control, control };
}

function createFieldElement(field, scope, categoryId) {
  const wrapper = document.createElement("div");
  wrapper.className = `field field-${field.width}`;
  if (field.image_display === "profile") {
    wrapper.classList.add("profile-image-field");
  }
  wrapper.dataset.fieldWrapper = field.id;
  const label = document.createElement("label");
  const generatedId = `control-${field.id}-${Math.random().toString(16).slice(2)}`;
  label.htmlFor = generatedId;
  label.textContent = field.label;
  if (field.required) {
    const required = document.createElement("span");
    required.className = "required-mark";
    required.textContent = "*";
    label.append(required);
  }
  const { root, control } = createControl(field, scope, categoryId);
  control.id = generatedId;
  wrapper.append(label, root);
  if (["date_gregorian", "date_hijri", "date_persian"].includes(field.type)) {
    const readable = document.createElement("span");
    readable.className = "calendar-readable";
    readable.dataset.calendarReadable = "";
    readable.textContent = "";
    wrapper.append(readable);
  }
  return wrapper;
}
function fieldValidationMessage(control) {
  const field = fieldById(control.dataset.fieldId, state.schema);

  if (!field) {
    return "";
  }

  if (control.validity.valueMissing) {
    return `الحقل «${field.label}» مطلوب.`;
  }

  if (control.validity.badInput) {
    return `يجب إدخال رقم صالح في الحقل «${field.label}».`;
  }

  if (control.validity.rangeUnderflow) {
    return `قيمة «${field.label}» يجب ألا تقل عن ${control.min}.`;
  }

  if (control.validity.rangeOverflow) {
    return `قيمة «${field.label}» يجب ألا تزيد على ${control.max}.`;
  }

  if (control.validity.stepMismatch) {
    return field.validation?.integer_only
      ? `يجب إدخال عدد صحيح في الحقل «${field.label}».`
      : `قيمة الحقل «${field.label}» غير صالحة.`;
  }

  return "";
}

function clearFieldValidation(control) {
  control.setCustomValidity("");
  control.removeAttribute("aria-invalid");

  const wrapper = control.closest("[data-field-wrapper]");
  wrapper?.querySelector("[data-field-error]")?.remove();
}

function validateEntryControl(control, showMessage = true) {
  if (
    !control.matches("[data-value-control]") ||
    control.dataset.scope === "search" ||
    control.type === "hidden"
  ) {
    return true;
  }

  clearFieldValidation(control);

  const message = fieldValidationMessage(control);

  if (!message) {
    return true;
  }

  control.setCustomValidity(message);
  control.setAttribute("aria-invalid", "true");

  if (showMessage) {
    const wrapper = control.closest("[data-field-wrapper]");

    if (wrapper) {
      const error = document.createElement("p");
      error.className = "field-error";
      error.dataset.fieldError = "";
      error.textContent = message;
      wrapper.append(error);
    }

    control.reportValidity();
  }

  return false;
}
function setControlValue(control, value) {
  const field = fieldById(control.dataset.fieldId, state.schema);
  if (!field) {
    return;
  }
  if (isSystemField(field)) {
    setSystemFieldValue(control, field);
    return;
  }
  if (["date_gregorian", "date_hijri", "date_persian"].includes(field.type)) {
    control.value = value || "";
    const group = control.closest(".calendar-control");
    const [year = "", month = "", day = ""] = String(value || "").split("-");
    group.querySelector("[data-calendar-year]").value = year;
    group.querySelector("[data-calendar-month]").value = month;
    fillCalendarDays(group);
    group.querySelector("[data-calendar-day]").value = day;
    control.value = value || "";
    syncCalendarDate(group, control);
  } else if (field.type === "file") {
    control.value = value || "";
    control._selectedFile = null;
    const picker = control
      .closest(".attachment-control")
      .querySelector("[data-file-picker]");
    picker.value = "";
    refreshFileSummary(control);
  } else if (field.type === "checkbox") {
    const checked =
      value === true ||
      ["true", "1", "نعم", "yes", "on"].includes(
        String(value ?? "").toLocaleLowerCase(),
      );
    if (control.tagName === "SELECT") {
      control.value =
        value === "" || value == null ? "" : checked ? "true" : "false";
    } else {
      control.checked = checked;
    }
  } else if (field.type === "checkbox_group") {
    const values = Array.isArray(value)
      ? value
      : String(value || "")
          .split(" | ")
          .map((item) => item.trim())
          .filter(Boolean);
    const selected = new Set(
      values.map((item) => optionIdForValue(field, item)),
    );
    control
      .closest(".checkbox-group-control")
      .querySelectorAll('input[type="checkbox"][data-option-id]')
      .forEach((input) => {
        input.checked = selected.has(input.dataset.optionId);
      });
    syncCheckboxGroupControl(control);
  } else if (["select", "yes_no"].includes(field.type)) {
    control.value = optionIdForValue(field, value);
    if (!control.value && value) {
      control.value = "";
    }
  } else {
    control.value = value ?? "";
  }
}

function sourceControlFor(targetControl, sourceFieldId) {
  const targetCategory = categoryById(
    targetControl.dataset.categoryId,
    state.schema,
  );
  const sourceCategory = fieldCategory(sourceFieldId, state.schema);
  if (
    targetControl.dataset.scope === "related" &&
    targetCategory?.id === sourceCategory?.id
  ) {
    return (
      targetControl
        .closest(".related-card")
        ?.querySelector(
          `[data-value-control][data-field-id="${attributeSafe(sourceFieldId)}"]`,
        ) || null
    );
  }
  return elements.recordForm.querySelector(
    `[data-value-control][data-scope="main"][data-field-id="${attributeSafe(sourceFieldId)}"]`,
  );
}

function optionFilterToken(sourceField, sourceControl) {
  const value = controlValue(sourceControl);
  if (sourceField.type === "checkbox") {
    return value ? "true" : "false";
  }
  return optionIdForValue(sourceField, value);
}

function allowedOptionsForControl(control) {
  const field = fieldById(control.dataset.fieldId, state.schema);
  const all = activeOptions(field);
  if (!field?.option_filter || control.dataset.scope === "search") {
    return all;
  }
  const source = fieldById(field.option_filter.source_field_id, state.schema);
  const sourceControl = sourceControlFor(
    control,
    field.option_filter.source_field_id,
  );
  if (!source || !sourceControl) {
    return all;
  }
  const token = optionFilterToken(source, sourceControl);
  const mapping = field.option_filter.mappings?.[token];
  if (!mapping) {
    return field.option_filter.unmatched === "none" ? [] : all;
  }
  const allowed = new Set(mapping);
  return all.filter((option) => allowed.has(option.id));
}

function refreshDependentControl(control, notify = false) {
  const field = fieldById(control.dataset.fieldId, state.schema);
  if (
    !field?.option_filter ||
    !["select", "checkbox_group"].includes(field.type)
  ) {
    return false;
  }
  const allowed = allowedOptionsForControl(control);
  const allowedIds = new Set(allowed.map((option) => option.id));
  let cleared = false;
  if (field.type === "select") {
    const previous = control.value;
    control.replaceChildren();
    appendBlankOption(control, "— اختر —");
    for (const item of allowed) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.label;
      control.append(option);
    }
    if (previous && allowedIds.has(previous)) {
      control.value = previous;
    } else {
      control.value = "";
      cleared = Boolean(previous);
    }
  } else {
    control
      .closest(".checkbox-group-control")
      .querySelectorAll('input[type="checkbox"][data-option-id]')
      .forEach((input) => {
        const label = input.closest("label");
        const available = allowedIds.has(input.dataset.optionId);
        label.hidden = !available;
        input.disabled = !available;
        if (!available && input.checked) {
          input.checked = false;
          cleared = true;
        }
      });
    syncCheckboxGroupControl(control);
  }
  if (cleared && notify) {
    showToast(`تم مسح قيمة «${field.label}» لأنها لم تعد متاحة.`, "info");
  }
  return cleared;
}

function refreshAllDependentOptions(notify = false) {
  elements.recordForm
    .querySelectorAll("[data-value-control]")
    .forEach((control) => {
      refreshDependentControl(control, notify);
    });
}

function anchoredRelatedCategories(schema = state.schema) {
  const mapping = new Map();
  for (const category of schema.categories.filter(
    (candidate) =>
      candidate.kind === "repeatable" && !candidate.parent_category_id,
  )) {
    let anchor = category.anchor_field_id;
    if (!anchor) {
      const condition = conditionsFor("category", category.id, schema).find(
        (candidate) =>
          fieldCategory(candidate.source_field_id, schema)?.kind === "main",
      );
      anchor = condition?.source_field_id || null;
    }
    if (anchor) {
      if (!mapping.has(anchor)) {
        mapping.set(anchor, []);
      }
      mapping.get(anchor).push(category);
    }
  }
  return mapping;
}

function createSectionHeading(category) {
  const heading = document.createElement("div");
  heading.className = "section-heading";
  const content = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = category.label;
  const description = document.createElement("p");
  description.textContent = category.description || "";
  content.append(title);
  if (category.description) {
    content.append(description);
  }
  heading.append(content);
  return heading;
}

function createRelatedSection(category) {
  const section = document.createElement("section");
  section.className = "related-section field-full";
  section.dataset.relatedCategory = category.id;
  section.dataset.entryCategory = category.id;
  section.dataset.categoryId = category.id;
  section.id = `entry-category-${category.id}`;
  section.tabIndex = -1;
  const heading = createSectionHeading(category);
  const records = document.createElement("div");
  records.className = "related-records";
  records.dataset.relatedRecords = category.id;

  const addRow = document.createElement("div");
  addRow.className = "related-add-row";
  const add = document.createElement("button");
  add.type = "button";
  add.className = "button button-secondary";
  add.dataset.addRelated = category.id;
  add.append(actionIcon("plus"), document.createTextNode(category.add_label));
  addRow.append(add);

  // Keep the add button after every card in both visual and keyboard order.
  section.append(heading, records, addRow);
  if (category.auto_start) {
    window.setTimeout(() => addRelatedCard(category.id), 0);
  }
  return section;
}

function createEntryCategorySection(category, anchors, rendered) {
  if (!category || rendered.has(category.id)) {
    return null;
  }
  rendered.add(category.id);

  let section;
  if (category.kind === "repeatable") {
    section = createRelatedSection(category);
  } else {
    section = document.createElement("section");
    section.className = "form-section";
    section.dataset.mainCategory = category.id;
    section.dataset.entryCategory = category.id;
    section.dataset.categoryId = category.id;
    section.id = `entry-category-${category.id}`;
    section.tabIndex = -1;
    section.append(createSectionHeading(category));

    const grid = document.createElement("div");
    grid.className = "field-grid main-category-fields";
    const profileColumn = document.createElement("div");
    profileColumn.className = "main-category-profile";

    for (const field of category.fields) {
      const fieldElement = createFieldElement(field, "main", category.id);
      if (field.image_display === "profile") {
        profileColumn.append(fieldElement);
      } else {
        grid.append(fieldElement);
      }
      for (const related of anchors.get(field.id) || []) {
        const relatedSection = createEntryCategorySection(
          related,
          anchors,
          rendered,
        );
        if (relatedSection) {
          grid.append(relatedSection);
        }
      }
    }

    if (profileColumn.children.length) {
      const layout = document.createElement("div");
      layout.className = "main-category-layout";
      layout.append(profileColumn, grid);
      section.classList.add("form-section-has-profile");
      section.append(layout);
    } else {
      section.append(grid);
    }
  }

  const children = categoryChildren(category.id, state.schema);
  if (children.length) {
    const childContainer = document.createElement("div");
    childContainer.className = "entry-category-children";
    for (const child of children) {
      const childSection = createEntryCategorySection(
        child,
        anchors,
        rendered,
      );
      if (childSection) {
        childContainer.append(childSection);
      }
    }
    if (childContainer.children.length) {
      section.append(childContainer);
    }
  }

  return section;
}

function renderEntryForm() {
  if (!state.schema) {
    return;
  }
  const configured = hasConfiguredFields();
  elements.emptySchemaPanel.hidden = configured;
  elements.recordForm.hidden = !configured;
  elements.entryRecordActions.hidden = !configured;
  if (!configured) {
    elements.searchPanel.hidden = true;
    if (state.mode === "entry") {
      refreshCategoryNavigation();
    }
    return;
  }

  elements.mainSections.replaceChildren();
  elements.unanchoredRelatedSections.replaceChildren();
  const anchors = anchoredRelatedCategories();
  const anchoredIds = new Set(
    [...anchors.values()].flat().map((category) => category.id),
  );

  const categoryIds = new Set(
    state.schema.categories.map((category) => category.id),
  );
  const roots = state.schema.categories.filter(
    (category) =>
      !category.parent_category_id ||
      !categoryIds.has(category.parent_category_id),
  );
  const rendered = new Set();

  for (const category of roots) {
    if (category.kind === "repeatable" && anchoredIds.has(category.id)) {
      continue;
    }
    const section = createEntryCategorySection(category, anchors, rendered);
    if (!section) {
      continue;
    }
    if (category.kind === "main") {
      elements.mainSections.append(section);
    } else {
      elements.unanchoredRelatedSections.append(section);
    }
  }

  for (const category of state.schema.categories) {
    if (rendered.has(category.id) || anchoredIds.has(category.id)) {
      continue;
    }
    const section = createEntryCategorySection(category, anchors, rendered);
    if (section) {
      (category.kind === "main"
        ? elements.mainSections
        : elements.unanchoredRelatedSections
      ).append(section);
    }
  }
  elements.unanchoredRelatedArea.hidden =
    elements.unanchoredRelatedSections.children.length === 0;
  elements.recordCode.value =
    state.selectedRecordCode ||
    elements.recordCode.value ||
    generateRecordCode();
  updateRecordButtonLabels();
  if (state.mode === "entry") {
    refreshCategoryNavigation();
  }
  updateConditionalVisibility();
}

function syncRowMarkerToggle(input) {
  input
    .closest(".row-marker-toggle")
    ?.classList.toggle("row-marker-toggle-selected", input.checked);
}

function mappedRelatedPersonValue(sourceField, targetField, value) {
  if (!["select", "yes_no", "checkbox_group"].includes(sourceField.type)) {
    return value;
  }
  const sourceOptions = new Map(
    (sourceField.options || []).map((option) => [option.id, option.label]),
  );
  const targetOptions = new Map(
    (targetField.options || []).map((option) => [
      normalizedComparison(option.label),
      option.id,
    ]),
  );
  const mapOne = (optionId) =>
    targetOptions.get(
      normalizedComparison(sourceOptions.get(optionId) || optionId),
    ) || "";
  if (sourceField.type === "checkbox_group") {
    return (Array.isArray(value) ? value : []).map(mapOne).filter(Boolean);
  }
  return mapOne(value);
}

async function fillRelatedPersonCard(card, category, code) {
  const normalizedCode = String(code || "").trim();
  const input = card.querySelector("[data-linked-record-code]");
  const status = card.querySelector("[data-related-person-status]");
  if (!normalizedCode) {
    showToast("أدخل ID الشخص المرتبط أولًا.", "error");
    input?.setCustomValidity("أدخل ID الشخص المرتبط أولًا.");
    input?.reportValidity();
    input?.focus();
    return false;
  }
  if (normalizedCode === elements.recordCode.value) {
    showToast("لا يمكن ربط السجل بنفسه.", "error");
    input?.setCustomValidity("لا يمكن ربط السجل بنفسه.");
    input?.reportValidity();
    return false;
  }

  if (input?._relatedPersonLoadPromise) {
    return input._relatedPersonLoadPromise;
  }

  const loadOperation = (async () => {
    input.disabled = true;
    card.classList.add("related-person-loading");
    if (status) {
      status.hidden = false;
      status.textContent = "جاري التحقق…";
    }

    try {
      const response = await fetch(
        `/api/records/${encodeURIComponent(normalizedCode)}`,
        { cache: "no-store" },
      );
      const linkedRecord = await responseJson(response);
      if (
        card.dataset.relatedPersonMode !== "existing" ||
        input.value.trim() !== normalizedCode
      ) {
        return false;
      }
      const values = {};
      card.querySelectorAll("[data-value-control]").forEach((control) => {
        values[control.dataset.fieldId] = controlValue(control);
      });
      let mappedCount = 0;
      for (const targetField of category.fields) {
        const sourceId = targetField.related_person_source_field_id;
        const sourceField = fieldById(sourceId, state.schema);
        if (!sourceField || !sourceId) {
          continue;
        }
        values[targetField.id] = mappedRelatedPersonValue(
          sourceField,
          targetField,
          linkedRecord.main[sourceId],
        );
        mappedCount += 1;
      }
      populateControlsInDependencyOrder(
        [...card.querySelectorAll("[data-value-control]")],
        values,
      );
      card.dataset.linkedRecordCode = linkedRecord.record_code;
      input.value = linkedRecord.record_code;
      input.setCustomValidity("");
      if (status) {
        status.hidden = false;
        status.textContent = `تم الربط بـ ${linkedRecord.record_code}`;
      }
      updateConditionalVisibility();
      scheduleDraftSave();
      showToast(
        mappedCount
          ? `تم جلب بيانات الشخص المرتبط: ${linkedRecord.record_code}`
          : "تم التحقق من ID، لكن لم تُحدَّد حقول للنسخ في المصمّم.",
      );
      return true;
    } catch (error) {
      card.dataset.linkedRecordCode = "";
      input.setCustomValidity(error.message);
      input.reportValidity();
      if (status) {
        status.hidden = false;
        status.textContent = "لم يُعثر على سجل مطابق";
      }
      showToast(error.message, "error");
      return false;
    } finally {
      input.disabled = false;
      card.classList.remove("related-person-loading");
    }
  })();

  input._relatedPersonLoadPromise = loadOperation;
  try {
    return await loadOperation;
  } finally {
    input._relatedPersonLoadPromise = null;
  }
}

async function saveAndOpenRelatedRecord(card, category) {
  const input = card.querySelector("[data-linked-record-code]");
  const code = input?.value.trim() || "";
  if (!code) {
    input?.focus();
    input?.reportValidity();
    return;
  }
  if (card.dataset.linkedRecordCode !== code) {
    const linked = await fillRelatedPersonCard(card, category, code);
    if (!linked) {
      return;
    }
  }
  if (await saveCurrentRecord()) {
    await loadRecord(code);
  }
}

function setRelatedPersonMode(card, mode, focusInput = false) {
  const existing = mode === "existing";
  const link = card.querySelector("[data-related-person-link]");
  const input = card.querySelector("[data-linked-record-code]");
  const status = card.querySelector("[data-related-person-status]");

  card.dataset.relatedPersonMode = existing ? "existing" : "manual";
  if (link) {
    link.hidden = !existing;
  }
  if (input) {
    input.required = existing;
  }

  card.querySelectorAll("[data-related-person-mode]").forEach((button) => {
    const selected =
      button.dataset.relatedPersonMode === card.dataset.relatedPersonMode;
    button.classList.toggle("related-person-mode-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  if (!existing) {
    card.dataset.linkedRecordCode = "";
    if (input) {
      input.value = "";
      input.setCustomValidity("");
    }
    if (status) {
      status.hidden = true;
      status.textContent = "";
    }
  } else if (focusInput && input) {
    window.setTimeout(() => input.focus(), 0);
  }

  if (card.isConnected) {
    updateConditionalVisibility();
    scheduleDraftSave();
  }
}

async function validateRelatedPersonCardsBeforeSave() {
  const cards = [
    ...elements.recordForm.querySelectorAll(
      '.related-card[data-related-person-mode="existing"]',
    ),
  ];

  for (const card of cards) {
    const input = card.querySelector("[data-linked-record-code]");
    const category = categoryById(card.dataset.categoryId, state.schema);
    const code = input?.value.trim() || "";

    if (!code) {
      input.setCustomValidity("أدخل ID الشخص المرتبط.");
      input.reportValidity();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      input.focus();
      return false;
    }

    if (card.dataset.linkedRecordCode !== code) {
      const loaded = await fillRelatedPersonCard(card, category, code);
      if (!loaded) {
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        input.focus();
        return false;
      }
    }
  }

  return true;
}

function addRelatedCard(
  categoryId,
  row = null,
  { focusFirst = false } = {},
) {
  const category = categoryById(categoryId, state.schema);
  const records = document.querySelector(
    `[data-related-records="${attributeSafe(categoryId)}"]`,
  );
  if (!category || !records || !category.fields.length) {
    return;
  }
  const card = document.createElement("div");
  card.className = "related-card";
  card.dataset.childId = row?._child_id || "";
  card.dataset.categoryId = category.id;
  const heading = document.createElement("div");
  heading.className = "related-card-heading";
  const identity = document.createElement("div");
  const title = document.createElement("strong");
  title.dataset.relatedTitle = "";
  identity.append(title);
  let initialRelatedPersonMode = null;

  if (category.related_person_enabled) {
    const workflow = document.createElement("div");
    workflow.className = "related-person-workflow";
    const question = document.createElement("span");
    question.className = "related-person-question";
    question.textContent = "هل لديه سجل؟";
    const modes = document.createElement("div");
    modes.className = "related-person-modes";
    modes.setAttribute("role", "group");
    modes.setAttribute("aria-label", "هل لدى الشخص المرتبط سجل؟");
    for (const [mode, label] of [
      ["existing", "لديه سجل"],
      ["manual", "ليس لديه سجل"],
    ]) {
      const modeButton = document.createElement("button");
      modeButton.type = "button";
      modeButton.className = "related-person-mode";
      modeButton.dataset.relatedPersonMode = mode;
      modeButton.textContent = label;
      modeButton.addEventListener("click", () => {
        setRelatedPersonMode(card, mode, mode === "existing");
      });
      modes.append(modeButton);
    }
    workflow.append(question, modes);

    const link = document.createElement("div");
    link.className = "related-person-link";
    link.dataset.relatedPersonLink = "";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "control";
    input.dir = "ltr";
    input.placeholder = "ID الشخص المرتبط";
    input.dataset.linkedRecordCode = "";
    input.value = row?.linked_record_code || "";
    card.dataset.linkedRecordCode = row?.related_person_mode
      ? ""
      : input.value;
    input.addEventListener("input", () => {
      input.setCustomValidity("");
      if (input.value.trim() !== card.dataset.linkedRecordCode) {
        card.dataset.linkedRecordCode = "";
      }
      const status = card.querySelector("[data-related-person-status]");
      if (status) {
        status.hidden = true;
        status.textContent = "";
      }
      scheduleDraftSave();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      }
    });
    input.addEventListener("blur", () => {
      if (
        card.dataset.relatedPersonMode === "existing" &&
        input.value.trim() &&
        input.value.trim() !== card.dataset.linkedRecordCode
      ) {
        void fillRelatedPersonCard(card, category, input.value);
      }
    });
    const status = document.createElement("small");
    status.className = "related-person-status";
    status.dataset.relatedPersonStatus = "";
    status.hidden = true;
    const saveAndOpen = document.createElement("button");
    saveAndOpen.type = "button";
    saveAndOpen.className =
      "button button-secondary related-person-save-open";
    saveAndOpen.title = "حفظ التعديلات وفتح سجل الشخص المرتبط";
    saveAndOpen.setAttribute("aria-label", saveAndOpen.title);
    saveAndOpen.append(actionIcon("open"));
    saveAndOpen.addEventListener("click", () => {
      void saveAndOpenRelatedRecord(card, category);
    });
    link.append(input, saveAndOpen, status);
    identity.append(workflow, link);

    initialRelatedPersonMode =
      row?.related_person_mode ||
      (row?.linked_record_code ? "existing" : "manual");
  }

  const headingTools = document.createElement("div");
  headingTools.className = "related-card-tools";
  const markers = document.createElement("div");
  markers.className = "row-marker-controls";
  for (const marker of category.row_markers || []) {
    const label = document.createElement("label");
    label.className = "row-marker-toggle";
    label.style.setProperty("--marker-color", marker.color);
    label.style.setProperty("--marker-text", contrastText(marker.color));
    label.title = marker.label;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.rowMarker = marker.id;
    input.checked = Boolean(row?.markers?.[marker.id]);
    const badge = document.createElement("span");
    badge.className = "row-marker-badge";
    badge.textContent = marker.display_text || `# ${marker.label}`;
    label.append(input, badge);
    input.addEventListener("change", () => {
      if (input.checked && marker.rule !== "independent") {
        records
          .querySelectorAll(
            `input[data-row-marker="${attributeSafe(marker.id)}"]`,
          )
          .forEach((other) => {
            if (other !== input) {
              other.checked = false;
              syncRowMarkerToggle(other);
            }
          });
      }
      syncRowMarkerToggle(input);
    });
    syncRowMarkerToggle(input);
    markers.append(label);
  }

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "button button-danger-quiet icon-text-button";
  remove.append(actionIcon("trash"), document.createTextNode("حذف البطاقة"));
  remove.addEventListener("click", () => {
    card.remove();
    renumberRelatedCards(records);
    scheduleDraftSave();
  });
  headingTools.append(markers, remove);
  heading.append(identity, headingTools);

  const grid = document.createElement("div");
  grid.className = "field-grid";
  category.fields.forEach((field) => {
    const wrapper = createFieldElement(field, "related", category.id);
    grid.append(wrapper);
  });

  card.append(heading, grid);
  records.append(card);

  if (initialRelatedPersonMode) {
    setRelatedPersonMode(card, initialRelatedPersonMode);
    if (row?.linked_record_code && !row?.related_person_mode) {
      const status = card.querySelector("[data-related-person-status]");
      status.hidden = false;
      status.textContent = `تم الربط بـ ${row.linked_record_code}`;
    }
  }

  const cardControls = [...card.querySelectorAll("[data-value-control]")];

  populateControlsInDependencyOrder(cardControls, row?.values || {});
  renumberRelatedCards(records);
  refreshAllDependentOptions(false);
  updateConditionalVisibility();

  if (!state.restoringDraft && row === null) {
    scheduleDraftSave();
  }

  if (focusFirst) {
    window.requestAnimationFrame(() => {
      const firstControl = card.querySelector(
        '[data-related-person-mode], [data-linked-record-code]:not([disabled]), [data-calendar-day]:not([disabled]), [data-file-picker]:not([disabled]), select[data-value-control]:not([disabled]), textarea[data-value-control]:not([disabled]):not([readonly]), input[data-value-control]:not([type="hidden"]):not([disabled]):not([readonly])',
      );
      firstControl?.focus();
      firstControl?.scrollIntoView({ block: "nearest", inline: "nearest" });
      scheduleViewportPaintRecovery(true);
    });
  }

  return card;
}

function renumberRelatedCards(records) {
  [...records.querySelectorAll(".related-card")].forEach((card, index) => {
    const sequence = index + 1;
    card.dataset.minorId = String(sequence);
    card.querySelector("[data-related-title]").textContent =
      `بطاقة ${sequence}`;
  });
}

function mainValues() {
  const values = {};
  elements.recordForm
    .querySelectorAll('[data-value-control][data-scope="main"]')
    .forEach((control) => {
      values[control.dataset.fieldId] = controlValue(control);
    });
  return values;
}

function cardValues(card) {
  const values = {};
  card.querySelectorAll("[data-value-control]").forEach((control) => {
    values[control.dataset.fieldId] = controlValue(control);
  });
  const category = categoryById(card.dataset.categoryId, state.schema);
  const modeField = relatedPersonModeField(category);
  if (modeField) {
    values[modeField.id] =
      card.dataset.relatedPersonMode === "existing" ? "existing" : "manual";
  }
  return values;
}

function updateConditionalVisibility() {
  if (!state.schema || elements.recordForm.hidden) {
    return;
  }
  refreshAllDependentOptions(true);
  const values = mainValues();
  elements.recordForm
    .querySelectorAll("[data-main-category]")
    .forEach((section) => {
      section.hidden = !targetVisible(
        "category",
        section.dataset.mainCategory,
        values,
      );
    });
  elements.recordForm
    .querySelectorAll("[data-related-category]")
    .forEach((section) => {
      section.hidden = !targetVisible(
        "category",
        section.dataset.relatedCategory,
        values,
      );
    });
  elements.recordForm
    .querySelectorAll("[data-field-wrapper]")
    .forEach((wrapper) => {
      const control = wrapper.querySelector("[data-value-control]");
      const card = wrapper.closest(".related-card");
      wrapper.hidden = !targetVisible(
        "field",
        wrapper.dataset.fieldWrapper,
        values,
        card ? cardValues(card) : null,
      );
      if (control?.dataset.scope === "related" && card) {
        wrapper.hidden =
          wrapper.hidden || card.closest("[data-related-category]").hidden;
      }
    });

  syncEntryCategoryNavigatorVisibility();
  scheduleCategoryObservation();
}

function eligibleSearchFields(schema = state.schema) {
  return allFields(schema).filter(
    ({ field }) => field.type !== "file" && !isSystemField(field),
  );
}

function defaultSearchFieldIds(schema = state.schema) {
  return eligibleSearchFields(schema)
    .filter(({ field }) => field.searchable)
    .map(({ field }) => field.id);
}

function sameFieldSelection(first, second) {
  if (first.length !== second.length) {
    return false;
  }
  const expected = new Set(second);
  return first.every((fieldId) => expected.has(fieldId));
}

function activeSearchFieldIds(schema = state.schema) {
  const eligible = new Set(
    eligibleSearchFields(schema).map(({ field }) => field.id),
  );
  const selected = Array.isArray(state.searchFieldIds)
    ? state.searchFieldIds
    : defaultSearchFieldIds(schema);
  return selected.filter((fieldId) => eligible.has(fieldId));
}

function updateSearchFieldChooserLabel() {
  const count = activeSearchFieldIds().length;
  const description = Array.isArray(
    state.searchFieldIds,
  )
    ? `حقول البحث: مخصصة (${count})`
    : count
      ? `حقول البحث: الافتراضية (${count})`
      : "حقول البحث: لا يوجد افتراضي";
  elements.chooseSearchFieldsText.textContent = description;
  elements.chooseSearchFieldsButton.title = description;
  elements.chooseSearchFieldsButton.setAttribute("aria-label", description);
}

function toggleSearchPanel() {
  const collapsed = elements.searchPanel.dataset.collapsed !== "true";
  elements.searchPanel.dataset.collapsed = String(collapsed);
  elements.searchCollapseButton.setAttribute(
    "aria-expanded",
    String(!collapsed),
  );
  const label = collapsed ? "فتح لوحة البحث" : "طي لوحة البحث";
  elements.searchCollapseButton.title = label;
  elements.searchCollapseButton.setAttribute("aria-label", label);
  elements.searchCollapseButton
    .querySelector("use")
    ?.setAttribute("href", collapsed ? "#icon-down" : "#icon-up");
}

function currentSearchControlValues() {
  const values = {};
  elements.searchFields
    .querySelectorAll("[data-value-control]")
    .forEach((control) => {
      values[control.dataset.fieldId] = controlValue(control);
    });
  return values;
}

function resetSearchResultDisplay() {
  state.searchMatches = [];
  state.searchResultIndex = 0;
  state.searchResultsTruncated = false;
  elements.searchResults.replaceChildren();
  elements.searchResultPager.hidden = true;
  elements.searchSummary.textContent =
    "أدخل معيارًا واحدًا أو أكثر ثم اضغط بحث.";
}

function renderSearchFields(options = {}) {
  const previousValues =
    options.preserveValues === false ? {} : currentSearchControlValues();
  elements.searchFields.replaceChildren();
  const eligible = eligibleSearchFields();
  const selectedIds = activeSearchFieldIds();
  const selected = new Set(selectedIds);
  elements.searchPanel.hidden = eligible.length === 0 || !hasConfiguredFields();
  elements.searchFieldsEmpty.hidden = selectedIds.length !== 0;
  for (const { category, field } of eligible) {
    if (!selected.has(field.id)) {
      continue;
    }
    const wrapper = createFieldElement(field, "search", category.id);
    const label = wrapper.querySelector("label");
    label.textContent = field.label;
    elements.searchFields.append(wrapper);
    if (Object.prototype.hasOwnProperty.call(previousValues, field.id)) {
      setControlValue(
        wrapper.querySelector("[data-value-control]"),
        previousValues[field.id],
      );
    }
  }
  updateSearchFieldChooserLabel();
  elements.searchButton.disabled =
    selectedIds.length === 0 ||
    state.searching ||
    state.savingRecord ||
    state.loadingRecord;
}

function renderSearchFieldOptions() {
  elements.searchFieldOptions.replaceChildren();
  const selected = new Set(activeSearchFieldIds());
  for (const category of allCategories(state.schema)) {
    const fields = category.fields.filter(
      (field) => field.type !== "file" && !isSystemField(field),
    );
    if (!fields.length) {
      continue;
    }
    const group = document.createElement("section");
    group.className = "search-field-option-group";
    const title = document.createElement("h3");
    title.textContent = category.label;
    const grid = document.createElement("div");
    grid.className = "search-field-option-grid";
    for (const field of fields) {
      const option = document.createElement("label");
      option.className = "check-field";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.searchFieldOption = field.id;
      checkbox.checked = selected.has(field.id);
      const label = document.createElement("span");
      label.textContent = field.searchable
        ? `${field.label} — افتراضي`
        : field.label;
      option.append(checkbox, label);
      grid.append(option);
    }
    group.append(title, grid);
    elements.searchFieldOptions.append(group);
  }
}

function openSearchFieldsDialog() {
  renderSearchFieldOptions();
  elements.searchFieldsDialog.showModal();
}

function applyTemporarySearchFields() {
  const selected = [
    ...elements.searchFieldOptions.querySelectorAll(
      "[data-search-field-option]:checked",
    ),
  ].map((checkbox) => checkbox.dataset.searchFieldOption);
  if (!selected.length) {
    showToast("اختر حقل بحث واحدًا على الأقل.", "error");
    return;
  }
  const defaults = defaultSearchFieldIds();
  state.searchFieldIds = sameFieldSelection(selected, defaults)
    ? null
    : selected;
  renderSearchFields();
  resetSearchResultDisplay();
  elements.searchFieldsDialog.close();
}

function resetTemporarySearchFields() {
  state.searchFieldIds = null;
  renderSearchFields();
  resetSearchResultDisplay();
  elements.searchFieldsDialog.close();
}

function searchValues() {
  const criteria = {
    _include_archived: elements.includeArchivedSearch.checked,
    _search_field_ids: activeSearchFieldIds(),
  };
  elements.searchFields
    .querySelectorAll("[data-value-control]")
    .forEach((control) => {
      criteria[control.dataset.fieldId] = controlValue(control);
    });
  return criteria;
}

function clearSearch() {
  elements.searchFields
    .querySelectorAll("[data-value-control]")
    .forEach((control) => {
      setControlValue(control, "");
    });
  elements.includeArchivedSearch.checked = false;
  resetSearchResultDisplay();
}

function setSearching(searching) {
  state.searching = searching;
  elements.searchButton.disabled =
    activeSearchFieldIds().length === 0 ||
    searching ||
    state.savingRecord ||
    state.loadingRecord;
  elements.clearSearchButton.disabled = searching;
  elements.searchSpinner.hidden = !searching;
  elements.searchButton.querySelector("svg").hidden = searching;
  elements.searchButtonText.textContent = searching ? "جاري البحث…" : "بحث";
  const label = searching ? "جاري البحث…" : "بحث";
  elements.searchButton.title = label;
  elements.searchButton.setAttribute("aria-label", label);
}

function renderCurrentSearchResult() {
  elements.searchResults.replaceChildren();
  const matches = state.searchMatches;
  if (!matches.length) {
    const empty = document.createElement("p");
    empty.className = "search-empty";
    empty.textContent = `لم يُعثر على ${entityName()} يطابق معايير البحث.`;
    elements.searchResults.append(empty);
    elements.searchSummary.textContent = "لا توجد نتائج";
    elements.searchResultPager.hidden = true;
    return;
  }
  state.searchResultIndex = Math.max(
    0,
    Math.min(state.searchResultIndex, matches.length - 1),
  );
  elements.searchSummary.textContent = state.searchResultsTruncated
    ? `ظهرت أول ${matches.length} نتيجة. أضف معيارًا آخر لتضييق البحث.`
    : `عدد النتائج: ${matches.length}`;
  const match = matches[state.searchResultIndex];
  const card = document.createElement("article");
  card.className = "search-result-card";
  card.dataset.searchRecordCode = match.record_code;
  const open = document.createElement("button");
  open.type = "button";
  open.className = "search-result-open";
  open.dataset.openSearchRecord = match.record_code;
  const title = document.createElement("span");
  title.className = "search-result-name";
  title.textContent = match.title || match.record_code;
  open.append(title);
  if (match.archived) {
    const archivedBadge = document.createElement("span");
    archivedBadge.className = "archived-badge";
    archivedBadge.textContent = "مؤرشف";
    open.append(archivedBadge);
  }
  (match.details || []).forEach((detail) => {
    if (String(detail.value ?? "").trim() === "") {
      return;
    }
    const line = document.createElement("span");
    line.className = "search-result-detail";
    line.textContent = `${detail.label}: ${detail.value}`;
    open.append(line);
  });
  const copyId = document.createElement("button");
  copyId.type = "button";
  copyId.className = "search-result-id";
  copyId.dataset.copyRecordCode = match.record_code;
  copyId.dir = "ltr";
  copyId.title = "نسخ ID";
  copyId.textContent = match.record_code;
  card.append(open, copyId);
  if (match.record_code === state.selectedRecordCode) {
    card.classList.add("search-result-card-selected");
  }
  elements.searchResults.append(card);
  elements.searchResultPager.hidden = matches.length <= 1;
  elements.searchResultPosition.textContent = `${state.searchResultIndex + 1} / ${matches.length}`;
  elements.previousSearchResult.disabled = state.searchResultIndex === 0;
  elements.nextSearchResult.disabled =
    state.searchResultIndex === matches.length - 1;
}

function renderSearchResults(result) {
  state.searchMatches = Array.isArray(result.matches) ? result.matches : [];
  state.searchResultIndex = 0;
  state.searchResultsTruncated = Boolean(result.truncated);
  renderCurrentSearchResult();
}

function moveSearchResult(offset) {
  state.searchResultIndex += offset;
  renderCurrentSearchResult();
}

async function copyRecordCode(code) {
  try {
    await navigator.clipboard.writeText(code);
  } catch (_error) {
    const helper = document.createElement("textarea");
    helper.value = code;
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.append(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }
  showToast(`تم نسخ ID: ${code}`);
}

async function searchRecords() {
  if (state.searching || state.savingRecord || state.loadingRecord) {
    return;
  }
  const criteria = searchValues();
  const hasCriteria = Object.entries(criteria).some(
    ([key, value]) =>
      !["_include_archived", "_search_field_ids"].includes(key) &&
      (Array.isArray(value)
        ? value.length > 0
        : String(value ?? "").trim() !== ""),
  );
  if (!hasCriteria) {
    showToast("أدخل معيار بحث واحدًا على الأقل.", "error");
    return;
  }
  setSearching(true);
  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(criteria),
    });
    renderSearchResults(await responseJson(response));
  } catch (error) {
    reportClientError("record-search", error);

    showToast(error.message, "error");
  } finally {
    setSearching(false);
  }
}

function clearSelectedSearchCard() {
  elements.searchResults
    .querySelectorAll(".search-result-card-selected")
    .forEach((card) => card.classList.remove("search-result-card-selected"));
}

function markSelectedSearchCard(code) {
  clearSelectedSearchCard();
  elements.searchResults
    .querySelector(`[data-search-record-code="${attributeSafe(code)}"]`)
    ?.classList.add("search-result-card-selected");
}
function populateControlsInDependencyOrder(controls, values) {
  const ordinaryControls = [];
  const dependentControls = [];

  controls.forEach((control) => {
    const field = fieldById(control.dataset.fieldId, state.schema);

    if (field?.option_filter) {
      dependentControls.push(control);
    } else {
      ordinaryControls.push(control);
    }
  });

  ordinaryControls.forEach((control) => {
    setControlValue(control, values[control.dataset.fieldId] ?? "");
  });

  refreshAllDependentOptions(false);

  dependentControls.forEach((control) => {
    refreshDependentControl(control, false);
    setControlValue(control, values[control.dataset.fieldId] ?? "");
  });
}
function populateMain(values) {
  const controls = [
    ...elements.recordForm.querySelectorAll(
      '[data-value-control][data-scope="main"]',
    ),
  ];

  populateControlsInDependencyOrder(controls, values);
}

function populateRelated(related) {
  for (const category of state.schema.categories.filter(
    (candidate) => candidate.kind === "repeatable",
  )) {
    const records = document.querySelector(
      `[data-related-records="${attributeSafe(category.id)}"]`,
    );
    records?.replaceChildren();
    const rows = Array.isArray(related[category.id])
      ? related[category.id]
      : [];
    rows.forEach((row) => addRelatedCard(category.id, row));
    if (!rows.length && category.auto_start) {
      addRelatedCard(category.id);
    }
  }
}

function attachmentApiUrl(path) {
  return `/api/${encodeURI(String(path || "")).replace(/%2F/gi, "/")}`;
}

function isImageAttachment(path) {
  return /\.(avif|bmp|gif|jpe?g|png|webp)$/i.test(storedFilename(path));
}

function renderAttachmentGallery() {
  elements.attachmentGalleryGrid.replaceChildren();
  if (!state.selectedRecordCode) {
    elements.attachmentGallery.hidden = true;
    return;
  }
  const controls = [
    ...elements.recordForm.querySelectorAll("[data-value-control]"),
  ].filter((control) => {
    const field = fieldById(control.dataset.fieldId, state.schema);
    return field?.type === "file" && control.value;
  });
  elements.attachmentGallery.hidden = controls.length === 0;

  for (const control of controls) {
    const field = fieldById(control.dataset.fieldId, state.schema);
    const category = categoryById(control.dataset.categoryId, state.schema);
    const card = control.closest(".related-card");
    const link = document.createElement("a");
    link.className = "gallery-card";
    link.href = attachmentApiUrl(control.value);
    link.target = "_blank";
    link.rel = "noopener";

    if (isImageAttachment(control.value)) {
      const image = document.createElement("img");
      image.className = "gallery-preview";
      image.src = attachmentApiUrl(control.value);
      image.alt = `${category?.label || ""} — ${field?.label || ""}`;
      image.loading = "lazy";
      link.append(image);
    } else {
      const icon = document.createElement("div");
      icon.className = "gallery-file-icon";
      icon.textContent = /\.pdf$/i.test(control.value) ? "PDF" : "FILE";
      link.append(icon);
    }
    const body = document.createElement("div");
    body.className = "gallery-card-body";
    const title = document.createElement("strong");
    title.textContent = field?.label || storedFilename(control.value);
    const detail = document.createElement("span");
    detail.textContent = category?.label || "";
    const filename = document.createElement("span");
    filename.textContent = storedFilename(control.value);
    body.append(title, detail, filename);
    link.append(body);
    elements.attachmentGalleryGrid.append(link);
  }
}
function formatRecordTimestamp(value) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("ar", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function displayRecordMetadata(record = null) {
  state.currentRecordMetadata = {
    record_code:
      record?.record_code || elements.recordCode.value || "",
    created_at: record?.created_at || "",
    updated_at: record?.updated_at || "",
  };
  refreshSystemFieldControls();
}
async function loadRecord(code, options = {}) {
  if (state.loadingRecord || (state.savingRecord && !options.force)) {
    return;
  }
  state.loadingRecord = true;
  try {
    const response = await fetch(`/api/records/${encodeURIComponent(code)}`, {
      cache: "no-store",
    });
    const record = await responseJson(response);
    state.suppressReset = true;
    elements.recordForm.reset();
    state.suppressReset = false;
    state.selectedRecordCode = record.record_code;
    state.currentRecordArchived = Boolean(record.archived);
    elements.recordCode.value = record.record_code;
    displayRecordMetadata(record);
    renderEntryForm();
    populateMain(record.main);
    populateRelated(record.related);
    updateConditionalVisibility();
    renderAttachmentGallery();
    updateRecordButtonLabels();
    markSelectedSearchCard(record.record_code);
    if (!options.silent) {
      showToast(`تم اختيار ${entityName()}: ${record.record_code}`);
    }
    if (options.scroll !== false) {
      const scrollTarget =
        elements.mainSections.firstElementChild || elements.recordForm;
      scrollTarget.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
    clearLocalDraft();
    state.recordDirty = false;
  } catch (error) {
    reportClientError("record-load", error, `record_code=${code}`);

    showToast(error.message, "error");
  } finally {
    state.loadingRecord = false;
  }
}

async function controlPayloadValue(control) {
  const field = fieldById(control.dataset.fieldId, state.schema);
  if (field?.type !== "file") {
    return controlValue(control);
  }
  const payload = { stored_path: control.value || "" };
  if (control._selectedFile) {
    payload.upload = {
      name: control._selectedFile.name,
      data: await readFileAsBase64(control._selectedFile),
    };
  }
  return payload;
}

async function collectMainPayload() {
  const values = {};
  for (const control of elements.recordForm.querySelectorAll(
    '[data-value-control][data-scope="main"]',
  )) {
    if (isSystemField(fieldById(control.dataset.fieldId, state.schema))) {
      continue;
    }
    values[control.dataset.fieldId] = await controlPayloadValue(control);
  }
  return values;
}

async function collectRelatedPayload() {
  const related = {};
  for (const category of state.schema.categories.filter(
    (candidate) => candidate.kind === "repeatable",
  )) {
    const section = document.querySelector(
      `[data-related-category="${attributeSafe(category.id)}"]`,
    );
    const rows = [];
    if (section && !section.hidden) {
      for (const card of section.querySelectorAll(".related-card")) {
        const values = {};
        for (const control of card.querySelectorAll("[data-value-control]")) {
          values[control.dataset.fieldId] = await controlPayloadValue(control);
        }
        const markers = {};
        card.querySelectorAll("[data-row-marker]").forEach((input) => {
          markers[input.dataset.rowMarker] = input.checked;
        });
        rows.push({
          _child_id: card.dataset.childId || "",
          linked_record_code: card.dataset.linkedRecordCode || "",
          markers,
          values,
        });
      }
    }
    related[category.id] = rows;
  }
  return related;
}

function setRecordSaving(saving) {
  state.savingRecord = saving;
  elements.saveRecordButton.disabled = saving;
  elements.resetFormButton.disabled = saving;
  elements.deleteRecordButton.disabled = saving;
  elements.archiveRecordButton.disabled = saving;
  elements.searchButton.disabled =
    saving || state.searching || state.loadingRecord;
  elements.saveSpinner.hidden = !saving;
  updateRecordButtonLabels();
}

function updateRecordButtonLabels() {
  const singular = entityName();
  const hasRecord = Boolean(state.selectedRecordCode);
  const builderUnlocked = Boolean(
    state.schema?.builder_access?.unlocked || state.schema?.developer_mode,
  );
  if (state.savingRecord) {
    elements.saveButtonText.textContent = "جاري الحفظ…";
  } else if (hasRecord) {
    elements.saveButtonText.textContent = "حفظ التعديلات";
  } else {
    elements.saveButtonText.textContent = `حفظ ${singular}`;
  }
  elements.archiveRecordButton.hidden = !hasRecord;
  elements.archiveButtonText.textContent = state.currentRecordArchived
    ? `استعادة ${singular}`
    : `أرشفة ${singular}`;
  elements.archiveRecordButton.classList.toggle(
    "button-restore",
    state.currentRecordArchived,
  );
  elements.deleteRecordButton.hidden = !hasRecord || !builderUnlocked;
  elements.deleteButtonText.textContent = `حذف ${singular} نهائيًا`;
  elements.resetButtonText.textContent = `${singular} جديد`;
  elements.saveNote.hidden = !state.currentRecordArchived;
  elements.saveNote.textContent = state.currentRecordArchived
    ? "هذا السجل مؤرشف، ويمكن تعديله أو استعادته."
    : "يمكن الحفظ في أي وقت ما لم تُعرَّف حقول مطلوبة.";
}

function draftValue(control) {
  const field = fieldById(control.dataset.fieldId, state.schema);

  if (field?.type === "file") {
    // Preserve only an already-saved attachment path.
    // Browser security does not permit restoring a newly selected file.
    return control.value || "";
  }

  return controlValue(control);
}

function valueHasDraftContent(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return String(value ?? "").trim() !== "";
}

function collectDraftSnapshot() {
  const main = {};

  elements.recordForm
    .querySelectorAll('[data-value-control][data-scope="main"]')
    .forEach((control) => {
      if (isSystemField(fieldById(control.dataset.fieldId, state.schema))) {
        return;
      }
      main[control.dataset.fieldId] = draftValue(control);
    });

  const related = {};

  for (const category of state.schema.categories.filter(
    (candidate) => candidate.kind === "repeatable",
  )) {
    const rows = [];

    const section = document.querySelector(
      `[data-related-category="${attributeSafe(category.id)}"]`,
    );

    if (section) {
      for (const card of section.querySelectorAll(".related-card")) {
        const values = {};
        const markers = {};

        card.querySelectorAll("[data-value-control]").forEach((control) => {
          values[control.dataset.fieldId] = draftValue(control);
        });

        card.querySelectorAll("[data-row-marker]").forEach((input) => {
          markers[input.dataset.rowMarker] = input.checked;
        });

        rows.push({
          _child_id: card.dataset.childId || "",
          linked_record_code:
            card.querySelector("[data-linked-record-code]")?.value.trim() || "",
          related_person_mode: card.dataset.relatedPersonMode || "manual",
          markers,
          values,
        });
      }
    }

    related[category.id] = rows;
  }

  return {
    version: 1,
    schema_revision: state.schema?.revision ?? null,
    saved_at: new Date().toISOString(),
    selected_record_code: state.selectedRecordCode,
    current_record_archived: state.currentRecordArchived,
    record_code: elements.recordCode.value,
    main,
    related,
  };
}

function draftHasContent(draft) {
  const mainHasContent = Object.values(draft.main || {}).some(
    valueHasDraftContent,
  );

  if (mainHasContent) {
    return true;
  }

  return Object.values(draft.related || {}).some(
    (rows) =>
      Array.isArray(rows) &&
      rows.some((row) => {
        const hasValue = Object.values(row.values || {}).some(
          valueHasDraftContent,
        );

        const hasMarker = Object.values(row.markers || {}).some(Boolean);

        return hasValue || hasMarker || Boolean(row.linked_record_code);
      }),
  );
}

function updateDraftStatus(message) {
  if (elements.draftStatus) {
    elements.draftStatus.textContent = message;
  }
}

function clearLocalDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (_error) {
    // Ignore unavailable browser storage.
  }

  window.clearTimeout(state.draftDebounceTimer);
  state.draftDebounceTimer = null;
  state.recordDirty = false;

  updateDraftStatus("لا توجد مسودة محلية.");
}

function saveDraftLocally() {
  if (!state.schema || !state.recordDirty || state.restoringDraft) {
    return;
  }

  const draft = collectDraftSnapshot();

  if (!draftHasContent(draft)) {
    clearLocalDraft();
    return;
  }

  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));

    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    updateDraftStatus(`حُفظت المسودة محليًا عند ${time}.`);
  } catch (_error) {
    updateDraftStatus("تعذّر حفظ المسودة محليًا.");
  }
}

function scheduleDraftSave() {
  if (state.restoringDraft) {
    return;
  }

  state.recordDirty = true;

  window.clearTimeout(state.draftDebounceTimer);

  state.draftDebounceTimer = window.setTimeout(
    saveDraftLocally,
    DRAFT_INPUT_DELAY_MS,
  );

  updateDraftStatus("توجد تغييرات غير محفوظة.");
}

function readLocalDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const draft = JSON.parse(raw);

    if (!draft || draft.version !== 1) {
      return null;
    }

    return draft;
  } catch (_error) {
    return null;
  }
}

function restoreLocalDraft() {
  const draft = readLocalDraft();

  if (!draft || !state.schema) {
    return;
  }

  if (
    draft.schema_revision !== null &&
    state.schema.revision !== undefined &&
    draft.schema_revision !== state.schema.revision
  ) {
    updateDraftStatus("توجد مسودة قديمة لا تطابق تصميم التطبيق الحالي.");
    return;
  }

  state.restoringDraft = true;

  try {
    state.selectedRecordCode = draft.selected_record_code || null;

    state.currentRecordArchived = Boolean(draft.current_record_archived);

    elements.recordCode.value = draft.record_code || generateRecordCode();
    displayRecordMetadata();

    renderEntryForm();
    populateMain(draft.main || {});
    populateRelated(draft.related || {});
    updateConditionalVisibility();
    renderAttachmentGallery();
    updateRecordButtonLabels();

    state.recordDirty = true;

    const savedTime = draft.saved_at
      ? new Date(draft.saved_at).toLocaleString()
      : "";

    updateDraftStatus(
      savedTime
        ? `تمت استعادة مسودة محفوظة في ${savedTime}.`
        : "تمت استعادة مسودة غير محفوظة.",
    );

    showToast("تمت استعادة آخر مسودة غير محفوظة.");
  } finally {
    state.restoringDraft = false;
  }
}
async function saveCurrentRecord() {
  if (state.savingRecord || !state.schema || !hasConfiguredFields()) {
    return false;
  }
  if (!(await validateRelatedPersonCardsBeforeSave())) {
    return false;
  }
  const invalidControl = [
    ...elements.recordForm.querySelectorAll("[data-value-control]"),
  ].find((control) => !validateEntryControl(control, false));

  if (invalidControl) {
    validateEntryControl(invalidControl, true);
    invalidControl.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    invalidControl.focus();
    return false;
  }
  setRecordSaving(true);
  try {
    const response = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: state.selectedRecordCode ? "update" : "create",
        record_code: elements.recordCode.value,
        main: await collectMainPayload(),
        related: await collectRelatedPayload(),
      }),
    });
    const result = await responseJson(response);
    state.selectedRecordCode = result.record_code;
    elements.recordCode.value = result.record_code;
    await loadRecord(result.record_code, {
      silent: true,
      scroll: false,
      force: true,
    });
    clearLocalDraft();
    updateRecordButtonLabels();
    showToast(
      result.action === "updated"
        ? `تم حفظ التعديلات. ID: ${result.record_code}`
        : `تم حفظ ${entityName()}. يمكنك تعديله مباشرةً. ID: ${result.record_code}`,
    );
    return true;
  } catch (error) {
    reportClientError("record-save", error);

    showToast(error.message, "error");
    return false;
  } finally {
    setRecordSaving(false);
  }
}

async function archiveCurrentRecord() {
  if (!state.selectedRecordCode || state.savingRecord) {
    return;
  }
  const archived = !state.currentRecordArchived;
  const action = archived ? "أرشفة" : "استعادة";
  if (
    !window.confirm(
      `هل تريد ${action} ${entityName()} ${state.selectedRecordCode}؟`,
    )
  ) {
    return;
  }
  setRecordSaving(true);
  try {
    const response = await fetch("/api/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record_code: state.selectedRecordCode,
        archived,
      }),
    });
    const result = await responseJson(response);
    state.currentRecordArchived = Boolean(result.archived);
    updateRecordButtonLabels();
    if (archived && !elements.includeArchivedSearch.checked) {
      state.searchMatches = state.searchMatches.filter(
        (match) => match.record_code !== state.selectedRecordCode,
      );
      renderCurrentSearchResult();
    } else {
      const match = state.searchMatches.find(
        (candidate) => candidate.record_code === state.selectedRecordCode,
      );
      if (match) {
        match.archived = archived;
        renderCurrentSearchResult();
      }
    }
    showToast(
      archived ? `تمت أرشفة ${entityName()}.` : `تمت استعادة ${entityName()}.`,
    );
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setRecordSaving(false);
  }
}

async function deleteCurrentRecord() {
  if (!state.selectedRecordCode || state.savingRecord) {
    return;
  }
  const code = state.selectedRecordCode;
  if (
    !window.confirm(
      `هل تريد حذف ${entityName()} ${code} نهائيًا من جميع الجداول والملفات؟`,
    )
  ) {
    return;
  }
  setRecordSaving(true);
  try {
    const response = await fetch(`/api/records/${encodeURIComponent(code)}`, {
      method: "DELETE",
    });
    const result = await responseJson(response);
    state.searchMatches = state.searchMatches.filter(
      (match) => match.record_code !== code,
    );
    renderCurrentSearchResult();
    newRecord();
    showToast(
      `تم حذف ${entityName()} و${result.deleted_related_rows} سجل مرتبط.`,
    );
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setRecordSaving(false);
  }
}

function newRecord() {
  state.suppressReset = true;
  elements.recordForm.reset();
  state.suppressReset = false;
  state.selectedRecordCode = null;
  state.currentRecordArchived = false;
  elements.recordCode.value = generateRecordCode();
  displayRecordMetadata();
  renderEntryForm();
  renderAttachmentGallery();
  clearSelectedSearchCard();
  updateRecordButtonLabels();
}

function handleFormReset() {
  if (state.suppressReset) {
    return;
  }
  window.setTimeout(() => {
    newRecord();
    showToast(`تم فتح ${entityName()} جديد.`);
  }, 0);
}

function applyLoadedSchema(schema, options = {}) {
  state.schema = schema;
  state.draftSchema = deepClone(schema);
  markClean();
  applyAppIdentity(schema);
  if (
    !schema.developer_mode &&
    !schema.builder_access?.unlocked &&
    state.mode === "builder"
  ) {
    switchMode("entry", true);
  }
  if (Array.isArray(state.searchFieldIds)) {
    const eligible = new Set(
      eligibleSearchFields(schema).map(({ field }) => field.id),
    );
    state.searchFieldIds = state.searchFieldIds.filter((fieldId) =>
      eligible.has(fieldId),
    );
    if (!state.searchFieldIds.length) {
      state.searchFieldIds = null;
    }
  }
  if (options.resetRecord) {
    state.selectedRecordCode = null;
    state.currentRecordArchived = false;
    elements.recordCode.value = generateRecordCode();
    displayRecordMetadata();
    clearSearch();
  }
  renderSearchFields();
  renderEntryForm();
  renderAttachmentGallery();
  renderBuilder();
  setStatus(
    "ready",
    `${schema.stats.field_count} حقل · ${schema.stats.record_count} سجل`,
  );
  if (options.resetRecord) {
    window.setTimeout(restoreLocalDraft, 0);
  }
}
function editableTargetLabel(targetType, targetId) {
  if (
    targetType === "category" &&
    targetId === state.editingCategoryId &&
    !categoryById(targetId)
  ) {
    return (
      "الفئة الجديدة: " + (elements.categoryLabel.value.trim() || "بلا اسم بعد")
    );
  }

  if (
    targetType === "field" &&
    targetId === state.editingFieldId &&
    !fieldById(targetId)
  ) {
    return (
      "الحقل الجديد: " + (elements.fieldLabel.value.trim() || "بلا اسم بعد")
    );
  }

  return targetQualifiedLabel(targetType, targetId);
}
function updateBuilderAccess(access) {
  if (!state.schema) return;
  state.schema.builder_access = access;
  state.draftSchema.builder_access = deepClone(access);
  applyAppIdentity(state.schema);
  updateRecordButtonLabels();
}

function builderAuthButtonLabel(mode = state.authMode) {
  if (mode === "initialize") {
    return "إنشاء وفتح";
  }
  if (mode === "change") {
    return "تغيير كلمة المرور";
  }
  return "فتح المصمّم";
}

function setBuilderAuthBusy(busy) {
  state.authSubmitting = busy;

  [
    elements.currentBuilderPassword,
    elements.builderPassword,
    elements.confirmBuilderPassword,
  ].forEach((control) => {
    control.disabled = busy;
  });

  elements.confirmBuilderAuthButton.disabled = busy;
  elements.builderAuthDialog.setAttribute("aria-busy", busy ? "true" : "false");
  elements.builderAuthSpinner.hidden = !busy;
  elements.confirmBuilderAuthText.textContent = busy
    ? "جارٍ التحقق…"
    : builderAuthButtonLabel();
}

function openBuilderAuthDialog(mode) {
  state.authMode = mode;
  elements.currentBuilderPassword.value = "";
  elements.builderPassword.value = "";
  elements.confirmBuilderPassword.value = "";

  const initialize = mode === "initialize";
  const change = mode === "change";

  elements.builderAuthTitle.textContent = initialize
    ? "إنشاء كلمة مرور المصمّم"
    : change
      ? "تغيير كلمة مرور المصمّم"
      : "فتح المصمّم";

  elements.builderAuthNote.textContent = initialize
    ? "أنشئ كلمة مرور من 8 أحرف على الأقل. ستُطلب عند فتح المصمّم لاحقًا."
    : change
      ? "اكتب كلمة المرور الجديدة وأكدها."
      : "أدخل كلمة مرور المصمّم. سيبقى المصمّم مفتوحًا حتى إغلاق التطبيق.";

  elements.currentPasswordWrapper.hidden = true;
  elements.confirmPasswordWrapper.hidden = !(initialize || change);
  elements.builderPassword.autocomplete =
    initialize || change ? "new-password" : "current-password";

  setBuilderAuthBusy(false);
  elements.builderAuthDialog.showModal();

  window.setTimeout(() => {
    elements.builderPassword.focus();
  }, 0);
}

async function submitBuilderAuth() {
  if (state.authSubmitting) {
    return;
  }

  const mode = state.authMode;
  const password = elements.builderPassword.value;

  if (!password) {
    showToast("أدخل كلمة المرور.", "error");
    elements.builderPassword.focus();
    return;
  }

  if (["initialize", "change"].includes(mode)) {
    if (password.length < 8) {
      showToast("يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.", "error");
      elements.builderPassword.focus();
      return;
    }

    if (password !== elements.confirmBuilderPassword.value) {
      showToast("تأكيد كلمة المرور غير مطابق.", "error");
      elements.confirmBuilderPassword.focus();
      return;
    }
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort();
  }, 20_000);

  setBuilderAuthBusy(true);

  try {
    const endpoint =
      mode === "change" ? "/api/builder/password" : "/api/builder/unlock";

    const payload =
      mode === "change"
        ? {
            current_password: elements.currentBuilderPassword.value,
            new_password: password,
          }
        : {
            password,
            initialize: mode === "initialize",
          };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const result = await responseJson(response);
    updateBuilderAccess(result.builder_access);
    elements.builderAuthDialog.close();

    if (mode === "change") {
      showToast("تم تغيير كلمة مرور المصمّم.");
    } else {
      switchMode("builder", true);
      showToast("تم فتح المصمّم حتى إغلاق التطبيق.");
    }
  } catch (error) {
    const visibleError =
      error?.name === "AbortError"
        ? new Error(
            "استغرق التحقق وقتًا أطول من المتوقع. تحقق من سجل التطبيق ثم حاول مجددًا.",
          )
        : error;

    reportClientError("builder-auth", visibleError);
    showToast(visibleError.message, "error");
  } finally {
    window.clearTimeout(timeout);
    setBuilderAuthBusy(false);
  }
}

async function loadSchema() {
  try {
    const response = await fetch("/api/schema", { cache: "no-store" });
    applyLoadedSchema(await responseJson(response), { resetRecord: true });
  } catch (error) {
    reportClientError("schema-load", error);

    showStartupError(error.message);
  }
}

async function closeApplication() {
  saveDraftLocally();
  state.closing = true;
  window.clearInterval(state.heartbeatTimer);
  window.clearInterval(state.draftTimer);
  window.clearInterval(state.builderAutosaveTimer);
  elements.closeButton.disabled = true;
  elements.builderCloseButton.disabled = true;
  try {
    await fetch("/api/shutdown", { method: "POST" });
  } catch (_error) {
    // The local process may stop before the response is read.
  }
  document.body.innerHTML = `
    <main class="closed-screen">
      <div>
        <h1>تم إغلاق البرنامج</h1>
        <p>يمكنك الآن إغلاق هذه الصفحة.</p>
      </div>
    </main>
  `;
}
function notifyDisconnect() {
  if (state.closing) {
    return;
  }

  try {
    navigator.sendBeacon(
      "/api/disconnect",
      new Blob([], {
        type: "text/plain",
      }),
    );
  } catch (_error) {
    // Closing the page must not display an error.
  }
}
async function sendHeartbeat() {
  if (state.closing) {
    return;
  }

  try {
    const response = await fetch("/api/heartbeat", {
      method: "POST",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Heartbeat failed with status ${response.status}`);
    }

    void flushClientLogs();

    if (state.serverOffline) {
      state.serverOffline = false;

      setStatus(
        "ready",
        `${state.schema?.stats?.field_count || 0} حقل · ` +
          `${state.schema?.stats?.record_count || 0} سجل`,
      );

      showToast("تمت إعادة الاتصال بالتطبيق.");
    }
  } catch (error) {
    if (!state.serverOffline) {
      state.serverOffline = true;

      reportClientError("server-connection", error);

      setStatus("error", "الخادم غير متصل — شغّل التطبيق مرة أخرى");

      showToast(
        "انقطع الاتصال بالخادم. " +
          "شغّل التطبيق مرة أخرى ثم أعد محاولة الحفظ.",
        "error",
      );
    }
  }
}

elements.entryModeButton.addEventListener("click", () => switchMode("entry"));
elements.builderModeButton.addEventListener("click", () =>
  switchMode("builder"),
);
elements.openBuilderButton.addEventListener("click", () =>
  switchMode("builder"),
);
elements.closeButton.addEventListener("click", closeApplication);
elements.builderCloseButton.addEventListener("click", closeApplication);
elements.builderSidebarAddCategoryButton.addEventListener("click", () => {
  openCategoryDialog();
});
elements.confirmCategoryButton.addEventListener(
  "click",
  saveCategoryFromDialog,
);
elements.confirmFieldButton.addEventListener("click", saveFieldFromDialog);
elements.confirmConditionButton.addEventListener(
  "click",
  saveConditionFromDialog,
);
elements.categoryKind.addEventListener("change", updateCategoryDialogType);
elements.fieldType.addEventListener("change", updateFieldDialogType);
elements.fieldSearchable.addEventListener("change", updateFieldDialogType);
elements.fieldShowResult.addEventListener("change", updateFieldDialogType);
elements.fileNamingMode.addEventListener("change", updateFieldDialogType);
elements.fieldOptions.addEventListener("input", () => {
  reconcileFieldOptions();
  renderOptionFilterMatrix();
});
elements.optionFilterSource.addEventListener("change", () => {
  state.optionFilterDraft = elements.optionFilterSource.value
    ? {
        source_field_id: elements.optionFilterSource.value,
        mappings: {},
        unmatched: "none",
      }
    : null;

  updateFieldDialogType();
  renderOptionFilterMatrix();
});
elements.categoryDialog.addEventListener("close", () => {
  if (state.categoryDialogCommitted || !state.categoryConditionsSnapshot) {
    return;
  }

  state.draftSchema.conditions = deepClone(state.categoryConditionsSnapshot);

  if (state.categoryDirtyBeforeOpen) {
    markDirty();
  } else {
    markClean();
  }

  renderBuilderConditions();
});

elements.fieldDialog.addEventListener("close", () => {
  if (state.fieldDialogCommitted || !state.fieldConditionsSnapshot) {
    return;
  }

  state.draftSchema.conditions = deepClone(state.fieldConditionsSnapshot);

  if (state.fieldDirtyBeforeOpen) {
    markDirty();
  } else {
    markClean();
  }

  renderBuilderConditions();
});
elements.addMarkerButton.addEventListener("click", addOrUpdateMarker);
elements.addFilePartButton.addEventListener("click", addFilePart);
elements.addCategoryConditionButton.addEventListener("click", () => {
  openConditionDialog(null, "category", state.editingCategoryId);
});

elements.addFieldConditionButton.addEventListener("click", () => {
  openConditionDialog(null, "field", state.editingFieldId);
});

elements.conditionSource.addEventListener("change", () => {
  fillConditionOperators();
  renderConditionValueControl("");
});

elements.conditionOperator.addEventListener("change", () => {
  const previous = currentConditionValue();

  renderConditionValueControl(previous);
});
elements.saveSchemaButton.addEventListener("click", saveSchema);
elements.backupButton.addEventListener("click", createBackup);
elements.chooseSearchFieldsButton.addEventListener(
  "click",
  openSearchFieldsDialog,
);
elements.selectAllSearchFieldsButton.addEventListener("click", () => {
  elements.searchFieldOptions
    .querySelectorAll("[data-search-field-option]")
    .forEach((checkbox) => {
      checkbox.checked = true;
    });
});
elements.clearAllSearchFieldsButton.addEventListener("click", () => {
  elements.searchFieldOptions
    .querySelectorAll("[data-search-field-option]")
    .forEach((checkbox) => {
      checkbox.checked = false;
    });
});
elements.resetSearchFieldsButton.addEventListener(
  "click",
  resetTemporarySearchFields,
);
elements.applySearchFieldsButton.addEventListener(
  "click",
  applyTemporarySearchFields,
);
elements.recordForm.addEventListener("input", (event) => {
  const control = event.target.closest("[data-value-control]");

  if (control) {
    clearFieldValidation(control);
  }
});

elements.recordForm.addEventListener("focusout", (event) => {
  const control = event.target.closest("[data-value-control]");

  if (!control) {
    return;
  }

  // Mark invalid data, but never steal focus back while the user is moving
  // through a large form with Tab. Save still focuses the first invalid field.
  validateEntryControl(control, true);
});
elements.confirmBuilderAuthButton.addEventListener("click", submitBuilderAuth);
elements.discardSchemaButton.addEventListener("click", discardSchemaChanges);
elements.saveRecordButton.addEventListener("click", saveCurrentRecord);
elements.archiveRecordButton.addEventListener("click", archiveCurrentRecord);
elements.deleteRecordButton.addEventListener("click", deleteCurrentRecord);
elements.searchButton.addEventListener("click", searchRecords);
elements.clearSearchButton.addEventListener("click", clearSearch);
elements.searchCollapseButton.addEventListener("click", toggleSearchPanel);
elements.recordForm.addEventListener("reset", handleFormReset);
elements.recordForm.addEventListener("input", () => {
  updateConditionalVisibility();
  scheduleDraftSave();
});
elements.recordForm.addEventListener("change", () => {
  updateConditionalVisibility();
  scheduleDraftSave();
});
elements.recordForm.addEventListener("click", (event) => {
  const add = event.target.closest("[data-add-related]");
  if (add) {
    addRelatedCard(add.dataset.addRelated, null, { focusFirst: true });
  }
});
elements.searchResults.addEventListener("click", (event) => {
  const copy = event.target.closest("[data-copy-record-code]");
  if (copy) {
    copyRecordCode(copy.dataset.copyRecordCode);
    return;
  }
  const open = event.target.closest("[data-open-search-record]");
  if (open) {
    loadRecord(open.dataset.openSearchRecord);
  }
});
elements.previousSearchResult.addEventListener("click", () =>
  moveSearchResult(-1),
);
elements.nextSearchResult.addEventListener("click", () =>
  moveSearchResult(1),
);
elements.builderCategories.addEventListener("click", (event) => {
  const button = event.target.closest("[data-builder-action]");
  if (button) {
    handleBuilderAction(button);
  }
});
elements.filePartsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-builder-action]");
  if (button) {
    handleFilePartAction(button);
  }
});
[
  elements.settingTitle,
  elements.settingSingular,
  elements.settingPlural,
  elements.settingPrimaryColor,
].forEach((control) => {
  control.addEventListener("input", () => {
    syncSettingsToDraft();
    markDirty();
  });
  control.addEventListener("change", () => {
    syncSettingsToDraft();
    markDirty();
  });
});
[
  elements.currentBuilderPassword,
  elements.builderPassword,
  elements.confirmBuilderPassword,
].forEach((control) => {
  control.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    void submitBuilderAuth();
  });
});
document.addEventListener("click", (event) => {
  const close = event.target.closest("[data-close-dialog]");
  if (close) {
    document.getElementById(close.dataset.closeDialog)?.close();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  if (
    event.target.closest("#builder-auth-dialog") ||
    ["TEXTAREA", "BUTTON"].includes(event.target.tagName)
  ) {
    return;
  }

  if (event.target.closest("form")) {
    event.preventDefault();
  }
});
window.addEventListener("pagehide", notifyDisconnect);
window.addEventListener("beforeunload", (event) => {
  if (state.dirty && !state.closing) {
    event.preventDefault();
  }
});

elements.recordCode.value = generateRecordCode();
displayRecordMetadata();
installStickyHeaderTracking();
installViewportPaintRecovery();
loadSchema();
sendHeartbeat();
window.addEventListener("error", (event) => {
  reportClientError(
    "window-error",
    event.error || event.message,
    `${event.filename || ""}:` +
      `${event.lineno || 0}:` +
      `${event.colno || 0}`,
  );
});

window.addEventListener("unhandledrejection", (event) => {
  reportClientError("unhandled-promise", event.reason);
});
state.heartbeatTimer = window.setInterval(sendHeartbeat, 2000);
state.draftTimer = window.setInterval(
  saveDraftLocally,
  RECORD_DRAFT_AUTOSAVE_MS,
);

state.builderAutosaveTimer = window.setInterval(
  autosaveBuilder,
  BUILDER_AUTOSAVE_MS,
);
