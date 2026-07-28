# HYDRAA – Persistent Excel-Based Data Management

## Critical Requirement: Data Must Persist After Refresh

Currently, when I refresh the browser, all values are reset to **0** and the application is not retaining any previously recorded data.

This needs to be fixed.

**HYDRAA must never rely on in-memory or temporary application state for persistent data.**

All user data, hydration records, settings, and configuration values must be stored in the application's Excel file and retrieved from that Excel file whenever the application loads.

### Required Data Flow

The application should follow this architecture:

**Excel File (Single Source of Truth)**
↓
**Application Loads Excel Data**
↓
**Application State / UI**
↓
**User Makes Changes**
↓
**Changes Are Saved to Excel**
↓
**Dashboard, History, Trends, and Settings Refresh from Updated Data**

When the browser is refreshed:

**Browser Refresh**
↓
**Application Loads Existing Excel File Automatically**
↓
**All Previously Saved Data Is Restored**
↓
**Dashboard, History, Trends, Settings, and Reminders Continue From Existing Data**

---

## Excel File Should Be Part of the Application

The Excel file should already exist as part of the HYDRAA application's architecture.

For example:

```text
HYDRAA
│
├── assets
│   └── data
│       └── hydraa_data.xlsx
│
├── src
│   ├── dashboard
│   ├── history
│   ├── trends
│   ├── settings
│   └── ...
│
└── ...
```

The application should automatically use this Excel file as its persistent data source.

There should be **no requirement for me to manually import the Excel file every time**.

The application already knows where the Excel file is located, so when HYDRAA starts or the browser is refreshed, it should automatically load the existing Excel file and populate the application.

### Expected Behavior

If the Excel file contains:

```text
Today's Water Intake: 1,500 ml
Number of Drinks: 8
First Drink: 08:30 AM
Last Drink: 04:45 PM
Daily Goal: 2,500 ml
Reminder Interval: 45 minutes
Theme: Dark
Notifications: Enabled
Volume: 60%
```

When I refresh the browser, the application should **not show**:

```text
Today's Water Intake: 0 ml
Number of Drinks: 0
First Drink: --
Last Drink: --
Daily Goal: 2,500 ml
```

Instead, it should read the existing Excel file and restore:

```text
Today's Water Intake: 1,500 ml
Number of Drinks: 8
First Drink: 08:30 AM
Last Drink: 04:45 PM
Daily Goal: 2,500 ml
Reminder Interval: 45 minutes
Theme: Dark
Notifications: Enabled
Volume: 60%
```

The application should continue working from the existing data.

---

## No Manual Import Required

A separate **Import Excel** button should not be required for the application's normal operation.

The Excel file is already part of the application, so HYDRAA should automatically:

1. Locate the Excel file.
2. Read the Excel file when the application starts.
3. Load all existing data.
4. Populate the Dashboard.
5. Populate History.
6. Populate Trends.
7. Populate Settings.
8. Restore reminder configuration.
9. Restore user preferences.
10. Continue tracking new data from the existing records.

The user should only need an **Export/Download Excel** button to download a copy of the current data when required.

---

## Everything Must Be Persisted

The following data must be stored in Excel and retrieved from Excel:

### Hydration Records

* Record ID.
* Drink type.
* Drink quantity.
* Date.
* Time.
* Reminder-related information.
* Whether the drink was recorded from a reminder or manually.
* Any other relevant drink information.

### Reminder Records

* Reminder date.
* Reminder time.
* Reminder status.
* Completed.
* Snoozed.
* Skipped.
* Snooze duration.
* Related drink record, if applicable.

### Application Settings

* Reminder interval.
* Snooze duration options.
* Selected/default snooze duration.
* Daily water goal.
* Daily goal by date, where applicable.
* Notification toggle.
* Reminder enable/disable state.
* Sound enable/disable state.
* Volume level.
* Theme selection.
* Any other configurable setting.

### User-Defined Values

If the user adds or modifies any configurable value, it should be saved to Excel.

For example, if the default snooze options are:

```text
5, 10, 15, 30 minutes
```

and the user adds:

```text
20 minutes
```

The updated configuration should be saved to Excel.

After refreshing the browser, the application should load:

```text
5, 10, 15, 30, 20 minutes
```

The same behavior should apply to all other user-configurable values.

---

## Dashboard Must Be Calculated From Excel Data

The Dashboard should **not maintain separate counters or temporary values**.

For example, the following values:

* Total Water Consumed.
* Number of Drinks.
* Average Drink Amount.
* First Drink Time.
* Last Drink Time.
* Time Since Last Drink.
* Daily Goal Progress.
* Reminder Completed Count.
* Reminder Snoozed Count.
* Reminder Skipped Count.

should be calculated from the actual records stored in Excel.

For example:

```text
Excel Drink Records
        ↓
Read Records
        ↓
Filter by Selected Date
        ↓
Calculate Metrics
        ↓
Display Dashboard
```

This ensures that the Dashboard always represents the actual data stored in the Excel file.

---

## History and Trends Must Also Use Excel

The **History** page should display records directly from the Excel data.

The **Trends** page should calculate daily, weekly, and monthly trends based on historical records from Excel.

For example:

```text
Excel
│
├── 28-Jul-2026 → 1,500 ml
├── 29-Jul-2026 → 2,100 ml
├── 30-Jul-2026 → 2,500 ml
└── 31-Jul-2026 → 1,900 ml
        ↓
   Trends Calculation
        ↓
   Charts & Graphs
```

If a record is added, edited, or deleted, the Dashboard, History, and Trends should all reflect the updated Excel data.

---

## Refresh and Application Restart Behavior

The following scenarios must preserve all data:

### Browser Refresh

```text
User Records 1,500 ml
        ↓
Saved to Excel
        ↓
Browser Refresh
        ↓
Excel Loaded Automatically
        ↓
Dashboard Shows 1,500 ml
```

### Browser Close and Reopen

```text
User Records Drinks
        ↓
Data Saved to Excel
        ↓
Browser Closed
        ↓
Browser Reopened
        ↓
Excel Loaded Automatically
        ↓
Previous Data Restored
```

### Application Restart

```text
HYDRAA Closed
        ↓
Excel Remains Unchanged
        ↓
HYDRAA Started Again
        ↓
Excel Automatically Loaded
        ↓
Previous Data Restored
```

---

## Important Architecture Principle

**Excel is the permanent source of truth for HYDRAA.**

There should be no situation where:

> "The data is available only in the browser memory and disappears after refresh."

Instead:

> **Every persistent change must be written to Excel, and every application startup/refresh must load the latest data from Excel.**

The application should behave as if the Excel file is the **local data store/database** for HYDRAA.

The user should not have to manually import the file because the Excel file is already part of the application's local data architecture.

The only user-facing file operation required should be:

**Export / Download Excel**

which downloads the current Excel data file for backup or external use.
