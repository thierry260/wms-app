<!-- src/lib/components/Dropdown.svelte -->
<script>
  import { goto } from "$app/navigation";
  import { deleteCategory } from "$lib/utils/delete";
  import { updateCategoryName } from "$lib/utils/set";
  import { createNewTemplate } from "$lib/utils/create";
  import { createCategory } from "$lib/utils/create";
  import { Plus, TrashSimple, PencilSimple, Star } from "phosphor-svelte";

  // Icons map for dynamic rendering
  const icons = {
    add: Plus,
    delete: TrashSimple,
    edit: PencilSimple,
    star: Star,
  };

  export let item;
  export let items = [];
  export let id = ""; // Unique ID for the dropdown
  export let categoryId = ""; // Unique ID for the category
  export let open = false;

  const toggleDropdown = () => {
    open = !open;
  };

  const closeDropdown = () => {
    open = false;
  };

  // Handle click events on dropdown items
  async function handleItemClick(action) {
    console.log(`Clicked item with action: ${action}`);

    if (action === "templ_add") {
      const newTemplateName = prompt(
        "Geef een naam in voor de nieuwe template:"
      );
      const newTemplateId = await createNewTemplate(
        categoryId,
        newTemplateName
      );

      console.log(newTemplateId);
      if (newTemplateId) {
        const newTemplate = { name: newTemplateName, id: newTemplateId };
        item = {
          ...item,
          templates: [...item.templates, newTemplate],
          open: true,
        };
        goto(`/template/${newTemplateId}#edit`);
      }
      closeDropdown();
    } else if (action === "cat_delete") {
      if (
        confirm(
          "Weet je zeker dat je deze categorie wilt verwijderen? Alle onderliggende categorieën en templates zullen tevens worden verwijderd."
        )
      ) {
        deleteCategory(categoryId).then(() => {
          item = {};
          closeDropdown();
        });
      }
    } else if (action === "cat_modify-name") {
      const newName = prompt("Geef een nieuwe naam voor de categorie:");
      if (newName) {
        updateCategoryName(categoryId, newName).then(() => {
          item.name = newName;
          closeDropdown();
        });
      }
    } else if (action === "cat_add") {
      const newCategoryName = prompt(
        "Geef een naam in voor de nieuwe categorie:"
      );
      if (newCategoryName) {
        createCategory(categoryId, newCategoryName).then((newCategory) => {
          item = {
            ...item,
            sub: [...item.sub, newCategory],
          };
          closeDropdown();
        });
      }
    }
  }

  // Listen for custom events to toggle the dropdown
  function handleToggle(event) {
    if (event.detail === id) {
      toggleDropdown();
    }
  }
</script>

<ul class="dropdown_list {open ? 'open' : ''}">
  {#each items as item}
    {#if item.class === "separator"}
      <li class="separator"></li>
    {:else}
      <li class={item.class} on:click={() => handleItemClick(item.action)}>
        {#if item.icon && icons[item.icon]}
          <svelte:component this={icons[item.icon]} size={18} />
        {/if}
        {item.label}
      </li>
    {/if}
  {/each}
</ul>

<!-- Close dropdown on outside click -->
<svelte:window
  on:toggle-dropdown={handleToggle}
  on:close-dropdown={closeDropdown}
  on:click={() => open && closeDropdown()}
/>

<style>
  .dropdown_list {
    position: absolute;
    top: 100%;
    transform: translateY(0);
    right: -5px;
    background: #fff;
    opacity: 0;
    border-radius: 5px;
    border: 1px solid var(--line-light, #e6e6e6);
    pointer-events: none;
    padding: 10px;
    transition:
      opacity 0.2s ease-out,
      transform 0.2s ease-out;
    white-space: nowrap;
    min-width: 170px;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 10;
    color: var(--text);
  }

  .dropdown_list::before {
    content: "";
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 7px 8px 7px;
    border-color: transparent transparent #fff transparent;
    position: absolute;
    right: 11px;
    top: 0px;
    transform: translateY(-100%);
    z-index: 1;
  }

  .dropdown_list::after {
    content: "";
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 8px 10px 8px;
    border-color: transparent transparent #e6e6e6 transparent;
    position: absolute;
    right: 10px;
    top: 0px;
    transform: translateY(-100%);
  }

  .dropdown_list.open {
    transform: translateY(10px);
    opacity: 1;
    pointer-events: auto;
  }

  .dropdown_list li {
    position: relative;
    padding: 8px 10px;
    border-radius: 5px;
    border: 1px solid transparent;
    cursor: pointer;
    display: flex;
    gap: 8px;
    align-items: center;
    transition:
      color 0.2s ease-out,
      background-color 0.2s ease-out;
  }

  .dropdown_list li:hover {
    background-color: var(--background, #f5f5f5);
    color: var(--text, #333);
  }

  .dropdown_list li.remove {
    color: var(--error, #f00);
  }

  .dropdown_list li.remove:hover {
    background-color: lighten(var(--error, #f00), 32%);
  }

  .dropdown_list li.separator {
    height: 1px;
    background-color: #e6e6e6;
    margin: 4px 0;
    padding: 0;
    border: none;
    pointer-events: none;
  }

  .dropdown_list li span {
    display: inline-block;
    margin-right: 8px;
  }
</style>
