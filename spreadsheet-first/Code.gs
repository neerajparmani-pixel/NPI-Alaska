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
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("NPI Alaska Test")
    .addItem("1. Prepare test sheet", "setupNpiTest")
    .addItem("2. Open app", "openNpiTest")
    .addToUi();
}
function ownerBook_() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
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
    return "Ready. Return to the spreadsheet and choose NPI Alaska Test > Open app.";
  } finally {
    lock.releaseLock();
  }
}
function openNpiTest() {
  var book = ownerBook_();
  workSheet_(book);
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutputFromFile("Index").setWidth(1100).setHeight(780),
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
    var rows =
      sheet.getLastRow() > 1
        ? sheet
            .getRange(2, 1, sheet.getLastRow() - 1, NPI_TEST.headers.length)
            .getValues()
        : [];
    var jobs = rows.map(rowJob_);
    if (request.action === "list") {
      return listPage_(jobs, request.page);
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
    return {
      job: job,
      list:
        request.action === "create" ? listPage_(jobs.concat([job]), 0) : null,
    };
  } finally {
    lock.releaseLock();
  }
}
