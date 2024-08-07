import express from 'express';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEET_ID = '1Mr3a1ISyqdLGV4VKWrJIfME7ET0__wMpRVfCaZ8wEq0';
const SHEET_RANGE = 'Urenregistratie!A:I';
const SHEET_RANGE_WIDE = 'Urenregistratie!A:M';

const oAuth2Client = new OAuth2Client(
	process.env.CLIENT_ID,
	process.env.CLIENT_SECRET,
	process.env.REDIRECT_URI
);
let authClient;

// Middleware
app.use(bodyParser.json());
app.use(cors());

app.get('/auth/google', (req, res) => {
	const authUrl = oAuth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES
	});
	res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
	const code = req.query.code;

	if (!code) {
		return res.status(400).send('Missing authorization code');
	}

	try {
		const response = await oAuth2Client.getToken(code);
		oAuth2Client.setCredentials(response.tokens);
		authClient = oAuth2Client;
		res.redirect('http://localhost:5173/');
	} catch (error) {
		console.error('Error retrieving access token', error);
		res.status(500).send('Authentication failed');
	}
});

app.get('/auth/status', async (req, res) => {
	if (authClient && authClient.credentials.access_token) {
		// Refresh the access token if needed
		if (new Date().getTime() >= authClient.credentials.expiry_date) {
			try {
				const newTokens = await oAuth2Client.refreshAccessToken();
				authClient.setCredentials(newTokens.credentials);
			} catch (error) {
				console.error('Error refreshing access token', error);
				return res.json({ loggedIn: false });
			}
		}
		res.json({ loggedIn: true });
	} else {
		res.json({ loggedIn: false });
	}
});

app.post('/addRow', async (req, res) => {
	if (!authClient) {
		return res.status(401).send('Not authorized');
	}

	const { dossiernaam, datum, omschrijving, min, uur, totaal, billable, uitvoerder, locatie } =
		req.body;
	console.log('Request body:', req.body);

	try {
		const sheets = google.sheets({ version: 'v4', auth: authClient });

		// Calculate the new row number to use in the formula
		const response = await sheets.spreadsheets.values.get({
			spreadsheetId: SHEET_ID,
			range: 'Urenregistratie!A:M'
		});

		const rows = response.data.values;
		const currentRow = rows.length + 1; // This will give us the next row number
		const totalFormula = `=E${currentRow}+D${currentRow}/60`; // Creating the formula for the new row

		// Calculate the new ID value for column M
		const previousId = rows.length > 1 ? parseInt(rows[rows.length - 1][12]) || 0 : 0;
		const newId = previousId + 1;

		// Prepare the row data with the formula and the new ID
		const rowData = [
			dossiernaam || '',
			datum || '',
			omschrijving || '',
			min || '0',
			uur || '0',
			totalFormula, // Use the formula instead of a calculated value
			billable || '',
			uitvoerder || '',
			locatie || '',
			'',
			'',
			'',
			newId // Empty cells for columns I, J, K, and new ID in column M
		];

		await sheets.spreadsheets.values.append({
			spreadsheetId: SHEET_ID,
			range: SHEET_RANGE,
			valueInputOption: 'USER_ENTERED',
			resource: {
				values: [rowData]
			}
		});

		res.status(200).send('Row added successfully');
	} catch (error) {
		if (error.response) {
			console.error('API Error details:', error.response.data);
			res.status(500).send(`Error adding row: ${error.response.data.error.message}`);
		} else {
			console.error('General Error details:', error.message);
			res.status(500).send('Error adding row');
		}
	}
});

app.post('/updateRow', async (req, res) => {
	if (!authClient) {
		return res.status(401).send('Not authorized');
	}

	const { id, dossiernaam, datum, omschrijving, min, uur, billable, uitvoerder, locatie } =
		req.body;
	console.log('Request body:', req.body);

	if (!id) {
		return res.status(400).send('ID is required');
	}

	try {
		const sheets = google.sheets({ version: 'v4', auth: authClient });

		// Fetch the data to find the row index
		const response = await sheets.spreadsheets.values.get({
			spreadsheetId: SHEET_ID,
			range: SHEET_RANGE_WIDE
		});

		const rows = response.data.values;
		let rowIndex;

		console.log('id: ', id);
		// console.log('rows: ', rows);
		for (let i = 0; i < rows.length; i++) {
			if (rows[i][12] && rows[i][12].toString() === id.toString()) {
				// Find the row with the matching ID
				rowIndex = i + 1; // Google Sheets rows start from 1
				break;
			}
		}

		if (rowIndex === undefined) {
			return res.status(404).send('Row not found');
		}

		const totalFormula = `=E${rowIndex}+D${rowIndex}/60`; // Creating the formula for the new row

		// Prepare the row data
		const rowData = [
			dossiernaam || '',
			datum || '',
			omschrijving || '',
			min || '0',
			uur || '0',
			totalFormula,
			billable || '',
			uitvoerder || '',
			locatie || '',
			'',
			'',
			'',
			id // Ensure the ID is included correctly
		];

		await sheets.spreadsheets.values.update({
			spreadsheetId: SHEET_ID,
			range: `Urenregistratie!A${rowIndex}:M${rowIndex}`,
			valueInputOption: 'USER_ENTERED',
			resource: {
				values: [rowData]
			}
		});

		res.status(200).send('Row updated successfully');
	} catch (error) {
		if (error.response) {
			console.error('API Error details:', error.response.data);
			res.status(500).send(`Error updating row: ${error.response.data.error.message}`);
		} else {
			console.error('General Error details:', error.message);
			res.status(500).send('Error updating row');
		}
	}
});

app.post('/deleteRow', async (req, res) => {
	if (!authClient) {
		return res.status(401).send('Not authorized');
	}

	const { id, dossiernaam, datum, omschrijving, min, uur, totaal, billable, uitvoerder, locatie } =
		req.body;
	console.log('Request body:', req.body);

	if (!id) {
		return res.status(400).send('ID is required');
	} else {
		console.log('id: ', id);
	}

	try {
		const sheets = google.sheets({ version: 'v4', auth: authClient });

		// Find the row number to delete based on some unique identifier in the request
		// This example assumes 'dossiernaam' is unique
		const response = await sheets.spreadsheets.values.get({
			spreadsheetId: SHEET_ID,
			range: SHEET_RANGE_WIDE
		});

		const rows = response.data.values;
		let rowIndex;

		// console.log('rows: ', rows);
		for (let i = 0; i < rows.length; i++) {
			if (rows[i][12] && rows[i][12].toString() === id.toString()) {
				// Find the row with the matching ID
				rowIndex = i + 1; // Google Sheets rows start from 1
				break;
			}
		}

		if (rowIndex === undefined) {
			return res.status(404).send('Row not found');
		}

		// Clear the row data
		await sheets.spreadsheets.values.update({
			spreadsheetId: SHEET_ID,
			range: `Urenregistratie!A${rowIndex}:M${rowIndex}`,
			valueInputOption: 'RAW',
			resource: {
				values: [['', '', '', '', '', '', '', '', '', '', '', '', '']]
			}
		});

		res.status(200).send('Row deleted successfully');
	} catch (error) {
		if (error.response) {
			console.error('API Error details:', error.response.data);
			res.status(500).send(`Error deleting row: ${error.response.data.error.message}`);
		} else {
			console.error('General Error details:', error.message);
			res.status(500).send('Error deleting row');
		}
	}
});

app.get('/getLogs', async (req, res) => {
	if (!authClient) {
		return res.status(401).send('Not authorized');
	}

	try {
		const sheets = google.sheets({ version: 'v4', auth: authClient });
		const response = await sheets.spreadsheets.values.get({
			spreadsheetId: SHEET_ID,
			range: 'Urenregistratie!A:M' // Ensure to include column M
		});

		const rows = response.data.values;
		if (!rows || rows.length === 0) {
			return res.status(404).send('No data found.');
		}

		let logs = [];
		let totalRevenue = 0;

		// Loop through the rows and prepare logs
		rows.forEach((row) => {
			logs.push({
				dossiernaam: row[0],
				datum: row[1],
				omschrijving: row[2],
				min: row[3] || '0',
				uur: row[4] || '0',
				totaal: row[5] || '0.00',
				billable: row[6],
				uitvoerder: row[7],
				locatie: row[8],
				id: row[12] || 'MOEDERS' // Ensure the ID is included
			});

			if (row[6] === 'Ja') {
				totalRevenue += parseFloat(row[5].replace(',', '.'));
			}
		});

		res.json({ logs, totalRevenue });
	} catch (error) {
		console.error('Error fetching logs:', error);
		res.status(500).send('Error fetching logs');
	}
});

app.get('/logout', (req, res) => {
	authClient = null;
	res.redirect('http://localhost:5173/');
});

app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});
