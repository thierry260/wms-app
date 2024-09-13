<script>
  import { X } from "phosphor-svelte"; // Import the close icon
  export let showFilters = false; // Controls visibility of the off-canvas
  export let onClearFilters; // Clear filters action
  export let onShowResults; // Show results action

  // Toggle visibility of the filters panel
  const closeFilters = () => (showFilters = false);
</script>

<div class="filters-container {showFilters ? 'show' : ''}">
  <!-- Top section with title and close button -->
  <div class="filters-top">
    <h6>Filters</h6>
    <button class="basic" on:click={closeFilters}><X size={16} /></button>
  </div>
  <!-- Slot for custom filters content -->
  <div class="filters-content">
    <slot></slot>
    <!-- Named slot for filter content -->
  </div>
  <!-- Bottom section with clear and show buttons -->
  <div class="filters-bottom">
    <!-- <button class="basic" on:click={onClearFilters}>Resetten</button> -->
    <button on:click={closeFilters}>Bekijken</button>
  </div>
</div>

<style lang="scss">
  .filters-container {
    position: fixed;
    --offset: 20px;
    top: var(--offset, 20px); /* Adjust the offset */
    right: var(--offset, 20px);
    bottom: var(--offset, 20px);
    width: 100%;
    max-width: 450px; /* Set the width of the off-canvas */
    background-color: white;
    border-radius: var(--border-radius);
    border: 1px solid var(--border);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transform: translateX(
      calc(100% + (var(--offset, 20px) * 2))
    ); /* Start hidden to the right */
    transition: transform 0.3s ease-out;
    z-index: 1000; /* Make sure it stays on top */

    display: flex;
    flex-direction: column;
    &.show {
      transform: translateX(0); /* Slide in when visible */
    }

    .filters-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 20px;
      border-bottom: 1px solid var(--border);
    }

    .filters-content {
      padding: 20px;
      overflow-y: auto;
      flex-grow: 1;
      flex-grow: 1;
    }

    .filters-bottom {
      display: grid;
      flex-wrap: wrap;
      justify-content: space-between;
      padding: 20px;
      border-top: 1px solid var(--border);
      gap: 15px;
      grid-template-columns: 1fr;
      @media (min-width: $xs) {
        // grid-template-columns: 1fr 1fr;
      }
      button {
        flex-grow: 1;
        width: 100%;
      }
    }
  }
</style>
