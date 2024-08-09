<script>
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { getAuth, signOut } from "firebase/auth";
  import { Timer, Folders, Users, DotsThree } from "phosphor-svelte";

  let showMore = false;
  let isMobile = false;

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
    // Add additional items here
  ];

  const checkIsMobile = () => {
    if (typeof window !== "undefined") {
      isMobile = window.innerWidth < 768;
    }
  };

  onMount(() => {
    checkIsMobile();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", checkIsMobile);
    }
  });

  const logout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      goto("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const toggleMore = () => {
    showMore = !showMore;
  };
</script>

<!-- Sidebar for Desktop -->
{#if !isMobile}
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
    <button class="logout-button" on:click={logout}>Uitloggen</button>
  </aside>
{/if}

<!-- Bottom Navigation for Mobile -->
{#if isMobile}
  <nav class="sidebar-mobile">
    {#each menuItems.slice(0, 4) as item}
      <a
        class="nav_item {item.route === $page.url.pathname ? 'active' : ''}"
        href={item.route}
      >
        <svelte:component this={item.icon} size={24} />
      </a>
    {/each}
    <button class="nav_item" on:click={toggleMore}>
      <DotsThree size={24} />
    </button>
    {#if showMore}
      <div class="more-menu">
        {#each menuItems.slice(4) as item}
          <a
            class="more_item {item.route === $page.url.pathname
              ? 'active'
              : ''}"
            href={item.route}
          >
            <svelte:component this={item.icon} size={20} />
            {item.label}
          </a>
        {/each}
      </div>
    {/if}
  </nav>
{/if}

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

  .sidebar-mobile {
    display: flex;
    justify-content: space-between;
    padding: 10px;
    background: linear-gradient(230deg, var(--primary), var(--secondary));
    position: fixed;
    bottom: 0;
    width: 100%;
    z-index: 1000;

    bottom: 10px;
    /* left: 10px; */
    /* right: 10px; */
    width: unset;
    /* margin-inline: auto; */
    transform: translateX(-50%);
    left: 50%;
    border-radius: 50px;
    gap: 20px;
    align-items: center;

    .nav_item {
      color: #fff;
      text-decoration: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      transition: color 0.1s ease-out;

      &.active {
        color: var(--active-color);
      }
    }

    .more-menu {
      position: absolute;
      bottom: 60px; /* Adjust based on your design */
      background: linear-gradient(230deg, var(--primary), var(--secondary));
      border-radius: 10px;
      padding: 10px;

      .more_item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 5px 0;
        color: #fff;
        text-decoration: none;

        &.active {
          color: var(--active-color);
        }
      }
    }
  }
</style>
