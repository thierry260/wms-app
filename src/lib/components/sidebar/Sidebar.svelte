<script>
  import { user } from "$lib/stores/user";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { getAuth, signOut } from "firebase/auth";
  import {
    Timer,
    Folders,
    Users,
    DotsThree,
    X,
    SignOut,
    ListChecks,
    Layout,
  } from "phosphor-svelte";

  $: currentUser = $user;

  let showMore = false;
  let isMobile = true;

  const menuItems = [
    {
      label: "Dashboard",
      route: "/",
      icon: Layout,
    },
    {
      label: "Urenregistratie",
      route: "/timetracking",
      icon: Timer,
    },
    {
      label: "Contacten",
      route: "/crm",
      icon: Users,
    },
    {
      label: "Dossiers",
      route: "/files",
      icon: Folders,
    },
    {
      label: "Taken",
      route: "/tasks",
      icon: ListChecks,
    },
    // Add additional items here
  ];

  const checkIsMobile = () => {
    if (typeof window !== "undefined") {
      isMobile = window.innerWidth < 992;
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
      localStorage.clear();
      goto("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const toggleMore = () => {
    showMore = !showMore;
  };

  // Function to get the image source
  function getImageSrc(userName = "placeholder") {
    if (!userName) {
      userName = "placeholder";
    }
    // Convert userName to lowercase and append .jpg
    const filename = `${userName.toLowerCase()}.jpg`;
    return `/img/people/${filename}`; // Update with the correct path to your images
  }
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
    <button class="logout-button" on:click={logout}>
      <div class="user">
        <figure class="avatar">
          <img
            width="40px"
            height="40px"
            src={getImageSrc(
              currentUser && currentUser.displayName
                ? currentUser.displayName.replace(/ .*/, "")
                : ""
            )}
          />
        </figure>
        <div class="info">
          {@html currentUser && currentUser.displayName
            ? `<strong>${currentUser.displayName}</strong>`
            : `<span>${currentUser && currentUser.email ? currentUser.email : ""}</span>`}
        </div>
      </div>
      <SignOut size={20} />
    </button>
  </aside>
{/if}

<!-- Bottom Navigation for Mobile -->
{#if isMobile}
  <nav class="sidebar-mobile">
    <div class="main_nav">
      <div class="main_nav_items">
        {#each menuItems.slice(0, 5) as item}
          <a
            class="nav_item {item.route === $page.url.pathname ? 'active' : ''}"
            href={item.route}
          >
            <svelte:component this={item.icon} size={18} />
          </a>
        {/each}
      </div>
      <div class="nav_item" on:click={toggleMore}>
        {#if showMore}
          <X size={20} />
        {:else}
          <DotsThree size={24} />
        {/if}
      </div>
    </div>
    {#if showMore}
      <div class="more-menu">
        <button class="logout-button" on:click={logout}
          ><SignOut size={18} />Uitloggen</button
        >
        {#each menuItems.slice(5) as item}
          <a
            class="more_item {item.route === $page.url.pathname
              ? 'active'
              : ''}"
            href={item.route}
          >
            <svelte:component this={item.icon} size={18} />
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
    max-width: 320px;
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
      padding: 10px 15px;
      background-image: none;
      background-color: transparent;
      border-radius: 10px;
      font-size: 1.6rem;
      color: #fff;
      cursor: pointer;
      border: 1px solid transparent;
      transition: border-color 0.2s ease-out;

      display: flex;
      justify-content: space-between;
      align-items: center;

      .user {
        display: flex;
        align-items: center;
        gap: 10px;

        figure {
          display: inline-flex;
          img {
            border-radius: 50%;
          }
        }
        .info {
          font-size: 1.4rem;
        }
      }

      &:hover {
        border-color: rgba(255, 255, 255, 0.2);
      }
    }
  }

  .sidebar-mobile {
    display: flex;
    justify-content: space-between;
    flex-direction: column-reverse;
    padding: 10px 25px;
    background: linear-gradient(230deg, var(--primary), var(--secondary));
    position: fixed;
    z-index: 1000;

    bottom: 20px;
    /* margin-inline: auto; */
    transform: translateX(-50%);
    left: 50%;
    border-radius: 30px;
    gap: 30px;
    align-items: center;

    .main_nav {
      display: flex;
      justify-content: center;
      gap: 10px;
    }

    .main_nav_items {
      display: contents;
    }

    .nav_item {
      color: #fff;
      text-decoration: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      transition: color 0.1s ease-out;

      color: #fff;
      display: flex;
      align-items: center;
      gap: 15px;
      border-radius: 5px;
      border: 1px solid rgba(0, 0, 0, 0);
      padding: 5px 15px;
      height: 46px;
      transition:
        background-color 0.2s ease-out,
        border-color 0.2s ease-out,
        padding 0.2s ease-out;
      font-size: 0.875rem;
      overflow: hidden;

      padding: 0;
      height: 38px;
      width: 38px;
      display: flex;
      justify-content: center;
      align-items: center;

      &.active {
        background-color: rgba(255, 255, 255, 0.2);
      }

      &:hover:not(.active) {
        cursor: pointer;
        border-color: rgba(255, 255, 255, 0.2);
      }
    }

    .more-menu {
      padding: 10px;

      .logout-button {
        font-size: 1.4rem;
        background: transparent;
      }

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
