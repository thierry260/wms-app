<script>
  import { page } from "$app/stores";
  import { fetchWorkspaceData } from "$lib/utils/get";
  import { CaretRight, ArrowRight } from "phosphor-svelte";

  let id;
  let name;
  let categories = [];
  let subcategories = [];
  let templates = [];

  $: id = $page.params.id;

  const findCategoryById = (categories, id) => {
    for (const category of categories) {
      if (category.id === id) {
        return category;
      } else if (category.sub) {
        const found = findCategoryById(category.sub, id);
        if (found) return found;
      }
    }
    return null;
  };

  const extractTemplates = (category, templates = []) => {
    if (category.templates) {
      templates = templates.concat(category.templates);
    }
    if (category.sub) {
      category.sub.forEach((subcategory) => {
        templates = extractTemplates(subcategory, templates);
      });
    }
    return templates;
  };

  const loadCategoryData = async () => {
    const data = await fetchWorkspaceData("categories");
    if (data) {
      categories = data.map((category) => ({
        ...category,
        open: false,
      }));

      const category = findCategoryById(categories, id);
      if (category) {
        name = category.name;
        subcategories = category.sub || [];
        templates = extractTemplates(category);
      } else {
        console.log("Category not found");
      }
    } else {
      console.log("Categories not found");
    }
  };

  // Load the category data on mount
  loadCategoryData();

  // Reactive statement to reload the category data whenever the ID changes
  $: {
    if (id) {
      loadCategoryData();
    }
  }
</script>

<div class="category">
  <h1>{name}</h1>

  <div class="categories">
    <h2>Onderliggende categorieën</h2>
    {#if subcategories.length > 0}
      <div class="categories_grid">
        {#each subcategories as subcategory}
          <a href={`/category/${subcategory.id}`} class="category">
            <h3>{subcategory.name}</h3>
            <div class="view_button">
              Bekijken
              <CaretRight size={16} />
            </div>
          </a>
        {/each}
      </div>
    {:else}
      <p class="placeholder">
        Je hebt nog geen onderliggende categorieën toegevoegd aan <u>{name}</u>.
        Voeg een categorie toe via de + in het linker zijvenster
      </p>
    {/if}
  </div>

  <div class="templates">
    <h2>Templates</h2>
    {#if templates.length > 0}
      <div class="templates_list">
        {#each templates as template}
          <a href={`/template/${template.id}`} class="template">
            <h3>{template.name}</h3>
            <CaretRight size={14} />
          </a>
        {/each}
      </div>
    {:else}
      <p class="placeholder">
        Je hebt nog geen templates toegevoegd aan <u>{name}</u>. Voeg een
        template toe via de + in het linker zijvenster
      </p>
    {/if}
  </div>
</div>

<style lang="scss">
  .category {
    display: flex;
    flex-direction: column;
    gap: 20px;
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
      gap: 20px;
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
        border-color: var(--gray-400);
      }
      &:active {
        color: inherit;
      }
      h3 {
        font-size: 1.8rem;
        flex-grow: 1;
        margin-bottom: 0;
      }
    }
  }

  .templates {
    margin-top: 20px;
  }

  .templates_list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    .template {
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

  .placeholder {
    padding: 20px;
    background-color: var(--gray-200);
    border-radius: var(--border-radius);
    font-size: 1.4rem;
  }
</style>
