<script>
  import { onMount, createEventDispatcher } from "svelte";
  import { fetchWorkspaceData } from "$lib/utils/get";
  import {
    doc,
    updateDoc,
    arrayUnion,
    collection,
    getDocs,
    getDoc,
  } from "firebase/firestore";
  import CaseDropdown from "$lib/CaseDropdown.svelte";
  import Result from "$lib/Results.svelte";
  import Filter from "$lib/Filter.svelte";
  import { writable, derived } from "svelte/store";
  import {
    CaretCircleLeft,
    CaretCircleRight,
    TrashSimple,
    Funnel,
    X,
    Plus,
    CaretRight,
  } from "phosphor-svelte";
  import { fetchWorkspaceFilesData } from "$lib/utils/get";
  import { db } from "$lib/firebase"; // Import the Firebase instance
  import TimeTrackingChart from "$lib/components/charts/Timetracking.svelte";
  import FileStatuses from "$lib/components/charts/FilesStatuses.svelte";

  const CACHE_EXPIRY_TIME = 15 * 60 * 1000; // 5 minutes

  //// States ////
  const loading = writable(true);
  const selectedTab = writable("today");
  const selectedPeriod = writable("week");

  //// Data ////

  // Tasks
  const tasks = writable([]);
  $: console.log("Tasks", $tasks);

  const groupedTasks = derived(tasks, ($tasks) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Set the current date to the end of the day

    return {
      overdue: $tasks.filter((task) => {
        const deadline = task.deadline?.seconds
          ? new Date(task.deadline.seconds * 1000)
          : null;
        return deadline && deadline < now && task.status_id !== "2v352059n273";
      }),
      dueToday: $tasks.filter((task) => {
        const deadline = task.deadline?.seconds
          ? new Date(task.deadline.seconds * 1000)
          : null;
        return (
          deadline &&
          deadline.toDateString() === now.toDateString() &&
          task.status_id !== "2v352059n273"
        );
      }),
      upcoming: $tasks.filter((task) => {
        const deadline = task.deadline?.seconds
          ? new Date(task.deadline.seconds * 1000)
          : null;
        return (
          deadline &&
          deadline > now &&
          deadline.toDateString() !== now.toDateString()
        );
      }),
      noDeadline: $tasks.filter((task) => !task.deadline),
    };
  });
  $: console.log("groupedTasks", $groupedTasks);

  // Files
  const files = writable([]);
  $: console.log("Files", $files);

  // Derived store to group files by status
  const fileStatuses = derived(files, ($files) => {
    const statusCount = $files.reduce((acc, file) => {
      const status = file.dossierstatus || "Unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(statusCount).map(([status, count]) => ({
      name: status,
      y: count,
    }));
  });

  const logs = derived(files, ($files) => {
    return $files.flatMap((dossier) =>
      (dossier.timetracking || []).map((entry) => ({
        ...entry,
        name: dossier.name, // Add the dossier's name to each timetracking entry
      }))
    );
  });
  $: console.log("Logs", $logs);

  onMount(async () => {
    try {
      fetchFiles();
      fetchTasks();
    } catch (error) {
      console.error("Error onMount:", error);
    } finally {
      loading.set(false);
    }

    const handleLogUpdate = () => updateLogs.set(true);

    window.addEventListener("logUpdated", handleLogUpdate);

    return () => {
      window.removeEventListener("logUpdated", handleLogUpdate);
    };
  });

  function isCacheExpired(timestamp) {
    return Date.now() - timestamp > CACHE_EXPIRY_TIME;
  }

  async function fetchFiles() {
    const cachedData = localStorage.getItem("workspaceFiles");
    const cachedTimestamp = localStorage.getItem("workspaceFilesTimestamp");

    if (cachedData && cachedTimestamp && !isCacheExpired(cachedTimestamp)) {
      files.set(JSON.parse(cachedData));
      console.log("cached data");
    } else {
      try {
        const data = await fetchWorkspaceFilesData();
        files.set(data);
        localStorage.setItem("workspaceFiles", JSON.stringify(data));
        localStorage.setItem("workspaceFilesTimestamp", Date.now().toString());
      } catch (error) {
        console.error("Error fetching logs:", error);
      }
    }
  }

  async function fetchTasks() {
    const cachedData = localStorage.getItem("workspaceTasks");
    const cachedTimestamp = localStorage.getItem("workspaceTasksTimestamp");

    if (cachedData && cachedTimestamp && !isCacheExpired(cachedTimestamp)) {
      tasks.set(JSON.parse(cachedData));
      console.log("cached data");
    } else {
      try {
        const tasksRef = collection(
          db,
          "workspaces",
          localStorage.getItem("workspace"),
          "tasks"
        );
        const taskSnapshots = await getDocs(tasksRef);
        const tasksArray = [];
        const fileRefs = new Map();

        taskSnapshots.docs.forEach((doc) => {
          const taskData = { id: doc.id, ...doc.data() };
          taskData.assignees =
            taskData.assignees && taskData.assignees.length > 0
              ? taskData.assignees
              : ["placeholder"];
          tasksArray.push(taskData);

          const fileId = String(taskData.file_id);
          if (fileId) {
            fileRefs.set(fileId, doc.id);
          }
        });

        const fileDocs = await Promise.all(
          Array.from(fileRefs.keys()).map((fileId) =>
            getDoc(
              doc(
                db,
                "workspaces",
                localStorage.getItem("workspace"),
                "files",
                fileId
              )
            )
          )
        );

        const fileDataMap = new Map();
        fileDocs.forEach((fileDoc) => {
          if (fileDoc.exists()) {
            fileDataMap.set(fileDoc.id, fileDoc.data());
          }
        });

        tasksArray.forEach((task) => {
          task.fileData = fileDataMap.get(task.file_id) || null;
        });

        tasks.set(tasksArray);
        localStorage.setItem("workspaceTasks", JSON.stringify(tasksArray));
        localStorage.setItem("workspaceTasksTimestamp", Date.now().toString());
      } catch (error) {
        console.error("Error fetching tasks:", error);
      }
    }
  }
</script>

<section class="dashboard">
  <h1>Welkom terug!</h1>
  <div class="card_grid">
    <!-- Card for Tasks -->
    <div class="card tasks">
      <div class="top">
        <h2>Taken</h2>
        <!-- Tabs for Switching Between Today and Overdue -->
        <div class="tabs">
          <button
            class:active={$selectedTab === "today"}
            on:click={() => selectedTab.set("today")}
          >
            Vandaag <span>{$groupedTasks.dueToday.length}</span>
          </button>
          <button
            class:active={$selectedTab === "overdue"}
            on:click={() => selectedTab.set("overdue")}
          >
            Verlopen <span>{$groupedTasks.overdue.length}</span>
          </button>
        </div>
      </div>
      <div class="main">
        <!-- Displaying Tasks Based on Selected Tab -->
        {#if $groupedTasks}
          <ul class="task-items">
            {#if $selectedTab === "today"}
              {#each $groupedTasks.dueToday as task}
                <li class="task-item">
                  {task.title}
                </li>
              {/each}
              {#if $groupedTasks.dueToday.length === 0}
                <p>Geen taken die vandaag verlopen</p>
              {/if}
            {/if}

            {#if $selectedTab === "overdue"}
              {#each $groupedTasks.overdue as task}
                <li class="task-item">
                  {task.title}<span class="deadline"
                    ><Clock size={16} />{new Date(
                      task.deadline.seconds * 1000
                    ).toLocaleDateString()}</span
                  >
                </li>
              {/each}
              {#if $groupedTasks.overdue.length === 0}
                <p>Geen verlopen taken</p>
              {/if}
            {/if}
          </ul>
        {/if}
      </div>
    </div>

    <!-- Other cards -->
    <div class="card timetracking">
      <div class="top">
        <h2>Omzet</h2>
        <div class="tabs">
          <button
            class:active={$selectedPeriod === "week"}
            on:click={() => selectedPeriod.set("week")}
          >
            Week
          </button>
          <button
            class:active={$selectedPeriod === "month"}
            on:click={() => selectedPeriod.set("month")}
          >
            Maand
          </button>
        </div>
      </div>

      <div class="main">
        {#if $logs.length > 0}
          <TimeTrackingChart logs={$logs} period={$selectedPeriod} />
        {/if}
      </div>
    </div>
    <div class="card files">
      <div class="top">
        <h2>Dossier status</h2>
      </div>

      <div class="main">
        {#if $fileStatuses.length > 0}
          <FileStatuses statuses={$fileStatuses} />
        {/if}
      </div>
    </div>
    <div class="card">
      <div class="top">
        <h2>Snel naar</h2>
      </div>

      <div class="main">
        <ul class="linktree-items">
          <li class="linktree-item">
            <a target="_blank" href="https://mail.google.com/mail/u/0/">
              <img
                src="/img/linktree/gmail.svg"
                alt="GMail logo"
                width="50px"
                height="50px"
              />
              <span class="">GMail</span>
              <CaretRight size={16} />
            </a>
          </li>
          <li class="linktree-item">
            <a target="_blank" href="https://calendar.google.com/calendar/u/0/">
              <img
                src="/img/linktree/calendar.svg"
                alt="Calendar logo"
                width="50px"
                height="50px"
              />
              <span class="">Agenda</span>
              <CaretRight size={16} />
            </a>
          </li>
          <li class="linktree-item">
            <a target="_blank" href="https://drive.google.com/drive/my-drive">
              <img
                src="/img/linktree/drive.svg"
                alt="Drive logo"
                width="50px"
                height="50px"
              />
              <span class="">Drive</span>
              <CaretRight size={16} />
            </a>
          </li>
          <li class="linktree-item">
            <a target="_blank" href="https://docs.google.com/document/u/0/">
              <img
                src="/img/linktree/docs.svg"
                alt="Docs logo"
                width="auto"
                height="40px"
                style="margin-inline: 10px;"
              />
              <span class="">Docs</span>
              <CaretRight size={16} />
            </a>
          </li>
        </ul>
      </div>
    </div>
  </div>
</section>

<style lang="scss">
  .dashboard {
    h1 {
      margin-bottom: 40px;
    }
    .card_grid {
      display: grid;
      gap: 30px;
      grid-template-columns: repeat(auto-fit, minmax(min(490px, 100%), 1fr));
      .card {
        padding: 30px;
        border-radius: 15px;
        border: 1px solid var(--border);
        box-shadow: none;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: 30px;
        width: unset;
        max-width: unset;
        margin: unset;

        &:nth-of-type(1) {
          margin-right: 50px;
        }
        &:nth-of-type(2) {
          margin-left: -50px;
        }
        &:nth-of-type(3) {
          margin-right: -50px;
        }
        &:nth-of-type(4) {
          margin-left: 50px;
        }

        .top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }

        h2 {
          font-size: 1.8rem;
          margin-bottom: 0;
        }

        .tabs {
          display: flex;
          gap: 10px;
          button {
            padding: 5px 0;
            border: none;
            border-radius: 0;
            background: none;
            cursor: pointer;
            font-size: 1.2rem;
            transition: color 0.2s;
            color: var(--text);
            border-bottom: 1px solid transparent;

            span {
              background-color: var(--text);
              padding: 2px 4px;
              border-radius: 5px;
              color: #fff;
              font-weight: 500;
              font-size: 1rem;
            }

            &:hover {
              color: var(--primary);
            }

            &.active {
              color: var(--primary);
              border-color: var(--primary);
              font-weight: bold;
              span {
                background-color: var(--primary);
              }
            }

            & + button {
              margin-left: 10px;
            }
          }
        }

        .main {
          flex-grow: 1;
          display: flex;
          align-items: flex-end;
          justify-content: stretch;
          ul {
            list-style-type: none;
            padding-left: 0;
            width: 100%;

            &.task-items {
              max-height: 260px;
              overflow-y: auto;

              /* ===== Scrollbar CSS ===== */

              /* Chrome, Edge, and Safari */
              &::-webkit-scrollbar {
                width: 12px;
                height: 12px;
              }

              &::-webkit-scrollbar-track {
                background: #ffffff;
              }

              &::-webkit-scrollbar-thumb {
                background-color: #e0e0e0;
                border-radius: 10px;
                border: 3px solid #ffffff;
              }

              p {
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 30px;
                min-height: 120px;
                color: var(--gray-400);
                font-size: 1.4rem;
                border-radius: 15px;
                background-color: var(--background);
              }
            }

            li {
              border-top: 1px solid var(--border);
              font-size: 1.4rem;
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: 10px;
              transition: border-color 0.2s ease-out;

              &:has(> a):hover {
                border-color: transparent;

                + li {
                  border-color: transparent;
                }
              }

              &:not(:has(> a)) {
                padding: 15px 0;
              }

              > a {
                display: flex;
                padding: 10px;
                border-radius: 10px;
                width: 100%;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
                color: inherit;
                text-decoration: none;
                transition: background-color 0.2s ease-out;
                &:hover {
                  background-color: var(--background);
                }
              }

              span.deadline {
                font-size: 1.2rem;
                margin-top: 1em;
                margin-bottom: 0.5em;
                text-transform: uppercase;
                font-weight: 500;
                color: var(--text);
                display: flex;
                align-items: center;
                gap: 4px;
              }
              &:first-child {
                border-top: none;
              }

              &.linktree-item {
                span {
                  flex-grow: 1;
                }
              }
            }
          }
        }
      }
    }
  }
</style>
