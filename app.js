const SHEET_ID = "199IIqX_7I4Bd0UfptLxp9IHZz1xKBBtMp61zeExJmC0";
const SHEET_QUERY_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=responseHandler:handleTeacherSheetResponse;out:json`;

const state = {
  records: [],
  classMap: new Map(),
};

const form = document.querySelector("#search-form");
const classSelect = document.querySelector("#class-select");
const sectionSelect = document.querySelector("#section-select");
const searchButton = document.querySelector("#search-button");
const statusMessage = document.querySelector("#status-message");
const resultsTitle = document.querySelector("#results-title");
const resultsCount = document.querySelector("#results-count");
const resultsBody = document.querySelector("#results-body");

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function compareNames(first, second) {
  return first.studentName.localeCompare(second.studentName, undefined, {
    sensitivity: "base",
  });
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? "#9f2d14" : "";
}

function setResultsPlaceholder(message) {
  const row = document.createElement("tr");
  row.className = "placeholder-row";

  const cell = document.createElement("td");
  cell.colSpan = 4;
  cell.textContent = message;

  row.appendChild(cell);
  resultsBody.replaceChildren(row);
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

function buildState(records) {
  const classMap = new Map();

  for (const record of records) {
    if (!classMap.has(record.className)) {
      classMap.set(record.className, new Set());
    }

    classMap.get(record.className).add(record.section);
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
}

function renderClassOptions() {
  fillSelect(classSelect, [...state.classMap.keys()], "Select class");
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

function renderResults(records, className, section) {
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

function loadSheetData() {
  window.handleTeacherSheetResponse = (response) => {
    if (response?.status !== "ok") {
      setStatus("Unable to read the Google Sheet right now.", true);
      setResultsPlaceholder("The sheet could not be loaded.");
      return;
    }

    const records = parseSheetData(response);
    buildState(records);
    renderClassOptions();
    setStatus(`Loaded ${records.length} records from Google Sheets.`);
  };

  const script = document.createElement("script");
  script.src = SHEET_QUERY_URL;
  script.async = true;

  script.onerror = () => {
    setStatus("Unable to load Google Sheet data. Check internet access.", true);
    setResultsPlaceholder("The sheet could not be loaded.");
  };

  document.body.appendChild(script);
}

classSelect.addEventListener("change", () => {
  const selectedClass = classSelect.value;

  if (!selectedClass) {
    sectionSelect.disabled = true;
    searchButton.disabled = true;
    fillSelect(sectionSelect, [], "Select a class first");
    return;
  }

  renderSectionOptions(selectedClass);
  resultsTitle.textContent = "No search yet";
  resultsCount.textContent = "0 students";
  setResultsPlaceholder("Choose a section and click search to view students.");
});

sectionSelect.addEventListener("change", () => {
  searchButton.disabled = !sectionSelect.value;
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

loadSheetData();
