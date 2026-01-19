# Grant Tracker - Spreadsheet Setup

Python script to create a blank Grant Tracker spreadsheet with the proper schema.

## Setup

```bash
cd poc

# Create virtual environment
python3 -m venv .venv

# Activate it
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Create a Spreadsheet

Make sure your service account JSON key is in `../keys/`.

```bash
python create_spreadsheet.py
```

This creates a new spreadsheet with:
- **Grants** sheet - main data with headers
- **Status** sheet - dropdown values for grant status
- **Tags** sheet - dropdown values for tags

The script will prompt to share the spreadsheet with your email.

## Schema

### Grants Sheet

| Column | Description |
|--------|-------------|
| ID | Grant identifier (e.g., "PYPI-2026-Packaging") |
| Title | Human-readable name |
| Organization | Grantee organization |
| Status | Dropdown from Status sheet |
| Amount | Grant value (currency) |
| Primary_Contact | Main contact email |
| Other_Contacts | Additional emails (space-separated) |
| Year | Grant year |
| Beneficiary | Ecosystem/beneficiary |
| Tags | Dropdown from Tags sheet |
| Cat_A_Percent | Category A allocation % |
| Cat_B_Percent | Category B allocation % |
| Cat_C_Percent | Category C allocation % |
| Cat_D_Percent | Category D allocation % |

### Status Sheet

Default values:
- Initial Contact, Meeting, Proposal Development, Stakeholder Review
- Approved, Notification, Signing, Disbursement
- Active, Finished, Rejected, Deferred

### Tags Sheet

Add your own tags. Default samples: Python, Rust, Security, Infrastructure
