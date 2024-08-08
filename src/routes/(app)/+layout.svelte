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
    <Breadcrumbs />
    <slot />
  </main>
</div>

<style>
  .layout {
    display: flex;
    height: 100vh;
  }
  main {
    flex: 1;
    padding: 80px;
    overflow-y: auto;
  }
</style>
