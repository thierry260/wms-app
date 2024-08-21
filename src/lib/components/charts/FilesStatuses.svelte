<script>
  import Highcharts from "highcharts";
  import { onMount, afterUpdate } from "svelte";

  export let statuses = []; // Expecting an array of status objects
  export let administratiestatus = []; // Expecting an array of administratiestatus objects

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
        statusChart = Highcharts.chart("pie-container", {
          chart: {
            type: "pie",
            height: 260,
          },
          title: {
            text: "Dossier Status",
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
      "administratiestatus-pie-container",
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
        adminChart = Highcharts.chart("administratiestatus-pie-container", {
          chart: {
            type: "pie",
            height: 260,
          },
          title: {
            text: "Administratiestatus",
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
    renderStatusChart();
    renderAdministratiestatusChart();
  });

  afterUpdate(() => {
    renderStatusChart();
    renderAdministratiestatusChart();
  });
</script>

<div id="pie-container"></div>
<div id="administratiestatus-pie-container"></div>
