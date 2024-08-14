<script>
  import { onMount } from "svelte";
  import { auth } from "$lib/firebase";
  import { onAuthStateChanged } from "firebase/auth";
  import { goto } from "$app/navigation";
  import Sidebar from "$lib/components/sidebar/Sidebar.svelte";
  import Breadcrumbs from "$lib/components/header/Breadcrumbs.svelte";

  let user = null;

  onMount(() => {
    onAuthStateChanged(auth, (currentUser) => {
      user = currentUser;
      if (!user) {
        goto("/login");
      }
    });
  });
</script>

<div class="layout">
  <Sidebar />
  <main>
    <!-- <Breadcrumbs /> -->
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
