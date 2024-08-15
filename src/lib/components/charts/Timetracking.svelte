<script>
  import Highcharts from "highcharts";
  import { onMount, afterUpdate } from "svelte";

  export let logs = [];
  export let period = ""; // "week" or "month"

  let chart;

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

    const categories = [];
    const hoursSeries = [];
    const turnoverSeries = [];
    const billabilitySeries = [];

    const now = new Date();
    const start =
      period === "week"
        ? new Date(now.setDate(now.getDate() - now.getDay())) // Start of the week
        : new Date(now.getFullYear(), now.getMonth(), 1); // Start of the month

    const end =
      period === "week"
        ? new Date(now.setDate(start.getDate() + 6)) // End of the week
        : new Date(now.getFullYear(), now.getMonth() + 1, 0); // End of the month

    // Generate all dates for the selected period
    let currentDate = new Date(start);
    while (currentDate <= end) {
      const day = `${currentDate.getDate()}/${currentDate.getMonth() + 1}`;
      categories.push(day);
      hoursSeries.push(0);
      turnoverSeries.push(0);
      billabilitySeries.push(0);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    logs.forEach((log) => {
      const date = new Date(log.date.seconds * 1000);

      // Only consider logs within the selected period
      if (date >= start && date <= end) {
        const day = `${date.getDate()}/${date.getMonth() + 1}`;
        const index = categories.indexOf(day);
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

    return {
      categories,
      hoursSeries,
      turnoverSeries,
      billabilitySeries, // return this series to use it later
    };
  }

  function renderChart() {
    const container = document.getElementById("chart-container");

    if (!container) {
      console.error("Chart container not found");
      return;
    }

    try {
      const chartData = transformLogsToChartData(logs, period);

      if (chart) {
        chart.update({
          xAxis: {
            categories: chartData.categories,
          },
          series: [
            {
              name: "Uren",
              data: chartData.hoursSeries,
              type: "spline",
              lineWidth: 2,
              marker: {
                enabled: false,
              },
            },
            {
              name: "Omzet",
              data: chartData.turnoverSeries,
              type: "areaspline",
              lineWidth: 2,
              color: "rgb(45, 30, 237)",
              marker: {
                enabled: false,
              },
              yAxis: 1,
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
              <b>${this.x}</b><br/>
              Uren: ${chartData.hoursSeries[index]}<br/>
              Omzet: €${chartData.turnoverSeries[index]}<br/>
              Declarabiliteit: ${chartData.billabilitySeries[index].toFixed(2)}%
            `;
            },
          },
          yAxis: [
            {
              title: {
                text: "Uren",
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
            },
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
            type: "area",
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
                text: "Uren",
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
            },
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
              <b>${this.x}</b><br/>
              Uren: ${chartData.hoursSeries[index]}<br/>
              Omzet: €${chartData.turnoverSeries[index]}<br/>
              <b>Billability: ${chartData.billabilitySeries[index].toFixed(2)}%</b>
            `;
            },
          },
          series: [
            {
              name: "Uren",
              data: chartData.hoursSeries,
              type: "spline",
              lineWidth: 2,
              marker: {
                enabled: false,
              },
            },
            {
              name: "Omzet",
              data: chartData.turnoverSeries,
              type: "areaspline",
              lineWidth: 2,
              color: "rgb(45, 30, 237)",
              marker: {
                enabled: false,
              },
              yAxis: 1,
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
    } catch (error) {
      console.error("Chart rendering error:", error);
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
