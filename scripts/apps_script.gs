// Apps Script Web App for HYDRAA
// This script accepts a POST containing JSON { xml: '<Workbook ...>' }
// It parses the workbook XML and overwrites the following sheets to match backup/HYDRAA.xls:
// - HYDRAA Log
// - Summary
// - HYDRAA Config
// - Daily Goals

var SPREADSHEET_ID = "1AA1bEa8v-qe6LFiwcc6l6pFsaJH1cfOHCgrTtakNVyA";

function createCorsTextOutput(text, mimeType) {
  return ContentService.createTextOutput(text).setMimeType(mimeType);
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "";
    if (!raw)
      return createCorsTextOutput(
        JSON.stringify({ ok: false, error: "no post data" }),
        ContentService.MimeType.JSON,
      );

    var payload;
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      payload = { xml: raw };
    }

    if (!payload || typeof payload !== "object") {
      payload = {};
    }

    if (!payload.state && e.parameter && e.parameter.payload) {
      try {
        payload = JSON.parse(e.parameter.payload);
      } catch (err) {
        payload = payload || {};
      }
    }

    if (payload && typeof payload === "object" && payload.state) {
      saveStateJsonToSheets(payload.state, payload.theme || "dark");
      return createCorsTextOutput(
        JSON.stringify({ ok: true }),
        ContentService.MimeType.JSON,
      );
    }

    var xml = payload.xml || "";
    if (!xml)
      return ContentService.createTextOutput(
        JSON.stringify({ ok: false, error: "no xml or state in payload" }),
      ).setMimeType(ContentService.MimeType.JSON);

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    var sheetsMap = parseWorkbookXml(xml);

    var expected = ["HYDRAA Log", "Summary", "HYDRAA Config", "Daily Goals"];

    expected.forEach(function (name) {
      var rows = sheetsMap[name] || [];
      var sheet = ss.getSheetByName(name);
      if (!sheet) sheet = ss.insertSheet(name);
      else sheet.clear();

      if (rows.length > 0) {
        var maxCols =
          rows.reduce(function (m, r) {
            return Math.max(m, r.length);
          }, 0) || 1;
        var norm = rows.map(function (r) {
          var copy = r.slice();
          while (copy.length < maxCols) copy.push("");
          return copy;
        });
        sheet.getRange(1, 1, norm.length, maxCols).setValues(norm);
      }
    });

    // update exported timestamp
    var cfg = ss.getSheetByName("HYDRAA Config");
    if (!cfg) cfg = ss.insertSheet("HYDRAA Config");
    var vals = cfg.getDataRange().getValues();
    var found = false;
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][0]).trim() === "Exported At") {
        cfg.getRange(i + 1, 2).setValue(new Date().toLocaleString());
        found = true;
        break;
      }
    }
    if (!found) cfg.appendRow(["Exported At", new Date().toLocaleString()]);

    return createCorsTextOutput(
      JSON.stringify({ ok: true }),
      ContentService.MimeType.JSON,
    );
  } catch (err) {
    Logger.log("doPost error: " + err);
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function saveStateJsonToSheets(state, theme) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var log = ss.getSheetByName("HYDRAA Log");
  if (!log) log = ss.insertSheet("HYDRAA Log");
  else log.clear();

  var header = [
    "Date",
    "Time",
    "Drink Type",
    "Amount (ml)",
    "Type",
    "Source",
    "Snooze (min)",
    "Water Total (ml)",
    "Daily Goal (ml)",
  ];
  var rows = [header];
  var stateRecords = state.records || [];
  var drinkMap = {
    water: "Water",
    coffee: "Coffee",
    tea: "Tea",
    soda: "Soda",
    juice: "Juice",
  };
  for (var i = 0; i < stateRecords.length; i++) {
    var record = stateRecords[i] || {};
    rows.push([
      record.date || "",
      record.time || "",
      drinkMap[record.drinkType] || "Water",
      Number(record.amount) || 0,
      record.type === "snooze"
        ? "Snoozed"
        : record.type === "skip"
          ? "Skipped"
          : "Drink",
      record.source === "reminder" ? "Reminder" : "Manual",
      Number(record.snoozeDuration) || "",
      Number(record.dailyWaterTotal) || 0,
      Number(record.dailyGoal) || "",
    ]);
  }
  if (rows.length > 0) {
    log.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  }

  var cfg = ss.getSheetByName("HYDRAA Config");
  if (!cfg) cfg = ss.insertSheet("HYDRAA Config");
  else cfg.clear();

  var configRows = [
    ["Daily Goal", Number(state.dailyGoal) || 2500],
    ["Reminder Interval", Number(state.reminderInterval) || 30],
    ["Snooze Durations", (state.snoozeDurations || []).join(",")],
    ["Reminder Enabled", state.reminderEnabled === false ? "false" : "true"],
    ["Sound Choice", state.soundChoice || "gentle"],
    ["Sound Volume", Number(state.soundVolume) || 0.7],
    ["Sound Enabled", state.soundEnabled === false ? "false" : "true"],
    ["Theme", theme],
    ["Exported At", new Date().toLocaleString()],
  ];
  cfg.getRange(1, 1, configRows.length, 2).setValues(configRows);

  var goals = ss.getSheetByName("Daily Goals");
  if (!goals) goals = ss.insertSheet("Daily Goals");
  else goals.clear();

  var goalRows = [["Date", "Goal (ml)"]];
  var stateGoals = (state.dailyGoals || []).slice().reverse();
  for (var j = 0; j < stateGoals.length; j++) {
    var goal = stateGoals[j] || {};
    goalRows.push([goal.date || "", Number(goal.goal) || 0]);
  }
  if (goalRows.length > 0) {
    goals.getRange(1, 1, goalRows.length, 2).setValues(goalRows);
  }
}

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === "getState") {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var result = getStateFromSheets(ss);
      return createCorsTextOutput(
        JSON.stringify({ ok: true, state: result.state, theme: result.theme }),
        ContentService.MimeType.JSON,
      );
    }

    if (e && e.parameter && e.parameter.action === "getAllCsv") {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var sheets = ss.getSheets();
      var sheetsData = {};
      sheets.forEach(function (sheet) {
        sheetsData[sheet.getName()] = sheet.getDataRange().getValues();
      });
      var xml = buildWorkbookXmlFromSheets(sheetsData);
      return createCorsTextOutput(xml, ContentService.MimeType.TEXT);
    }

    if (e && e.parameter && e.parameter.action === "getState") {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var result = getStateFromSheets(ss);
      return createCorsTextOutput(
        JSON.stringify({ ok: true, state: result.state, theme: result.theme }),
        ContentService.MimeType.JSON,
      );
    }

    if (e && e.parameter && e.parameter.action === "getXml") {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var sheets = ss.getSheets();
      var sheetsData = {};
      sheets.forEach(function (sheet) {
        sheetsData[sheet.getName()] = sheet.getDataRange().getValues();
      });
      var xml = buildWorkbookXmlFromSheets(sheetsData);
      return createCorsTextOutput(xml, ContentService.MimeType.TEXT);
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var cfg = ss.getSheetByName("HYDRAA Config");
    var exported = "";
    if (cfg) {
      var v = cfg.getDataRange().getValues();
      for (var r = 0; r < v.length; r++) {
        if (String(v[r][0]).trim() === "Exported At") {
          exported = String(v[r][1] || "");
          break;
        }
      }
    }
    return createCorsTextOutput(
      JSON.stringify({ ok: true, exportedAt: exported }),
      ContentService.MimeType.JSON,
    );
  } catch (err) {
    return createCorsTextOutput(
      JSON.stringify({ ok: false, error: String(err) }),
      ContentService.MimeType.JSON,
    );
  }
}

function getStateFromSheets(ss) {
  function getString(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function parseNumber(value, fallback) {
    var n = Number(value);
    return isNaN(n) ? fallback : n;
  }

  function parseBoolean(value, fallback) {
    if (value === null || value === undefined) return fallback;
    var text = String(value).trim().toLowerCase();
    if (text === "true") return true;
    if (text === "false") return false;
    return fallback;
  }

  function formatDate(value) {
    if (value instanceof Date) {
      return Utilities.formatDate(
        value,
        Session.getScriptTimeZone(),
        "yyyy-MM-dd",
      );
    }
    var text = getString(value);
    if (!text) return "";
    var parsed = new Date(text);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(
        parsed,
        Session.getScriptTimeZone(),
        "yyyy-MM-dd",
      );
    }
    return text;
  }

  function formatTime(value) {
    if (value instanceof Date) {
      return Utilities.formatDate(
        value,
        Session.getScriptTimeZone(),
        "HH:mm:ss",
      );
    }
    var text = getString(value);
    if (!text) return "";
    var parsed = new Date(text);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(
        parsed,
        Session.getScriptTimeZone(),
        "HH:mm:ss",
      );
    }
    // Try parsing as time-only input for formats like 11:00:00
    var asTimeOnly = new Date("1970-01-01T" + text);
    if (!isNaN(asTimeOnly.getTime())) {
      return Utilities.formatDate(
        asTimeOnly,
        Session.getScriptTimeZone(),
        "HH:mm:ss",
      );
    }
    return text;
  }

  var drinkMap = {
    Water: "water",
    Coffee: "coffee",
    Tea: "tea",
    Soda: "soda",
    Juice: "juice",
  };

  var state = {
    records: [],
    dailyGoal: 2500,
    dailyGoals: [],
    reminderInterval: 30,
    snoozeDurations: [5, 10, 15, 30],
    reminderEnabled: true,
    soundChoice: "gentle",
    soundVolume: 0.7,
    soundEnabled: true,
  };
  var theme = "dark";

  var logSheet = ss.getSheetByName("HYDRAA Log");
  if (logSheet) {
    var rows = logSheet.getDataRange().getValues();
    var records = [];
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      var date = formatDate(row[0]);
      var time = formatTime(row[1]);
      if (!date || !time) continue;
      var drinkLabel = getString(row[2]);
      var drinkType = drinkMap[drinkLabel] || "water";
      var amount = parseNumber(row[3], 0);
      var typeText = getString(row[4]).toLowerCase();
      var recordType =
        typeText === "snoozed" || typeText === "snooze"
          ? "snooze"
          : typeText === "skipped" || typeText === "skip"
            ? "skip"
            : "drink";
      var sourceText = getString(row[5]).toLowerCase();
      var source = sourceText === "reminder" ? "reminder" : "manual";
      var snoozeDuration = parseNumber(row[6], 0) || undefined;
      var dailyWaterTotal = parseNumber(row[7], 0);
      var logDailyGoal = parseNumber(row[8], state.dailyGoal);
      if (Number.isFinite(logDailyGoal) && logDailyGoal >= 0) {
        state.dailyGoal = logDailyGoal;
      }
      var timestamp = new Date(date + "T" + time).getTime();
      if (!Number.isFinite(timestamp)) {
        timestamp = Date.now() + i;
      }
      records.push({
        id: String(timestamp),
        date: date,
        time: time,
        timestamp: timestamp,
        amount: amount,
        drinkType: drinkType,
        type: recordType,
        source: source,
        snoozeDuration: snoozeDuration,
        dailyWaterTotal: dailyWaterTotal,
      });
    }
    records.sort(function (a, b) {
      return b.timestamp - a.timestamp;
    });
    state.records = records;
  }

  var cfgSheet = ss.getSheetByName("HYDRAA Config");
  if (cfgSheet) {
    var cfgRows = cfgSheet.getDataRange().getValues();
    for (var j = 1; j < cfgRows.length; j++) {
      var key = getString(cfgRows[j][0]);
      var value = cfgRows[j][1];
      if (!key) continue;
      if (key === "Daily Goal")
        state.dailyGoal = parseNumber(value, state.dailyGoal);
      if (key === "Reminder Interval")
        state.reminderInterval = parseNumber(value, state.reminderInterval);
      if (key === "Snooze Durations") {
        var parts = getString(value).split(",");
        var parsed = [];
        for (var k = 0; k < parts.length; k++) {
          var n = parseNumber(parts[k], NaN);
          if (Number.isFinite(n) && n > 0) parsed.push(n);
        }
        if (parsed.length) state.snoozeDurations = parsed;
      }
      if (key === "Reminder Enabled")
        state.reminderEnabled = parseBoolean(value, state.reminderEnabled);
      if (key === "Sound Choice" && getString(value))
        state.soundChoice = getString(value);
      if (key === "Sound Volume")
        state.soundVolume = parseNumber(value, state.soundVolume);
      if (key === "Sound Enabled")
        state.soundEnabled = parseBoolean(value, state.soundEnabled);
      if (key === "Theme") {
        var themeValue = getString(value).toLowerCase();
        if (themeValue === "light" || themeValue === "dark") theme = themeValue;
      }
    }
  }

  var goalsSheet = ss.getSheetByName("Daily Goals");
  if (goalsSheet) {
    var goalRows = goalsSheet.getDataRange().getValues();
    var dailyGoals = [];
    for (var m = 1; m < goalRows.length; m++) {
      var date = formatDate(goalRows[m][0]);
      var goal = parseNumber(goalRows[m][1], NaN);
      if (date && Number.isFinite(goal) && goal >= 0) {
        dailyGoals.push({ date: date, goal: goal });
      }
    }
    state.dailyGoals = dailyGoals;
  }

  return { state: state, theme: theme };
}

function buildWorkbookXmlFromSheets(sheetsData) {
  function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function cellXml(value) {
    var type = "String";
    var normalized = value;
    if (value instanceof Date) {
      type = "String";
      var formattedDate = Utilities.formatDate(
        value,
        Session.getScriptTimeZone(),
        "yyyy-MM-dd",
      );
      var formattedTime = Utilities.formatDate(
        value,
        Session.getScriptTimeZone(),
        "HH:mm:ss",
      );
      if (formattedDate === "1899-12-30") {
        normalized = formattedTime;
      } else if (formattedTime === "00:00:00") {
        normalized = formattedDate;
      } else {
        normalized = formattedDate + " " + formattedTime;
      }
    } else if (typeof value === "number") {
      type = "Number";
      normalized = value;
    } else if (
      typeof value === "string" &&
      value.trim() !== "" &&
      !isNaN(Number(value))
    ) {
      type = "Number";
      normalized = Number(value);
    }
    return (
      '<Cell><Data ss:Type="' + type + '">' + esc(normalized) + "</Data></Cell>"
    );
  }

  function rowXml(row, rowIndex, sheetName) {
    var isHeaderRow = rowIndex === 0 && sheetName !== "HYDRAA Config";
    return (
      "<Row>" +
      row
        .map(function (value) {
          var type = "String";
          var normalized = value;
          if (value instanceof Date) {
            type = "String";
            var formattedDate = Utilities.formatDate(
              value,
              Session.getScriptTimeZone(),
              "yyyy-MM-dd",
            );
            var formattedTime = Utilities.formatDate(
              value,
              Session.getScriptTimeZone(),
              "HH:mm:ss",
            );
            if (formattedDate === "1899-12-30") {
              normalized = formattedTime;
            } else if (formattedTime === "00:00:00") {
              normalized = formattedDate;
            } else {
              normalized = formattedDate + " " + formattedTime;
            }
          } else if (typeof value === "number") {
            type = "Number";
            normalized = value;
          } else if (
            typeof value === "string" &&
            value.trim() !== "" &&
            !isNaN(Number(value))
          ) {
            type = "Number";
            normalized = Number(value);
          }

          var styleAttr = isHeaderRow ? ' ss:StyleID="h"' : "";
          return (
            '<Cell' +
            styleAttr +
            '><Data ss:Type="' +
            type +
            '">' +
            esc(normalized) +
            "</Data></Cell>"
          );
        })
        .join("") +
      "</Row>"
    );
  }

  var sheetNames = Object.keys(sheetsData);
  var workbook = [];
  workbook.push(
    '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>',
  );
  workbook.push(
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
  );
  workbook.push("<Styles>");
  workbook.push(
    '<Style ss:ID="h"><Font ss:Bold="1" ss:Color="#000000"/><Interior ss:Color="#95B9F3" ss:Pattern="Solid"/></Style>',
  );
  workbook.push(
    '<Style ss:ID="s"><Font ss:Bold="1"/><Interior ss:Color="#E8F4FD" ss:Pattern="Solid"/></Style>',
  );
  workbook.push("</Styles>");

  sheetNames.forEach(function (sheetName) {
    var rows = sheetsData[sheetName] || [];
    workbook.push('<Worksheet ss:Name="' + esc(sheetName) + '"><Table>');
    rows.forEach(function (row, index) {
      workbook.push(rowXml(row, index, sheetName));
    });
    workbook.push("</Table></Worksheet>");
  });

  workbook.push("</Workbook>");
  return workbook.join("\n");
}

function parseWorkbookXml(xml) {
  var map = {};
  try {
    var doc = XmlService.parse(xml);
    var root = doc.getRootElement();

    var worksheets = [];
    (function walk(node) {
      if (!node) return;
      var nm = node.getName ? node.getName() : "";
      if (nm === "Worksheet" || nm === "WORKSHEET") worksheets.push(node);
      var ch = node.getChildren();
      for (var i = 0; i < ch.length; i++) walk(ch[i]);
    })(root);

    worksheets.forEach(function (ws) {
      var attrs = ws.getAttributes();
      var sheetName = "";
      for (var a = 0; a < attrs.length; a++) {
        var an = attrs[a].getName ? attrs[a].getName() : "";
        if (
          an === "Name" ||
          an === "ss:Name" ||
          (attrs[a].getLocalName && attrs[a].getLocalName() === "Name")
        ) {
          sheetName = attrs[a].getValue();
          break;
        }
      }
      if (!sheetName) sheetName = "Sheet";

      var table = null;
      var wsChildren = ws.getChildren();
      for (var j = 0; j < wsChildren.length; j++) {
        if (wsChildren[j].getName && wsChildren[j].getName() === "Table") {
          table = wsChildren[j];
          break;
        }
      }
      var rows = [];
      if (table) {
        var rowElems = table.getChildren();
        for (var ri = 0; ri < rowElems.length; ri++) {
          var rowEl = rowElems[ri];
          if (!rowEl.getName || rowEl.getName() !== "Row") continue;
          var cells = rowEl.getChildren();
          var row = [];
          for (var ci = 0; ci < cells.length; ci++) {
            var cell = cells[ci];
            var dataChild = null;
            var cellChildren = cell.getChildren();
            for (var k = 0; k < cellChildren.length; k++) {
              if (
                cellChildren[k].getName &&
                cellChildren[k].getName() === "Data"
              ) {
                dataChild = cellChildren[k];
                break;
              }
            }
            if (dataChild) row.push(String(dataChild.getText()));
            else row.push("");
          }
          rows.push(row);
        }
      }
      map[sheetName] = rows;
    });
  } catch (err) {
    Logger.log("parseWorkbookXml error: " + err);
  }
  return map;
}
