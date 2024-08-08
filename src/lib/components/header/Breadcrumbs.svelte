<script>
  import { onMount } from "svelte";
  import { derived, get } from "svelte/store";
  import { page } from "$app/stores";
  import { fetchWorkspaceData } from "$lib/utils/get";

  let breadcrumbs = [];
  let fetchedData = [];

  // Function to generate breadcrumb URL based on type
  const breadcrumbUrl = (breadcrumb) => {
    switch (breadcrumb.type) {
      case "category":
        return `/category/${breadcrumb.id}`;
      case "template":
        return `/template/${breadcrumb.id}`;
      case "home":
        return "/";
      default:
        return "#";
    }
  };

  // Function to generate breadcrumbs based on current route parameters
  const generateBreadcrumbs = (currentId, currentType, data) => {
    let path = [];

    const findPath = (item) => {
      if (currentType === "category" && item.id === currentId) {
        path.push({ name: item.name, type: "category", id: item.id });
        return true;
      }

      if (currentType === "template" && item.templates) {
        for (const template of item.templates) {
          if (template.id === currentId) {
            path.push({
              name: template.name,
              type: "template",
              id: template.id,
            });
            return true;
          }
        }
      }

      if (item.sub) {
        for (const subItem of item.sub) {
          if (findPath(subItem)) {
            path.unshift({ name: item.name, type: "category", id: item.id });
            return true;
          }
        }
      }

      return false;
    };

    if (currentType === "home") {
      path.push({ name: "Home", type: "home", id: null });
      return path;
    }

    data.forEach((category) => {
      if (findPath(category)) {
        path.unshift({ name: "Home", type: "home", id: null });
      }
    });

    return path;
  };

  // Fetch workspace data and update fetchedData
  const fetchData = async () => {
    try {
      const data = await fetchWorkspaceData("categories");
      fetchedData = Array.isArray(data) ? data : [];
      console.log("fetchedData", fetchedData);
    } catch (error) {
      console.error("Failed to fetch workspace data:", error);
      fetchedData = [];
    }
  };

  // Call fetchData initially
  fetchData();

  // Watch for changes in $page and update breadcrumbs accordingly
  $: {
    const currentId = $page.params?.id;
    const currentType =
      $page.route.id && $page.route.id.includes("template")
        ? "template"
        : "category";

    if (currentId && currentType && fetchedData && fetchedData.length > 0) {
      breadcrumbs = generateBreadcrumbs(currentId, currentType, fetchedData);
    } else {
      console.warn("Current ID or type not available.", currentId, currentType);
    }
  }

  onMount(() => {
    // No initial load here; rely on reactive statement
  });
</script>

<nav aria-label="Breadcrumb">
  <ol class="breadcrumbs">
    {#if breadcrumbs.length}
      {#each breadcrumbs as crumb, index (index)}
        <li>
          <a href={breadcrumbUrl(crumb)}>{crumb.name}</a>
          {#if index !== breadcrumbs.length - 1}<span>&nbsp;&gt;&nbsp;</span
            >{/if}
        </li>
      {/each}
    {/if}
  </ol>
</nav>

<style lang="scss">
  .breadcrumbs {
    display: flex;
    list-style: none;
    padding: 0;
    margin: 0 0 20px;
    font-size: 1.2rem;

    li {
      display: inline-flex;
      align-items: center;

      a {
        color: var(--blue); /* Customize link color */
        text-decoration: none;
        cursor: pointer;

        &:hover {
          text-decoration: underline;
        }
      }

      span {
        color: var(--gray-600); /* Customize arrow color */
      }
    }
  }
</style>
