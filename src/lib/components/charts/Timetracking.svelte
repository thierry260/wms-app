<script>
  import Highcharts from "highcharts";
  import { onMount, afterUpdate } from "svelte";

  export let logs = [];
  export let period = ""; // "week", "maand", or "jaar"
  export let offset = 0; // Offset to navigate through different periods
  export let percentualChange;
  export let currentTurnover = 0; // Store current period's turnover

  $: console.log("offset", offset);

  let chart;
  let previousTurnover = 0; // Store previous period's turnover

  function getDayNameInDutch(dayIndex) {
    const dayNames = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
    return dayNames[dayIndex];
  }

  function getDateRange(period, offset = 0) {
    const now = new Date();
    let start, end;

    if (period === "week") {
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay() + 1));
      start = new Date(weekStart.setDate(weekStart.getDate() - offset * 7));
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 0, 0);
    } else if (period === "maand") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      start = new Date(monthStart.setMonth(monthStart.getMonth() - offset));
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    } else if (period === "jaar") {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      start = new Date(yearStart.setFullYear(yearStart.getFullYear() - offset));
      end = new Date(start.getFullYear(), 11, 31);
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

    logs.sort((a, b) => a.date.seconds - b.date.seconds);

    const { start, end } = getDateRange(period, offset);

    const categories = [];
    const hoursSeries = new Array(period === "jaar" ? 12 : 0).fill(0);
    const turnoverSeries = new Array(period === "jaar" ? 12 : 0).fill(0);
    const billabilitySeries = new Array(period === "jaar" ? 12 : 0).fill(0);

    if (period === "jaar") {
      const monthNames = [
        "Jan",
        "Feb",
        "Mrt",
        "Apr",
        "Mei",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Okt",
        "Nov",
        "Dec",
      ];
      categories.push(...monthNames);
    } else {
      let currentDate = new Date(start);
      while (currentDate <= end) {
        let category;
        if (period === "week") {
          category = getDayNameInDutch(currentDate.getDay());
        } else {
          category = `${currentDate.getDate()}/${currentDate.getMonth() + 1}`;
        }
        categories.push(category);
        hoursSeries.push(0);
        turnoverSeries.push(0);
        billabilitySeries.push(0);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    logs.forEach((log) => {
      const date = new Date(log.date.seconds * 1000);
      if (date >= start && date <= end) {
        let index;
        if (period === "jaar") {
          index = date.getMonth();
        } else {
          let category;
          if (period === "week") {
            category = getDayNameInDutch(date.getDay());
          } else {
            category = `${date.getDate()}/${date.getMonth() + 1}`;
          }
          index = categories.indexOf(category);
        }

        const hours = parseFloat((log.minutes / 60).toFixed(2));
        const turnover = log.billable
          ? parseFloat((hours * 250).toFixed(2))
          : 0;

        if (index >= 0) {
          hoursSeries[index] += hours;
          turnoverSeries[index] += turnover;
          if (log.billable) {
            billabilitySeries[index] += hours;
          }
        }
      }
    });

    for (let i = 0; i < categories.length; i++) {
      billabilitySeries[i] =
        hoursSeries[i] > 0 ? (billabilitySeries[i] / hoursSeries[i]) * 100 : 0;
    }

    currentTurnover = turnoverSeries.reduce((a, b) => a + b, 0);

    console.log("Transformed Data:", {
      categories,
      hoursSeries,
      turnoverSeries,
      billabilitySeries,
    });

    return {
      categories,
      hoursSeries,
      turnoverSeries,
      billabilitySeries,
    };
  }

  function calculatePercentualChange(previousTurnover, currentTurnover) {
    if (previousTurnover === 0) return 0;
    const change =
      ((currentTurnover - previousTurnover) / previousTurnover) * 100;
    return Math.round(change);
  }

  function fetchPreviousPeriodTurnover(period) {
    const { start, end } = getDateRange(period, 1);
    const previousPeriodLogs = logs.filter((log) => {
      const date = new Date(log.date.seconds * 1000);
      return date >= start && date <= end;
    });

    let previousPeriodTurnover = 0;

    previousPeriodLogs.forEach((log) => {
      const date = new Date(log.date.seconds * 1000);
      const hours = parseFloat((log.minutes / 60).toFixed(2));
      const turnover = log.billable ? parseFloat((hours * 250).toFixed(2)) : 0;

      previousPeriodTurnover += turnover;
    });

    return previousPeriodTurnover;
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
          const billability = chartData.billabilitySeries[index] / 100;
          return {
            y: value,
            color: {
              linearGradient: { x1: 0, x2: 0, y1: 0, y2: 1 },
              stops: [
                [0, "#d4e3fc"],
                [1 - billability, "#d4e3fc"],
                [1 - billability, "#22ABE7"],
                [1, "#22ABE7"],
              ],
            },
          };
        }
      );

      if (chart) {
        chart.series[0].setData(turnoverSeriesWithColors, true);
        chart.xAxis[0].setCategories(chartData.categories, true);
      } else {
        chart = Highcharts.chart("chart-container", {
          chart: {
            type: "column",
            height: 260,
          },
          title: {
            text: "",
            style: {
              fontSize: "12px",
            },
          },
          credits: {
            enabled: false,
          },
          tooltip: {
            style: {
              fontSize: "12px",
            },
          },
          plotOptions: {
            pie: {
              dataLabels: {
                style: {
                  fontSize: "12px",
                },
              },
            },
          },
          legend: {
            itemStyle: {
              fontSize: "12px",
            },
          },
          is: {
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
                  return "€" + this.value;
                },
                style: {
                  fontSize: "12px",
                },
              },
              gridLineWidth: 0,
              opposite: true,
            },
          ],
          series: [
            {
              name: "Omzet (€)",
              data: turnoverSeriesWithColors,
            },
          ],
        });
      }

      previousTurnover = fetchPreviousPeriodTurnover(period);
      percentualChange = calculatePercentualChange(
        previousTurnover,
        currentTurnover
      );

      console.log("Current Turnover:", currentTurnover);
      console.log("Previous Turnover:", previousTurnover);
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
