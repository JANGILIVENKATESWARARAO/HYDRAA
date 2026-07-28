Here is the updated and consolidated requirement with the **Drink Now water quantity selection** added:

# Personal Hydration Tracking & Reminder Application

I want to create a **local web application** to track my daily water intake and hydration habits. The application will run locally on my computer, but the **water reminder popup/alert should appear on top of other applications**, regardless of which screen or application I am currently using.

## Core Requirements

* The application should allow me to **track my daily water intake**.
* I should be able to record:

  * How many times I drink water.
  * How much water I drink each time.
  * The exact time when I drink water.
* The application should track the **first water intake and last water intake** of the day.
* It should maintain a complete history of my daily hydration activity.

## Water Reminder

* The user should be able to configure a **default reminder interval** (for example, every 30 minutes, 45 minutes, or 1 hour).
* Based on the configured interval, the application should automatically show a **popup/notification reminder** asking me to drink water.
* The reminder should appear **regardless of which application or screen I am currently using**.
* The reminder popup should provide the following options:

### 1. Drink Now

When I select **Drink Now**, the popup should display predefined water quantity options:

* **50 ml**
* **100 ml**
* **150 ml**
* **200 ml**
* **300 ml**

I should be able to select the amount of water I have consumed. Once I select an amount:

* The selected water quantity should be automatically recorded.
* The application should record the **current date and exact time** of consumption.
* The selected amount should be added to my **total daily water intake**.
* The number of water intake occurrences should be updated.
* The **last drink time** should be updated.
* If it is the first drink of the day, the application should record it as the **first drink time**.
* The intake should be saved in the Excel file as a new hydration record.

### 2. Snooze

* The user should be able to **snooze the reminder** for a selected duration.
* The user should be able to configure the available snooze durations.
* The application should record the snooze action and snooze duration in the Excel file.
* After the snooze period expires, the reminder should appear again.

### 3. Skip

* The user should be able to **skip the current reminder** without recording any water intake.
* The application should record that the reminder was skipped.

## Dashboard

The application should have a dashboard that provides a summary of my hydration activity, including:

* Total water consumed today.
* Number of times I drank water today.
* Average amount consumed per drink.
* First drink time.
* Last drink time.
* Time since the last drink.
* Daily water intake progress.
* Daily water intake target.
* Actual water intake vs. daily target.
* Reminder history.
* Number of reminders completed.
* Number of reminders snoozed.
* Number of reminders skipped.
* Daily hydration trends.
* Weekly hydration trends.
* Monthly hydration trends.
* Historical water consumption data.

## Data Storage

There will be **no database** for this application.

All hydration data should be stored in an **Excel file**. The application should:

* Add new water intake records to the Excel file.
* Read and retrieve historical data from the Excel file.
* Maintain daily and historical hydration records.
* Use the Excel file as the **primary data source** for storing and retrieving all hydration-related information.

The application should store details such as:

* Date.
* Time.
* Amount of water consumed.
* Intake type/source, if required.
* Reminder status:

  * Drink Now
  * Snoozed
  * Skipped
* Snooze duration, if applicable.
* Daily total water intake.
* Daily water intake target, if required.

Each time I select a water quantity from the **Drink Now** popup (50 ml, 100 ml, 150 ml, 200 ml, or 300 ml), the application should create a new hydration record in the Excel file with the corresponding **date, exact time, and water quantity**.

## Key Objective

The main objective is to build a **personal hydration tracking and reminder application** that runs locally, continuously reminds me to drink water through **system-level popups**, tracks my water consumption and drinking times, and provides useful hydration insights through a dashboard.

The application should allow me to quickly record my water intake directly from the reminder popup by selecting **50 ml, 100 ml, 150 ml, 200 ml, or 300 ml**. The selected amount should immediately update the dashboard and be persisted in the Excel file along with the **exact date and time of consumption**.

All hydration and reminder data should be persisted in an **Excel file instead of a traditional database**, allowing the application to read and write historical hydration data whenever required.
