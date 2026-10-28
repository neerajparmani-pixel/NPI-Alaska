/** NPI Alaska: spreadsheet-owner test, not worker authentication.
 * Paste into a script BOUND to a private test spreadsheet. Never publish to Anyone.
 */
var NPI_TEST = {
  sheet: "NPI_Test_Work",
  headers: [
    "ID",
    "Site",
    "Area",
    "Worker",
    "Equipment",
    "Status",
    "StartedUTC",
    "FinishedUTC",
    "TasksJSON",
    "Notes",
    "Loads",
    "FilesJSON",
    "Correction",
    "Version",
    "HistoryJSON",
  ],
  sites: {
    Courthouse: ["Plowing", "Sidewalk clearing", "Sanding", "Ice melt"],
    "David Dowd": ["Snow clearing", "Sanding", "Ice melt"],
    "Tote Port": ["Hauling", "Site cleanup"],
  },
  limit: 500,
  fileLimit: 2 * 1024 * 1024,
};
// Readable backend tabs are rebuilt from the versioned record store.
// Keeping one atomic record write protects status/history/request-ID consistency.
var NPI_VIEWS = {
  NPI_Settings: ["Setting", "Value", "Purpose"],
  NPI_Assignments: [
    "Assignment ID",
    "Site",
    "Work area",
    "Worker",
    "Equipment",
    "Status",
    "Assigned (Alaska time)",
  ],
  NPI_WorkLogs: [
    "Work ID",
    "Site",
    "Work area",
    "Worker",
    "Status",
    "Started (Alaska time)",
    "Finished (Alaska time)",
    "Completed hours",
    "Tasks",
    "Loads",
    "Notes",
    "Correction",
  ],
  NPI_Attachments: [
    "Work ID",
    "Site",
    "Worker",
    "Kind",
    "Filename",
    "Private Drive link",
  ],
  NPI_Approvals: [
    "Review ID",
    "Work ID",
    "Site",
    "Worker",
    "Decision",
    "Reviewer",
    "Reviewed (Alaska time)",
    "Reason",
  ],
  NPI_AuditLog: [
    "Operation ID",
    "Work ID",
    "Action",
    "Actor",
    "When (Alaska time)",
    "Reason",
  ],
  NPI_Sites: ["Site", "Tasks", "Status"],
  NPI_Users: ["Email", "Display name", "Role", "Access"],
};
function formatAlaska_(value) {
  return value
    ? Utilities.formatDate(
        new Date(value),
        "America/Anchorage",
        "MMM d, yyyy h:mm a",
      )
    : "";
}
function checkView_(sheet, name) {
  if (
    !sheet ||
    sheet.getLastColumn() !== NPI_VIEWS[name].length ||
    sheet
      .getRange(1, 1, 1, NPI_VIEWS[name].length)
      .getValues()[0]
      .some(function (v, i) {
        return v !== NPI_VIEWS[name][i];
      })
  ) {
    throw new Error(
      name +
        " headers are missing or changed. Run setupNpiTest to prepare the backend.",
    );
  }
}
function styleView_(sheet, columns) {
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 40);
  sheet
    .getRange(1, 1, 1, columns)
    .setBackground("#102c50")
    .setFontColor("#ffffff")
    .setFontWeight("bold");
  sheet
    .getRange(1, 1, Math.max(2, sheet.getLastRow()), columns)
    .setFontFamily("Arial")
    .setVerticalAlignment("top")
    .setWrap(true);
  for (var i = 1; i <= columns; i++)
    sheet.setColumnWidth(i, i === 1 ? 290 : 180);
}
function prepareViews_(book) {
  var props = PropertiesService.getScriptProperties();
  var managed = props.getProperty("NPI_BACKEND_BOOK") === book.getId();
  Object.keys(NPI_VIEWS).forEach(function (name) {
    var existing = book.getSheetByName(name);
    if (existing && existing.getLastRow()) {
      checkView_(existing, name);
      if (!managed && existing.getLastRow() > 1)
        throw new Error(
          name +
            " already contains unmanaged data. Nothing was overwritten; use a separate private test spreadsheet.",
        );
    }
  });
  Object.keys(NPI_VIEWS).forEach(function (name) {
    var sheet = book.getSheetByName(name) || book.insertSheet(name);
    if (!sheet.getLastRow())
      sheet
        .getRange(1, 1, 1, NPI_VIEWS[name].length)
        .setValues([NPI_VIEWS[name]]);
    styleView_(sheet, NPI_VIEWS[name].length);
  });
  var settings = book.getSheetByName("NPI_Settings");
  if (settings.getLastRow() === 1)
    settings.getRange(2, 1, 2, 3).setValues([
      ["Workspace name", "NPI Alaska", "Displayed in the app navigation"],
      ["Support contact", "", "Displayed to workers for assignment questions"],
    ]);
  props.setProperty("NPI_BACKEND_BOOK", book.getId());
}
function sourceJobs_(sheet) {
  return sheet.getLastRow() > 1
    ? sheet
        .getRange(2, 1, sheet.getLastRow() - 1, NPI_TEST.headers.length)
        .getValues()
        .map(rowJob_)
    : [];
}
function syncViews_(book, jobs) {
  if (
    PropertiesService.getScriptProperties().getProperty("NPI_BACKEND_BOOK") !==
    book.getId()
  )
    throw new Error("Run setupNpiTest once to upgrade the multi-tab backend.");
  Object.keys(NPI_VIEWS).forEach(function (name) {
    checkView_(book.getSheetByName(name), name);
  });
  var rows = {
    NPI_Assignments: [],
    NPI_WorkLogs: [],
    NPI_Attachments: [],
    NPI_Approvals: [],
    NPI_AuditLog: [],
    NPI_Sites: [],
    NPI_Users: [],
  };
  jobs.forEach(function (j) {
    rows.NPI_Assignments.push([
      j.id,
      j.site,
      j.area,
      j.worker,
      j.equipment,
      j.status,
      formatAlaska_(j.history[0] && j.history[0].at),
    ]);
    var completed =
      j.start && j.end
        ? Math.max(
            0,
            Math.round((new Date(j.end) - new Date(j.start)) / 36000) / 100,
          )
        : "";
    rows.NPI_WorkLogs.push([
      j.id,
      j.site,
      j.area,
      j.worker,
      j.status,
      formatAlaska_(j.start),
      formatAlaska_(j.end),
      completed,
      j.tasks.join(", "),
      j.loads,
      j.notes,
      j.correction,
    ]);
    j.files.forEach(function (f) {
      rows.NPI_Attachments.push([
        j.id,
        j.site,
        j.worker,
        f.kind,
        f.name,
        "https://drive.google.com/file/d/" + encodeURIComponent(f.id) + "/view",
      ]);
    });
    j.history.forEach(function (h) {
      rows.NPI_AuditLog.push([
        h.requestId,
        j.id,
        h.action,
        h.actor,
        formatAlaska_(h.at),
        h.reason || "",
      ]);
      if (["approve", "return"].indexOf(h.action) >= 0)
        rows.NPI_Approvals.push([
          h.requestId,
          j.id,
          j.site,
          j.worker,
          h.action === "approve" ? "Approved" : "Correction requested",
          h.actor,
          formatAlaska_(h.at),
          h.reason || "",
        ]);
    });
  });
  Object.keys(NPI_TEST.sites).forEach(function (name) {
    rows.NPI_Sites.push([
      name,
      NPI_TEST.sites[name].join("\n"),
      "Available in this preview",
    ]);
  });
  rows.NPI_Users.push([
    Session.getActiveUser().getEmail(),
    "Spreadsheet owner",
    "Owner",
    "Owner-only preview; company logins not connected",
  ]);
  Object.keys(rows).forEach(function (name) {
    var sheet = book.getSheetByName(name),
      width = NPI_VIEWS[name].length;
    if (sheet.getLastRow() > 1)
      sheet.getRange(2, 1, sheet.getLastRow() - 1, width).clearContent();
    if (rows[name].length + 1 > sheet.getMaxRows())
      sheet.insertRowsAfter(
        sheet.getMaxRows(),
        rows[name].length + 1 - sheet.getMaxRows(),
      );
    if (rows[name].length)
      sheet.getRange(2, 1, rows[name].length, width).setValues(
        rows[name].map(function (row) {
          return row.map(safeCell_);
        }),
      );
  });
  SpreadsheetApp.flush();
  PropertiesService.getScriptProperties().deleteProperty("NPI_VIEW_DIRTY");
}
function syncSafely_(book, jobs) {
  try {
    syncViews_(book, jobs);
    return "";
  } catch (e) {
    PropertiesService.getScriptProperties().setProperty("NPI_VIEW_DIRTY", "1");
    return (
      "Your work record is saved, but a backend report tab could not refresh. Use NPI Alaska > Refresh backend tabs. " +
      e.message
    );
  }
}
function refreshNpiBackend() {
  var book = ownerBook_(),
    lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    syncViews_(book, sourceJobs_(workSheet_(book)));
    return "Backend tabs refreshed.";
  } finally {
    lock.releaseLock();
  }
}
function showNpiRecordStore() {
  var book = ownerBook_();
  workSheet_(book).showSheet();
}
function overview_(jobs) {
  var result = {
    total: jobs.length,
    assigned: 0,
    inProgress: 0,
    submitted: 0,
    approved: 0,
    corrections: 0,
  };
  var key = {
    Assigned: "assigned",
    "In progress": "inProgress",
    Submitted: "submitted",
    Approved: "approved",
    "Correction requested": "corrections",
  };
  jobs.forEach(function (j) {
    if (key[j.status]) result[key[j.status]]++;
  });
  return result;
}
function workspaceSettings_(book) {
  var sheet = book.getSheetByName("NPI_Settings"),
    result = { name: "NPI Alaska", support: "" };
  if (sheet && sheet.getLastRow() > 1)
    sheet
      .getRange(2, 1, sheet.getLastRow() - 1, 3)
      .getValues()
      .forEach(function (row) {
        if (
          row[0] === "Workspace name" &&
          typeof row[1] === "string" &&
          row[1].trim() &&
          row[1].length <= 60
        )
          result.name = row[1];
        if (
          row[0] === "Support contact" &&
          typeof row[1] === "string" &&
          row[1].length <= 200
        )
          result.support = row[1];
      });
  return result;
}
function saveWorkspaceSettings_(book, data) {
  var name = text_(data.name, "workspace name", 60);
  if (typeof data.support !== "string" || data.support.length > 200)
    throw new Error("Use a support contact of 200 characters or fewer.");
  var sheet = book.getSheetByName("NPI_Settings");
  checkView_(sheet, "NPI_Settings");
  var rows =
    sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues()
      : [];
  [
    ["Workspace name", name, "Displayed in app navigation"],
    [
      "Support contact",
      data.support.trim(),
      "Displayed for assignment questions",
    ],
  ].forEach(function (item) {
    var index = rows.findIndex(function (row) {
      return row[0] === item[0];
    });
    if (index < 0) {
      index = rows.length;
      rows.push(item);
    }
    sheet.getRange(index + 2, 1, 1, 3).setValues([item.map(safeCell_)]);
  });
  SpreadsheetApp.flush();
  return settings_(book);
}
function settings_(book) {
  return {
    owner: Session.getActiveUser().getEmail(),
    workspace: workspaceSettings_(book),
    access: "Owner-only Google account",
    companyLogin: "Not connected",
    accountType: "Company-issued usernames/passwords",
    tabs: Object.keys(NPI_VIEWS).map(function (name) {
      return {
        name: name,
        url:
          "https://docs.google.com/spreadsheets/d/" +
          book.getId() +
          "/edit#gid=" +
          book.getSheetByName(name).getSheetId(),
      };
    }),
  };
}
function appOutput_() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("NPI Alaska | Field operations")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}
function doGet() {
  try {
    var book = ownerBook_();
    workSheet_(book);
    return appOutput_();
  } catch (e) {
    return HtmlService.createHtmlOutput(
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font:16px Arial;background:#f3f6fa;color:#182b40;padding:40px"><h1>NPI Alaska</h1><h2>Open with the spreadsheet owner account</h2><p>In your bound Apps Script project, run <b>setupNpiTest</b> first. Add the HTML file named <b>Index</b>.</p><p>For a full-page preview, deploy as a Web app, execute as <b>Me</b>, and restrict access to <b>Only myself</b>. Keep the spreadsheet private.</p><p>If Google cannot identify the owner in this session, use the spreadsheet menu instead. Company worker logins are not connected yet.</p></body></html>',
    ).setTitle("NPI Alaska | Setup needed");
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("NPI Alaska")
    .addItem("Prepare / upgrade backend", "setupNpiTest")
    .addItem("Open app window", "openNpiTest")
    .addItem("Refresh backend tabs", "refreshNpiBackend")
    .addItem("Show record store", "showNpiRecordStore")
    .addToUi();
}
function ownerBook_() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) {
    var savedId = PropertiesService.getScriptProperties().getProperty(
      "NPI_TEST_SPREADSHEET_ID",
    );
    if (savedId) book = SpreadsheetApp.openById(savedId);
  }
  if (!book)
    throw new Error(
      "Open this script from Extensions > Apps Script in your test spreadsheet.",
    );
  var owner = DriveApp.getFileById(book.getId()).getOwner();
  var active = Session.getActiveUser().getEmail();
  var effective = Session.getEffectiveUser().getEmail();
  if (
    !owner ||
    !active ||
    !effective ||
    active.toLowerCase() !== owner.getEmail().toLowerCase() ||
    effective.toLowerCase() !== active.toLowerCase()
  ) {
    throw new Error(
      "This test is restricted to the spreadsheet owner. Open it using the Google account that owns this spreadsheet. Shared Drive files are not supported by this test.",
    );
  }
  return book;
}
function workSheet_(book) {
  var sheet = book.getSheetByName(NPI_TEST.sheet);
  if (!sheet) throw new Error("Run setupNpiTest first.");
  var actual = sheet.getRange(1, 1, 1, NPI_TEST.headers.length).getValues()[0];
  if (
    sheet.getLastColumn() !== NPI_TEST.headers.length ||
    actual.some(function (v, i) {
      return v !== NPI_TEST.headers[i];
    })
  ) {
    throw new Error(
      "NPI_Test_Work headers were changed. Restore the original headers before continuing.",
    );
  }
  if (sheet.getLastRow() - 1 > NPI_TEST.limit)
    throw new Error(
      "This test supports a maximum of 500 records. Use a new private test spreadsheet.",
    );
  return sheet;
}
function setupNpiTest() {
  var book = ownerBook_();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = book.getSheetByName(NPI_TEST.sheet);
    if (!sheet) sheet = book.insertSheet(NPI_TEST.sheet);
    if (!sheet.getLastRow()) {
      sheet
        .getRange(1, 1, 1, NPI_TEST.headers.length)
        .setValues([NPI_TEST.headers]);
      sheet.setFrozenRows(1);
      sheet
        .getRange(1, 1, 1, NPI_TEST.headers.length)
        .setBackground("#102c50")
        .setFontColor("#ffffff")
        .setFontWeight("bold");
    }
    workSheet_(book);
    PropertiesService.getScriptProperties().setProperty(
      "NPI_TEST_SPREADSHEET_ID",
      book.getId(),
    );
    prepareViews_(book);
    syncViews_(book, sourceJobs_(sheet));
    book.setActiveSheet(book.getSheetByName("NPI_WorkLogs"));
    sheet.hideSheet();
    return "Backend ready. Use NPI Alaska > Open app window, or deploy a private Web app for a full-page view.";
  } finally {
    lock.releaseLock();
  }
}
function openNpiTest() {
  var book = ownerBook_();
  workSheet_(book);
  SpreadsheetApp.getUi().showModalDialog(
    appOutput_().setWidth(1200).setHeight(820),
    "NPI Alaska — owner test",
  );
}
function text_(value, label, limit) {
  if (typeof value !== "string" || !value.trim() || value.length > limit)
    throw new Error(
      "Enter a valid " + label + " (maximum " + limit + " characters).",
    );
  return value.trim();
}
function safeCell_(value) {
  return typeof value === "string" && /^[=+@\-\t\r]/.test(value)
    ? "'" + value
    : value;
}
function json_(value) {
  return JSON.parse(value || "[]");
}
function rowJob_(row) {
  return {
    id: row[0],
    site: row[1],
    area: row[2],
    worker: row[3],
    equipment: row[4],
    status: row[5],
    start: row[6] instanceof Date ? row[6].toISOString() : row[6],
    end: row[7] instanceof Date ? row[7].toISOString() : row[7],
    tasks: json_(row[8]),
    notes: row[9] || "",
    loads: row[10] === "" ? "" : Number(row[10]),
    files: json_(row[11]),
    correction: row[12] || "",
    version: Number(row[13]),
    history: json_(row[14]),
  };
}
function jobRow_(j) {
  return [
    j.id,
    j.site,
    j.area,
    j.worker,
    j.equipment,
    j.status,
    j.start || "",
    j.end || "",
    JSON.stringify(j.tasks),
    j.notes,
    j.loads,
    JSON.stringify(j.files),
    j.correction,
    j.version,
    JSON.stringify(j.history),
  ].map(safeCell_);
}
function draft_(job, data) {
  if (data.tasks !== undefined) {
    if (
      !Array.isArray(data.tasks) ||
      data.tasks.length > 10 ||
      data.tasks.some(function (t) {
        return NPI_TEST.sites[job.site].indexOf(t) < 0;
      })
    )
      throw new Error("Choose valid completed tasks for this site.");
    job.tasks = data.tasks.filter(function (t, i, all) {
      return all.indexOf(t) === i;
    });
  }
  if (data.notes !== undefined) {
    if (typeof data.notes !== "string" || data.notes.length > 2000)
      throw new Error("Notes must be 2000 characters or fewer.");
    job.notes = data.notes;
  }
  if (data.loads !== undefined) {
    if (data.loads === "") job.loads = "";
    else {
      var count = Number(data.loads);
      if (!Number.isInteger(count) || count < 0 || count > 100000)
        throw new Error("Enter whole-number loads, zero or more.");
      job.loads = count;
    }
  }
}
function photoSignature_(bytes, type) {
  var b = bytes.map(function (v) {
    return (v + 256) % 256;
  });
  return type === "image/jpeg"
    ? b[0] === 255 && b[1] === 216 && b[2] === 255
    : type === "image/png"
      ? [137, 80, 78, 71, 13, 10, 26, 10].every(function (v, i) {
          return b[i] === v;
        })
      : type === "application/pdf" &&
        [37, 80, 68, 70, 45].every(function (v, i) {
          return b[i] === v;
        });
}
function attach_(job, data, requestId) {
  if (["photo", "timecard"].indexOf(data.kind) < 0)
    throw new Error("Select photo or timecard.");
  if (
    data.kind === "photo" &&
    job.files.filter(function (f) {
      return f.kind === "photo";
    }).length >= 6
  )
    throw new Error("Maximum 6 photos per job.");
  if (
    data.kind === "timecard" &&
    job.files.some(function (f) {
      return f.kind === "timecard";
    })
  )
    throw new Error("A timecard is already attached.");
  var types =
    data.kind === "photo"
      ? ["image/jpeg", "image/png"]
      : ["image/jpeg", "image/png", "application/pdf"];
  if (
    types.indexOf(data.type) < 0 ||
    typeof data.base64 !== "string" ||
    data.base64.length > Math.ceil(NPI_TEST.fileLimit / 3) * 4
  )
    throw new Error(
      "Use a JPEG/PNG photo, or JPEG/PNG/PDF timecard, up to 2 MB.",
    );
  var bytes = Utilities.base64Decode(data.base64);
  if (
    !bytes.length ||
    bytes.length > NPI_TEST.fileLimit ||
    !photoSignature_(bytes, data.type)
  )
    throw new Error(
      "The file contents do not match a supported file type or size.",
    );
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("NPI_TEST_FOLDER_ID");
  var folder = id
    ? DriveApp.getFolderById(id)
    : DriveApp.createFolder("NPI Alaska — private test evidence");
  if (
    folder.getSharingAccess() !== DriveApp.Access.PRIVATE ||
    folder.getEditors().length ||
    folder.getViewers().length
  )
    throw new Error(
      "The test evidence folder must remain private to its owner.",
    );
  if (!id) props.setProperty("NPI_TEST_FOLDER_ID", folder.getId());
  var name =
    job.id +
    "-" +
    requestId +
    "-" +
    String(data.name || "evidence")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-70);
  // Reuse an upload if a previous sheet write failed; never make files public.
  var previous = folder.getFilesByName(name);
  var file = previous.hasNext()
    ? previous.next()
    : folder.createFile(Utilities.newBlob(bytes, data.type, name));
  job.files.push({
    id: file.getId(),
    name: String(data.name || "Evidence").slice(0, 100),
    type: data.type,
    kind: data.kind,
  });
}
function listPage_(jobs, requestedPage) {
  var page = Math.max(
    0,
    Math.min(
      Math.floor(Number(requestedPage) || 0),
      Math.max(0, Math.ceil(jobs.length / 20) - 1),
    ),
  );
  return {
    jobs: jobs
      .slice()
      .reverse()
      .slice(page * 20, page * 20 + 20),
    total: jobs.length,
    page: page,
    sites: NPI_TEST.sites,
    summary: overview_(jobs),
    appVersion: "2",
  };
}
function npiTestApi(request) {
  var book = ownerBook_();
  if (!request || typeof request !== "object")
    throw new Error("Invalid request.");
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = workSheet_(book);
    if (
      PropertiesService.getScriptProperties().getProperty(
        "NPI_BACKEND_BOOK",
      ) !== book.getId()
    )
      throw new Error(
        "Run setupNpiTest again to prepare the new multi-tab backend.",
      );
    if (request.action === "settings") return settings_(book);
    if (request.action === "saveSettings")
      return saveWorkspaceSettings_(book, request.data || {});
    var rows =
      sheet.getLastRow() > 1
        ? sheet
            .getRange(2, 1, sheet.getLastRow() - 1, NPI_TEST.headers.length)
            .getValues()
        : [];
    var jobs = rows.map(rowJob_);
    if (request.action === "list") {
      var pageResult = listPage_(jobs, request.page);
      pageResult.backend = settings_(book);
      if (PropertiesService.getScriptProperties().getProperty("NPI_VIEW_DIRTY"))
        pageResult.warning = syncSafely_(book, jobs);
      return pageResult;
    }
    if (request.action === "readFile") {
      var parent = jobs.find(function (j) {
        return j.id === request.id;
      });
      var attachment =
        parent &&
        parent.files.find(function (f) {
          return f.id === request.fileId && f.kind === "photo";
        });
      if (!attachment) throw new Error("Photo not found in this test record.");
      var blob = DriveApp.getFileById(attachment.id).getBlob();
      if (blob.getBytes().length > NPI_TEST.fileLimit)
        throw new Error("Photo too large.");
      return {
        data:
          "data:" +
          attachment.type +
          ";base64," +
          Utilities.base64Encode(blob.getBytes()),
      };
    }
    var actions = [
      "create",
      "start",
      "save",
      "submit",
      "approve",
      "return",
      "upload",
    ];
    if (actions.indexOf(request.action) < 0) throw new Error("Unknown action.");
    var requestId = text_(request.requestId, "request ID", 80);
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId))
      throw new Error("Invalid request ID.");
    var duplicate = jobs.find(function (j) {
      return j.history.some(function (h) {
        return h.requestId === requestId;
      });
    });
    if (duplicate)
      return {
        job: duplicate,
        summary: overview_(jobs),
        list: request.action === "create" ? listPage_(jobs, 0) : null,
      };
    var data = request.data || {},
      now = new Date().toISOString(),
      index = -1,
      job;
    if (request.action === "create") {
      if (jobs.length >= NPI_TEST.limit)
        throw new Error("Test limit: 500 records.");
      if (!Object.prototype.hasOwnProperty.call(NPI_TEST.sites, data.site))
        throw new Error("Select a valid site.");
      job = {
        id: "AK-" + Utilities.getUuid(),
        site: data.site,
        area: text_(data.area, "work area", 120),
        worker: text_(data.worker, "worker name", 80),
        equipment: text_(data.equipment, "equipment", 80),
        status: "Assigned",
        start: "",
        end: "",
        tasks: [],
        notes: "",
        loads: "",
        files: [],
        correction: "",
        version: 1,
        history: [],
      };
    } else {
      index = jobs.findIndex(function (j) {
        return j.id === request.id;
      });
      if (index < 0)
        throw new Error("Work record not found. Refresh the list.");
      job = jobs[index];
      if (job.history.length >= 100)
        throw new Error(
          "This test record reached 100 changes. Create a new test record.",
        );
      if (Number(request.version) !== job.version)
        throw new Error("This record changed. Refresh it before saving again.");
      if (request.action === "start" && job.status === "Assigned") {
        job.status = "In progress";
        job.start = now;
      } else if (
        ["save", "submit", "upload"].indexOf(request.action) >= 0 &&
        ["In progress", "Correction requested"].indexOf(job.status) >= 0
      ) {
        if (request.action === "upload") attach_(job, data, requestId);
        else draft_(job, data);
        if (request.action === "submit") {
          if (!job.tasks.length)
            throw new Error("Select at least one completed task.");
          if (
            !job.files.some(function (f) {
              return f.kind === "photo";
            })
          )
            throw new Error("Add at least one work photo.");
          if (
            job.site === "Tote Port" &&
            (job.loads === "" ||
              !job.files.some(function (f) {
                return f.kind === "timecard";
              }))
          )
            throw new Error(
              "Port work requires completed loads and a signed timecard.",
            );
          job.status = "Submitted";
          job.end = job.end || now;
        }
      } else if (request.action === "approve" && job.status === "Submitted")
        job.status = "Approved";
      else if (request.action === "return" && job.status === "Submitted") {
        job.correction = text_(data.reason, "correction instructions", 1000);
        job.status = "Correction requested";
      } else
        throw new Error(
          "This action is not available for the current work status.",
        );
      job.version++;
    }
    if (job.history.length >= 100)
      throw new Error(
        "This test record reached 100 changes. Create a new test record.",
      );
    job.history.push({
      action: request.action,
      requestId: requestId,
      actor: Session.getActiveUser().getEmail(),
      at: now,
      reason: request.action === "return" ? job.correction : "",
    });
    var values = jobRow_(job);
    if (
      values.some(function (v) {
        return typeof v === "string" && v.length > 45000;
      })
    )
      throw new Error(
        "This test record is too large for a spreadsheet cell. Create a new test record.",
      );
    sheet
      .getRange(
        index < 0 ? sheet.getLastRow() + 1 : index + 2,
        1,
        1,
        NPI_TEST.headers.length,
      )
      .setValues([values]);
    SpreadsheetApp.flush();
    var currentJobs = index < 0 ? jobs.concat([job]) : jobs;
    var viewWarning = syncSafely_(book, currentJobs);
    return {
      job: job,
      summary: overview_(currentJobs),
      warning: viewWarning,
      list:
        request.action === "create" ? listPage_(jobs.concat([job]), 0) : null,
    };
  } finally {
    lock.releaseLock();
  }
}
