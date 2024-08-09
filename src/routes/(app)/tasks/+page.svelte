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
    query,
    where,
    deleteDoc,
    writeBatch,
  } from "firebase/firestore";
  import { Clock, TrashSimple, PencilSimple } from "phosphor-svelte";

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
      localStorage.getItem("workspace")
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
      "tasks"
    );
    const taskSnapshots = await getDocs(tasksRef);

    const categorizedTasks = {};
    const fileRefs = new Map();

    statuses.forEach((status) => {
      categorizedTasks[status.id] = [];
    });

    // Process tasks and collect file references
    taskSnapshots.docs.forEach((doc) => {
      const taskData = { id: doc.id, ...doc.data() };
      const taskStatusId = taskData.status_id;
      const fileId = taskData.file_id;

      if (categorizedTasks[taskStatusId]) {
        categorizedTasks[taskStatusId].push(taskData);
      } else {
        console.warn(`Unknown task status ID: ${taskStatusId}`);
      }

      // Collect file references
      if (fileId) {
        fileRefs.set(fileId, doc.id); // Use task ID as a placeholder for file reference
      }
    });

    // Fetch file data
    const fileDocs = await Promise.all(
      Array.from(fileRefs.keys()).map((fileId) =>
        getDoc(
          doc(
            db,
            "workspaces",
            localStorage.getItem("workspace"),
            "files",
            fileId,
          ),
        ),
      ),
    );

    // Map file data to file IDs
    const fileDataMap = new Map();
    fileDocs.forEach((fileDoc) => {
      if (fileDoc.exists()) {
        fileDataMap.set(fileDoc.id, fileDoc.data());
      }
    });

    // Combine task and file data
    Object.keys(categorizedTasks).forEach((statusId) => {
      categorizedTasks[statusId] = categorizedTasks[statusId].map((task) => ({
        ...task,
        fileData: fileDataMap.get(task.file_id) || null,
      }));
    });

    tasks.set(categorizedTasks);

    console.log(categorizedTasks);
  }

  async function updateTaskStatus(taskId, newStatusId) {
    const taskRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "tasks",
      taskId
    );
    await setDoc(taskRef, { status_id: newStatusId }, { merge: true });
  }

  async function updateTaskStatusName(statusId, newName) {
    const workspaceRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace")
    );
    const workspaceSnap = await getDoc(workspaceRef);
    const workspaceData = workspaceSnap.data();
    const updatedStatuses = workspaceData.taskStatuses.map((status) =>
      status.id === statusId ? { ...status, name: newName } : status
    );
    await updateDoc(workspaceRef, { taskStatuses: updatedStatuses });
  }

  async function deleteTaskStatus(statusId) {
    const tasksRef = collection(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "tasks"
    );
    const q = query(tasksRef, where("status_id", "==", statusId));
    const taskSnapshots = await getDocs(q);

    let confirmMessage = "Weet je zeker dat je deze status wilt verwijderen?";
    if (taskSnapshots.size > 0) {
      confirmMessage +=
        "\nAlle taken met deze status zullen ook worden verwijderd.";
    }

    if (confirm(confirmMessage)) {
      const workspaceRef = doc(
        db,
        "workspaces",
        localStorage.getItem("workspace")
      );
      const workspaceSnap = await getDoc(workspaceRef);
      const workspaceData = workspaceSnap.data();
      const updatedStatuses = workspaceData.taskStatuses.filter(
        (status) => status.id !== statusId
      );

      if (taskSnapshots.size > 0) {
        const batch = writeBatch(db);
        taskSnapshots.forEach((docSnapshot) => {
          batch.delete(docSnapshot.ref);
        });
        await batch.commit(); // Commit the batch operation
      }

      await updateDoc(workspaceRef, { taskStatuses: updatedStatuses });
      // Note: Deleting the status doc in 'tasks' subcollection is not needed
      // if task status is stored in the main 'workspaces' collection as part of workspace data
      taskStatuses.set(updatedStatuses);
    }
  }
  function handleEditClick(event) {
    const target = event.currentTarget
      .closest(".kanban-column-header")
      .querySelector("h3");
    target.focus();

    // Move the cursor to the end of the content inside the h3 element
    const range = document.createRange();
    const selection = window.getSelection();

    range.selectNodeContents(target);
    range.collapse(false); // Collapse the range to the end
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function handleKeyDown() {
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent newline character in contentEditable
      const target = event.currentTarget;
      const statusId = target.closest(".kanban-column").dataset.id;
      const newName = target.innerText;

      updateTaskStatusName(statusId, newName);
    }
  }

  function handleBlur(event) {
    const target = event.currentTarget;
    const statusId = target.closest(".kanban-column").dataset.id;
    const newName = target.innerText;

    updateTaskStatusName(statusId, newName);
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
            (child) => child.dataset.id
          );
          const workspaceRef = doc(
            db,
            "workspaces",
            localStorage.getItem("workspace")
          );
          const workspaceSnap = await getDoc(workspaceRef);
          const workspaceData = workspaceSnap.data();

          // Update column order in the workspace document
          await updateDoc(workspaceRef, {
            taskStatuses: newOrder.map((id) =>
              workspaceData.taskStatuses.find((status) => status.id === id)
            ),
          });
        },
      });
    });
  }

  function openModal(statusId) {
    newTask.update((n) => ({
      ...n,
      title: "",
      description: "",
      assignees: [],
      file_id: "",
      priority: "Medium",
      status_id: statusId, // Set the status ID here
      deadline: "",
    }));

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
        "tasks"
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
      "files"
    );
    const fileSnapshots = await getDocs(filesRef);
    files.set(
      fileSnapshots.docs.map((doc) => ({
        id: doc.id,
        label: `${doc.id} - ${doc.data().name}`,
      }))
    );

    // dossiers = dossiersData.map((dossier) => ({
    //     id: dossier.id,
    //     label: `${dossier.id} - ${dossier.name}`,
    //   }));

    console.log(files);
    // Fetch task statuses
    await fetchTaskStatuses();
    await fetchTasks();
    setupSortable();
  });

  // Utility functions
  function formatDate(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  function getDeadlineStatus(deadline) {
    if (!deadline) return "";
    const now = new Date();
    const deadlineDate = deadline.toDate();
    deadlineDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    if (now > deadlineDate) return "overdue";
    if (now.getTime() === deadlineDate.getTime()) return "today";
    return "";
  }

  let newStatusName = writable(""); // Track the new column name

  async function addNewStatus() {
    const statusName = get(newStatusName).trim();
    if (!statusName) return; // Exit if the input is empty

    const newStatusId = doc(collection(db, "dummy")).id; // Generate a new unique ID
    const workspaceRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace")
    );
    const newStatus = { id: newStatusId, name: statusName };

    try {
      // Update Firestore with the new status
      await updateDoc(workspaceRef, {
        taskStatuses: arrayUnion(newStatus),
      });

      // Refresh the task statuses
      await fetchTaskStatuses();
      newStatusName.set(""); // Reset the input field
    } catch (error) {
      console.error("Error adding new status:", error);
    }
  }
</script>

<div class="kanban-board">
  {#if $taskStatuses.length > 0}
    {#each $taskStatuses as status (status.id)}
      <div class="kanban-column" data-id={status.id}>
        <div class="kanban-column-header">
          <h3
            on:keydown={handleKeyDown}
            on:blur={handleBlur}
            contenteditable="true"
          >
            {status.name}
          </h3>
          <div on:click={handleEditClick}><PencilSimple size={18} /></div>
          <div on:click={() => deleteTaskStatus(status.id)}>
            <TrashSimple size={18} />
          </div>
        </div>
        <ul
          id={status.id}
          class="kanban-column-content"
          data-status={status.id}
        >
          {#if $tasks[status.id]}
            {#each $tasks[status.id] as task (task.id)}
              <li
                class="kanban-task {getDeadlineStatus(task.deadline)}"
                data-id={task.id}
              >
                <div class="top">
                  <h4>{task.title}</h4>
                  <span class="subtitle"
                    >{task.fileData ? task.fileData.name : ""}</span
                  >
                </div>
                <!-- <p>{task.description}</p> -->
                {#if task.deadline}
                  <div class="task-deadline">
                    <Clock size="18" />{formatDate(task.deadline)}
                  </div>
                {/if}
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

    <div
      class="kanban-column new-column-placeholder"
      on:click={() => {
        document.querySelector(".new-column-placeholder input").focus();
      }}
    >
      <input
        bind:value={$newStatusName}
        placeholder="+ Nieuwe status toevoegen"
        on:keydown={(e) => e.key === "Enter" && addNewStatus()}
        on:blur={addNewStatus}
        on:click={(e) => e.stopPropagation()}
      />
    </div>
  {/if}
</div>

<dialog bind:this={modal} class="task-modal">
  <h2>Taak toevoegen</h2>
  <form on:submit|preventDefault={addTask}>
    <label
      ><span class="legend">Titel</span>
      <input type="text" bind:value={$newTask.title} required />
    </label>

    <label
      ><span class="legend">Beschrijving</span>
      <textarea bind:value={$newTask.description}></textarea>
    </label>

    <label
      ><span class="legend">Uitvoerders</span>
      <select bind:value={$newTask.assignees} multiple>
        {#each $assignees as assignee}
          <option value={assignee}>{assignee}</option>
        {/each}
      </select>
    </label>

    <label
      ><span class="legend">Dossier</span>
      <Select
        items={$files}
        bind:value={$newTask.file_id}
        getOptionLabel={(file) => `${file.id} - ${file.name}`}
        getOptionValue={(file) => file.id}
        getSelectionLabel={(option) =>
          option?.name || `No name found for dossier ${option.id}`}
        placeholder="Selecteer een dossier"
        itemId="id"
        clearable={false}
      />
    </label>

    <label
      ><span class="legend">Prioriteit</span>
      <select bind:value={$newTask.priority} required>
        <option value="Low">Laag</option>
        <option value="Medium">Medium</option>
        <option value="High">Hoog</option>
      </select>
    </label>

    <label
      ><span class="legend">Status</span>
      <select bind:value={$newTask.status_id} required>
        <option value="" disabled selected>Selecteer een status</option>
        {#each $taskStatuses as status}
          <option value={status.id}>{status.name}</option>
        {/each}
      </select>
    </label>

    <label
      ><span class="legend">Deadline</span>
      <input type="datetime-local" bind:value={$newTask.deadline} />
    </label>

    <div class="buttons">
      <button class="basic" type="button" on:click={closeModal}
        >Annuleren</button
      >
      <button type="submit">Opslaan</button>
    </div>
  </form>
</dialog>

<style lang="scss">
  .kanban-board {
    --container: 1520px;
    display: flex;
    justify-content: space-between;
    outline: none;

    flex-grow: 1;
    flex-basis: 0;
    display: flex;
    align-items: start;
    overflow-x: auto;
    overflow-y: hidden;
    margin-inline: -60px;
    margin-bottom: -60px;
    width: calc(100% + 120px);
    padding-inline: max(50px, (100% - var(--container) + 100px) / 2);
    padding-inline: max(50px, (100% - var(--container)) / 2);
    padding-bottom: 40px;
    // max-width: 100%;
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
    gap: 15px;

    .kanban-column-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      color: var(--text);

      &:has(h3:focus) {
      }
      h3 {
        font-size: 1.6rem;
        flex-grow: 1;
        margin-bottom: 0;
        outline: none;
      }
    }

    &.new-column-placeholder {
      background-color: transparent;
      border: 2px dashed #ccc;
      min-height: 220px;
      box-shadow: none;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: default;
      input {
        background-color: transparent;
        border: none;
        outline: none;
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
    padding: 15px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    &:not(:last-child) {
      margin-bottom: 8px;
    }

    .task-deadline {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 5px;
      border-radius: 5px;
      font-size: 13px;
      margin-top: 15px;
      color: var(--text-light);
    }

    &.today .task-deadline {
      background-color: $warning;
      color: #fff;
    }
    &.overdue .task-deadline {
      background-color: $error;
      color: #fff;
    }

    .subtitle {
      text-transform: uppercase;
      opacity: 0.6;
      font-size: 1.4rem;
      margin-top: 0.5em;
      display: block;
      &:empty {
        display: none;
      }
    }
    h4 {
      font-size: 1.8rem;
      margin-bottom: 0;
    }
  }
  .legend {
    margin-bottom: 0.5em;
    display: block;
  }
</style>
