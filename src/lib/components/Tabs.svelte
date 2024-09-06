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
  {#if activeTab === 3}
    <slot name="tab-3" />
  {/if}
  {#if activeTab === 4}
    <slot name="tab-4" />
  {/if}
  {#if activeTab === 5}
    <slot name="tab-5" />
  {/if}
  {#if activeTab === 6}
    <slot name="tab-6" />
  {/if}
  {#if activeTab === 7}
    <slot name="tab-7" />
  {/if}
  {#if activeTab === 8}
    <slot name="tab-8" />
  {/if}
  {#if activeTab === 9}
    <slot name="tab-9" />
  {/if}
  {#if activeTab === 10}
    <slot name="tab-10" />
  {/if}
</div>

<style lang="scss">
  .tabs {
    display: flex;
    border-bottom: 2px solid var(--gray-200);
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 2px;

    -ms-overflow-style: none; /* Internet Explorer 10+ */
    scrollbar-width: none; /* Firefox */
    &::-webkit-scrollbar {
      display: none; /* Safari and Chrome */
    }
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
    @media (max-width: $sm) {
      // max-height: 58vh;
      overflow-y: auto;
    }
  }
  :global([slot]) {
    display: contents;
  }
</style>
