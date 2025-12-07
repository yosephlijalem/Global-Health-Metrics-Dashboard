// DOM elements
const countrySelect = document.getElementById("countrySelect");
const metricSelect = document.getElementById("metricSelect");
const windowSelect = document.getElementById("windowSelect");
const compareSelect = document.getElementById("compareSelect");
const pieYearSelect = document.getElementById("pieYearSelect");
const insightText = document.getElementById("insightText");
const statusMessage = document.getElementById("statusMessage");
const chartCanvas = document.getElementById("healthChart");
const barCanvas = document.getElementById("barChart");
const pieCanvas = document.getElementById("pieChart");
const metricDescription = document.getElementById("metricDescription");

// KPI elements
const kpiCurrent = document.getElementById("kpiCurrent");
const kpiAbsolute = document.getElementById("kpiAbsolute");
const kpiPercent = document.getElementById("kpiPercent");

// Table elements
const dataTableBody = document.getElementById("dataTableBody");
const primaryHeader = document.getElementById("primaryHeader");
const compareHeader = document.getElementById("compareHeader");
const deltaHeader = document.getElementById("deltaHeader");
const deltaPctHeader = document.getElementById("deltaPctHeader");

// Global Chart instances
let lineChart = null;
let barChart = null;
let pieChart = null;

// Metric descriptions
const metricInfo = {
    "SP.DYN.LE00.IN": "Life expectancy at birth (years) estimates the average number of years a newborn would live if current mortality patterns remain constant.",
    "NY.GDP.MKTP.CD": "Gross domestic product (GDP) in current US dollars measures the total market value of all goods and services produced within a country in a given year.",
    "SH.DYN.MORT": "Mortality rate indicator from the World Bank. For many countries this reflects under-five mortality (deaths per 1,000 live births).",
    "SP.POP.TOTL": "Total population based on the de facto definition of population, counting all residents regardless of legal status or citizenship."
};

/**
 * Center text plugin for the donut pie chart
 */
const centerTextPlugin = {
    id: "centerText",
    afterDraw(chart, args, pluginOptions) {
        const text = pluginOptions && pluginOptions.text;
        if (!text) return;

        const { ctx, chartArea } = chart;
        if (!chartArea) return;

        const x = (chartArea.left + chartArea.right) / 2;
        const y = (chartArea.top + chartArea.bottom) / 2;

        ctx.save();
        ctx.fillStyle = pluginOptions.color || "#e5e7eb";
        ctx.font = (pluginOptions.fontSize || 14) + "px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI'";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x, y);
        ctx.restore();
    }
};

Chart.register(centerTextPlugin);

/**
 * Update the text under "Metric Details" when metric changes
 */
function updateMetricDescription() {
    const metric = metricSelect.value;
    const description =
        metricInfo[metric] ||
        "This indicator describes the evolution of the selected metric for the chosen country over time.";
    metricDescription.textContent = description;
}

/**
 * Format values nicely based on the metric type
 */
function formatValue(metric, value) {
    if (value === null || value === undefined || isNaN(value)) {
        return "N/A";
    }

    // GDP or Population -> K, M, B, T
    if (metric === "NY.GDP.MKTP.CD" || metric === "SP.POP.TOTL") {
        const abs = Math.abs(value);
        if (abs >= 1e12) {
            return (value / 1e12).toFixed(2) + " T";
        } else if (abs >= 1e9) {
            return (value / 1e9).toFixed(2) + " B";
        } else if (abs >= 1e6) {
            return (value / 1e6).toFixed(2) + " M";
        } else if (abs >= 1e3) {
            return (value / 1e3).toFixed(2) + " K";
        }
        return value.toFixed(2);
    }

    // Other metrics (like life expectancy, mortality)
    return value.toFixed(2);
}

/**
 * Pulse animation helper for KPIs
 */
function pulseElement(el) {
    if (!el) return;
    el.classList.remove("kpi-pulse");
    void el.offsetWidth; // restart animation
    el.classList.add("kpi-pulse");
}

/**
 * Update KPI cards based on the current window of values (primary country only)
 */
function updateKpis(values, metric) {
    kpiAbsolute.classList.remove("kpi-positive", "kpi-negative");
    kpiPercent.classList.remove("kpi-positive", "kpi-negative");

    if (!values || values.length === 0) {
        kpiCurrent.textContent = "–";
        kpiAbsolute.textContent = "–";
        kpiPercent.textContent = "–";
        return;
    }

    const first = values[0];
    const last = values[values.length - 1];
    const absChange = last - first;
    const pctChange = first === 0 ? null : (absChange / first) * 100;

    // Current value
    kpiCurrent.textContent = formatValue(metric, last);
    pulseElement(kpiCurrent);

    // Absolute change
    let absText = formatValue(metric, absChange);
    if (absChange > 0) {
        absText = "+" + absText;
        kpiAbsolute.classList.add("kpi-positive");
    } else if (absChange < 0) {
        kpiAbsolute.classList.add("kpi-negative");
    }
    kpiAbsolute.textContent = absText;
    pulseElement(kpiAbsolute);

    // Percent change
    if (pctChange === null || !isFinite(pctChange)) {
        kpiPercent.textContent = "N/A";
    } else {
        let pctText = pctChange.toFixed(2) + "%";
        if (pctChange > 0) {
            pctText = "+" + pctText;
            kpiPercent.classList.add("kpi-positive");
        } else if (pctChange < 0) {
            kpiPercent.classList.add("kpi-negative");
        }
        kpiPercent.textContent = pctText;
    }
    pulseElement(kpiPercent);
}

/**
 * Update pie year select options based on current plot years
 */
function updatePieYearOptions(plotYears, hasCompare) {
    if (!pieYearSelect) return;

    const prevValue = pieYearSelect.value || "latest";

    // Clear existing options
    pieYearSelect.innerHTML = "";

    const latestOpt = document.createElement("option");
    latestOpt.value = "latest";
    latestOpt.textContent = "Latest year";
    pieYearSelect.appendChild(latestOpt);

    plotYears.forEach((year) => {
        const opt = document.createElement("option");
        opt.value = year;
        opt.textContent = `Year ${year}`;
        pieYearSelect.appendChild(opt);
    });

    // Restore previous selection if still valid
    const values = Array.from(pieYearSelect.options).map(o => o.value);
    if (prevValue && values.includes(prevValue)) {
        pieYearSelect.value = prevValue;
    } else {
        pieYearSelect.value = "latest";
    }

    // Enable only when compare is active
    pieYearSelect.disabled = !hasCompare;
}

/**
 * Update the data table (primary vs optional compare)
 * - If compare active: Δ = primary - compare; Δ% = vs compare
 * - If no compare: Δ = vs previous year; Δ% = vs previous year
 */
function updateTable(years, primaryValues, metric, compareValues, primaryLabel, compareLabel) {
    if (!dataTableBody) return;

    dataTableBody.innerHTML = "";

    const hasCompare =
        Array.isArray(compareValues) &&
        compareValues.length === years.length &&
        compareValues.some(v => v !== null && v !== undefined) &&
        !!compareLabel;

    if (!years.length || !primaryValues.length) {
        if (primaryHeader) primaryHeader.textContent = "Value";
        if (compareHeader) compareHeader.style.display = "none";
        if (deltaHeader) deltaHeader.textContent = "Δ";
        if (deltaPctHeader) deltaPctHeader.textContent = "Δ%";

        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 5;
        cell.textContent = "No data available for this selection.";
        row.appendChild(cell);
        dataTableBody.appendChild(row);
        return;
    }

    // Headers
    if (primaryHeader) {
        primaryHeader.textContent = primaryLabel ? `Primary – ${primaryLabel}` : "Primary";
    }

    if (compareHeader) {
        if (hasCompare) {
            compareHeader.style.display = "table-cell";
            compareHeader.textContent = `Compare – ${compareLabel}`;
        } else {
            compareHeader.style.display = "none";
        }
    }

    if (deltaHeader && deltaPctHeader) {
        if (hasCompare) {
            deltaHeader.textContent = "Δ (Primary - Compare)";
            deltaPctHeader.textContent = "Δ% vs Compare";
        } else {
            deltaHeader.textContent = "Δ vs Prev Year";
            deltaPctHeader.textContent = "Δ% vs Prev Year";
        }
    }

    // Build rows (most recent first)
    for (let i = years.length - 1; i >= 0; i--) {
        const row = document.createElement("tr");

        const yearCell = document.createElement("td");
        const primaryCell = document.createElement("td");
        const compareCell = document.createElement("td");
        const deltaCell = document.createElement("td");
        const deltaPctCell = document.createElement("td");

        yearCell.textContent = years[i];
        primaryCell.textContent = formatValue(metric, primaryValues[i]);

        let diff = null;
        let diffPct = null;

        if (hasCompare) {
            const cVal = compareValues[i];
            if (cVal !== null && cVal !== undefined) {
                compareCell.textContent = formatValue(metric, cVal);
            } else {
                compareCell.textContent = "N/A";
            }

            const pVal = primaryValues[i];
            if (
                pVal !== null &&
                pVal !== undefined &&
                cVal !== null &&
                cVal !== undefined &&
                cVal !== 0
            ) {
                diff = pVal - cVal;
                diffPct = (diff / cVal) * 100;
            }
        } else {
            // No compare: Δ vs previous year
            compareCell.style.display = "none";
            const prevIndex = i - 1;
            const currentVal = primaryValues[i];
            const prevVal =
                prevIndex >= 0 ? primaryValues[prevIndex] : null;

            if (
                prevVal !== null &&
                prevVal !== undefined &&
                currentVal !== null &&
                currentVal !== undefined
            ) {
                diff = currentVal - prevVal;
                if (prevVal !== 0) {
                    diffPct = (diff / prevVal) * 100;
                }
            }
        }

        deltaCell.classList.add("delta-cell");
        deltaPctCell.classList.add("delta-cell");

        if (diff === null || !isFinite(diff)) {
            deltaCell.textContent = "–";
            deltaPctCell.textContent = "–";
        } else {
            const formattedDiff = formatValue(metric, diff);
            if (diff > 0) {
                deltaCell.textContent = "▲ " + formattedDiff;
                deltaCell.classList.add("delta-positive");
            } else if (diff < 0) {
                deltaCell.textContent = "▼ " + formattedDiff;
                deltaCell.classList.add("delta-negative");
            } else {
                deltaCell.textContent = formattedDiff;
            }

            if (diffPct === null || !isFinite(diffPct)) {
                deltaPctCell.textContent = "–";
            } else {
                const pctText = diffPct.toFixed(2) + "%";
                if (diffPct > 0) {
                    deltaPctCell.textContent = "▲ " + pctText;
                    deltaPctCell.classList.add("delta-positive");
                } else if (diffPct < 0) {
                    deltaPctCell.textContent = "▼ " + pctText;
                    deltaPctCell.classList.add("delta-negative");
                } else {
                    deltaPctCell.textContent = pctText;
                }
            }
        }

        row.appendChild(yearCell);
        row.appendChild(primaryCell);

        if (hasCompare) {
            row.appendChild(compareCell);
        } else {
            compareCell.style.display = "none";
            row.appendChild(compareCell);
        }

        row.appendChild(deltaCell);
        row.appendChild(deltaPctCell);

        dataTableBody.appendChild(row);
    }
}

/**
 * Fetch indicator data from World Bank API
 */
async function fetchData(country, metric) {
    const url = `https://api.worldbank.org/v2/country/${country}/indicator/${metric}?format=json&per_page=80`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Network response was not ok");
    }

    const data = await response.json();

    const entries = (data && data[1]) ? data[1] : [];

    // Filter out null values and sort by year ascending
    const cleaned = entries
        .filter(item => item.value !== null)
        .sort((a, b) => Number(a.date) - Number(b.date));

    const years = cleaned.map(item => item.date);
    const values = cleaned.map(item => item.value);

    return { years, values };
}

/**
 * Generate a simple, human-readable insight based on values (primary only)
 */
function generateInsight(values, years, countryLabel, metricLabel, metric) {
    if (!values || values.length === 0) {
        insightText.textContent = "No data available to summarize.";
        return;
    }

    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const firstYear = years[0];
    const lastYear = years[years.length - 1];

    let trend;

    if (lastValue > firstValue * 1.05) {
        trend = "an overall increase";
    } else if (lastValue < firstValue * 0.95) {
        trend = "an overall decrease";
    } else {
        trend = "relative stability";
    }

    const formattedStart = formatValue(metric, firstValue);
    const formattedEnd = formatValue(metric, lastValue);

    insightText.textContent = `${metricLabel} in ${countryLabel} shows ${trend} between ${firstYear} and ${lastYear}, moving from approximately ${formattedStart} to ${formattedEnd}.`;
}

/**
 * Build or update all charts + KPIs + table
 */
async function updateDashboard() {
    const primaryCode = countrySelect.value;
    const metric = metricSelect.value;
    const metricLabel = metricSelect.options[metricSelect.selectedIndex].text;
    const primaryLabel = countrySelect.options[countrySelect.selectedIndex].text;
    const windowSize = Number(windowSelect.value);

    const compareCodeRaw = compareSelect.value;
    const compareActive = compareCodeRaw && compareCodeRaw !== primaryCode;
    const compareCode = compareActive ? compareCodeRaw : null;
    const compareLabel = compareCode
        ? compareSelect.options[compareSelect.selectedIndex].text
        : null;

    statusMessage.textContent = "Loading data…";
    statusMessage.style.color = "#9ca3af";

    try {
        let primaryData;
        let compareData = null;

        if (compareCode) {
            [primaryData, compareData] = await Promise.all([
                fetchData(primaryCode, metric),
                fetchData(compareCode, metric)
            ]);
        } else {
            primaryData = await fetchData(primaryCode, metric);
        }

        const years = primaryData.years;
        const values = primaryData.values;

        if (!years.length || !values.length) {
            if (lineChart) lineChart.destroy();
            if (barChart) barChart.destroy();
            if (pieChart) pieChart.destroy();
            lineChart = barChart = pieChart = null;

            statusMessage.textContent = "No recent data available for this selection.";
            statusMessage.style.color = "#f97373";
            insightText.textContent = "The World Bank API did not return enough valid data points for this country and metric.";
            updateKpis([], metric);
            updateTable([], [], metric, null, primaryLabel, compareLabel);
            if (pieYearSelect) pieYearSelect.disabled = true;
            return;
        }

        // Apply time window on primary
        let plotYears = years;
        let plotPrimaryValues = values;
        if (plotYears.length > windowSize) {
            const startIndex = plotYears.length - windowSize;
            plotYears = plotYears.slice(startIndex);
            plotPrimaryValues = plotPrimaryValues.slice(startIndex);
        }

        // Align compare data to primary years
        let plotCompareValues = null;
        if (compareCode && compareData && compareData.years.length) {
            const yearToValue = new Map();
            compareData.years.forEach((y, idx) => {
                yearToValue.set(y, compareData.values[idx]);
            });
            plotCompareValues = plotYears.map(y =>
                yearToValue.has(y) ? yearToValue.get(y) : null
            );
        }

        const hasCompare = !!(plotCompareValues && compareLabel);

        // Update pie year dropdown based on current years and compare mode
        updatePieYearOptions(plotYears, hasCompare);

        // Destroy old charts
        if (lineChart) lineChart.destroy();
        if (barChart) barChart.destroy();
        if (pieChart) pieChart.destroy();

        // ----- LINE CHART -----
        const lineDatasets = [
            {
                label: `${metricLabel} – ${primaryLabel}`,
                data: plotPrimaryValues,
                borderColor: "#6366f1",
                backgroundColor: "rgba(99, 102, 241, 0.18)",
                borderWidth: 2,
                tension: 0.28,
                pointRadius: 2.5,
                pointHoverRadius: 4
            }
        ];

        if (hasCompare) {
            lineDatasets.push({
                label: `${metricLabel} – ${compareLabel}`,
                data: plotCompareValues,
                borderColor: "#22c55e",
                backgroundColor: "rgba(34, 197, 94, 0.22)",
                borderWidth: 2,
                tension: 0.28,
                pointRadius: 2.5,
                pointHoverRadius: 4
            });
        }

        lineChart = new Chart(chartCanvas, {
            type: "line",
            data: {
                labels: plotYears,
                datasets: lineDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: "Year",
                            color: "#9ca3af"
                        },
                        ticks: {
                            color: "#9ca3af",
                            maxTicksLimit: 10
                        },
                        grid: {
                            color: "rgba(55, 65, 81, 0.5)"
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: metricLabel,
                            color: "#9ca3af"
                        },
                        beginAtZero: false,
                        ticks: {
                            color: "#9ca3af",
                            callback: (value) => formatValue(metric, value)
                        },
                        grid: {
                            color: "rgba(55, 65, 81, 0.5)"
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: "#e5e7eb"
                        }
                    },
                    tooltip: {
                        mode: "index",
                        intersect: false,
                        callbacks: {
                            label: (ctx) => {
                                const v = ctx.parsed.y;
                                return `${ctx.dataset.label}: ${formatValue(metric, v)}`;
                            }
                        }
                    }
                }
            }
        });

        // ----- BAR CHART -----
        const barDatasets = [
            {
                label: `${metricLabel} – ${primaryLabel}`,
                data: plotPrimaryValues,
                backgroundColor: "rgba(236, 72, 153, 0.75)",
                borderRadius: 4
            }
        ];

        if (hasCompare) {
            barDatasets.push({
                label: `${metricLabel} – ${compareLabel}`,
                data: plotCompareValues,
                backgroundColor: "rgba(56, 189, 248, 0.85)",
                borderRadius: 4
            });
        }

        barChart = new Chart(barCanvas, {
            type: "bar",
            data: {
                labels: plotYears,
                datasets: barDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: "Year",
                            color: "#9ca3af"
                        },
                        ticks: {
                            color: "#9ca3af",
                            maxTicksLimit: 10
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: metricLabel,
                            color: "#9ca3af"
                        },
                        beginAtZero: false,
                        ticks: {
                            color: "#9ca3af",
                            callback: (value) => formatValue(metric, value)
                        },
                        grid: {
                            color: "rgba(55, 65, 81, 0.5)"
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: hasCompare,
                        labels: {
                            color: "#e5e7eb"
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const v = ctx.parsed.y;
                                return `${ctx.dataset.label}: ${formatValue(metric, v)}`;
                            }
                        }
                    }
                }
            }
        });

        // ----- PIE / DONUT CHART -----
        let pieLabels = [];
        let pieValues = [];
        let centerText = "";

        // Determine snapshot mode for pie
        let snapshotMode = "latest";
        let snapshotYear = null;
        if (pieYearSelect && !pieYearSelect.disabled) {
            const v = pieYearSelect.value;
            if (v && v !== "latest") {
                snapshotMode = "specific";
                snapshotYear = v;
            }
        }

        if (hasCompare) {
            // Primary vs Compare for selected (or latest) year
            let index;
            if (snapshotMode === "latest") {
                index = plotYears.length - 1;
            } else {
                index = plotYears.indexOf(snapshotYear);
                if (index === -1) index = plotYears.length - 1;
            }

            const year = plotYears[index];
            const pVal = plotPrimaryValues[index];
            const cVal = plotCompareValues[index];

            pieLabels = [primaryLabel, compareLabel];
            pieValues = [
                typeof pVal === "number" && isFinite(pVal) ? pVal : 0,
                typeof cVal === "number" && isFinite(cVal) ? cVal : 0
            ];
            centerText = year;
        } else {
            // No compare: start vs end of window (primary)
            const firstYear = plotYears[0];
            const lastYear = plotYears[plotYears.length - 1];
            const firstVal = plotPrimaryValues[0];
            const lastVal = plotPrimaryValues[plotPrimaryValues.length - 1];

            pieLabels = [String(firstYear), String(lastYear)];
            pieValues = [
                typeof firstVal === "number" && isFinite(firstVal) ? firstVal : 0,
                typeof lastVal === "number" && isFinite(lastVal) ? lastVal : 0
            ];
            centerText = "Start vs End";
        }

        pieChart = new Chart(pieCanvas, {
            type: "doughnut",
            data: {
                labels: pieLabels,
                datasets: [
                    {
                        data: pieValues,
                        backgroundColor: hasCompare
                            ? ["rgba(99, 102, 241, 0.85)", "rgba(56, 189, 248, 0.85)"]
                            : ["rgba(99, 102, 241, 0.85)", "rgba(236, 72, 153, 0.85)"],
                        borderWidth: 0
                    }
                ]
            },
            options: {
                cutout: "60%",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            color: "#e5e7eb"
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const label = ctx.label || "";
                                const v = ctx.parsed;
                                return `${label}: ${formatValue(metric, v)}`;
                            }
                        }
                    },
                    centerText: {
                        text: centerText,
                        fontSize: 14,
                        color: "#e5e7eb"
                    }
                }
            }
        });

        // ----- TEXT + TABLE + KPIs -----
        generateInsight(plotPrimaryValues, plotYears, primaryLabel, metricLabel, metric);
        updateKpis(plotPrimaryValues, metric);
        updateTable(plotYears, plotPrimaryValues, metric, plotCompareValues, primaryLabel, compareLabel);

        // Status message with extra comparison analytics
        if (hasCompare) {
            const lastIndex = plotYears.length - 1;
            const pLast = plotPrimaryValues[lastIndex];
            const cLast = plotCompareValues[lastIndex];

            let extra = "";
            if (
                typeof pLast === "number" &&
                typeof cLast === "number" &&
                isFinite(pLast) &&
                isFinite(cLast) &&
                cLast !== 0
            ) {
                const relPct = ((pLast - cLast) / cLast) * 100;
                const relText = Math.abs(relPct).toFixed(1) + "%";
                if (relPct > 0) {
                    extra = ` Latest year: ${primaryLabel} is about ${relText} higher than ${compareLabel}.`;
                } else if (relPct < 0) {
                    extra = ` Latest year: ${primaryLabel} is about ${relText} lower than ${compareLabel}.`;
                } else {
                    extra = ` Latest year: values are approximately equal.`;
                }
            }

            statusMessage.textContent = `Showing ${metricLabel.toLowerCase()} for ${primaryLabel} vs ${compareLabel} (last ${windowSize} years).` + extra;
        } else {
            statusMessage.textContent = `Showing ${metricLabel.toLowerCase()} for ${primaryLabel} (last ${windowSize} years).`;
        }
        statusMessage.style.color = "#4ade80";
    } catch (error) {
        console.error(error);

        if (lineChart) lineChart.destroy();
        if (barChart) barChart.destroy();
        if (pieChart) pieChart.destroy();
        lineChart = barChart = pieChart = null;

        const primaryLabel = countrySelect.options[countrySelect.selectedIndex].text;
        const compareLabel =
            compareSelect.value && compareSelect.value !== countrySelect.value
                ? compareSelect.options[compareSelect.selectedIndex].text
                : null;

        statusMessage.textContent = "Unable to load data. Please try again.";
        statusMessage.style.color = "#f97373";
        insightText.textContent = "There was an error while fetching data from the API.";
        updateKpis([], metricSelect.value);
        updateTable([], [], metricSelect.value, null, primaryLabel, compareLabel);
        if (pieYearSelect) pieYearSelect.disabled = true;
    }
}

// ---- Initial load + event handlers ----
updateMetricDescription();
updateDashboard();

countrySelect.addEventListener("change", updateDashboard);
metricSelect.addEventListener("change", () => {
    updateMetricDescription();
    updateDashboard();
});
windowSelect.addEventListener("change", updateDashboard);
compareSelect.addEventListener("change", updateDashboard);
if (pieYearSelect) {
    pieYearSelect.addEventListener("change", updateDashboard);
}
