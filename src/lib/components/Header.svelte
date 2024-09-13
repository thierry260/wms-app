<script>
  import { onMount } from "svelte";
  import { writable } from "svelte/store";
  import {
    CircleNotch,
    CurrencyEur,
    Car,
    TrashSimple,
    SlidersHorizontal,
    X,
    Plus,
  } from "phosphor-svelte";

  export let title = "Default Title";
  export let resultCount = 0;
  export let searchQuery = writable("");
  export let showSearch = true;
  export let showFilterButton = false; // Control visibility of filter button
  export let showFilters = false;
  export let searchPlaceholder = "Zoeken..."; // Control visibility of filter button

  let searchEl;

  onMount(async () => {
    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
    };
  });

  function handleShortcut(event) {
    // Check if Ctrl+F (Windows/Linux) or Cmd+F (Mac) is pressed
    if ((event.ctrlKey || event.metaKey) && event.key === "f") {
      event.preventDefault(); // Prevent the default browser search
      searchEl?.focus(); // Focus on the search input element
    }

    // Handle Escape key
    else if (event.key === "Escape") {
      if (document.activeElement === searchEl) {
        if (searchEl) searchEl.value = "";
        searchEl?.dispatchEvent(new Event("input", { bubbles: true }));
        searchQuery.set("");
        searchEl?.blur(); // Remove focus from the search input element
      }
    }
  }
</script>

<div class="top floating">
  <div class="module-info">
    <h2>{title}</h2>
    <div class="result-count">
      <small><span>{$resultCount}</span> resultaten</small>
    </div>
  </div>

  <div class="buttons">
    {#if showSearch}
      <div class="search">
        <input
          type="text"
          class="search"
          placeholder={searchPlaceholder}
          bind:this={searchEl}
          bind:value={$searchQuery}
        />
      </div>
    {/if}

    {#if showFilterButton}
      <button class="basic" on:click={() => (showFilters = !showFilters)}>
        <SlidersHorizontal size="20" />
      </button>
    {/if}

    <slot name="action" />
  </div>
</div>

<style lang="scss">
  .top {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 10px 30px;
    flex-wrap: wrap;
    padding-block: 30px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 30px;
    position: relative;

    &.floating {
      z-index: 1;
      position: sticky;
      background-color: var(--body-background);
      top: 0;
      margin-top: 30px;

      @media (max-width: $md) {
        margin-top: 0;
      }
    }

    .buttons {
      display: flex;
      justify-content: stretch;
      align-items: stretch;
      gap: 12px;

      .basic {
        min-width: 42px;
        background-color: #f1f1f1;
      }

      ::slotted(button) {
        background-color: var(--primary);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 5px;
        font-size: 1rem;
      }
    }

    @media (max-width: $md) {
      padding-block: 20px;
      justify-content: flex-end;

      .module-info {
        position: absolute;
        left: 0;
      }
    }

    h2 {
      margin-bottom: 0;
    }

    .result-count {
      font-size: 1.4rem;
      color: var(--gray-500);
    }

    input.search.search {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23a8a8a8' viewBox='0 0 256 256'%3E%3Cpath d='M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z'%3E%3C/path%3E%3C/svg%3E");
      background-position: left 12px center;
      background-repeat: no-repeat;
      background-size: 16px;
      padding-left: 35px;
      width: 100%;

      // @media (min-width: $xlm) {
      max-width: 42px;
      padding-inline: 18px;
      transition: max-width 0.2s ease-out;
      cursor: pointer;
      &::placeholder {
        opacity: 0;
        transition: opacity 0.2s ease-out;
      }

      &:focus,
      &:not(:placeholder-shown) {
        max-width: 300px;
        @media (max-width: $md) {
          max-width: 85vw;
        }
        padding-inline: 40px 20px;
        cursor: unset;
        &::placeholder {
          opacity: 0.5;
        }
      }
      // }
    }
    @media (max-width: $xs) {
      .hide_mobile {
        display: none;
      }
    }
  }
</style>
