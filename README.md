# Global Health Metrics Dashboard

Interactive dashboard for exploring key global development indicators across countries using World Bank Open Data. Built with HTML, CSS, JavaScript, and Chart.js.

---

## Overview

This project is a data visualization dashboard that lets you explore and compare global health and development metrics over time.

You can:

- Select a **primary country**
- Optionally select a **comparison country**
- Choose between multiple **metrics** (life expectancy, GDP, mortality, population)
- Adjust the **time window** (last 10, 20, or 30 years)
- View **interactive charts**, **KPI cards**, and a **comparison table**

The goal is to show both **front end skills** and **data storytelling** in one project.

---

## Live Data Source

All data is loaded at runtime from the **World Bank Open Data API**:

- No hard coded CSV files
- Data is requested with `fetch` and handled asynchronously
- Simple cleaning and alignment logic applied before plotting

---

## Tech Stack

- **HTML5** – semantic layout and structure
- **CSS3** – custom responsive styling, dark theme dashboard look
- **JavaScript (ES6+)** – logic, data fetching, and interaction
- **Chart.js** – line, bar, and doughnut charts
- **World Bank Open Data API** – real world public data source

---

## Key Features

### 1. Multi metric support

Currently supported indicators:

- Life Expectancy at Birth (`SP.DYN.LE00.IN`)
- GDP (Current US Dollars) (`NY.GDP.MKTP.CD`)
- Mortality Rate (`SH.DYN.MORT`)
- Total Population (`SP.POP.TOTL`)

Each metric updates:

- Line chart
- Bar chart
- KPI cards
- Summary insight text
- Comparison table
- Pie snapshot

### 2. Country comparison

- Choose a **primary country**
- Optionally choose a **comparison country**
- When comparison is active:
  - Both lines appear on the time series chart
  - Both bars appear in the bar chart
  - The table shows differences (Δ and Δ%) per year
  - The pie chart compares the two countries in a selected year
  - The status text explains how far apart the countries are in the latest year

### 3. Time window control

- Choose between **last 10**, **20**, or **30** years
- All charts and tables instantly update to match the selected time range

### 4. Analytical widgets

- **KPI cards** show:
  - Latest value
  - Absolute change across the window
  - Percentage change across the window
- **Narrative summary**:
  - Simple trend description for the primary country
  - Uses first vs last year to describe increase, decrease, or stability
- **Comparison table**:
  - Year by year values
  - Difference between primary and comparison (or previous year when no comparison)
  - Difference as a percentage

### 5. Pie snapshot (compare mode)

- When comparison is enabled:
  - A dropdown lets you select any year in the current window
  - The doughnut chart shows the relative share of the metric for both countries in that year
- When comparison is disabled:
  - The doughnut chart switches to **start vs end** for the primary country

---


