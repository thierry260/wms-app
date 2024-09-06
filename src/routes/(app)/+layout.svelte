<script>
  import Sidebar from "$lib/components/sidebar/Sidebar.svelte";
</script>

<div class="layout">
  <Sidebar />
  <main>
    <slot />
  </main>
</div>

<style lang="scss">
  .layout {
    display: flex;
    height: 100vh;
  }
  main {
    flex: 1;
    padding: 60px;
    @media (max-width: $sm) {
      padding: 30px;
      padding-bottom: 100px;
    }

    &:has(.top.floating) {
      padding-top: 0;
      @media (max-width: $sm) {
        padding-top: 0;
      }
    }

    &:has(.bottom-nav) {
      padding: 120px 60px 60px 60px;
      @media (max-width: $sm) {
        padding: 90px 30px 30px 30px;
      }
    }

    overflow-y: auto;
    position: relative;
    display: flex;
    flex-direction: column;
  }
</style>
