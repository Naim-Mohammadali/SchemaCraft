# SchemaCraft

**SchemaCraft** is a schema-driven desktop application for building custom data-entry systems without changing the application code.

It allows an authorized Builder user to define categories, fields, validation rules, conditional visibility, repeatable sections, search behavior, and attachment handling. Regular users then work with the generated form to create, search, edit, archive, and manage records.

> **Current language:** The application interface is currently available in **Arabic only**.  
> **Current release platform:** Windows.  
> **Current data backend:** Microsoft Excel (`.xlsx`).

---

## Overview

SchemaCraft starts as a blank application:

- No predefined categories
- No predefined fields
- No predefined conditions
- No predefined records

The entire form structure is created from the built-in **Builder** interface.

The Builder remains available in the packaged application, but it is protected by a password. Users who do not have the Builder password can use the data-entry and record-management features without being able to change the application structure.

---

## Main Features

### Dynamic Form Builder

Authorized Builder users can:

- Create main and repeatable categories
- Add, rename, reorder, disable, or remove fields
- Configure field width, helper text, required status, uniqueness, and limits
- Define searchable fields and result-display fields
- Configure conditional visibility
- Configure dependent list options
- Define repeated-card labels and exclusivity rules
- Change the Builder password
- Create backups
- Perform structural changes with confirmation and safety checks

### Data Entry

Regular users can:

- Create new records
- Edit existing records
- Search using one or more fields
- Work with repeatable cards
- Upload and manage attachments
- Archive and restore records
- Open images, PDFs, and other supported files
- Continue editing a record immediately after saving

The application is designed for keyboard-heavy data-entry workflows and supports long forms with many fields.

---

## Category Types

### Main Categories

A main category appears once in each record.

Its values are stored in the main Excel records sheet.

### Repeatable Categories

A repeatable category allows multiple cards under the same record.

Examples include:

- Wives or family members
- Previous jobs
- Qualifications
- Addresses
- Contracts
- Bank accounts
- Contact methods

Each repeated card has:

- A stable internal UUID
- A visible sequential `minor_id`
- Independent field values
- Optional labels or status tags
- Optional automatic creation of an empty first card

Repeatable categories are stored in separate Excel sheets.

---

## Supported Field Types

SchemaCraft supports:

- Short text
- Long text
- Number
- Dropdown list
- Single checkbox
- Multiple-choice checkbox group
- Three-state Yes / No / Empty
- Gregorian date
- Hijri date
- Solar Hijri date
- File or attachment

Fields can optionally include:

- Required validation
- Unique-value validation
- Helper text
- Search support
- Result-card display
- Minimum and maximum text length
- Minimum and maximum numeric values
- Date-range validation
- Comparison with another date field
- Conditional visibility
- Dependent option filtering
- Attachment filename rules

---

## Date Entry

All supported calendars use the same structured control:

```text
Year | Month | Day
```

The application does not rely on the browser's default date input.

Features include:

- Keyboard-friendly numeric entry
- Gregorian month-length and leap-year validation
- Hijri calendar validation
- Solar Hijri calendar validation
- Arabic month-name preview
- Consistent internal storage as `YYYY-MM-DD`

The field definition preserves the selected calendar type.

---

## Conditional Visibility

Fields and categories can be shown or hidden according to other field values.

Supported conditions include:

- Equals
- Does not equal
- Contains
- Does not contain
- Is empty
- Is not empty

When multiple conditions are configured, all conditions must be satisfied.

A repeatable category can also appear directly below the field that controls its visibility.

---

## Dependent Lists

List and multiple-choice options can depend on another field.

Examples:

```text
Department → Job titles
Country → Province
Employment type → Contract types
```

Rules are applied in both the user interface and the backend.

When a previously selected option becomes invalid, the application clears it and informs the user.

---

## Repeatable-Card Labels

Repeatable cards can display configurable labels such as:

```text
Current
Primary
Active
Preferred
```

Labels can follow rules such as:

- Multiple cards allowed
- Only one card may use the label
- Only one card may exist when rows are present
- Exactly one card must always exist

When an exclusive label is assigned to a new card, it is removed automatically from the previous card.

---

## Search and Record Editing

The Builder defines the default searchable fields.

Users may temporarily select different search fields during the current session.

Search behavior includes:

- Multiple criteria combined with `AND`
- Empty criteria ignored
- Partial text matching
- Arabic text normalization
- Exact matching for selected field types
- Same-card matching for repeatable-category criteria
- Optional inclusion of archived records

Selecting a result loads the complete record, including:

- Main fields
- Repeatable cards
- Attachments
- Archived status

Saving after loading updates the same record rather than creating a duplicate.

---

## Record Identity

Every record has:

- A short visible record ID
- A hidden stable UUID

Every repeatable card has:

- A hidden stable UUID
- A visible sequential `minor_id`

Relationships use internal UUIDs rather than labels, field names, display order, or `minor_id`.

---

## Excel Storage

SchemaCraft uses two main runtime files:

```text
data/schema.json
data/database.xlsx
```

### `schema.json`

Stores the application definition, including:

- Categories
- Fields
- Field types
- Search settings
- Visibility rules
- Option definitions
- Validation configuration
- Repeatable-card rules

### `database.xlsx`

Stores the records.

The workbook structure uses:

- A hidden technical first row containing stable field IDs
- A visible second row containing current field names
- Data beginning from the third row
- Separate sheets for repeatable categories

Stable field IDs allow fields to be renamed and reordered without losing their associated data.

Do not manually change the hidden technical row.

Close `database.xlsx` in Excel before saving records or changing the schema from SchemaCraft.

---

## Schema Changes and Data Safety

When the Builder saves structural changes:

- Excel is rebuilt according to the new schema
- Existing values remain connected through stable field IDs
- Renaming and reordering do not remove data
- Removing fields or categories requires confirmation
- Unsafe category-type changes are blocked after records exist
- Duplicate record IDs and UUIDs are rejected
- Orphaned repeatable rows are rejected
- Excel and schema updates are handled as one coordinated operation
- Previous files are restored when a critical update step fails

Before destructive structural changes, the application can create a backup.

---

## Attachments

File fields can be used in main or repeatable categories.

Attachment behavior includes:

- Files stored in `data/attachments/`
- Relative paths stored in Excel
- Images, PDFs, and other file types supported
- Maximum file size of 100 MB
- Original or generated filenames
- Duplicate filename numbering
- Image gallery for loaded records
- PDF and file cards
- Open, replace, and remove actions
- Physical deletion after the record is saved
- Automatic attachment deletion when a record is permanently deleted

Potentially executable formats such as HTML and SVG are downloaded instead of being rendered inside the application.

---

## Archiving and Permanent Deletion

Archiving is the normal way to retire a record.

Archived records:

- Remain in Excel
- Are hidden from normal searches
- Can be shown with the archived-record option
- Can be restored later

Permanent deletion is available only while Builder mode is unlocked.

---

## Builder Authentication

Builder access is protected by `builder-auth.json`.

The file stores:

- A random salt
- A PBKDF2-SHA256 password hash
- The iteration count

The password itself is never stored.

Normal data-entry features work without `builder-auth.json`.

When the file is missing:

- The application still starts
- Regular data entry remains available
- Builder access remains disabled

To configure Builder access, run:

```bash
python set-builder-password.py
```

Place the generated `builder-auth.json` beside the executable or inside the source directory.

Builder access remains unlocked for the current application session until the user locks it manually or closes the application.

---

## Backups

Builder mode includes manual backup creation.

A backup ZIP can include:

- `schema.json`
- `database.xlsx`
- `attachments/`

Backups are stored in the runtime backup folder and can be downloaded from the application.

Backups should also be copied regularly to a separate drive or company backup system.

---

## Application Shutdown and Instance Control

SchemaCraft includes controlled shutdown behavior:

- A visible Close Application button
- Local server shutdown
- Browser-tab shutdown signaling
- Backup heartbeat detection
- Protection against multiple instances using the same installation folder
- Startup error reporting
- `startup-error.log` creation when the packaged application cannot start

---

## Project Structure

```text
Source/
├── SchemaCraft.py
├── app/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── tests/
│   ├── test_backend.py
│   ├── test_server.py
│   └── test_ui_dom.js
├── build-windows.bat
├── make-user-copy.bat
├── set-builder-password.py
├── requirements.txt
├── requirements-build.txt
├── package.json
├── package-lock.json
└── README.md
```

Runtime files such as `data/`, `builder-auth.json`, logs, attachments, and backups are intentionally excluded from the public source repository.

---

## Running from Source

### Requirements

- Python 3
- Dependencies listed in `requirements.txt`

Install dependencies:

```bash
python -m pip install -r requirements.txt
```

Run the application:

```bash
python SchemaCraft.py
```

The application creates its runtime data directory and files when needed.

---

## Building the Windows Version

Requirements:

- Windows
- Python 3
- Python Launcher
- Internet access during the build process

Run:

```bat
build-windows.bat
```

The script:

1. Creates an isolated build environment
2. Installs build dependencies
3. Builds `SchemaCraft.exe`
4. Creates a clean user package
5. Removes temporary build files

The final user computer does not require:

- Python
- Node.js
- npm
- Internet access

The build works even when `data/` and `builder-auth.json` are absent.

---

## Creating a User Package

Run:

```bat
make-user-copy.bat
```

The generated package contains:

```text
SchemaCraft.exe
app/
builder-auth.json    optional
```

Runtime data is not copied into the package.

This prevents accidental distribution of:

- Company records
- Attachments
- Logs
- Existing schemas
- Backups

---

## Tests

Backend tests:

```bash
python -m unittest tests.test_backend
```

The project also includes:

- HTTP server tests
- DOM and browser-interface tests
- Search and validation tests
- Cache and index tests
- Attachment tests
- Schema migration tests
- Concurrency and failure-recovery tests

Node.js dependencies are used only for frontend testing and are not included in the packaged application.

---

## Current Scope

SchemaCraft intentionally remains focused.

Current limitations:

- Arabic user interface only
- Windows packaged release
- Excel-based storage
- No cloud synchronization
- No Google Sheets integration
- No online multi-user backend
- No plugin system
- No built-in report designer
- No multilingual interface

These features may be considered in later releases.

---

## Planned Development

Potential future work includes:

- Report generation and export
- Additional export formats
- Optional Google Sheets or online spreadsheet backend
- Linux packaged release
- Additional language support
- Improved deployment automation
- GitHub Actions testing and release automation

---

## Release Status

SchemaCraft 1.0 is the first stable desktop release.

The current focus is:

- Production testing
- Bug fixing
- Reliability
- Data safety
- Performance with large forms and thousands of records

Major new features are planned for later releases after the current version is fully stabilized.

---

## License

MIT License

## Acknowledgments

SchemaCraft was designed and developed by Mohammadali Naim with assistance from ChatGPT by OpenAI for code review, debugging, documentation, testing guidance, and development planning.

All final design decisions, implementation choices, testing, and release responsibility remain with the project author.
