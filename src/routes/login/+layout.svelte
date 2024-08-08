<script>
</script>

<div class="layout">
  <aside>
    <img class="logo" src="/img/MailGen-logo.svg" alt="MailGen logo" />
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
    aside {
      background: linear-gradient(230deg, var(--primary), var(--secondary));
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      img {
        max-width: 300px;
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
    }
  }
</style>
