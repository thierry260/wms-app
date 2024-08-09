<script>
  import { db } from "$lib/firebase";
  import { onMount } from "svelte";
  import Sortable from "sortablejs";
  import { writable, get } from "svelte/store";
  import Select from "svelte-select"; // Import svelte-select

  import {
    collection,
    getDocs,
    doc,
    setDoc,
    getDoc,
    addDoc,
    updateDoc,
    arrayUnion,
    Timestamp,
  } from "firebase/firestore";

  let taskStatuses = writable([]);
  let tasks = writable({});
  let newTask = writable({
    title: "",
    description: "",
    assignees: [],
    file_id: "",
    priority: "Medium",
    status: "",
    status_id: "",
    deadline: "",
  });
  let modal;
  let assignees = writable([]);
  let files = writable([]);
  let clients = writable([]);

  async function fetchTaskStatuses() {
    const workspaceRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
    );
    const workspaceSnap = await getDoc(workspaceRef);
    const workspaceData = workspaceSnap.data();

    // Assumes statuses are stored in a field named "taskStatuses" which is an array
    const statuses = workspaceData.taskStatuses || [];
    taskStatuses.set(statuses);
    return statuses;
  }

  async function fetchTasks() {
    const statuses = await fetchTaskStatuses();
    const tasksRef = collection(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "tasks",
    );
    const taskSnapshots = await getDocs(tasksRef);

    const categorizedTasks = {};
    statuses.forEach((status) => {
      categorizedTasks[status.id] = [];
    });

    taskSnapshots.docs.forEach((doc) => {
      const taskData = { id: doc.id, ...doc.data() };
      const taskStatusId = taskData.status_id;

      if (categorizedTasks[taskStatusId]) {
        categorizedTasks[taskStatusId].push(taskData);
      } else {
        console.warn(`Unknown task status ID: ${taskStatusId}`);
      }
    });

    tasks.set(categorizedTasks);
  }

  async function updateTaskStatus(taskId, newStatusId) {
    const taskRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "tasks",
      taskId,
    );
    await setDoc(taskRef, { status_id: newStatusId }, { merge: true });
  }

  function setupSortable() {
    // Set up task sorting within columns
    taskStatuses.subscribe((statuses) => {
      document
        .querySelectorAll(".kanban-column-content")
        .forEach((taskColumn) => {
          Sortable.create(taskColumn, {
            group: "taskColumnTasks",
            sort: false,
            animation: 250,
            onEnd: async function (evt) {
              const itemEl = evt.item;
              const oldStatusId = evt.from.closest(".kanban-column").dataset.id;
              const newStatusId = evt.to.closest(".kanban-column").dataset.id;
              const taskId = itemEl.dataset.id;

              if (oldStatusId !== newStatusId) {
                await updateTaskStatus(taskId, newStatusId);
              }
            },
          });
        });

      // Set up column sorting
      Sortable.create(document.querySelector(".kanban-board"), {
        group: "taskColumn",
        animation: 250,
        onEnd: async function (evt) {
          const newOrder = Array.from(evt.from.children).map(
            (child) => child.dataset.id,
          );
          const workspaceRef = doc(
            db,
            "workspaces",
            localStorage.getItem("workspace"),
          );
          const workspaceSnap = await getDoc(workspaceRef);
          const workspaceData = workspaceSnap.data();

          // Update column order in the workspace document
          await updateDoc(workspaceRef, {
            taskStatuses: newOrder.map((id) =>
              workspaceData.taskStatuses.find((status) => status.id === id),
            ),
          });
        },
      });
    });
  }

  function openModal(statusId) {
    newTask.set({
      title: "",
      description: "",
      status_id: statusId,
    });
    modal.showModal();
  }

  function closeModal() {
    modal.close();
  }

  // Ensure `updated_at` is saved every time
  async function addTask() {
    const taskData = get(newTask);

    // Convert deadline to Firestore timestamp
    if (taskData.deadline) {
      taskData.deadline = Timestamp.fromDate(new Date(taskData.deadline));
    }

    try {
      const tasksRef = collection(
        db,
        "workspaces",
        localStorage.getItem("workspace"),
        "tasks",
      );
      await addDoc(tasksRef, {
        ...taskData,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(), // Ensure updated_at is set when saving
      });
      await fetchTasks(); // Refresh tasks to show the new task
      closeModal();
    } catch (error) {
      console.error("Error adding task: ", error);
    }
  }

  onMount(async () => {
    // Fetch assignees (Example: hardcoded, adjust based on your structure)
    assignees.set(["Michel", "Mike", "Toon", "Thierry"]);

    // Fetch files
    const filesRef = collection(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "files",
    );
    const fileSnapshots = await getDocs(filesRef);
    files.set(fileSnapshots.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

    // Fetch task statuses
    await fetchTaskStatuses();
    await fetchTasks();
    setupSortable();
  });
</script>

<div class="kanban-board">
  {#if $taskStatuses.length > 0}
    {#each $taskStatuses as status (status.id)}
      <div class="kanban-column" data-id={status.id}>
        <div class="kanban-column-header">
          <h3>{status.name}</h3>
        </div>
        <ul
          id={status.id}
          class="kanban-column-content"
          data-status={status.id}
        >
          {#if $tasks[status.id]}
            {#each $tasks[status.id] as task (task.id)}
              <li class="kanban-task" data-id={task.id}>
                <h4>{task.title}</h4>
                <p>{task.description}</p>
              </li>
            {/each}
          {/if}
        </ul>
        <button
          class="kanban-task-add basic"
          data-status={status.id}
          on:click={() => openModal(status.id)}
        >
          + Taak toevoegen
        </button>
      </div>
    {/each}
  {/if}
</div>

<dialog bind:this={modal} class="task-modal">
  <h2>Nieuwe Taak Toevoegen</h2>
  <form on:submit|preventDefault={addTask}>
    <label>
      Titel:
      <input type="text" bind:value={$newTask.title} required />
    </label>

    <label>
      Beschrijving:
      <textarea bind:value={$newTask.description} required></textarea>
    </label>

    <label>
      Uitvoerders:
      <select bind:value={$newTask.assignees} multiple required>
        {#each $assignees as assignee}
          <option value={assignee}>{assignee}</option>
        {/each}
      </select>
    </label>

    <label>
      Dossier:
      <Select
        items={$files}
        bind:value={$newTask.file_id}
        getOptionLabel={(file) => `${file.id} - ${file.name}`}
        getOptionValue={(file) => file.id}
        placeholder="Selecteer een dossier"
        clearable={false}
      />
    </label>

    <label>
      Prioriteit:
      <select bind:value={$newTask.priority} required>
        <option value="Low">Laag</option>
        <option value="Medium">Medium</option>
        <option value="High">Hoog</option>
      </select>
    </label>

    <label>
      Status:
      <select bind:value={$newTask.status_id} required>
        <option value="" disabled selected>Selecteer een status</option>
        {#each $taskStatuses as status}
          <option value={status.id}>{status.name}</option>
        {/each}
      </select>
    </label>

    <label>
      Deadline:
      <input type="datetime-local" bind:value={$newTask.deadline} required />
    </label>

    <button type="submit">Opslaan</button>
    <button type="button" on:click={closeModal}>Annuleren</button>
  </form>
</dialog>

<style lang="scss">
  .kanban-board {
    display: flex;
    justify-content: space-between;

    flex-grow: 1;
    flex-basis: 0;
    display: flex;
    align-items: start;
    overflow-x: auto;
    overflow-y: hidden;
    margin-inline: auto;
    padding-inline: max(50px, (100% - var(--container) + 100px) / 2);
    padding-inline: max(50px, (100% - var(--container)) / 2);
    padding-bottom: 40px;
    max-width: 100%;
    display: grid;
    grid-auto-columns: 400px;
    grid-auto-flow: column;
    grid-column-gap: 2rem;
    grid-template-rows: minmax(0, 1fr);
    cursor: grab;
  }

  .kanban-column {
    background-color: var(--background);
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;

    .kanban-column-header {
      h3 {
        font-size: 1.8rem;
      }
    }
  }

  .kanban-column-content {
    min-height: 100px;
    list-style: none;
    padding: 0;
    flex-grow: 1;
  }

  .kanban-task {
    background-color: #fff;
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 8px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
</style>
