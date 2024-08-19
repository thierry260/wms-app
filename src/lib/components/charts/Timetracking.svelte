<script>
  import Highcharts from "highcharts";
  import { onMount, afterUpdate } from "svelte";

  export let logs = [];
  export let period = ""; // "week" or "maand"
  export let percentualChange;
  export let currentTurnover = 0; // Store current period's turnover

  let chart;
  let previousTurnover = 0; // Store previous period's turnover

  function getDayNameInDutch(dayIndex) {
    const dayNames = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
    return dayNames[dayIndex];
  }

  function convertToHHMM(decimalHours) {
    // Extract hours
    const hours = Math.floor(decimalHours);

    // Extract minutes by multiplying the decimal part by 60
    const minutes = Math.round((decimalHours - hours) * 60);

    // Return in HH:MM format
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
  }

  function getDateRange(period, offset = 0) {
    const now = new Date();
    let start, end;

    if (period === "week") {
      // Calculate the start and end of the week with an offset
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay() + 1));
      start = new Date(weekStart.setDate(weekStart.getDate() - offset * 7));
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 0, 0);
    } else if (period === "maand") {
      // Calculate the start and end of the month with an offset
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      start = new Date(monthStart.setMonth(monthStart.getMonth() - offset));
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    }

    return { start, end };
  }

  function transformLogsToChartData(logs, period) {
    if (!Array.isArray(logs)) {
      console.error("Invalid logs data:", logs);
      return {
        categories: [],
        hoursSeries: [],
        turnoverSeries: [],
        billabilitySeries: [],
      };
    }

    // Sort logs by date in ascending order
    logs.sort((a, b) => a.date.seconds - b.date.seconds);

    const { start, end } = getDateRange(period);

    const categories = [];
    const hoursSeries = [];
    const turnoverSeries = [];
    const billabilitySeries = [];

    // Generate all dates for the selected period
    let currentDate = new Date(start);
    while (currentDate <= end) {
      let category;
      if (period === "week") {
        // Use day names for week view
        category = getDayNameInDutch(currentDate.getDay());
      } else {
        // Use day/month for month view
        category = `${currentDate.getDate()}/${currentDate.getMonth() + 1}`;
      }
      categories.push(category);
      hoursSeries.push(0);
      turnoverSeries.push(0);
      billabilitySeries.push(0);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    logs.forEach((log) => {
      const date = new Date(log.date.seconds * 1000);

      // Only consider logs within the selected period
      if (date >= start && date <= end) {
        let category;
        if (period === "week") {
          // Use day names for week view
          category = getDayNameInDutch(date.getDay());
        } else {
          // Use day/month for month view
          category = `${date.getDate()}/${date.getMonth() + 1}`;
        }
        const index = categories.indexOf(category);
        const hours = parseFloat((log.minutes / 60).toFixed(2)); // Convert minutes to hours
        const turnover = log.billable
          ? parseFloat((hours * 250).toFixed(2))
          : 0; // Calculate turnover

        hoursSeries[index] += hours;
        turnoverSeries[index] += turnover;

        if (log.billable) {
          billabilitySeries[index] += hours;
        }
      }
    });

    // Calculate the billability percentage per day
    for (let i = 0; i < categories.length; i++) {
      billabilitySeries[i] =
        hoursSeries[i] > 0 ? (billabilitySeries[i] / hoursSeries[i]) * 100 : 0;
    }

    // Store current period's turnover
    currentTurnover = turnoverSeries.reduce((a, b) => a + b, 0);

    return {
      categories,
      hoursSeries,
      turnoverSeries,
      billabilitySeries,
    };
  }

  function calculatePercentualChange(previousTurnover, currentTurnover) {
    if (previousTurnover === 0) return 0; // Avoid division by zero
    const change =
      ((currentTurnover - previousTurnover) / previousTurnover) * 100;
    return Math.round(change); // Round to the nearest integer
  }

  function fetchPreviousPeriodTurnover(period) {
    // Get date range for the previous period
    const { start, end } = getDateRange(period, 1); // offset by 1 period (week or month)

    console.log({ start, end });

    // Filter logs to only include those in the previous period
    const previousPeriodLogs = logs.filter((log) => {
      const date = new Date(log.date.seconds * 1000);
      return date >= start && date <= end;
    });

    let previousPeriodTurnover = 0;

    previousPeriodLogs.forEach((log) => {
      const date = new Date(log.date.seconds * 1000);
      const hours = parseFloat((log.minutes / 60).toFixed(2)); // Convert minutes to hours

      // Only consider logs within the selected period
      if (date >= start && date <= end) {
        const turnover = log.billable
          ? parseFloat((hours * 250).toFixed(2))
          : 0; // Calculate turnover

        previousPeriodTurnover += turnover;
      }
    });

    console.log("previousPeriodLogs", previousPeriodLogs);
    return previousPeriodTurnover; // Return total turnover for previous period
  }

  function renderChart() {
    const container = document.getElementById("chart-container");

    if (!container) {
      console.error("Chart container not found");
      return;
    }

    try {
      const chartData = transformLogsToChartData(logs, period);

      const turnoverSeriesWithColors = chartData.turnoverSeries.map(
        (value, index) => {
          const billability = chartData.billabilitySeries[index] / 100; // Normalize billability to 0-1 range
          return {
            y: value,
            color: {
              linearGradient: { x1: 0, x2: 0, y1: 0, y2: 1 },
              stops: [
                [0, "#d4e3fc"],
                [1 - billability, "#d4e3fc"], // Light blue for non-billable portion
                [1 - billability, "#22ABE7"], // Darker blue for billable portion
                [1, "#22ABE7"],
              ],
            },
          };
        },
      );

      if (chart) {
        chart.update({
          xAxis: {
            categories: chartData.categories,
          },
          series: [
            {
              name: "Omzet",
              data: turnoverSeriesWithColors,
              type: "column",
              lineWidth: 2,
              marker: {
                enabled: false,
              },
              // yAxis: 1,
              fillColor: {
                linearGradient: {
                  x1: 0,
                  y1: 0,
                  x2: 0,
                  y2: 1,
                },
                stops: [
                  [0, "rgba(45, 30, 237, 0.5)"], // Top color
                  [1, "rgba(45, 30, 237, 0)"], // Bottom color
                ],
              },
            },
          ],
          tooltip: {
            shared: true,
            style: {
              fontSize: "12px",
            },
            formatter: function () {
              const index = this.points[0].point.index;
              return `
                <i>${this.x}</i><br/>
                Tijd: <b>${convertToHHMM(chartData.hoursSeries[index])}</b><br/>
                Declarabiliteit: <b>${chartData.billabilitySeries[index].toFixed(2)}%</b><br/>
                Omzet: <b>€${chartData.turnoverSeries[index]}</b>
              `;
            },
          },
          yAxis: [
            {
              title: {
                text: "Omzet (€)",
                style: {
                  fontSize: "12px",
                },
              },
              labels: {
                formatter: function () {
                  return Math.floor(this.value); // Remove decimals
                },
                style: {
                  fontSize: "12px",
                },
              },
              opposite: true,
            },
          ],
        });
      } else {
        chart = Highcharts.chart("chart-container", {
          chart: {
            type: "column",
            height: 260,
          },
          title: {
            text: "",
          },
          credits: {
            enabled: false,
          },
          xAxis: {
            categories: chartData.categories,
            labels: {
              style: {
                fontSize: "12px",
              },
            },
          },
          yAxis: [
            {
              title: {
                text: "Omzet (€)",
                style: {
                  fontSize: "12px",
                },
              },
              labels: {
                formatter: function () {
                  return Math.floor(this.value); // Remove decimals
                },
                style: {
                  fontSize: "12px",
                },
              },
              opposite: true,
            },
          ],
          legend: {
            itemStyle: {
              fontSize: "12px",
            },
          },
          tooltip: {
            shared: true,
            style: {
              fontSize: "12px",
            },
            formatter: function () {
              const index = this.points[0].point.index;
              return `
                <i>${this.x}</i><br/>
                Tijd: <b>${convertToHHMM(chartData.hoursSeries[index])}</b><br/>
                Declarabiliteit: <b>${chartData.billabilitySeries[index].toFixed(2)}%</b><br/>
                Omzet: <b>€${chartData.turnoverSeries[index]}</b>
              `;
            },
          },
          series: [
            {
              name: "Omzet",
              data: turnoverSeriesWithColors,
              type: "column",
              lineWidth: 2,
              marker: {
                enabled: false,
              },
              // yAxis: 1,
              fillColor: {
                linearGradient: {
                  x1: 0,
                  y1: 0,
                  x2: 0,
                  y2: 1,
                },
                stops: [
                  [0, "rgba(45, 30, 237, 0.5)"], // Top color
                  [1, "rgba(45, 30, 237, 0)"], // Bottom color
                ],
              },
            },
          ],
        });
      }

      // Fetch previous period's turnover
      previousTurnover = fetchPreviousPeriodTurnover(period);

      // Calculate percentual change
      percentualChange = calculatePercentualChange(
        previousTurnover,
        currentTurnover,
      );

      console.log("Percentual Change:", percentualChange);
    } catch (error) {
      console.error("Error rendering chart:", error);
    }
  }

  onMount(() => {
    renderChart();
  });

  afterUpdate(() => {
    renderChart();
  });
</script>

<div id="chart-container"></div>

<style>
  #chart-container {
    height: 260px;
  }
</style>
