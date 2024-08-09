<script>
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { getAuth, signOut } from "firebase/auth";
  import { Timer, Folders, Users } from "phosphor-svelte";
  import { templatesStore } from "$lib/stores/templates";
  import { fetchWorkspaceData } from "$lib/utils/get";
  import { createCategory } from "$lib/utils/create";

  let data = [];
  let currentId = "";
  let currentType;
  let isHomeActive = false;
  let isSettingsActive = false;
  let areAllOpen = false;

  const menuItems = [
    {
      label: "Urenregistratie",
      route: "/",
      icon: Timer,
    },
    {
      label: "CRM",
      route: "/crm",
      icon: Users,
    },
    {
      label: "Dossiers",
      route: "/files",
      icon: Folders,
    },
  ];

  $: {
    currentId = $page.params.id;
    currentType = $page.route.id.includes("template") ? "template" : "category";
    isHomeActive =
      $page.route.id === "" ||
      $page.route.id === "/" ||
      $page.route.id === "/(app)";
    isSettingsActive = $page.route.id.includes("/settings");
  }

  onMount(async () => {});

  const logout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      goto("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };
</script>

<aside class="sidebar">
  <img class="logo" src="/img/wms-logo.png" alt="WMS logo" />

  {#each menuItems as item}
    <a
      class="menu_item {item.route === $page.url.pathname ? 'active' : ''}"
      href={item.route}
    >
      <svelte:component this={item.icon} size={20} />
      {item.label}
    </a>
  {/each}

  <!-- <a class="menu_item" href="/settings" class:active={isSettingsActive}>
    <Gear size={20} />Instellingen
  </a> -->
  <button class="logout-button" on:click={logout}>Uitloggen</button>
</aside>

<style lang="scss">
  .sidebar {
    width: 100%;
    max-width: 350px;
    background: linear-gradient(230deg, var(--primary), var(--secondary));
    height: 100%;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    .logo {
      max-width: 140px;
      margin-inline: auto;
      width: 100%;
      display: block;
      padding-block: 30px;
      filter: brightness(0) invert(1);
    }

    .label {
      color: #fff;
    }

    .menu_item {
      cursor: pointer;
      padding: 10px;
      min-height: 44px;
      background-color: transparent;
      border: 1px solid transparent;
      border-radius: 10px;
      font-size: 1.5rem;
      width: 100%;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 8px;
      transition:
        border-color 0.1s ease-out,
        background-color 0.1s ease-out;
      color: #fff;
      text-decoration: none;
      margin-bottom: 20px;

      &.active {
        background-color: rgba(0, 0, 0, 0.2);
      }

      &:not(.active):hover {
        border-color: rgba(255, 255, 255, 0.6);
      }
    }

    .logout-button {
      margin-top: auto;
      padding: 10px;
      background-color: transparent;
      border: 1px solid #ffffff77;
      border-radius: 10px;
      font-size: 1.6rem;
      color: #fff;
      cursor: pointer;
      transition: background-color 0.1s ease-out;

      &:hover {
        background-color: rgba(255, 255, 255, 0.2);
      }
    }
  }
</style>
