const SHEET_ID = "1Zy9cZ3q5v7tZ87B8y4nI7gWj9HsIq6IQPkETbjKrSlI";
const SHEET_QUERY_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=responseHandler:handleTeacherSheetResponse;out:json`;

const state = {
  records: [],
  classMap: new Map(),
  kaushalGroups: [],
  currentResults: [],
  currentSelection: null,
  currentKaushalResults: [],
  currentKaushalSelection: null,
};

const form = document.querySelector("#search-form");
const kaushalForm = document.querySelector("#kaushal-form");
const classSelect = document.querySelector("#class-select");
const sectionSelect = document.querySelector("#section-select");
const kaushalSelect = document.querySelector("#kaushal-select");
const classRangeInputs = [...document.querySelectorAll('input[name="class-range"]')];
const searchButton = document.querySelector("#search-button");
const kaushalSearchButton = document.querySelector("#kaushal-search-button");
const statusMessage = document.querySelector("#status-message");
const kaushalStatusMessage = document.querySelector("#kaushal-status-message");
const resultsTitle = document.querySelector("#results-title");
const resultsCount = document.querySelector("#results-count");
const resultsBody = document.querySelector("#results-body");
const exportButton = document.querySelector("#export-button");
const kaushalResultsTitle = document.querySelector("#kaushal-results-title");
const kaushalResultsCount = document.querySelector("#kaushal-results-count");
const kaushalResultsBody = document.querySelector("#kaushal-results-body");
const kaushalExportButton = document.querySelector("#kaushal-export-button");

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function compareNames(first, second) {
  return first.studentName.localeCompare(second.studentName, undefined, {
    sensitivity: "base",
  });
}

function setStatus(message, isError = false, target = statusMessage) {
  target.textContent = message;
  target.style.color = isError ? "#9f2d14" : "";
}

function updateExportButton() {
  exportButton.disabled = state.currentResults.length === 0;
  kaushalExportButton.disabled = state.currentKaushalResults.length === 0;
}

function setResultsPlaceholder(message, targetBody = resultsBody) {
  const row = document.createElement("tr");
  row.className = "placeholder-row";

  const cell = document.createElement("td");
  cell.colSpan = 4;
  cell.textContent = message;

  row.appendChild(cell);
  targetBody.replaceChildren(row);
}

function fillSelect(selectElement, options, placeholder) {
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;

  const optionNodes = options.map((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    return option;
  });

  selectElement.replaceChildren(placeholderOption, ...optionNodes);
}

function getClassNumber(className) {
  const match = normalizeText(className).match(/\d+/);
  return match ? Number(match[0]) : null;
}

function isInSelectedRange(className, selectedRange) {
  const classNumber = getClassNumber(className);

  if (classNumber === null) {
    return false;
  }

  if (selectedRange === "3-5") {
    return classNumber >= 3 && classNumber <= 5;
  }

  if (selectedRange === "6-8") {
    return classNumber >= 6 && classNumber <= 8;
  }

  return false;
}

function getSelectedClassRange() {
  return classRangeInputs.find((input) => input.checked)?.value ?? "";
}

function updateKaushalSearchButtonState() {
  kaushalSearchButton.disabled = !kaushalSelect.value || !getSelectedClassRange();
}

function buildState(records) {
  const classMap = new Map();
  const kaushalGroups = new Set();

  for (const record of records) {
    if (!classMap.has(record.className)) {
      classMap.set(record.className, new Set());
    }

    classMap.get(record.className).add(record.section);

    if (record.kaushalBodh) {
      kaushalGroups.add(record.kaushalBodh);
    }
  }

  state.records = records.sort(compareNames);
  state.classMap = new Map(
    [...classMap.entries()]
      .sort(([first], [second]) =>
        first.localeCompare(second, undefined, { numeric: true, sensitivity: "base" })
      )
      .map(([className, sections]) => [
        className,
        [...sections].sort((first, second) =>
          first.localeCompare(second, undefined, { sensitivity: "base" })
        ),
      ])
  );
  state.kaushalGroups = [...kaushalGroups].sort((first, second) =>
    first.localeCompare(second, undefined, { sensitivity: "base" })
  );
}

function renderClassOptions() {
  fillSelect(classSelect, [...state.classMap.keys()], "Select");
  classSelect.disabled = false;
}

function renderSectionOptions(className) {
  const sections = state.classMap.get(className) ?? [];
  fillSelect(
    sectionSelect,
    sections,
    sections.length ? "Select section" : "No sections found"
  );
  sectionSelect.disabled = sections.length === 0;
  searchButton.disabled = true;
}

function renderKaushalOptions() {
  fillSelect(
    kaushalSelect,
    state.kaushalGroups,
    state.kaushalGroups.length ? "Select" : "No options found"
  );
  kaushalSelect.disabled = state.kaushalGroups.length === 0;
  updateKaushalSearchButtonState();
}

function renderResults(records, className, section) {
  state.currentResults = [...records];
  state.currentSelection = { type: "class-section", className, section };
  updateExportButton();

  resultsTitle.textContent = `${className} • ${section}`;
  resultsCount.textContent = `${records.length} student${records.length === 1 ? "" : "s"}`;

  if (!records.length) {
    setResultsPlaceholder("No students found for the selected class and section.");
    return;
  }

  const rows = records.map((record) => {
    const row = document.createElement("tr");

    [record.studentName, record.className, record.section, record.kaushalBodh || "-"].forEach(
      (value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      }
    );

    return row;
  });

  resultsBody.replaceChildren(...rows);
}

function renderKaushalResults(records, kaushalGroup, classRange) {
  state.currentKaushalResults = [...records];
  state.currentKaushalSelection = { kaushalGroup, classRange };
  updateExportButton();

  const rangeLabel = classRange === "3-5" ? "Class 3 to 5" : "Class 6 to 8";
  kaushalResultsTitle.textContent = `${kaushalGroup} • ${rangeLabel}`;
  kaushalResultsCount.textContent = `${records.length} student${records.length === 1 ? "" : "s"}`;

  if (!records.length) {
    setResultsPlaceholder(
      "No students found for the selected Kaushal Booth group and class range.",
      kaushalResultsBody
    );
    return;
  }

  const rows = records.map((record) => {
    const row = document.createElement("tr");

    [record.studentName, record.className, record.section, record.kaushalBodh || "-"].forEach(
      (value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      }
    );

    return row;
  });

  kaushalResultsBody.replaceChildren(...rows);
}

function parseSheetData(response) {
  const rows = response?.table?.rows ?? [];

  return rows
    .map((row) => {
      const cells = row.c ?? [];
      const studentName = normalizeText(cells[1]?.v);
      const className = normalizeText(cells[2]?.v);
      const section = normalizeText(cells[3]?.v);
      const kaushalBodh = normalizeText(cells[4]?.v);

      if (!studentName || !className || !section) {
        return null;
      }

      return {
        studentName,
        className,
        section,
        kaushalBodh,
      };
    })
    .filter(Boolean);
}

function resetResultsState() {
  state.currentResults = [];
  state.currentSelection = null;
  updateExportButton();
}

function resetKaushalResultsState() {
  state.currentKaushalResults = [];
  state.currentKaushalSelection = null;
  updateExportButton();
}

function createCsvContent(records) {
  const header = ["Student Name", "Class", "Section", "Kaushal Booth"];
  const rows = records.map((record) => [
    record.studentName,
    record.className,
    record.section,
    record.kaushalBodh || "",
  ]);

  return [header, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
}

function downloadCsvFile(records, fileName) {
  const csvContent = createCsvContent(records);
  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadExcelFile() {
  if (!state.currentResults.length || !state.currentSelection) {
    return;
  }

  const { className, section } = state.currentSelection;
  const safeClass = className.replace(/\s+/g, "-").toLowerCase();
  const safeSection = section.replace(/\s+/g, "-").toLowerCase();
  const fileName = `teacher-record-${safeClass}-${safeSection}.csv`;

  downloadCsvFile(state.currentResults, fileName);
}

function downloadKaushalExcelFile() {
  if (!state.currentKaushalResults.length || !state.currentKaushalSelection) {
    return;
  }

  const { kaushalGroup, classRange } = state.currentKaushalSelection;
  const safeKaushalGroup = kaushalGroup.replace(/\s+/g, "-").toLowerCase();
  const safeRange = classRange.replace(/\s+/g, "-").toLowerCase();
  const fileName = `teacher-record-kaushal-booth-${safeKaushalGroup}-${safeRange}.csv`;

  downloadCsvFile(state.currentKaushalResults, fileName);
}

function loadSheetData() {
  window.handleTeacherSheetResponse = (response) => {
    if (response?.status !== "ok") {
      setStatus("Unable to read the Google Sheet right now.", true);
      setStatus("Unable to load Kaushal Booth groups right now.", true, kaushalStatusMessage);
      setResultsPlaceholder("The sheet could not be loaded.");
      setResultsPlaceholder("The sheet could not be loaded.", kaushalResultsBody);
      return;
    }

    const records = parseSheetData(response);
    buildState(records);
    resetResultsState();
    resetKaushalResultsState();
    renderClassOptions();
    renderKaushalOptions();
    setStatus(`Loaded ${records.length} records from Google Sheets.`);
    setStatus(
      `Loaded ${state.kaushalGroups.length} Kaushal Booth groups from Google Sheets.`,
      false,
      kaushalStatusMessage
    );
  };

  const script = document.createElement("script");
  script.src = SHEET_QUERY_URL;
  script.async = true;

  script.onerror = () => {
    setStatus("Unable to load Google Sheet data. Check internet access.", true);
    setStatus("Unable to load Kaushal Booth groups. Check internet access.", true, kaushalStatusMessage);
    setResultsPlaceholder("The sheet could not be loaded.");
    setResultsPlaceholder("The sheet could not be loaded.", kaushalResultsBody);
  };

  document.body.appendChild(script);
}

classSelect.addEventListener("change", () => {
  const selectedClass = classSelect.value;

  if (!selectedClass) {
    sectionSelect.disabled = true;
    searchButton.disabled = true;
    fillSelect(sectionSelect, [], "Select first");
    resetResultsState();
    return;
  }

  renderSectionOptions(selectedClass);
  resetResultsState();
  resultsTitle.textContent = "No search yet";
  resultsCount.textContent = "0 students";
  setResultsPlaceholder("Choose a section and click search to view students.");
});

sectionSelect.addEventListener("change", () => {
  searchButton.disabled = !sectionSelect.value;
});

kaushalSelect.addEventListener("change", () => {
  updateKaushalSearchButtonState();
  resetKaushalResultsState();
  kaushalResultsTitle.textContent = "No search yet";
  kaushalResultsCount.textContent = "0 students";
  setResultsPlaceholder(
    "Choose a Kaushal Booth group and class range, then click search to view students.",
    kaushalResultsBody
  );
});

classRangeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    updateKaushalSearchButtonState();
    resetKaushalResultsState();
    kaushalResultsTitle.textContent = "No search yet";
    kaushalResultsCount.textContent = "0 students";
    setResultsPlaceholder(
      "Choose a Kaushal Booth group and class range, then click search to view students.",
      kaushalResultsBody
    );
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const selectedClass = classSelect.value;
  const selectedSection = sectionSelect.value;

  const filteredRecords = state.records
    .filter(
      (record) =>
        record.className === selectedClass && record.section === selectedSection
    )
    .sort(compareNames);

  renderResults(filteredRecords, selectedClass, selectedSection);
});

kaushalForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const selectedKaushalGroup = kaushalSelect.value;
  const selectedClassRange = getSelectedClassRange();
  const filteredRecords = state.records
    .filter(
      (record) =>
        record.kaushalBodh === selectedKaushalGroup &&
        isInSelectedRange(record.className, selectedClassRange)
    )
    .sort(compareNames);

  renderKaushalResults(filteredRecords, selectedKaushalGroup, selectedClassRange);
});

exportButton.addEventListener("click", downloadExcelFile);
kaushalExportButton.addEventListener("click", downloadKaushalExcelFile);

loadSheetData();
