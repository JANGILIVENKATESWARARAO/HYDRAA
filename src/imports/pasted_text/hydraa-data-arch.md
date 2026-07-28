# HYDRAA – Excel-Based Data Architecture & UI Behavior

## Side Menu Hover Effects

The **HYDRAA side menu** should have a proper hover effect for **all interactive content**, including:

* Dashboard
* History
* Trends
* Settings
* Theme selector
* Collapse/Expand button
* Any other clickable menu items or controls

The hover state should be visually clear and consistent with the overall HYDRAA theme. The selected/active menu item should also have a distinct active state.

---

## Excel as the Primary Data Source

The **Excel file should be an integral part of the HYDRAA application architecture**.

The Excel file should exist inside the application's **assets folder** and act as the **single source of truth for all application data**.

There should be **no separate database** and no separate static/mock data source.

### Data Flow

The application should follow this flow:

**Excel File → Application → UI**

and

**User Changes → Application → Excel File**

All application data should be loaded from the Excel file when the application starts.

Any changes made by the user should be written back to the Excel file immediately or when the user clicks **Save Changes**, depending on the specific functionality.

When the application is reopened or refreshed, it should read the latest values from the Excel file and populate the UI accordingly.

---

## Export Excel

The application should provide an **Export Excel** button.

When the user clicks the **Export Excel** button:

* The current Excel file containing all application data should be downloaded.
* The downloaded file should contain the latest saved data.
* The downloaded file should maintain the same structure and data that the application is currently using.

The exported Excel file should essentially be a copy of the application's current Excel data source.

---

## Avoid Static Data

The application should **not maintain static data** for application settings or user-configurable values.

All configurable values should be loaded from and saved to Excel.

For example:

* Reminder interval
* Snooze duration options
* Daily water goal
* Current-day water goal
* Toggle states
* Notification settings
* Theme selection
* Volume settings
* Other user preferences
* Any future configurable application settings

These values should always be retrieved from Excel rather than being hardcoded in the application.

---

## Default Reminder Interval

The application should have a default reminder interval.

The reminder interval selected by the user should be stored in Excel.

For example:

* 30 minutes
* 45 minutes
* 60 minutes

If the user changes the reminder interval, the updated value should be saved to Excel.

When the application is opened again, the previously saved value should automatically be loaded and used as the current reminder interval.

---

## Snooze Duration

The default snooze duration options should initially be:

* 5 minutes
* 10 minutes
* 15 minutes
* 30 minutes

These default options should be stored in the Excel file.

If the user adds another option, for example:

* 5 minutes
* 10 minutes
* 15 minutes
* 30 minutes
* 20 minutes

The newly added **20-minute option should also be saved to Excel**.

The next time the application loads, it should retrieve the snooze options from Excel and display:

**5 | 10 | 15 | 30 | 20 minutes**

The application should not rely on a hardcoded list after the user has modified the values.

The same principle should apply to all configurable settings.

---

## Daily Water Goal

The default daily water goal should be:

**2,500 ml**

This default value should be stored in Excel.

If the user changes the daily water goal to:

**3,000 ml**

for the current day, the application should:

1. Update the dashboard immediately.
2. Reflect the new goal in the daily hydration progress.
3. Save the updated goal to Excel.
4. Ensure that the correct goal is displayed when the data is reloaded.

The application should support storing the water goal based on the appropriate date/context so that historical records are not incorrectly changed when the user updates the goal for a different day.

For example:

| Date        | Daily Water Goal |
| ----------- | ---------------: |
| 28-Jul-2026 |         2,500 ml |
| 29-Jul-2026 |         3,000 ml |

The dashboard should always use the applicable goal from Excel.

---

## Drink Types & Quantities

The **drink types and standard quantity options** can remain part of the application's static configuration because the application already provides the ability to manually enter a custom drink type or custom quantity when required.

Standard drink types may include:

* 💧 Water
* ☕ Coffee
* 🍵 Tea
* 🥤 Soda
* 🧃 Juice

Standard quantity options may include:

* 50 ml
* 100 ml
* 150 ml
* 200 ml
* 300 ml

However, any **user-added custom drink types or custom quantities** should be persisted in Excel and loaded from Excel on subsequent application sessions.

---

## Save Changes Behavior

When the user opens **Settings** and modifies any configurable value, clicking **Save Changes** should persist **all selected and updated values to Excel**.

This includes, but is not limited to:

* Reminder interval.
* Snooze duration options.
* Daily water goal.
* Selected/default snooze duration.
* Notification toggle states.
* Reminder enable/disable state.
* Theme selection.
* Volume settings.
* Any other toggle or preference available in Settings.

After clicking **Save Changes**:

**Settings UI → Save Changes → Excel**

When the application is opened again:

**Excel → Load Configuration → Populate Settings UI**

All previously saved values should be reflected automatically.

For example, if the user previously configured:

* Reminder interval: 45 minutes.
* Snooze options: 5, 10, 15, 30, 20 minutes.
* Daily water goal: 3,000 ml.
* Notifications: Enabled.
* Reminder sound: Disabled.
* Volume: 60%.
* Theme: Dark.

After reopening the application, all these values should automatically be populated from Excel.

The application should not revert to hardcoded defaults unless the Excel file does not contain the required configuration.

---

## Single Source of Truth

The overall HYDRAA architecture should follow the principle:

> **Excel is the single source of truth.**

All persistent application data should be:

**Read from Excel → Displayed in UI**

and:

**Updated in UI → Saved to Excel → Reflected throughout the application**

This should apply consistently across the entire application, including:

* Dashboard
* History
* Trends
* Settings
* Reminder system
* Drink recording
* Daily hydration goals
* Reminder configuration
* Snooze configuration
* User preferences
* Toggle states
* Theme settings
* Volume settings
* Custom user-defined values

There should be **no duplicate data sources, hardcoded user settings, or independent static configuration values** that can become inconsistent with the Excel data.
