// src/lib/api/googleSheets.js
export async function authenticate() {
	return new Promise((resolve, reject) => {
		gapi.load('client:auth2', async () => {
			try {
				await gapi.client.init({
					apiKey: import.meta.env.VITE_API_KEY,
					clientId: import.meta.env.VITE_CLIENT_ID,
					discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
					scope: 'https://www.googleapis.com/auth/spreadsheets'
				});

				gapi.auth2
					.getAuthInstance()
					.signIn()
					.then(() => {
						resolve(gapi.auth2.getAuthInstance().currentUser.get());
					});
			} catch (error) {
				reject(error);
			}
		});
	});
}

export async function getSheetData() {
	try {
		const response = await gapi.client.sheets.spreadsheets.values.get({
			spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID,
			range: 'Urenregistratie!A:M'
		});
		return response.result.values;
	} catch (error) {
		console.error('Error fetching sheet data:', error);
		throw error;
	}
}

export async function addRow(data) {
	try {
		await gapi.client.sheets.spreadsheets.values.append({
			spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID,
			range: 'Urenregistratie!A:M',
			valueInputOption: 'USER_ENTERED',
			resource: { values: [data] }
		});
	} catch (error) {
		console.error('Error adding row:', error);
		throw error;
	}
}

export async function updateRow(range, data) {
	try {
		await gapi.client.sheets.spreadsheets.values.update({
			spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID,
			range,
			valueInputOption: 'USER_ENTERED',
			resource: { values: [data] }
		});
	} catch (error) {
		console.error('Error updating row:', error);
		throw error;
	}
}

export async function deleteRow(range) {
	try {
		await gapi.client.sheets.spreadsheets.values.clear({
			spreadsheetId: import.meta.env.VITE_SPREADSHEET_ID,
			range
		});
	} catch (error) {
		console.error('Error deleting row:', error);
		throw error;
	}
}
