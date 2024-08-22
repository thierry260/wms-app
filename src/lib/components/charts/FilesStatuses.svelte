<script>
  import Highcharts from "highcharts";
  import { onMount, afterUpdate } from "svelte";

  export let statuses = []; // Expecting an array of status objects
  export let administratiestatus = []; // Expecting an array of administratiestatus objects
  export let chart = "administratie"; // "week" or "maand"

  let statusChart;
  let adminChart;

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

  function transformAdministratiestatusToChartData(administratiestatus) {
    if (!Array.isArray(administratiestatus)) {
      console.error("Invalid administratiestatus data:", administratiestatus);
      return [];
    }

    return administratiestatus.map((status) => ({
      name: status.name,
      y: status.y,
    }));
  }

  function renderStatusChart() {
    const container = document.getElementById("pie-container");

    if (!container) {
      console.error("Status chart container not found");
      return;
    }

    try {
      const chartData = transformStatusesToChartData(statuses);

      if (statusChart) {
        statusChart.update({
          series: [
            {
              name: "Status",
              colorByPoint: true,
              data: chartData,
            },
          ],
        });
      } else {
        statusChart = Highcharts.chart(container, {
          chart: {
            type: "pie",
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
      console.error("Error rendering status chart:", error);
    }
  }

  function renderAdministratiestatusChart() {
    const container = document.getElementById(
      "administratiestatus-pie-container"
    );

    if (!container) {
      console.error("Administratiestatus chart container not found");
      return;
    }

    try {
      const chartData =
        transformAdministratiestatusToChartData(administratiestatus);

      if (adminChart) {
        adminChart.update({
          series: [
            {
              name: "Administratiestatus",
              colorByPoint: true,
              data: chartData,
            },
          ],
        });
      } else {
        adminChart = Highcharts.chart(container, {
          chart: {
            type: "pie",
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
          series: [
            {
              name: "Administratiestatus",
              colorByPoint: true,
              data: chartData,
            },
          ],
        });
      }
    } catch (error) {
      console.error("Error rendering administratiestatus chart:", error);
    }
  }

  onMount(() => {
    if (chart === "administratie") {
      renderAdministratiestatusChart();
    } else if (chart === "status") {
      renderStatusChart();
    }
  });

  afterUpdate(() => {
    if (chart === "administratie") {
      renderAdministratiestatusChart();
      // Hide the status chart
      document.getElementById("pie-container").style.display = "none";
      document.getElementById(
        "administratiestatus-pie-container"
      ).style.display = "block";
    } else if (chart === "status") {
      renderStatusChart();
      // Hide the administratiestatus chart
      document.getElementById(
        "administratiestatus-pie-container"
      ).style.display = "none";
      document.getElementById("pie-container").style.display = "block";
    }
  });
</script>

<div id="pie-container" style="display: none;"></div>
<div id="administratiestatus-pie-container" style="display: none;"></div>
