<script>
  import { onMount } from "svelte";
  import { doc, updateDoc } from "firebase/firestore";
  import { db, auth, storage } from "$lib/firebase";
  import { writable } from "svelte/store";
  import { get } from "svelte/store";
  import { user } from "$lib/stores/user"; // Import user store
  import {
    reauthenticateWithCredential,
    EmailAuthProvider,
    updatePassword,
    updateProfile, // Import updateProfile
  } from "firebase/auth";
  import { ref, getDownloadURL, uploadBytes } from "firebase/storage";
  import Tabs from "$lib/components/Tabs.svelte"; // Import Tabs component

  let currentPassword = "";
  let newPassword = "";
  let passwordError = writable("");
  let passwordSuccess = writable("");
  let inviteEmail = "";
  let inviteLink = writable("");
  let inviteError = writable("");
  let inviteSuccess = writable("");
  let workspaceName = "";
  let workspaceNameError = writable("");
  let workspaceNameSuccess = writable("");
  let displayName = ""; // New displayName state
  let displayNameError = writable(""); // Error state for displayName
  let displayNameSuccess = writable(""); // Success state for displayName

  let profileImage = "";
  let profileImageError = writable("");
  let profileImageSuccess = writable("");
  let selectedFile = null;

  // Get the current user's displayName from the store
  onMount(() => {
    const currentUser = get(user); // Get the current user
    console.log(currentUser);
    if (currentUser) {
      displayName = currentUser.displayName || "";
      profileImage = currentUser.photoURL || "";
    }
  });

  const handleFileChange = (event) => {
    profileImageError.set("");
    profileImageSuccess.set("");

    const file = event.target.files[0];
    if (file) {
      selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        profileImage = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChangeProfilePicture = async () => {
    profileImageError.set("");
    profileImageSuccess.set("");

    if (!selectedFile) {
      profileImageError.set("Selecteer een afbeelding.");
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("No user is currently signed in.");
      }

      // Create a storage reference
      const storageRef = ref(storage, `profilePictures/${currentUser.uid}`);

      // Upload the file
      await uploadBytes(storageRef, selectedFile);

      // Get the download URL
      const photoURL = await getDownloadURL(storageRef);

      // Update the user's profile in Firebase Authentication
      await updateProfile(currentUser, { photoURL });

      // Update the user's profile in Firestore
      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, { photoURL });

      // Update the user store with the new photoURL
      user.update((currentUserData) => {
        return {
          ...currentUserData,
          photoURL, // Update the photoURL in the user store
        };
      });

      profileImageSuccess.set("Profielfoto aangepast.");
    } catch (error) {
      profileImageError.set(error.message);
    }
  };

  // Function to handle password change
  const handleChangePassword = async () => {
    passwordError.set("");
    passwordSuccess.set("");

    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );

      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, newPassword);
      passwordSuccess.set("Wachtwoord aangepast.");
    } catch (error) {
      if (error.code === "auth/wrong-password") {
        passwordError.set("Huidig wachtwoord onjuist");
      } else {
        passwordError.set(error.message);
      }
    }
  };

  // Function to handle display name change
  const handleChangeDisplayName = async () => {
    displayNameError.set("");
    displayNameSuccess.set("");

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("No user is currently signed in.");
      }

      await updateProfile(currentUser, { displayName }); // Correct usage of updateProfile
      displayNameSuccess.set("Naam aangepast.");
    } catch (error) {
      displayNameError.set(error.message);
    }
  };

  // Function to handle workspace name change
  const handleChangeWorkspaceName = async () => {
    workspaceNameError.set("");
    workspaceNameSuccess.set("");

    try {
      const workspaceId = localStorage.getItem("workspace");
      if (!workspaceId) {
        throw new Error("Workspace ID not found in localStorage");
      }

      const docRef = doc(db, "workspaces", workspaceId);
      await updateDoc(docRef, { name: workspaceName });
      workspaceNameSuccess.set("Workspacenaam aangepast.");
    } catch (error) {
      workspaceNameError.set(error.message);
    }
  };

  // Function to generate invite link
  const generateInviteLink = async () => {
    inviteError.set("");
    inviteSuccess.set("");

    try {
      const workspaceId = localStorage.getItem("workspace");
      if (!workspaceId) {
        throw new Error("Workspace ID not found in localStorage");
      }

      const inviteId = btoa(`${workspaceId},${inviteEmail}`);
      const link = `${window.location.origin}/get-wms?id=${inviteId}`;
      inviteLink.set(link);
      inviteSuccess.set("Uitnodigingslink gegenereerd.");
    } catch (error) {
      inviteError.set(error.message);
    }
  };
</script>

<h1>Instellingen</h1>

<Tabs tabs={[{ label: "Account" }, { label: "Workspace" }]}>
  <!-- Account Tab Content -->
  <div slot="tab-0">
    <div>
      <span class="legend">Wachtwoord wijzigen</span>
      <input
        type="password"
        placeholder="Huidig wachtwoord"
        bind:value={currentPassword}
      />
      <input
        type="password"
        placeholder="Nieuw wachtwoord"
        bind:value={newPassword}
      />
      <button class="button" on:click={handleChangePassword}>
        Wachtwoord wijzigen
      </button>
      {#if $passwordError}
        <p style="color: red">{$passwordError}</p>
      {/if}
      {#if $passwordSuccess}
        <p style="color: green">{$passwordSuccess}</p>
      {/if}
    </div>

    <div>
      <span class="legend">Naam wijzigen</span>
      <input type="text" placeholder="Nieuwe naam" bind:value={displayName} />
      <button class="button" on:click={handleChangeDisplayName}>
        Naam wijzigen
      </button>
      {#if $displayNameError}
        <p style="color: red">{$displayNameError}</p>
      {/if}
      {#if $displayNameSuccess}
        <p style="color: green">{$displayNameSuccess}</p>
      {/if}
    </div>
    <div>
      <span class="legend">Profielfoto wijzigen</span>
      <div
        class="columns"
        style="grid-template-columns: auto 1fr; align-items: center; gap: 20px;"
      >
        {#if profileImage}
          <img
            src={profileImage}
            alt="Profile Picture Preview"
            class="profile-preview"
          />
        {/if}
        <div>
          <input type="file" accept="image/*" on:change={handleFileChange} />

          <button class="button" on:click={handleChangeProfilePicture}>
            Profielfoto wijzigen
          </button>
          {#if $profileImageError}
            <p style="color: red">{$profileImageError}</p>
          {/if}
          {#if $profileImageSuccess}
            <p style="color: green">{$profileImageSuccess}</p>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Workspace Tab Content -->
  <div slot="tab-1">
    <div>
      <span class="legend">Workspacenaam wijzigen</span>
      <input
        type="text"
        placeholder="Nieuwe workspacenaam"
        bind:value={workspaceName}
      />
      <button class="button" on:click={handleChangeWorkspaceName}>
        Workspacenaam wijzigen
      </button>
      {#if $workspaceNameError}
        <p style="color: red">{$workspaceNameError}</p>
      {/if}
      {#if $workspaceNameSuccess}
        <p style="color: green">{$workspaceNameSuccess}</p>
      {/if}
    </div>
    <div>
      <span class="legend">Uitnodigen voor Workspace</span>
      <input type="email" placeholder="E-mailadres" bind:value={inviteEmail} />
      <button class="button" on:click={generateInviteLink}>
        Genereer uitnodigingslink
      </button>
      {#if $inviteError}
        <p style="color: red">{$inviteError}</p>
      {/if}
      {#if $inviteSuccess}
        <p style="color: green">{$inviteSuccess}</p>
      {/if}
      {#if $inviteLink}
        <p>
          Uitnodigingslink: <a href={$inviteLink} target="_blank"
            >{$inviteLink}</a
          >
        </p>
      {/if}
    </div>
  </div>
</Tabs>

<style lang="scss">
  .profile-preview {
    max-width: 120px;
    max-height: 120px;
    margin-top: 10px;
    border-radius: 50%;
    object-fit: cover;
  }

  .tabs {
    display: flex;
    justify-content: center;
    gap: 30px;
    margin-bottom: 40px;
  }

  .tabs button {
    color: var(--gray-400);
    background: none;
    border: none;
    border-radius: 0;
    padding: 6px 0;
    cursor: pointer;
    font-size: 16px;
    border-bottom: 2px solid transparent;
    transition: border-color 0.2s ease-out;
  }

  .columns .button {
    display: block;
  }

  .tabs button:hover {
    border-color: var(--gray-300);
  }

  .tabs button.active {
    color: var(--secondary);
    border-color: currentColor;
  }

  .legend {
    display: block;
    margin-top: 20px;
  }

  .button {
    width: max-content;
    margin-top: 10px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
  }

  th,
  td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: left;
  }

  th {
    background-color: #f2f2f2;
  }

  tr:nth-child(even) {
    background-color: #f9f9f9;
  }

  tr:hover {
    background-color: #f1f1f1;
  }

  h1 {
    // text-align: center;
    margin-bottom: 20px;
  }

  h3 {
    margin-top: 20px;
  }

  input[type="text"],
  input[type="password"],
  input[type="email"] {
    width: 100%;
    padding: 8px;
    margin: 5px 0;
  }

  /* button {
    padding: 8px 16px;
    margin: 5px 0;
    cursor: pointer;
  } */

  div {
    margin-bottom: 20px;
  }

  .invite-to-workspace p {
    margin-top: 10px;
  }
</style>
