<script>
  import Highcharts from "highcharts";
  import { onMount, afterUpdate } from "svelte";

  export let logs = [];

  let chart;

  function transformLogsToChartData(logs) {
    if (!Array.isArray(logs)) {
      console.error("Invalid logs data:", logs);
      return { categories: [], series: [] };
    }

    const categories = [];
    const seriesData = [];

    logs.forEach((log) => {
      const date = new Date(log.date.seconds * 1000);
      const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;

      const hours = parseFloat((log.minutes / 60).toFixed(2)); // Convert minutes to hours with two decimals

      if (!categories.includes(monthYear)) {
        categories.push(monthYear);
        seriesData.push(hours);
      } else {
        const index = categories.indexOf(monthYear);
        seriesData[index] = parseFloat((seriesData[index] + hours).toFixed(2));
      }
    });

    return {
      categories,
      series: seriesData,
    };
  }

  function renderChart() {
    const container = document.getElementById("chart-container");

    if (!container) {
      console.error("Chart container not found");
      return;
    }

    try {
      const chartData = transformLogsToChartData(logs);

      if (chart) {
        chart.update({
          xAxis: {
            categories: chartData.categories,
          },
          series: [
            {
              name: "Hours",
              data: chartData.series,
            },
          ],
        });
      } else {
        chart = Highcharts.chart("chart-container", {
          chart: {
            type: "column",
          },
          title: {
            text: "Time Tracking",
          },
          xAxis: {
            categories: chartData.categories,
          },
          yAxis: {
            title: {
              text: "Hours",
            },
            labels: {
              formatter: function () {
                return this.value.toFixed(2); // Format y-axis labels to two decimal places
              },
            },
          },
          series: [
            {
              name: "Hours",
              data: chartData.series,
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

<style lang="scss">
  svg {
    font-size: 1.6rem !important;
  }
</style>
