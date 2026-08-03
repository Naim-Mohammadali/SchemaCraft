"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { webcrypto } = require("node:crypto");
const { JSDOM, VirtualConsole } = require("jsdom");

const projectDir = path.resolve(__dirname, "..");
const activeServers = [];
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "generic-entry-dom-"));
const developerData = path.join(temporaryRoot, "developer-data");
const userData = path.join(temporaryRoot, "user-data");
// Always start from an isolated empty data directory. Never copy or mutate the
// developer's live schema, workbook, attachments, or logs during UI tests.
fs.mkdirSync(developerData, { recursive: true });

const fixtureResult = spawnSync(
  "python3",
  [
    "-c",
    [
      "import json,sys",
      `sys.path.insert(0, ${JSON.stringify(path.join(projectDir, "tests"))})`,
      "from test_backend import configured_schema",
      "print(json.dumps(configured_schema(), ensure_ascii=False))"
    ].join(";")
  ],
  { cwd: projectDir, encoding: "utf8" }
);
assert.equal(fixtureResult.status, 0, fixtureResult.stderr);
const fixtureSchema = JSON.parse(fixtureResult.stdout);
fixtureSchema.app.primary_color = "#FFFFFF";
fixtureSchema.app.background_color = "#000000";
fixtureSchema.app.surface_color = "#000000";

const IDS = {
  name: "fld_000000000001",
  father: "fld_000000000002",
  family: "fld_000000000003",
  works: "fld_000000000004",
  gregorian: "fld_000000000005",
  hijri: "fld_000000000006",
  shamsi: "fld_000000000007",
  status: "fld_000000000009",
  notes: "fld_00000000000a",
  documentType: "fld_00000000000b",
  customFile: "fld_00000000000d",
  documents: "cat_000000000002"
};

function startServer(dataDirectory, developerMode) {
  const args = [
    path.join(projectDir, "tests", "test_server.py"),
    dataDirectory
  ];
  if (developerMode) {
    args.push("--builder");
  }
  const server = spawn("python3", args, {
    cwd: projectDir,
    stdio: ["ignore", "pipe", "pipe"]
  });
  activeServers.push(server);
  let errors = "";
  server.stderr.on("data", (chunk) => {
    errors += chunk.toString();
  });
  const portPromise = new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for server. ${errors}`)),
      10_000
    );
    server.stdout.on("data", (chunk) => {
      output += chunk.toString();
      const match = output.match(/PORT=(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(Number(match[1]));
      }
    });
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited with ${code}. ${errors}`));
    });
  });
  return { server, portPromise, errors: () => errors };
}

async function waitFor(predicate, message, timeoutMs = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out: ${message}`);
}

function setValue(window, elementOrSelector, value, eventType = "input") {
  const element =
    typeof elementOrSelector === "string"
      ? window.document.querySelector(elementOrSelector)
      : elementOrSelector;
  assert.ok(element, `Missing element: ${elementOrSelector}`);
  element.value = value;
  element.dispatchEvent(new window.Event(eventType, { bubbles: true }));
  return element;
}

function setSelectByLabel(window, element, label) {
  const option = [...element.options].find((candidate) => candidate.textContent === label);
  assert.ok(option, `Missing select option: ${label}`);
  return setValue(window, element, option.value, "change");
}

function typeDigits(window, element, digits) {
  for (const key of digits) {
    const event = new window.KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
  }
}

function browserOptions(browserErrors) {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => browserErrors.push(String(error)));
  virtualConsole.on("error", (error) => browserErrors.push(String(error)));
  return {
    resources: "usable",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: webcrypto });
      window.fetch = (input, init) =>
        fetch(new URL(input, window.location.href), init);
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.confirm = () => true;
      window.open = () => null;
      window.navigator.sendBeacon = () => true;
      window.CSS = window.CSS || {};
      window.CSS.escape =
        window.CSS.escape ||
        ((value) => String(value).replace(/["\\]/g, "\\$&"));
      if (window.HTMLDialogElement) {
        window.HTMLDialogElement.prototype.showModal = function showModal() {
          this.open = true;
        };
        window.HTMLDialogElement.prototype.close = function close() {
          this.open = false;
        };
      }
    }
  };
}

async function loadDom(baseUrl, browserErrors) {
  const dom = await JSDOM.fromURL(baseUrl, browserOptions(browserErrors));
  await waitFor(
    () =>
      dom.window.document
        .querySelector("#app-status")
        ?.classList.contains("status-ready"),
    "application schema to load"
  );
  return dom;
}

function valueControl(document, fieldId, scope = "main", root = document) {
  return root.querySelector(
    `[data-value-control][data-field-id="${fieldId}"][data-scope="${scope}"]`
  );
}

function setCalendar(window, document, fieldId, year, month, day, scope = "main") {
  const hidden = valueControl(document, fieldId, scope);
  assert.ok(hidden, `Missing calendar field ${fieldId}`);
  const group = hidden.closest(".calendar-control");
  const monthSelect = group.querySelector("[data-calendar-month]");
  assert.equal(
    monthSelect.options[Number(month)].textContent,
    String(month).padStart(2, "0")
  );
  setValue(window, group.querySelector("[data-calendar-year]"), year, "change");
  setValue(
    window,
    monthSelect,
    String(month).padStart(2, "0"),
    "change"
  );
  setValue(
    window,
    group.querySelector("[data-calendar-day]"),
    String(day).padStart(2, "0"),
    "change"
  );
  assert.equal(hidden.value, `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  return hidden.closest(".field").querySelector("[data-calendar-readable]").textContent;
}

async function run() {
  const browserErrors = [];
  const developer = startServer(developerData, true);
  const developerPort = await developer.portPromise;
  const developerBase = `http://127.0.0.1:${developerPort}/`;

  const emptyDom = await loadDom(developerBase, browserErrors);
  const emptyDocument = emptyDom.window.document;
  assert.equal(emptyDocument.querySelector("#empty-schema-panel").hidden, false);
  assert.equal(emptyDocument.querySelector("#record-form").hidden, true);
  assert.equal(emptyDocument.querySelector("#builder-mode-button").hidden, false);

  emptyDocument.querySelector("#builder-mode-button").click();
  assert.equal(emptyDocument.querySelector("#builder-view").hidden, false);
  assert.ok(emptyDocument.querySelector("#backup-button .action-icon"));
  assert.equal(emptyDocument.querySelector("#change-builder-password-button"), null);
  assert.equal(emptyDocument.querySelector("#lock-builder-button"), null);
  assert.equal(emptyDocument.querySelector("#setting-direction"), null);
  assert.equal(emptyDocument.querySelector("#setting-background-color"), null);
  assert.equal(emptyDocument.querySelector("#setting-surface-color"), null);
  emptyDocument.querySelector("#builder-sidebar-add-category-button").click();
  assert.equal(emptyDocument.querySelector("#category-dialog").open, true);
  setValue(emptyDom.window, "#category-label", "فئة اختبار");
  emptyDocument.querySelector("#confirm-category-button").click();
  assert.equal(emptyDocument.querySelectorAll(".builder-category").length, 1);
  emptyDocument.querySelector('[data-builder-action="add-field"]').click();
  setValue(emptyDom.window, "#field-label", "حقل اختبار");
  setValue(emptyDom.window, "#field-type", "date_hijri", "change");
  emptyDocument.querySelector("#field-searchable").checked = true;
  emptyDocument
    .querySelector("#field-searchable")
    .dispatchEvent(new emptyDom.window.Event("change", { bubbles: true }));
  emptyDocument.querySelector("#confirm-field-button").click();
  assert.equal(emptyDocument.querySelectorAll(".builder-field-row").length, 1);
  assert.equal(
    emptyDocument.querySelector("#builder-save-state").dataset.dirty,
    "true"
  );
  emptyDocument.querySelector("#discard-schema-button").click();
  assert.equal(emptyDocument.querySelectorAll(".builder-category").length, 0);

  const putResponse = await fetch(`${developerBase}api/schema`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fixtureSchema)
  });
  assert.equal(putResponse.status, 200);
  const configured = await putResponse.json();
  assert.equal(configured.stats.field_count, 18);

  fs.cpSync(developerData, userData, { recursive: true });
  const userServer = startServer(userData, false);
  const userPort = await userServer.portPromise;
  const userBase = `http://127.0.0.1:${userPort}/`;
  const userDom = await loadDom(userBase, browserErrors);
  const userDocument = userDom.window.document;
  assert.equal(userDocument.querySelector("#builder-mode-button").hidden, false);
  assert.equal(userDocument.querySelector("#open-builder-button").hidden, false);
  assert.equal(userDocument.querySelector("#record-form").hidden, false);
  userDocument.querySelector("#builder-mode-button").click();
  assert.equal(userDocument.querySelector("#builder-auth-dialog").open, true);
  assert.equal(userDocument.querySelector("#builder-view").hidden, true);

  const dom = await loadDom(developerBase, browserErrors);
  const { window } = dom;
  const { document } = window;
  assert.equal(document.documentElement.dir, "rtl");
  assert.equal(document.querySelector("#app-title").textContent, "نظام تجريبي");
  assert.equal(
    document.documentElement.style.getPropertyValue("--primary-contrast"),
    "#172033"
  );
  assert.notEqual(
    document.documentElement.style.getPropertyValue("--primary-ink"),
    "#FFFFFF"
  );
  assert.ok(document.querySelector("#search-button .action-icon"));
  assert.ok(document.querySelector("#save-record-button .action-icon"));
  assert.ok(document.querySelector("#reset-form-button .action-icon"));
  assert.ok(document.querySelector("#close-app-button .action-icon"));
  assert.equal(document.querySelector("#startup-error").hidden, true);
  assert.equal(document.querySelectorAll("[data-main-category]").length, 1);
  assert.equal(document.querySelectorAll("[data-related-category]").length, 2);
  assert.equal(document.querySelectorAll("input[type='date']").length, 0);
  assert.equal(window.getComputedStyle(document.body).display, "flex");
  assert.equal(
    window.getComputedStyle(document.querySelector(".app-header")).position,
    "relative"
  );
  assert.equal(
    window.getComputedStyle(document.querySelector(".page")).overflowY,
    "auto"
  );

  const gregorianHidden = valueControl(document, IDS.gregorian);
  const gregorianGroup = gregorianHidden.closest(".calendar-control");
  const gregorianDay = gregorianGroup.querySelector("[data-calendar-day]");
  const gregorianMonth = gregorianGroup.querySelector("[data-calendar-month]");
  const gregorianYear = gregorianGroup.querySelector("[data-calendar-year]");
  gregorianDay.focus();
  typeDigits(window, gregorianDay, "09");
  await waitFor(
    () => document.activeElement === gregorianMonth,
    "two day digits to advance to month"
  );
  typeDigits(window, gregorianMonth, "04");
  await waitFor(
    () => document.activeElement === gregorianYear,
    "two month digits to advance to year"
  );
  typeDigits(window, gregorianYear, "2001");
  await waitFor(
    () => gregorianHidden.value === "2001-04-09",
    "four year digits to complete the date"
  );
  gregorianDay.focus();
  typeDigits(window, gregorianDay, "39");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(document.activeElement, gregorianDay);
  assert.equal(gregorianDay.value, "09");

  const gregorianText = setCalendar(
    window,
    document,
    IDS.gregorian,
    "2001",
    4,
    9
  );
  const hijriText = setCalendar(
    window,
    document,
    IDS.hijri,
    "1447",
    9,
    12
  );
  const shamsiText = setCalendar(
    window,
    document,
    IDS.shamsi,
    "1405",
    1,
    20
  );
  assert.match(gregorianText, /أبريل.*ميلادي/);
  assert.match(hijriText, /رمضان.*هجري/);
  assert.match(shamsiText, /فروردین.*هجري شمسي/);

  const documentsSection = document.querySelector(
    `[data-related-category="${IDS.documents}"]`
  );
  const works = valueControl(document, IDS.works);
  assert.equal(documentsSection.hidden, true);
  setSelectByLabel(window, works, "نعم");
  assert.equal(documentsSection.hidden, false);
  assert.equal(
    works.closest("[data-field-wrapper]").nextElementSibling,
    documentsSection
  );

  setValue(window, valueControl(document, IDS.name), "عَلِي");
  setValue(window, valueControl(document, IDS.father), "حسن");
  setValue(window, valueControl(document, IDS.family), "محمدي");
  setValue(window, valueControl(document, IDS.notes), "ملاحظة");
  setSelectByLabel(window, valueControl(document, IDS.status), "نشط");
  const relatedRecords = documentsSection.querySelector("[data-related-records]");
  const relatedAddButton = documentsSection.querySelector("[data-add-related]");
  assert.ok(relatedAddButton);
  assert.equal(relatedRecords.nextElementSibling.contains(relatedAddButton), true);
  relatedAddButton.click();
  const documentCard = documentsSection.querySelector(".related-card");
  assert.ok(documentCard);
  await waitFor(
    () => documentCard.contains(document.activeElement),
    "new repeated card to receive focus"
  );
  setValue(
    window,
    valueControl(document, IDS.documentType, "related", documentCard),
    "صورة"
  );
  const picker = documentCard.querySelector("[data-file-picker]");
  const image = new window.File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])],
    "photo.png",
    { type: "image/png" }
  );
  Object.defineProperty(picker, "files", {
    configurable: true,
    value: [image]
  });
  picker.dispatchEvent(new window.Event("change", { bubbles: true }));

  const countBeforeEnter = document.querySelectorAll(".related-card").length;
  const enter = new window.KeyboardEvent("keydown", {
    key: "Enter",
    bubbles: true,
    cancelable: true
  });
  valueControl(document, IDS.name).dispatchEvent(enter);
  assert.equal(enter.defaultPrevented, true);
  assert.equal(document.querySelectorAll(".related-card").length, countBeforeEnter);

  document.querySelector("#save-record-button").click();
  await waitFor(
    () =>
      !document.querySelector("#delete-record-button").hidden &&
      document.querySelector("#save-button-text").textContent === "حفظ التعديلات",
    "record to save and reload",
    15_000
  );
  assert.match(document.querySelector("#record-code").value, /^[A-Z][A-Z0-9]{7}$/);
  assert.equal(document.querySelector("#attachment-gallery").hidden, false);
  assert.equal(document.querySelectorAll(".gallery-card").length, 1);
  assert.equal(document.querySelectorAll(".gallery-preview").length, 1);

  assert.match(
    document.querySelector("#choose-search-fields-text").textContent,
    /الافتراضية/
  );
  document.querySelector("#choose-search-fields-button").click();
  assert.equal(document.querySelector("#search-fields-dialog").open, true);
  const notesSearchOption = document.querySelector(
    `#search-field-options [data-search-field-option="${IDS.notes}"]`
  );
  assert.ok(notesSearchOption);
  assert.equal(notesSearchOption.checked, false);
  assert.equal(
    document.querySelector(
      `#search-field-options [data-search-field-option="${IDS.customFile}"]`
    ),
    null
  );
  document.querySelector("#clear-all-search-fields-button").click();
  notesSearchOption.checked = true;
  document.querySelector("#apply-search-fields-button").click();
  assert.match(
    document.querySelector("#choose-search-fields-text").textContent,
    /مخصصة \(1\)/
  );
  assert.deepEqual(
    [...document.querySelectorAll("#search-fields [data-field-wrapper]")].map(
      (wrapper) => wrapper.dataset.fieldWrapper
    ),
    [IDS.notes]
  );
  setValue(window, valueControl(document, IDS.notes, "search"), "ملاحظة");
  document.querySelector("#search-button").click();
  await waitFor(
    () => document.querySelectorAll(".search-result-card").length === 1,
    "temporary field search result"
  );
  document.querySelector("#choose-search-fields-button").click();
  document.querySelector("#reset-search-fields-button").click();
  assert.match(
    document.querySelector("#choose-search-fields-text").textContent,
    /الافتراضية/
  );

  const searchName = valueControl(document, IDS.name, "search");
  const visibleSearchLabels = [
    ...document.querySelectorAll("#search-fields [data-field-wrapper] > label")
  ].map((label) => label.textContent);
  assert.ok(visibleSearchLabels.includes("الاسم"));
  assert.equal(visibleSearchLabels.some((label) => label.includes("—")), false);
  setValue(window, searchName, "علي");
  const searchTabStops = [
    ...document.querySelectorAll(
      "#search-panel input:not([disabled]), #search-panel select:not([disabled]), #search-panel button:not([disabled])"
    )
  ];
  assert.equal(searchTabStops.at(-2).id, "clear-search-button");
  assert.equal(searchTabStops.at(-1).id, "search-button");
  document.querySelector("#search-button").click();
  await waitFor(
    () => document.querySelectorAll(".search-result-card").length === 1,
    "search result"
  );
  document.querySelector(".search-result-card").click();
  await waitFor(
    () => valueControl(document, IDS.name).value === "عَلِي",
    "selected record to load"
  );
  setValue(window, valueControl(document, IDS.name), "علي المعدّل");
  document.querySelector("#save-record-button").click();
  await waitFor(
    async () => {
      const schema = await (await fetch(`${developerBase}api/schema`)).json();
      return schema.stats.record_count === 1 &&
        valueControl(document, IDS.name).value === "علي المعدّل";
    },
    "record update"
  );

  const closeStyleRule = fs
    .readFileSync(path.join(projectDir, "app", "styles.css"), "utf8")
    .match(/#close-app-button\s*\{[^}]*position:\s*fixed/s);
  assert.ok(closeStyleRule, "Exit button must remain fixed while scrolling");

  assert.deepEqual(
    browserErrors.filter(
      (message) =>
        !message.includes("Not implemented: navigation") &&
        !message.includes("Could not parse CSS stylesheet")
    ),
    []
  );

  emptyDom.window.close();
  userDom.window.close();
  dom.window.close();
  console.log(
    "Generic builder, password-locked access, unified calendars, record workflow, and attachment gallery passed."
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  for (const server of activeServers) {
    if (!server.killed) {
      server.kill("SIGTERM");
    }
  }
});
