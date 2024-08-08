<script>
  import { onMount } from "svelte";
  import { fetchWorkspaceData } from "$lib/utils/get";
  import { CaretRight, ArrowRight } from "phosphor-svelte";
  import { goto } from "$app/navigation";

  let data = [];
  let recentlyViewed = [];
  let favoriteTemplates = [];
  let searchInput = "";
  let searchResults = [];

  onMount(async () => {
    data = await fetchWorkspaceData("categories");
    if (data) {
      data = data.map((category) => ({
        ...category,
        open: false, // Add open property to handle accordion state
      }));
      console.log(data);
    } else {
      console.log("Categories not found");
    }

    // Function to retrieve recently viewed templates from localStorage
    const getRecentlyViewed = () => {
      return JSON.parse(localStorage.getItem("recentlyViewed")) || [];
    };

    // Function to retrieve favorite templates from localStorage
    const getFavoriteTemplates = () => {
      return JSON.parse(localStorage.getItem("favoriteTemplates")) || [];
    };

    // Retrieve recently viewed and favorite templates
    recentlyViewed = getRecentlyViewed();
    favoriteTemplates = getFavoriteTemplates();
  });

  // Function to handle search input change
  const handleSearchInputChange = (event) => {
    searchInput = event.target.value.trim();
    if (searchInput) {
      searchResults = searchItems(data, searchInput);
    } else {
      searchResults = [];
    }
  };

  // Recursive function to search through categories and templates
  const searchItems = (items, query) => {
    let results = [];
    items.forEach((item) => {
      // Check if the item matches the query
      if (item.name.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          type: "category",
          id: item.id,
          name: item.name,
        });
      }

      // Check subcategories recursively
      if (item.sub) {
        results = results.concat(searchItems(item.sub, query));
      }

      // Check templates
      if (item.templates) {
        item.templates.forEach((template) => {
          if (template.name.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              type: "template",
              id: template.id,
              name: template.name,
            });
          }
        });
      }
    });
    return results.slice(0, 6); // Limit to maximum 6 results
  };

  // Function to navigate based on suggestion type
  const navigateTo = (type, id) => {
    if (type === "template") {
      goto(`/template/${id}`);
    } else if (type === "category") {
      goto(`/category/${id}`);
    }
  };
</script>

<div class="home">
  <div class="search">
    <h1>Waar ben je naar op zoek?</h1>
    <input
      type="text"
      placeholder="Zoek op templates"
      on:input={handleSearchInputChange}
    />
    <!-- Display search results -->
    <div class="search_results" hidden={searchResults.length === 0}>
      {#each searchResults as result}
        <a
          href="#"
          class="search_result"
          on:click={() => navigateTo(result.type, result.id)}
        >
          <h3>{result.name}</h3>
          <CaretRight size={18} />
        </a>
      {/each}
    </div>
  </div>

  <div class="categories">
    <h2>Categorieën</h2>
    <div class="categories_grid">
      {#each data as item}
        <a href="/category/{item.id}" class="category">
          <h3>{item.name}</h3>
          <div class="view_button">
            Bekijken
            <CaretRight size={16} />
          </div>
        </a>
      {/each}
    </div>
  </div>

  <div class="favorite_templates">
    <h2>Favoriete templates</h2>
    {#if favoriteTemplates.length === 0}
      <p>Geen favoriete templates.</p>
    {:else}
      <div class="recent_templates">
        {#each favoriteTemplates as template}
          <a href="/template/{template.id}" class="recent_template">
            <h3>{template.name}</h3>
            <CaretRight size={14} />
          </a>
        {/each}
      </div>
    {/if}
  </div>

  <div class="recently_viewed">
    <h2>Recent bekeken</h2>
    {#if recentlyViewed.length === 0}
      <p>Geen templates recent bekeken.</p>
    {:else}
      <div class="recent_templates">
        {#each recentlyViewed as template}
          <a href="/template/{template.id}" class="recent_template">
            <h3>{template.name}</h3>
            <CaretRight size={14} />
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .home {
    display: flex;
    flex-direction: column;
    gap: 40px;
  }

  .search {
    position: relative;
    .search_results {
      position: absolute;
      background-color: #fff;
      width: 100%;
      border: 1px solid var(--border);
      border-radius: var(--border-radius-small, 5px);
      transform: translateY(10px);
      box-shadow: 0 6px 8px rgba(0, 0, 0, 0.1);
      .search_result {
        padding: 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        text-decoration: none;
        transition:
          background-color,
          0.2s ease-out;
        h3 {
          font-size: 1.6rem;
          font-weight: 500;
          margin-bottom: 0;
        }

        &:hover {
          background-color: var(--gray-100);
        }
        &:not(:last-child) {
          border-bottom: 1px solid var(--border);
        }

        &:first-child {
          border-top-left-radius: inherit;
          border-top-right-radius: inherit;
        }
        &:last-child {
          border-bottom-left-radius: inherit;
          border-bottom-right-radius: inherit;
        }
      }
    }
  }

  .categories_grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;

    .view_button {
      display: flex;
      align-items: center;
      gap: 5px;
      color: var(--text);
    }
    .category {
      background-color: #fff;
      padding: 30px;
      margin-bottom: 10px;
      border-radius: var(--border-radius);
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      cursor: pointer;
      text-decoration: none;
      transition:
        background-color 0.2s ease-out,
        border-color 0.2s ease-out;
      &:hover {
        // background-color: var(--gray-100);
        border-color: var(--gray-400);
      }
      &:active {
        color: inherit;
      }
      h3 {
        font-size: 1.8rem;
        flex-grow: 1;
      }
    }
  }

  .recent_templates {
    display: flex;
    flex-direction: column;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
    .recent_template {
      padding: 15px;
      border-radius: var(--border-radius-small, 5px);
      border: 1px solid var(--border);
      background-color: #fff;
      display: flex;
      flex-direction: row;
      align-items: center;
      cursor: pointer;
      text-decoration: none;
      transition:
        background-color 0.2s ease-out,
        border-color 0.2s ease-out;
      &:hover {
        // background-color: var(--gray-100);
        border-color: var(--gray-400);
      }
      &:active {
        color: inherit;
      }
      h3 {
        font-size: 1.6rem;
        flex-grow: 1;
        margin-bottom: 0;
      }
    }
  }

  h2 {
    font-size: 2.6rem;
  }
</style>
