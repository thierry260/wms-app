<script>
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { SignOut } from 'phosphor-svelte';
	import { initGapi, signIn, signOut } from '$lib/api/auth.js'; // Import functions
  
	let isAuthenticated = writable(false);
  
	onMount(async () => {
	  try {
		await initGapi(); // Ensure gapi is initialized
		const user = window.google.accounts.id.getAuthInstance().currentUser.get();
		isAuthenticated.set(user.hasGrantedScopes('https://www.googleapis.com/auth/userinfo.email'));
	  } catch (error) {
		console.error('Error initializing Google API:', error);
		isAuthenticated.set(false);
	  }
	});
  
	async function handleLogin() {
	  try {
		const idToken = await signIn();
		// Handle successful login, possibly send the ID token to your server
		console.log('User ID Token:', idToken);
		// Set authenticated state
		isAuthenticated.set(true);
	  } catch (error) {
		console.error('Error signing in:', error);
	  }
	}
  
	async function handleLogout() {
	  try {
		await signOut();
		// Handle successful logout
		isAuthenticated.set(false);
		// Optionally clear user session on your server
		window.location.href = 'https://www.wms.conceptgen.nl/logout';
	  } catch (error) {
		console.error('Error signing out:', error);
	  }
	}
  </script>
  
  <header>
	<h1>WMS</h1>
	{#if $isAuthenticated}
	  <button class="logout" on:click={handleLogout}><SignOut size={24} /></button>
	{:else}
	  <button class="login" on:click={handleLogin}>Login</button>
	{/if}
  </header>
  
  <style>
	header {
	  display: flex;
	  justify-content: space-between;
	  align-items: center;
	  padding: 0 20px;
	  background-color: #fff;
	  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
	  margin-bottom: 20px;
	}
  
	h1 {
	  font-size: 1.8rem;
	  font-weight: 600;
	  color: var(--primary);
	  margin: 0;
	}
  
	.logout,
	.login {
	  font-size: 1.6rem;
	  color: var(--text);
	  cursor: pointer;
	  background: none;
	  border: none;
	  transition: color 0.3s ease;
	}
  
	button.logout {
	  padding-inline: 0;
	}
  
	.logout:hover,
	.login:hover {
	  color: var(--primary);
	}
  </style>
  