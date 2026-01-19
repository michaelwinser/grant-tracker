#!/usr/bin/env python3
"""
Create a blank Grant Tracker spreadsheet with the proper schema.

This script creates a new Google Spreadsheet with:
- Grants sheet (main data)
- Status sheet (dropdown values)
- Tags sheet (dropdown values)

Usage:
    source .venv/bin/activate
    python create_spreadsheet.py
"""

import json
import sys
from pathlib import Path

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
except ImportError:
    print("Missing required packages. Run:")
    print("  pip install -r requirements.txt")
    sys.exit(1)

# Configuration
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]

KEYS_DIR = Path(__file__).parent.parent / "keys"


# Schema definitions
GRANTS_COLUMNS = [
    "ID",
    "Title",
    "Organization",
    "Status",
    "Amount",
    "Primary_Contact",
    "Other_Contacts",
    "Year",
    "Beneficiary",
    "Tags",
    "Cat_A_Percent",
    "Cat_B_Percent",
    "Cat_C_Percent",
    "Cat_D_Percent",
]

STATUS_VALUES = [
    "Initial Contact",
    "Meeting",
    "Proposal Development",
    "Stakeholder Review",
    "Approved",
    "Notification",
    "Signing",
    "Disbursement",
    "Active",
    "Finished",
    "Rejected",
    "Deferred",
]

# Sample tags - users can add more
DEFAULT_TAGS = [
    "Python",
    "Rust",
    "Security",
    "Infrastructure",
]


def get_credentials():
    """Get credentials from service account JSON file."""
    json_files = list(KEYS_DIR.glob("*.json")) if KEYS_DIR.exists() else []
    if not json_files:
        print(f"Error: No service account JSON file found in {KEYS_DIR}")
        sys.exit(1)

    sa_file = json_files[0]
    creds = service_account.Credentials.from_service_account_file(
        str(sa_file), scopes=SCOPES
    )
    print(f"Using service account: {creds.service_account_email}")
    return creds


def create_spreadsheet(sheets_service, title="Grant Tracker"):
    """Create a new spreadsheet with the required sheets."""

    spreadsheet_body = {
        "properties": {"title": title},
        "sheets": [
            {"properties": {"title": "Grants", "index": 0}},
            {"properties": {"title": "Status", "index": 1}},
            {"properties": {"title": "Tags", "index": 2}},
        ],
    }

    result = sheets_service.spreadsheets().create(body=spreadsheet_body).execute()

    spreadsheet_id = result["spreadsheetId"]
    print(f"Created spreadsheet: {result['properties']['title']}")
    print(f"ID: {spreadsheet_id}")
    print(f"URL: https://docs.google.com/spreadsheets/d/{spreadsheet_id}")

    return spreadsheet_id, result


def populate_sheets(sheets_service, spreadsheet_id):
    """Add headers and dropdown values to the sheets."""

    # Batch update for efficiency
    data = [
        # Grants headers
        {
            "range": "Grants!A1",
            "values": [GRANTS_COLUMNS],
        },
        # Status values (with header)
        {
            "range": "Status!A1",
            "values": [["Status"]] + [[s] for s in STATUS_VALUES],
        },
        # Tags values (with header)
        {
            "range": "Tags!A1",
            "values": [["Name"]] + [[t] for t in DEFAULT_TAGS],
        },
    ]

    sheets_service.spreadsheets().values().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={"valueInputOption": "RAW", "data": data},
    ).execute()

    print("Added headers and dropdown values")


def format_sheets(sheets_service, spreadsheet_id, sheet_metadata):
    """Apply formatting: bold headers, freeze rows, column widths."""

    # Get sheet IDs from metadata
    sheet_ids = {}
    for sheet in sheet_metadata["sheets"]:
        sheet_ids[sheet["properties"]["title"]] = sheet["properties"]["sheetId"]

    requests = []

    # Format each sheet's header row
    for sheet_name, sheet_id in sheet_ids.items():
        # Bold header row
        requests.append({
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 0,
                    "endRowIndex": 1,
                },
                "cell": {
                    "userEnteredFormat": {
                        "textFormat": {"bold": True},
                        "backgroundColor": {"red": 0.9, "green": 0.9, "blue": 0.9},
                    }
                },
                "fields": "userEnteredFormat(textFormat,backgroundColor)",
            }
        })

        # Freeze header row
        requests.append({
            "updateSheetProperties": {
                "properties": {
                    "sheetId": sheet_id,
                    "gridProperties": {"frozenRowCount": 1},
                },
                "fields": "gridProperties.frozenRowCount",
            }
        })

    # Set column widths for Grants sheet
    grants_id = sheet_ids["Grants"]
    column_widths = [
        (0, 150),   # ID
        (1, 200),   # Title
        (2, 150),   # Organization
        (3, 120),   # Status
        (4, 100),   # Amount
        (5, 150),   # Primary_Contact
        (6, 200),   # Other_Contacts
        (7, 60),    # Year
        (8, 120),   # Beneficiary
        (9, 150),   # Tags
        (10, 100),  # Cat_A_Percent
        (11, 100),  # Cat_B_Percent
        (12, 100),  # Cat_C_Percent
        (13, 100),  # Cat_D_Percent
    ]

    for col_idx, width in column_widths:
        requests.append({
            "updateDimensionProperties": {
                "range": {
                    "sheetId": grants_id,
                    "dimension": "COLUMNS",
                    "startIndex": col_idx,
                    "endIndex": col_idx + 1,
                },
                "properties": {"pixelSize": width},
                "fields": "pixelSize",
            }
        })

    sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={"requests": requests},
    ).execute()

    print("Applied formatting")


def add_data_validation(sheets_service, spreadsheet_id, sheet_metadata):
    """Add dropdown validation for Status and Tags columns."""

    grants_id = None
    for sheet in sheet_metadata["sheets"]:
        if sheet["properties"]["title"] == "Grants":
            grants_id = sheet["properties"]["sheetId"]
            break

    if not grants_id:
        print("Warning: Could not find Grants sheet for validation")
        return

    requests = [
        # Status column (D) - dropdown from Status sheet
        {
            "setDataValidation": {
                "range": {
                    "sheetId": grants_id,
                    "startRowIndex": 1,
                    "startColumnIndex": 3,  # Column D (Status)
                    "endColumnIndex": 4,
                },
                "rule": {
                    "condition": {
                        "type": "ONE_OF_RANGE",
                        "values": [{"userEnteredValue": "=Status!$A$2:$A"}],
                    },
                    "showCustomUi": True,
                    "strict": False,
                },
            }
        },
        # Tags column (J) - dropdown from Tags sheet
        {
            "setDataValidation": {
                "range": {
                    "sheetId": grants_id,
                    "startRowIndex": 1,
                    "startColumnIndex": 9,  # Column J (Tags)
                    "endColumnIndex": 10,
                },
                "rule": {
                    "condition": {
                        "type": "ONE_OF_RANGE",
                        "values": [{"userEnteredValue": "=Tags!$A$2:$A"}],
                    },
                    "showCustomUi": True,
                    "strict": False,
                },
            }
        },
    ]

    sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={"requests": requests},
    ).execute()

    print("Added data validation (dropdowns)")


def share_with_user(drive_service, spreadsheet_id, email):
    """Share the spreadsheet with a user."""
    drive_service.permissions().create(
        fileId=spreadsheet_id,
        body={"type": "user", "role": "writer", "emailAddress": email},
        sendNotificationEmail=False,
    ).execute()
    print(f"Shared with: {email}")


def main():
    print("Grant Tracker - Create Spreadsheet")
    print("=" * 40)

    # Get credentials
    creds = get_credentials()

    # Build services
    sheets_service = build("sheets", "v4", credentials=creds)
    drive_service = build("drive", "v3", credentials=creds)

    # Create the spreadsheet
    spreadsheet_id, metadata = create_spreadsheet(sheets_service)

    # Populate with headers and values
    populate_sheets(sheets_service, spreadsheet_id)

    # Apply formatting
    format_sheets(sheets_service, spreadsheet_id, metadata)

    # Add data validation
    add_data_validation(sheets_service, spreadsheet_id, metadata)

    # Optionally share with a user
    print()
    share_email = input("Share with email (or press Enter to skip): ").strip()
    if share_email:
        try:
            share_with_user(drive_service, spreadsheet_id, share_email)
        except Exception as e:
            print(f"Could not share: {e}")

    print()
    print("Done! Open the spreadsheet to verify:")
    print(f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}")


if __name__ == "__main__":
    main()
