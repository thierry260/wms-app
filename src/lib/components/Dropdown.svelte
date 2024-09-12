<!-- src/lib/components/Dropdown.svelte -->
<script>
  import { goto } from "$app/navigation";
  import {
    Plus,
    TrashSimple,
    PencilSimple,
    Star,
    ArrowSquareOut,
  } from "phosphor-svelte";

  // Icons map for dynamic rendering
  const icons = {
    add: Plus,
    delete: TrashSimple,
    edit: PencilSimple,
    star: Star,
    link: ArrowSquareOut,
  };

  export let item;
  export let items = [];
  export let id = ""; // Unique ID for the dropdown
  export let open = false;
  export let file_id = null;
  export let href = null;

  const toggleDropdown = () => {
    open = !open;
  };

  const closeDropdown = () => {
    open = false;
  };

  // Handle click events on dropdown items
  async function handleItemClick(action) {
    console.log(`Clicked item with action: ${action}`);

    if (action === "open_file") {
      window.open(`/files?id=${file_id}`, "_blank");
      closeDropdown();
    } else if (action === "cat_delete") {
      closeDropdown();
    } else if (action === "open_drive") {
      console.log(href);
      window.open(
        `https://drive.google.com/drive/search?q=%22${href}.%22`,
        "_blank",
      ); // Open Google Drive link
      closeDropdown();
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

<style lang="scss">
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
    background-color: lighten(#f00, 32%);
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
