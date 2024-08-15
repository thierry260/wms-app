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
            height: 260, // Set the height of the chart
          },
          title: {
            text: "",
            style: {
              fontSize: "12px", // Set the title font size
            },
          },
          credits: {
            enabled: false, // Disable Highcharts branding
          },
          tooltip: {
            style: {
              fontSize: "12px", // Set tooltip font size
            },
          },
          plotOptions: {
            pie: {
              dataLabels: {
                style: {
                  fontSize: "12px", // Set data labels font size
                },
              },
            },
          },
          legend: {
            itemStyle: {
              fontSize: "12px", // Set legend font size
            },
          },
          xAxis: {
            labels: {
              style: {
                fontSize: "12px", // Set x-axis labels font size
              },
            },
          },
          yAxis: {
            title: {
              style: {
                fontSize: "12px", // Set y-axis title font size
              },
            },
            labels: {
              style: {
                fontSize: "12px", // Set y-axis labels font size
              },
            },
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
