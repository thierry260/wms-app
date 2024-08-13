<script>
</script>

<div class="layout">
  <aside>
    <img class="logo" src="/img/wms-logo.png" alt="WMS logo" />
  </aside>
  <main>
    <slot />
  </main>
</div>

<style lang="scss">
  .layout {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    display: grid;
    grid-template-columns: 1fr 1fr;

    @media (max-width: $sm) {
      grid-template-columns: 100%;
      grid-template-rows: 25vh auto;
    }

    aside {
      background: linear-gradient(230deg, var(--primary), var(--secondary));
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      img {
        max-width: 300px;
        filter: brightness(0) invert(1);
      }
    }
    main {
      flex: 1;
      padding: 40px;
      overflow-y: auto;
      display: flex;
      // align-items: center;
      justify-content: center;
      flex-direction: column;

      @media (max-width: $sm) {
        padding: 30px;
      }
    }
  }
</style>
