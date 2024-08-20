<script>
  import { createEventDispatcher } from "svelte";

  export let tabs = [];
  export let activeTab = 0;
  const dispatch = createEventDispatcher();

  function selectTab(index, tabLabel) {
    activeTab = index;
    dispatch("tabChange", { tabLabel });
  }
</script>

<div class="tabs">
  {#each tabs as tab, index}
    <div
      class="tab {activeTab === index ? 'active' : ''}"
      on:click={() => selectTab(index, tab.label)}
    >
      {tab.label}
    </div>
  {/each}
</div>

<div class="tab-content">
  {#if activeTab === 0}
    <slot name="tab-0" />
  {/if}
  {#if activeTab === 1}
    <slot name="tab-1" />
  {/if}
  {#if activeTab === 2}
    <slot name="tab-2" />
  {/if}
  <!-- Add more conditions for additional tabs -->
</div>

<style>
  .tabs {
    display: flex;
    border-bottom: 2px solid var(--gray-200);
  }

  .tab {
    padding: 10px 15px;
    margin-bottom: -2px;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-size: 1.4rem;
  }

  .tab.active {
    border-color: var(--primary);
  }
  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  :global([slot]) {
    display: contents;
  }
</style>
