<script>
  import Highcharts from "highcharts";
  import { onMount, afterUpdate } from "svelte";

  export let statuses = []; // Expecting an array of status objects

  let chart;

  function transformStatusesToChartData(statuses) {
    if (!Array.isArray(statuses)) {
      console.error("Invalid statuses data:", statuses);
      return [];
    }

    return statuses.map((status) => ({
      name: status.name,
      y: status.y,
    }));
  }

  function renderChart() {
    const container = document.getElementById("pie-container");

    if (!container) {
      console.error("Chart container not found");
      return;
    }

    try {
      const chartData = transformStatusesToChartData(statuses);

      if (chart) {
        chart.update({
          series: [
            {
              name: "Status",
              colorByPoint: true,
              data: chartData,
            },
          ],
        });
      } else {
        chart = Highcharts.chart("pie-container", {
          chart: {
            type: "pie",
          },
          title: {
            text: "File Status Distribution",
          },
          series: [
            {
              name: "Status",
              colorByPoint: true,
              data: chartData,
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

<div id="pie-container"></div>

<style lang="scss">
  svg {
    font-size: 1.6rem !important;
  }
</style>
