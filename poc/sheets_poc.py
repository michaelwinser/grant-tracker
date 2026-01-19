#!/usr/bin/env python3
"""
Google Sheets Tables API Proof of Concept

This script explores how to read and write to Google Sheets using both
the standard Values API and the Tables API.

Usage (Service Account - recommended for PoC):
    1. Place service account JSON key as 'service-account.json' in this directory
    2. Share the spreadsheet with the service account email (as Viewer)
    3. Run: python sheets_poc.py

Usage (OAuth - for testing as a real user):
    1. Create a .env file with CLIENT_ID and CLIENT_SECRET
    2. Run: python sheets_poc.py --oauth
    3. Complete OAuth in browser
"""

import json
import os
import sys
from pathlib import Path

# Check for required packages
try:
    from google.oauth2 import service_account
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    from dotenv import load_dotenv
except ImportError:
    print("Missing required packages. Install with:")
    print("  pip install google-auth google-auth-oauthlib google-api-python-client python-dotenv")
    sys.exit(1)

# Load environment variables
load_dotenv()

# Configuration
SPREADSHEET_ID = "12pdLsFW8rmWs4ojDKZfmVRiY09m_OGhl8kF1egJENEE"
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]

# File paths
SERVICE_ACCOUNT_FILE = Path(__file__).parent / "service-account.json"
TOKEN_FILE = Path(__file__).parent / "token.json"

# OAuth configuration (only needed if using --oauth)
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")


def get_credentials(use_oauth=False):
    """Get credentials via service account or OAuth."""

    if use_oauth:
        return get_oauth_credentials()
    else:
        return get_service_account_credentials()


def get_service_account_credentials():
    """Get credentials from service account JSON file."""
    if not SERVICE_ACCOUNT_FILE.exists():
        print(f"Error: Service account file not found: {SERVICE_ACCOUNT_FILE}")
        print("\nTo set up:")
        print("  1. Go to GCP Console > IAM & Admin > Service Accounts")
        print("  2. Create a service account (or use existing)")
        print("  3. Create a JSON key and download it")
        print("  4. Save it as 'service-account.json' in this directory")
        print("  5. Share your spreadsheet with the service account email")
        print("\nOr use --oauth flag for user authentication")
        sys.exit(1)

    creds = service_account.Credentials.from_service_account_file(
        str(SERVICE_ACCOUNT_FILE),
        scopes=SCOPES
    )
    print(f"Using service account: {creds.service_account_email}")
    return creds


def get_oauth_credentials():
    """Get or refresh OAuth credentials."""
    creds = None

    # Check for existing token
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    # Refresh or get new credentials
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("Refreshing expired token...")
            creds.refresh(Request())
        else:
            if not CLIENT_ID or not CLIENT_SECRET:
                print("Error: CLIENT_ID and CLIENT_SECRET must be set in .env file")
                print("Create a .env file with:")
                print("  CLIENT_ID=your-client-id")
                print("  CLIENT_SECRET=your-client-secret")
                sys.exit(1)

            # Create OAuth flow from client config
            client_config = {
                "installed": {
                    "client_id": CLIENT_ID,
                    "client_secret": CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": ["http://localhost:8080/"],
                }
            }

            flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
            creds = flow.run_local_server(port=8080)

        # Save credentials for next run
        TOKEN_FILE.write_text(creds.to_json())
        print(f"Token saved to {TOKEN_FILE}")

    return creds


def print_section(title):
    """Print a section header."""
    print(f"\n{'=' * 60}")
    print(f" {title}")
    print('=' * 60)


def explore_spreadsheet_metadata(service):
    """Fetch and display spreadsheet metadata."""
    print_section("Spreadsheet Metadata")

    result = service.spreadsheets().get(
        spreadsheetId=SPREADSHEET_ID,
        fields="spreadsheetId,properties.title,sheets.properties,tables"
    ).execute()

    print(f"Title: {result['properties']['title']}")
    print(f"ID: {result['spreadsheetId']}")

    print("\nSheets:")
    for sheet in result.get('sheets', []):
        props = sheet['properties']
        print(f"  - {props['title']} (sheetId: {props['sheetId']})")

    # Check for tables
    if 'tables' in result:
        print("\nTables found:")
        print(json.dumps(result['tables'], indent=2))
    else:
        print("\nNo 'tables' field in response (Tables may need different API call)")

    return result


def explore_values_api(service):
    """Read data using the standard Values API."""
    print_section("Values API - Reading Sheets")

    # Get all sheet names first
    metadata = service.spreadsheets().get(
        spreadsheetId=SPREADSHEET_ID,
        fields="sheets.properties.title"
    ).execute()

    sheet_names = [s['properties']['title'] for s in metadata.get('sheets', [])]
    print(f"Sheets to read: {sheet_names}")

    # Read each sheet
    for sheet_name in sheet_names:
        print(f"\n--- {sheet_name} ---")
        try:
            result = service.spreadsheets().values().get(
                spreadsheetId=SPREADSHEET_ID,
                range=f"'{sheet_name}'!A:Z"
            ).execute()

            values = result.get('values', [])
            if not values:
                print("  (empty)")
                continue

            # Print headers
            headers = values[0]
            print(f"  Headers: {headers}")
            print(f"  Rows: {len(values) - 1}")

            # Print first few data rows
            for i, row in enumerate(values[1:4], 1):
                # Pad row to match headers
                row_padded = row + [''] * (len(headers) - len(row))
                row_dict = dict(zip(headers, row_padded))
                print(f"  Row {i}: {row_dict}")

            if len(values) > 4:
                print(f"  ... and {len(values) - 4} more rows")

        except Exception as e:
            print(f"  Error reading sheet: {e}")


def explore_tables_api(service):
    """Explore the Tables-specific API features."""
    print_section("Tables API Exploration")

    # The Tables feature is accessed through the spreadsheet metadata
    # Let's try different fields to see what's available

    fields_to_try = [
        "tables",
        "sheets.tables",
        "sheets.data.rowData",
        "sheets.conditionalFormats",
        "sheets.filterViews",
        "dataSourceSchedules",
    ]

    for field in fields_to_try:
        print(f"\nTrying field: {field}")
        try:
            result = service.spreadsheets().get(
                spreadsheetId=SPREADSHEET_ID,
                fields=f"spreadsheetId,{field}"
            ).execute()

            # Check if the field exists in result
            if field in result:
                print(f"  Found! Value: {json.dumps(result[field], indent=2)[:500]}")
            elif 'sheets' in result:
                for sheet in result['sheets']:
                    if 'tables' in sheet:
                        print(f"  Found in sheet! {json.dumps(sheet['tables'], indent=2)[:500]}")
            else:
                print(f"  Field not in response. Keys: {list(result.keys())}")
        except Exception as e:
            print(f"  Error: {e}")

    # Try getting data with table ranges
    print("\n--- Trying Named Range / Table Range Syntax ---")

    # First get the sheet names that might be tables
    metadata = service.spreadsheets().get(
        spreadsheetId=SPREADSHEET_ID,
        fields="sheets.properties.title,namedRanges"
    ).execute()

    if 'namedRanges' in metadata:
        print(f"Named ranges found: {json.dumps(metadata['namedRanges'], indent=2)}")
    else:
        print("No named ranges found")


def explore_data_validation(service):
    """Check how dropdown validations are set up."""
    print_section("Data Validation Rules")

    result = service.spreadsheets().get(
        spreadsheetId=SPREADSHEET_ID,
        fields="sheets(properties.title,data.rowData.values.dataValidation)"
    ).execute()

    for sheet in result.get('sheets', []):
        sheet_name = sheet['properties']['title']
        data = sheet.get('data', [])

        validations_found = []
        for grid in data:
            for row_idx, row in enumerate(grid.get('rowData', [])):
                for col_idx, cell in enumerate(row.get('values', [])):
                    if 'dataValidation' in cell:
                        validations_found.append({
                            'row': row_idx,
                            'col': col_idx,
                            'validation': cell['dataValidation']
                        })

        if validations_found:
            print(f"\n--- {sheet_name} ---")
            # Group by column to avoid repetition
            by_col = {}
            for v in validations_found:
                col = v['col']
                if col not in by_col:
                    by_col[col] = v['validation']

            for col, validation in by_col.items():
                print(f"  Column {col}: {json.dumps(validation, indent=4)}")


def test_write_operation(service):
    """Test writing to the spreadsheet (if desired)."""
    print_section("Write Test (Skipped)")
    print("To test writing, modify this function and remove the early return")
    return

    # Example: append a row to a sheet
    # values = [["TEST-2026-Example", "Test Grant", "Test Org", "2026", "Draft", "1000"]]
    # result = service.spreadsheets().values().append(
    #     spreadsheetId=SPREADSHEET_ID,
    #     range="Grants!A:Z",
    #     valueInputOption="USER_ENTERED",
    #     body={"values": values}
    # ).execute()
    # print(f"Appended {result.get('updates', {}).get('updatedRows', 0)} rows")


def main():
    print("Grant Tracker - Sheets API Proof of Concept")
    print(f"Spreadsheet ID: {SPREADSHEET_ID}")

    # Check for --oauth flag
    use_oauth = "--oauth" in sys.argv

    # Get credentials
    print("\nAuthenticating...")
    creds = get_credentials(use_oauth=use_oauth)

    # Build the Sheets service
    service = build('sheets', 'v4', credentials=creds)

    # Run explorations
    explore_spreadsheet_metadata(service)
    explore_values_api(service)
    explore_tables_api(service)
    explore_data_validation(service)
    test_write_operation(service)

    print_section("Done")
    print("Review the output above to understand the data structures.")
    print("Modify this script to test additional operations as needed.")


if __name__ == "__main__":
    main()
