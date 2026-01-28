package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/docs/v1"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

// Server implements the generated ServerInterface
type Server struct {
	clientID     string
	rootFolderID string // Shared Drive root folder
	credentials  []byte // Service account credentials (nil = use default)

	// Discovered from root folder
	spreadsheetID  string
	grantsFolderID string

	// Cached service clients
	sheetsClient *sheets.Service
	driveClient  *drive.Service
	docsClient   *docs.Service
	clientMu     sync.Mutex
}

// NewServer creates a new API server
func NewServer(clientID string) (*Server, error) {
	s := &Server{
		clientID:     clientID,
		rootFolderID: os.Getenv("ROOT_FOLDER_ID"),
	}

	log.Printf("[API] Initializing server...")
	log.Printf("[API]   Client ID: %s", maskString(clientID))
	log.Printf("[API]   Root Folder ID: %s", maskString(s.rootFolderID))

	// Load service account credentials
	if keyJSON := os.Getenv("GOOGLE_SERVICE_ACCOUNT_KEY"); keyJSON != "" {
		s.credentials = []byte(keyJSON)
		log.Printf("[API]   Service account: loaded from GOOGLE_SERVICE_ACCOUNT_KEY (%d bytes)", len(keyJSON))
	} else if keyPath := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS"); keyPath != "" {
		var err error
		s.credentials, err = os.ReadFile(keyPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read service account key file: %w", err)
		}
		log.Printf("[API]   Service account: loaded from file %s (%d bytes)", keyPath, len(s.credentials))
	} else {
		log.Printf("[API]   Service account: NOT CONFIGURED")
	}

	// Discover spreadsheet and Grants folder from root folder
	if s.rootFolderID != "" && s.credentials != nil {
		if err := s.discoverResources(); err != nil {
			log.Printf("[API]   Discovery failed: %v", err)
			// Don't fail server startup - just log the error
		}
	}

	log.Printf("[API]   IsConfigured: %v", s.IsConfigured())

	return s, nil
}

// discoverResources finds the spreadsheet and Grants folder in the root folder
func (s *Server) discoverResources() error {
	ctx := context.Background()

	srv, err := s.driveService(ctx)
	if err != nil {
		return fmt.Errorf("failed to get drive service: %w", err)
	}

	// Verify root folder exists and is in a Shared Drive
	rootFolder, err := srv.Files.Get(s.rootFolderID).
		SupportsAllDrives(true).
		Fields("id, name, driveId, mimeType").
		Do()
	if err != nil {
		return fmt.Errorf("failed to get root folder: %w", err)
	}

	if rootFolder.DriveId == "" {
		return fmt.Errorf("root folder must be in a Shared Drive")
	}

	log.Printf("[API]   Root folder: %s (Shared Drive: %s)", rootFolder.Name, rootFolder.DriveId)

	// Find spreadsheet in root folder (Google Sheets file)
	spreadsheetQuery := fmt.Sprintf("'%s' in parents and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false", s.rootFolderID)
	spreadsheetResp, err := srv.Files.List().
		Q(spreadsheetQuery).
		SupportsAllDrives(true).
		IncludeItemsFromAllDrives(true).
		Fields("files(id, name)").
		PageSize(10).
		Do()
	if err != nil {
		return fmt.Errorf("failed to search for spreadsheet: %w", err)
	}

	if len(spreadsheetResp.Files) == 0 {
		return fmt.Errorf("no spreadsheet found in root folder")
	}

	s.spreadsheetID = spreadsheetResp.Files[0].Id
	log.Printf("[API]   Discovered spreadsheet: %s (%s)", spreadsheetResp.Files[0].Name, maskString(s.spreadsheetID))

	// Find Grants folder in root folder
	grantsFolderQuery := fmt.Sprintf("'%s' in parents and mimeType = 'application/vnd.google-apps.folder' and name = 'Grants' and trashed = false", s.rootFolderID)
	grantsFolderResp, err := srv.Files.List().
		Q(grantsFolderQuery).
		SupportsAllDrives(true).
		IncludeItemsFromAllDrives(true).
		Fields("files(id, name)").
		PageSize(1).
		Do()
	if err != nil {
		return fmt.Errorf("failed to search for Grants folder: %w", err)
	}

	if len(grantsFolderResp.Files) == 0 {
		// Create Grants folder if it doesn't exist
		grantsFolder := &drive.File{
			Name:     "Grants",
			MimeType: "application/vnd.google-apps.folder",
			Parents:  []string{s.rootFolderID},
		}
		created, err := srv.Files.Create(grantsFolder).
			SupportsAllDrives(true).
			Fields("id").
			Do()
		if err != nil {
			return fmt.Errorf("failed to create Grants folder: %w", err)
		}
		s.grantsFolderID = created.Id
		log.Printf("[API]   Created Grants folder: %s", maskString(s.grantsFolderID))
	} else {
		s.grantsFolderID = grantsFolderResp.Files[0].Id
		log.Printf("[API]   Discovered Grants folder: %s", maskString(s.grantsFolderID))
	}

	return nil
}

// maskString masks all but the first 8 and last 4 characters
func maskString(s string) string {
	if s == "" {
		return "(not set)"
	}
	if len(s) <= 12 {
		return s[:len(s)/2] + "..."
	}
	return s[:8] + "..." + s[len(s)-4:]
}

// IsConfigured returns true if the server has service account credentials
func (s *Server) IsConfigured() bool {
	return s.credentials != nil || os.Getenv("GOOGLE_APPLICATION_CREDENTIALS") != ""
}

// sheetsService returns an authenticated Sheets API service (cached)
func (s *Server) sheetsService(ctx context.Context) (*sheets.Service, error) {
	s.clientMu.Lock()
	defer s.clientMu.Unlock()

	if s.sheetsClient != nil {
		return s.sheetsClient, nil
	}

	var opts []option.ClientOption

	if s.credentials != nil {
		config, err := google.JWTConfigFromJSON(s.credentials, sheets.SpreadsheetsScope)
		if err != nil {
			return nil, fmt.Errorf("failed to parse service account credentials: %w", err)
		}
		opts = append(opts, option.WithTokenSource(config.TokenSource(ctx)))
	}

	srv, err := sheets.NewService(ctx, opts...)
	if err != nil {
		return nil, err
	}
	s.sheetsClient = srv
	return srv, nil
}

// driveService returns an authenticated Drive API service (cached)
func (s *Server) driveService(ctx context.Context) (*drive.Service, error) {
	s.clientMu.Lock()
	defer s.clientMu.Unlock()

	if s.driveClient != nil {
		return s.driveClient, nil
	}

	var opts []option.ClientOption

	if s.credentials != nil {
		config, err := google.JWTConfigFromJSON(s.credentials, drive.DriveScope)
		if err != nil {
			return nil, fmt.Errorf("failed to parse service account credentials: %w", err)
		}
		opts = append(opts, option.WithTokenSource(config.TokenSource(ctx)))
	}

	srv, err := drive.NewService(ctx, opts...)
	if err != nil {
		return nil, err
	}
	s.driveClient = srv
	return srv, nil
}

// docsService returns an authenticated Docs API service (cached)
func (s *Server) docsService(ctx context.Context) (*docs.Service, error) {
	s.clientMu.Lock()
	defer s.clientMu.Unlock()

	if s.docsClient != nil {
		return s.docsClient, nil
	}

	var opts []option.ClientOption

	if s.credentials != nil {
		config, err := google.JWTConfigFromJSON(s.credentials, docs.DocumentsScope)
		if err != nil {
			return nil, fmt.Errorf("failed to parse service account credentials: %w", err)
		}
		opts = append(opts, option.WithTokenSource(config.TokenSource(ctx)))
	}

	srv, err := docs.NewService(ctx, opts...)
	if err != nil {
		return nil, err
	}
	s.docsClient = srv
	return srv, nil
}

// ============================================
// Authorization middleware
// ============================================

// authCacheEntry stores cached authorization results
type authCacheEntry struct {
	hasAccess bool
	expires   time.Time
}

var (
	authCache     = make(map[string]*authCacheEntry)
	authCacheMu   sync.RWMutex
	cacheDuration = 5 * time.Minute
)

// UserInfo contains authenticated user information
type UserInfo struct {
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

// RequireAuth wraps a handler with authentication check
func RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		accessCookie, err := r.Cookie("gt_access_token")
		if err != nil || accessCookie.Value == "" {
			writeError(w, "Unauthorized: No access token", http.StatusUnauthorized)
			return
		}

		userCookie, err := r.Cookie("gt_user")
		if err != nil {
			writeError(w, "Unauthorized: No user info", http.StatusUnauthorized)
			return
		}

		decoded, err := base64.StdEncoding.DecodeString(userCookie.Value)
		if err != nil {
			writeError(w, "Unauthorized: Invalid user info", http.StatusUnauthorized)
			return
		}

		var user UserInfo
		if err := json.Unmarshal(decoded, &user); err != nil {
			writeError(w, "Unauthorized: Invalid user info", http.StatusUnauthorized)
			return
		}

		// Store in request context via headers
		r.Header.Set("X-User-Email", user.Email)
		r.Header.Set("X-User-Name", user.Name)
		r.Header.Set("X-Access-Token", accessCookie.Value)

		next(w, r)
	}
}

// RequireDriveAccess wraps a handler with Drive access verification (legacy, uses user token)
func RequireDriveAccess(folderId string, next http.HandlerFunc) http.HandlerFunc {
	return RequireAuth(func(w http.ResponseWriter, r *http.Request) {
		userEmail := r.Header.Get("X-User-Email")
		userToken := r.Header.Get("X-Access-Token")

		if folderId == "" {
			writeError(w, "Server configuration error: GRANTS_FOLDER_ID not set", http.StatusInternalServerError)
			return
		}

		// Check cache
		hasAccess, cacheHit := checkAuthCache(userEmail, folderId)
		if cacheHit {
			if !hasAccess {
				writeError(w, "Access denied. You do not have permission to this Grant Tracker instance.", http.StatusForbidden)
				return
			}
			next(w, r)
			return
		}

		// Verify access using user's token
		hasAccess, err := verifyDriveAccessWithToken(userToken, folderId)
		if err != nil {
			log.Printf("Error verifying drive access for %s: %v", userEmail, err)
			writeError(w, "Failed to verify access permissions", http.StatusInternalServerError)
			return
		}

		setAuthCache(userEmail, folderId, hasAccess)

		if !hasAccess {
			writeError(w, "Access denied. You do not have permission to this Grant Tracker instance.", http.StatusForbidden)
			return
		}

		next(w, r)
	})
}

// RequireAccess wraps a handler with access verification using the service account
// This is used when users have identity-only OAuth scopes
func (s *Server) RequireAccess(next http.HandlerFunc) http.HandlerFunc {
	return RequireAuth(func(w http.ResponseWriter, r *http.Request) {
		userEmail := r.Header.Get("X-User-Email")
		folderId := s.grantsFolderID

		if folderId == "" {
			writeError(w, "Server configuration error: GRANTS_FOLDER_ID not set", http.StatusInternalServerError)
			return
		}

		// Check cache
		hasAccess, cacheHit := checkAuthCache(userEmail, folderId)
		if cacheHit {
			if !hasAccess {
				writeError(w, "Access denied. You do not have permission to this Grant Tracker instance.", http.StatusForbidden)
				return
			}
			next(w, r)
			return
		}

		// Verify access using service account
		hasAccess, err := s.verifyDriveAccessWithServiceAccount(r.Context(), userEmail, folderId)
		if err != nil {
			log.Printf("Error verifying drive access for %s: %v", userEmail, err)
			writeError(w, "Failed to verify access permissions", http.StatusInternalServerError)
			return
		}

		setAuthCache(userEmail, folderId, hasAccess)

		if !hasAccess {
			writeError(w, "Access denied. You do not have permission to this Grant Tracker instance.", http.StatusForbidden)
			return
		}

		next(w, r)
	})
}

// verifyDriveAccessWithToken verifies access using the user's token (requires drive scopes)
func verifyDriveAccessWithToken(token, folderId string) (bool, error) {
	url := fmt.Sprintf("https://www.googleapis.com/drive/v3/files/%s?fields=id", folderId)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return false, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return true, nil
	}
	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusForbidden {
		return false, nil
	}

	body, _ := io.ReadAll(resp.Body)
	return false, fmt.Errorf("unexpected response %d: %s", resp.StatusCode, string(body))
}

// verifyDriveAccessWithServiceAccount checks if a user has access to a folder
// by listing the folder's permissions using the service account
func (s *Server) verifyDriveAccessWithServiceAccount(ctx context.Context, userEmail, folderId string) (bool, error) {
	srv, err := s.driveService(ctx)
	if err != nil {
		return false, fmt.Errorf("failed to get drive service: %w", err)
	}

	// List permissions on the folder
	perms, err := srv.Permissions.List(folderId).
		SupportsAllDrives(true).
		Fields("permissions(emailAddress,role,type)").
		Do()
	if err != nil {
		return false, fmt.Errorf("failed to list permissions: %w", err)
	}

	// Check if user's email is in the permissions
	for _, perm := range perms.Permissions {
		// Check direct user permission
		if perm.Type == "user" && perm.EmailAddress == userEmail {
			return true, nil
		}
		// Check domain-wide permission (anyone in the domain)
		if perm.Type == "domain" {
			// Extract domain from user email
			parts := splitEmail(userEmail)
			if len(parts) == 2 && perm.Domain == parts[1] {
				return true, nil
			}
		}
		// "anyone" type means public access
		if perm.Type == "anyone" {
			return true, nil
		}
	}

	return false, nil
}

// splitEmail splits an email into local and domain parts
func splitEmail(email string) []string {
	for i := len(email) - 1; i >= 0; i-- {
		if email[i] == '@' {
			return []string{email[:i], email[i+1:]}
		}
	}
	return []string{email}
}

func checkAuthCache(email, folderId string) (bool, bool) {
	key := email + ":" + folderId
	authCacheMu.RLock()
	entry, exists := authCache[key]
	authCacheMu.RUnlock()

	if !exists || time.Now().After(entry.expires) {
		return false, false
	}
	return entry.hasAccess, true
}

func setAuthCache(email, folderId string, hasAccess bool) {
	key := email + ":" + folderId
	authCacheMu.Lock()
	authCache[key] = &authCacheEntry{
		hasAccess: hasAccess,
		expires:   time.Now().Add(cacheDuration),
	}
	authCacheMu.Unlock()
}

// ============================================
// Helper functions
// ============================================

func writeError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(Error{Error: message})
}

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func decodeBody(r *http.Request, v interface{}) error {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		return fmt.Errorf("invalid request body: %w", err)
	}
	return nil
}

// ============================================
// Config endpoint
// ============================================

func (s *Server) GetConfig(w http.ResponseWriter, r *http.Request) {
	config := Config{
		ClientId:              s.clientID,
		ServiceAccountEnabled: s.IsConfigured(),
	}

	if s.IsConfigured() {
		if s.spreadsheetID != "" {
			config.SpreadsheetId = &s.spreadsheetID
		}
		if s.grantsFolderID != "" {
			config.GrantsFolderId = &s.grantsFolderID
		}
	}

	log.Printf("[API] GetConfig: serviceAccountEnabled=%v, spreadsheetId=%v, grantsFolderId=%v",
		config.ServiceAccountEnabled,
		config.SpreadsheetId != nil,
		config.GrantsFolderId != nil)

	writeJSON(w, config)
}

// ============================================
// Sheets endpoints
// ============================================

func (s *Server) ReadSheet(w http.ResponseWriter, r *http.Request) {
	var req ReadSheetRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Sheet == "" {
		writeError(w, "Sheet name is required", http.StatusBadRequest)
		return
	}

	log.Printf("[API] ReadSheet: %s (spreadsheet: %s)", req.Sheet, maskString(s.spreadsheetID))

	rangeStr := req.Sheet
	if req.Range != nil && *req.Range != "" {
		rangeStr = req.Sheet + "!" + *req.Range
	}

	srv, err := s.sheetsService(r.Context())
	if err != nil {
		log.Printf("Failed to create Sheets service: %v", err)
		writeError(w, "Failed to connect to Google Sheets", http.StatusInternalServerError)
		return
	}

	resp, err := srv.Spreadsheets.Values.Get(s.spreadsheetID, rangeStr).
		ValueRenderOption("UNFORMATTED_VALUE").Do()
	if err != nil {
		log.Printf("Failed to read sheet %s: %v", req.Sheet, err)
		writeError(w, fmt.Sprintf("Failed to read sheet: %v", err), http.StatusInternalServerError)
		return
	}

	var headers []string
	var rows [][]interface{}

	if len(resp.Values) > 0 {
		for _, v := range resp.Values[0] {
			headers = append(headers, fmt.Sprintf("%v", v))
		}
		if len(resp.Values) > 1 {
			rows = resp.Values[1:]
		}
	}

	log.Printf("[API] ReadSheet %s: %d headers, %d rows", req.Sheet, len(headers), len(rows))
	if len(headers) > 0 {
		log.Printf("[API]   Headers: %v", headers)
	}

	writeJSON(w, ReadSheetResponse{Headers: headers, Rows: rows})
}

func (s *Server) AppendRow(w http.ResponseWriter, r *http.Request) {
	var req AppendRowRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Sheet == "" {
		writeError(w, "Sheet name is required", http.StatusBadRequest)
		return
	}

	srv, err := s.sheetsService(r.Context())
	if err != nil {
		log.Printf("Failed to create Sheets service: %v", err)
		writeError(w, "Failed to connect to Google Sheets", http.StatusInternalServerError)
		return
	}

	// Get headers
	headersResp, err := srv.Spreadsheets.Values.Get(s.spreadsheetID, req.Sheet+"!1:1").Do()
	if err != nil {
		log.Printf("Failed to get headers: %v", err)
		writeError(w, "Failed to get sheet headers", http.StatusInternalServerError)
		return
	}

	if len(headersResp.Values) == 0 || len(headersResp.Values[0]) == 0 {
		writeError(w, "Sheet has no headers", http.StatusBadRequest)
		return
	}

	// Build row in header order
	var rowValues []interface{}
	for _, header := range headersResp.Values[0] {
		headerStr := fmt.Sprintf("%v", header)
		if val, ok := req.Row[headerStr]; ok {
			rowValues = append(rowValues, val)
		} else {
			rowValues = append(rowValues, "")
		}
	}

	valueRange := &sheets.ValueRange{Values: [][]interface{}{rowValues}}
	_, err = srv.Spreadsheets.Values.Append(s.spreadsheetID, req.Sheet, valueRange).
		ValueInputOption("USER_ENTERED").
		InsertDataOption("INSERT_ROWS").
		Do()

	if err != nil {
		log.Printf("Failed to append row: %v", err)
		writeError(w, fmt.Sprintf("Failed to append row: %v", err), http.StatusInternalServerError)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	log.Printf("AUDIT: %s appended row to %s", userEmail, req.Sheet)

	writeJSON(w, SuccessResponse{Success: true})
}

func (s *Server) UpdateRow(w http.ResponseWriter, r *http.Request) {
	var req UpdateRowRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Sheet == "" || req.IdColumn == "" || req.Id == "" {
		writeError(w, "Sheet, idColumn, and id are required", http.StatusBadRequest)
		return
	}

	srv, err := s.sheetsService(r.Context())
	if err != nil {
		log.Printf("Failed to create Sheets service: %v", err)
		writeError(w, "Failed to connect to Google Sheets", http.StatusInternalServerError)
		return
	}

	resp, err := srv.Spreadsheets.Values.Get(s.spreadsheetID, req.Sheet).Do()
	if err != nil {
		log.Printf("Failed to read sheet: %v", err)
		writeError(w, "Failed to read sheet", http.StatusInternalServerError)
		return
	}

	if len(resp.Values) < 2 {
		writeError(w, "Sheet has no data rows", http.StatusNotFound)
		return
	}

	// Find ID column
	headers := resp.Values[0]
	idColIdx := -1
	for i, h := range headers {
		if fmt.Sprintf("%v", h) == req.IdColumn {
			idColIdx = i
			break
		}
	}

	if idColIdx == -1 {
		writeError(w, fmt.Sprintf("Column %s not found", req.IdColumn), http.StatusBadRequest)
		return
	}

	// Find row
	rowIdx := -1
	for i, row := range resp.Values[1:] {
		if len(row) > idColIdx && fmt.Sprintf("%v", row[idColIdx]) == req.Id {
			rowIdx = i + 2
			break
		}
	}

	if rowIdx == -1 {
		writeError(w, fmt.Sprintf("Row with %s=%s not found", req.IdColumn, req.Id), http.StatusNotFound)
		return
	}

	// Update row
	existingRow := resp.Values[rowIdx-1]
	for colIdx, header := range headers {
		headerStr := fmt.Sprintf("%v", header)
		if val, ok := req.Data[headerStr]; ok {
			for len(existingRow) <= colIdx {
				existingRow = append(existingRow, "")
			}
			existingRow[colIdx] = val
		}
	}

	rangeStr := fmt.Sprintf("%s!A%d", req.Sheet, rowIdx)
	valueRange := &sheets.ValueRange{Values: [][]interface{}{existingRow}}
	_, err = srv.Spreadsheets.Values.Update(s.spreadsheetID, rangeStr, valueRange).
		ValueInputOption("USER_ENTERED").
		Do()

	if err != nil {
		log.Printf("Failed to update row: %v", err)
		writeError(w, fmt.Sprintf("Failed to update row: %v", err), http.StatusInternalServerError)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	log.Printf("AUDIT: %s updated %s in %s (row %d)", userEmail, req.Id, req.Sheet, rowIdx)

	writeJSON(w, SuccessResponse{Success: true})
}

func (s *Server) DeleteRow(w http.ResponseWriter, r *http.Request) {
	var req DeleteRowRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Sheet == "" || req.IdColumn == "" || req.Id == "" {
		writeError(w, "Sheet, idColumn, and id are required", http.StatusBadRequest)
		return
	}

	srv, err := s.sheetsService(r.Context())
	if err != nil {
		log.Printf("Failed to create Sheets service: %v", err)
		writeError(w, "Failed to connect to Google Sheets", http.StatusInternalServerError)
		return
	}

	// Get spreadsheet to find sheet ID
	spreadsheet, err := srv.Spreadsheets.Get(s.spreadsheetID).Do()
	if err != nil {
		log.Printf("Failed to get spreadsheet: %v", err)
		writeError(w, "Failed to get spreadsheet", http.StatusInternalServerError)
		return
	}

	var sheetID int64 = -1
	for _, sheet := range spreadsheet.Sheets {
		if sheet.Properties.Title == req.Sheet {
			sheetID = sheet.Properties.SheetId
			break
		}
	}

	if sheetID == -1 {
		writeError(w, fmt.Sprintf("Sheet %s not found", req.Sheet), http.StatusNotFound)
		return
	}

	// Read data to find row
	resp, err := srv.Spreadsheets.Values.Get(s.spreadsheetID, req.Sheet).Do()
	if err != nil {
		log.Printf("Failed to read sheet: %v", err)
		writeError(w, "Failed to read sheet", http.StatusInternalServerError)
		return
	}

	if len(resp.Values) < 2 {
		writeError(w, "Sheet has no data rows", http.StatusNotFound)
		return
	}

	// Find ID column
	headers := resp.Values[0]
	idColIdx := -1
	for i, h := range headers {
		if fmt.Sprintf("%v", h) == req.IdColumn {
			idColIdx = i
			break
		}
	}

	if idColIdx == -1 {
		writeError(w, fmt.Sprintf("Column %s not found", req.IdColumn), http.StatusBadRequest)
		return
	}

	// Find row
	rowIdx := -1
	for i, row := range resp.Values[1:] {
		if len(row) > idColIdx && fmt.Sprintf("%v", row[idColIdx]) == req.Id {
			rowIdx = i + 1 // 0-based for delete
			break
		}
	}

	if rowIdx == -1 {
		writeError(w, fmt.Sprintf("Row with %s=%s not found", req.IdColumn, req.Id), http.StatusNotFound)
		return
	}

	// Delete row
	deleteReq := &sheets.BatchUpdateSpreadsheetRequest{
		Requests: []*sheets.Request{{
			DeleteDimension: &sheets.DeleteDimensionRequest{
				Range: &sheets.DimensionRange{
					SheetId:    sheetID,
					Dimension:  "ROWS",
					StartIndex: int64(rowIdx),
					EndIndex:   int64(rowIdx + 1),
				},
			},
		}},
	}

	_, err = srv.Spreadsheets.BatchUpdate(s.spreadsheetID, deleteReq).Do()
	if err != nil {
		log.Printf("Failed to delete row: %v", err)
		writeError(w, fmt.Sprintf("Failed to delete row: %v", err), http.StatusInternalServerError)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	log.Printf("AUDIT: %s deleted %s from %s", userEmail, req.Id, req.Sheet)

	writeJSON(w, SuccessResponse{Success: true})
}

func (s *Server) BatchUpdateCells(w http.ResponseWriter, r *http.Request) {
	var req BatchUpdateRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Sheet == "" || len(req.Updates) == 0 {
		writeError(w, "Sheet and updates are required", http.StatusBadRequest)
		return
	}

	srv, err := s.sheetsService(r.Context())
	if err != nil {
		log.Printf("Failed to create Sheets service: %v", err)
		writeError(w, "Failed to connect to Google Sheets", http.StatusInternalServerError)
		return
	}

	var data []*sheets.ValueRange
	for _, update := range req.Updates {
		data = append(data, &sheets.ValueRange{
			Range:  req.Sheet + "!" + update.Range,
			Values: [][]interface{}{update.Values},
		})
	}

	batchReq := &sheets.BatchUpdateValuesRequest{
		ValueInputOption: "USER_ENTERED",
		Data:             data,
	}

	_, err = srv.Spreadsheets.Values.BatchUpdate(s.spreadsheetID, batchReq).Do()
	if err != nil {
		log.Printf("Failed to batch update: %v", err)
		writeError(w, fmt.Sprintf("Failed to batch update: %v", err), http.StatusInternalServerError)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	log.Printf("AUDIT: %s batch updated %d cells in %s", userEmail, len(data), req.Sheet)

	writeJSON(w, SuccessResponse{Success: true})
}

// ============================================
// Drive endpoints
// ============================================

func (s *Server) ListFiles(w http.ResponseWriter, r *http.Request) {
	var req ListFilesRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err.Error(), http.StatusBadRequest)
		return
	}

	folderId := s.grantsFolderID
	if req.FolderId != nil && *req.FolderId != "" {
		folderId = *req.FolderId
	}

	if folderId == "" {
		writeError(w, "Folder ID is required", http.StatusBadRequest)
		return
	}

	srv, err := s.driveService(r.Context())
	if err != nil {
		log.Printf("Failed to create Drive service: %v", err)
		writeError(w, "Failed to connect to Google Drive", http.StatusInternalServerError)
		return
	}

	query := fmt.Sprintf("'%s' in parents and trashed = false", folderId)
	if req.Query != nil && *req.Query != "" {
		query = query + " and " + *req.Query
	}

	resp, err := srv.Files.List().
		Q(query).
		Fields("files(id, name, mimeType, modifiedTime, webViewLink, shortcutDetails)").
		OrderBy("name").
		PageSize(1000).
		SupportsAllDrives(true).
		IncludeItemsFromAllDrives(true).
		Do()

	if err != nil {
		log.Printf("Failed to list files: %v", err)
		writeError(w, fmt.Sprintf("Failed to list files: %v", err), http.StatusInternalServerError)
		return
	}

	files := make([]FileInfo, 0, len(resp.Files))
	for _, f := range resp.Files {
		fi := FileInfo{
			Id:          f.Id,
			Name:        f.Name,
			MimeType:    f.MimeType,
			WebViewLink: &f.WebViewLink,
		}
		if f.ModifiedTime != "" {
			if t, err := time.Parse(time.RFC3339, f.ModifiedTime); err == nil {
				fi.ModifiedTime = &t
			}
		}
		if f.ShortcutDetails != nil {
			fi.ShortcutDetails = &ShortcutDetails{
				TargetId:       &f.ShortcutDetails.TargetId,
				TargetMimeType: &f.ShortcutDetails.TargetMimeType,
			}
		}
		files = append(files, fi)
	}

	writeJSON(w, ListFilesResponse{Files: files})
}

func (s *Server) CreateFolder(w http.ResponseWriter, r *http.Request) {
	var req CreateFolderRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		writeError(w, "Folder name is required", http.StatusBadRequest)
		return
	}

	parentID := s.grantsFolderID
	if req.ParentId != nil && *req.ParentId != "" {
		parentID = *req.ParentId
	}

	srv, err := s.driveService(r.Context())
	if err != nil {
		log.Printf("Failed to create Drive service: %v", err)
		writeError(w, "Failed to connect to Google Drive", http.StatusInternalServerError)
		return
	}

	folder := &drive.File{
		Name:     req.Name,
		MimeType: "application/vnd.google-apps.folder",
		Parents:  []string{parentID},
	}

	created, err := srv.Files.Create(folder).
		Fields("id, webViewLink").
		SupportsAllDrives(true).
		Do()

	if err != nil {
		log.Printf("Failed to create folder: %v", err)
		writeError(w, fmt.Sprintf("Failed to create folder: %v", err), http.StatusInternalServerError)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	log.Printf("AUDIT: %s created folder %s (%s)", userEmail, req.Name, created.Id)

	writeJSON(w, CreateFolderResponse{Id: created.Id, Url: created.WebViewLink})
}

func (s *Server) CreateDoc(w http.ResponseWriter, r *http.Request) {
	var req CreateDocRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		writeError(w, "Name is required", http.StatusBadRequest)
		return
	}

	parentID := s.grantsFolderID
	if req.ParentId != nil && *req.ParentId != "" {
		parentID = *req.ParentId
	}

	srv, err := s.driveService(r.Context())
	if err != nil {
		log.Printf("Failed to create Drive service: %v", err)
		writeError(w, "Failed to connect to Google Drive", http.StatusInternalServerError)
		return
	}

	doc := &drive.File{
		Name:     req.Name,
		MimeType: string(req.MimeType),
		Parents:  []string{parentID},
	}

	created, err := srv.Files.Create(doc).
		Fields("id, webViewLink").
		SupportsAllDrives(true).
		Do()

	if err != nil {
		log.Printf("Failed to create document: %v", err)
		writeError(w, fmt.Sprintf("Failed to create document: %v", err), http.StatusInternalServerError)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	log.Printf("AUDIT: %s created doc %s (%s) type %s", userEmail, req.Name, created.Id, req.MimeType)

	writeJSON(w, CreateDocResponse{Id: created.Id, Url: created.WebViewLink})
}

func (s *Server) CreateShortcut(w http.ResponseWriter, r *http.Request) {
	var req CreateShortcutRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.TargetId == "" || req.ParentId == "" {
		writeError(w, "TargetId and parentId are required", http.StatusBadRequest)
		return
	}

	srv, err := s.driveService(r.Context())
	if err != nil {
		log.Printf("Failed to create Drive service: %v", err)
		writeError(w, "Failed to connect to Google Drive", http.StatusInternalServerError)
		return
	}

	name := ""
	if req.Name != nil {
		name = *req.Name
	}
	if name == "" {
		target, err := srv.Files.Get(req.TargetId).
			Fields("name").
			SupportsAllDrives(true).
			Do()
		if err != nil {
			log.Printf("Failed to get target file: %v", err)
			writeError(w, "Failed to get target file info", http.StatusInternalServerError)
			return
		}
		name = target.Name
	}

	shortcut := &drive.File{
		Name:     name,
		MimeType: "application/vnd.google-apps.shortcut",
		Parents:  []string{req.ParentId},
		ShortcutDetails: &drive.FileShortcutDetails{
			TargetId: req.TargetId,
		},
	}

	created, err := srv.Files.Create(shortcut).
		Fields("id").
		SupportsAllDrives(true).
		Do()

	if err != nil {
		log.Printf("Failed to create shortcut: %v", err)
		writeError(w, fmt.Sprintf("Failed to create shortcut: %v", err), http.StatusInternalServerError)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	log.Printf("AUDIT: %s created shortcut to %s in %s", userEmail, req.TargetId, req.ParentId)

	writeJSON(w, CreateShortcutResponse{Id: created.Id})
}

func (s *Server) MoveFile(w http.ResponseWriter, r *http.Request) {
	var req MoveFileRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.FileId == "" || req.NewParentId == "" {
		writeError(w, "FileId and newParentId are required", http.StatusBadRequest)
		return
	}

	srv, err := s.driveService(r.Context())
	if err != nil {
		log.Printf("Failed to create Drive service: %v", err)
		writeError(w, "Failed to connect to Google Drive", http.StatusInternalServerError)
		return
	}

	prevParent := ""
	if req.PrevParentId != nil {
		prevParent = *req.PrevParentId
	}
	if prevParent == "" {
		file, err := srv.Files.Get(req.FileId).
			Fields("parents").
			SupportsAllDrives(true).
			Do()
		if err != nil {
			log.Printf("Failed to get file parents: %v", err)
			writeError(w, "Failed to get file info", http.StatusInternalServerError)
			return
		}
		if len(file.Parents) > 0 {
			prevParent = file.Parents[0]
		}
	}

	_, err = srv.Files.Update(req.FileId, nil).
		AddParents(req.NewParentId).
		RemoveParents(prevParent).
		SupportsAllDrives(true).
		Do()

	if err != nil {
		log.Printf("Failed to move file: %v", err)
		writeError(w, fmt.Sprintf("Failed to move file: %v", err), http.StatusInternalServerError)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	log.Printf("AUDIT: %s moved file %s to %s", userEmail, req.FileId, req.NewParentId)

	writeJSON(w, SuccessResponse{Success: true})
}

func (s *Server) GetFile(w http.ResponseWriter, r *http.Request) {
	var req GetFileRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.FileId == "" {
		writeError(w, "FileId is required", http.StatusBadRequest)
		return
	}

	srv, err := s.driveService(r.Context())
	if err != nil {
		log.Printf("Failed to create Drive service: %v", err)
		writeError(w, "Failed to connect to Google Drive", http.StatusInternalServerError)
		return
	}

	file, err := srv.Files.Get(req.FileId).
		Fields("id, name, mimeType, modifiedTime, webViewLink, shortcutDetails").
		SupportsAllDrives(true).
		Do()

	if err != nil {
		log.Printf("Failed to get file: %v", err)
		writeError(w, fmt.Sprintf("Failed to get file: %v", err), http.StatusInternalServerError)
		return
	}

	fi := FileInfo{
		Id:          file.Id,
		Name:        file.Name,
		MimeType:    file.MimeType,
		WebViewLink: &file.WebViewLink,
	}
	if file.ModifiedTime != "" {
		if t, err := time.Parse(time.RFC3339, file.ModifiedTime); err == nil {
			fi.ModifiedTime = &t
		}
	}
	if file.ShortcutDetails != nil {
		fi.ShortcutDetails = &ShortcutDetails{
			TargetId:       &file.ShortcutDetails.TargetId,
			TargetMimeType: &file.ShortcutDetails.TargetMimeType,
		}
	}

	writeJSON(w, fi)
}

// ============================================
// Docs API endpoints
// ============================================

// InitializeTrackerDocRequest is the request body for initializing a tracker doc
type InitializeTrackerDocRequest struct {
	DocumentId string            `json:"documentId"`
	Grant      map[string]string `json:"grant"`
	Approvers  []string          `json:"approvers,omitempty"`
}

// InitializeTrackerDoc populates a tracker doc with grant metadata
func (s *Server) InitializeTrackerDoc(w http.ResponseWriter, r *http.Request) {
	var req InitializeTrackerDocRequest
	if err := decodeBody(r, &req); err != nil {
		writeError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.DocumentId == "" {
		writeError(w, "documentId is required", http.StatusBadRequest)
		return
	}

	srv, err := s.docsService(r.Context())
	if err != nil {
		log.Printf("Failed to create Docs service: %v", err)
		writeError(w, "Failed to connect to Google Docs", http.StatusInternalServerError)
		return
	}

	// Build the document content
	var requests []*docs.Request

	// Start with Status heading
	content := "Status\n\n"

	// Add project metadata table if grant data provided
	if len(req.Grant) > 0 {
		content += "Project Metadata\n"
	}

	// Insert the content at the beginning
	requests = append(requests, &docs.Request{
		InsertText: &docs.InsertTextRequest{
			Location: &docs.Location{Index: 1},
			Text:     content,
		},
	})

	// Format "Status" as Heading 1
	requests = append(requests, &docs.Request{
		UpdateParagraphStyle: &docs.UpdateParagraphStyleRequest{
			Range: &docs.Range{
				StartIndex: 1,
				EndIndex:   8, // "Status\n"
			},
			ParagraphStyle: &docs.ParagraphStyle{
				NamedStyleType: "HEADING_1",
			},
			Fields: "namedStyleType",
		},
	})

	// If we have grant data, format "Project Metadata" as Heading 2
	if len(req.Grant) > 0 {
		metadataStart := 9 // After "Status\n\n"
		metadataEnd := metadataStart + 17 // "Project Metadata\n"
		requests = append(requests, &docs.Request{
			UpdateParagraphStyle: &docs.UpdateParagraphStyleRequest{
				Range: &docs.Range{
					StartIndex: int64(metadataStart),
					EndIndex:   int64(metadataEnd),
				},
				ParagraphStyle: &docs.ParagraphStyle{
					NamedStyleType: "HEADING_2",
				},
				Fields: "namedStyleType",
			},
		})

		// Build metadata table content
		tableRows := [][]string{
			{"Field", "Value"},
		}

		// Add key grant fields
		fieldOrder := []string{"ID", "Title", "Organization", "Amount", "Status", "Year"}
		for _, field := range fieldOrder {
			if val, ok := req.Grant[field]; ok && val != "" {
				tableRows = append(tableRows, []string{field, val})
			}
		}

		// Create and insert table if we have data
		if len(tableRows) > 1 {
			// Insert table after the heading
			tableIndex := int64(metadataEnd)
			requests = append(requests, &docs.Request{
				InsertTable: &docs.InsertTableRequest{
					Location: &docs.Location{Index: tableIndex},
					Rows:     int64(len(tableRows)),
					Columns:  2,
				},
			})
		}
	}

	// Add Approvals section if approvers provided
	if len(req.Approvers) > 0 {
		// We'll add this after the initial content is inserted
		// For now, just add a placeholder - the table structure is complex
	}

	// Execute batch update
	_, err = srv.Documents.BatchUpdate(req.DocumentId, &docs.BatchUpdateDocumentRequest{
		Requests: requests,
	}).Do()

	if err != nil {
		log.Printf("Failed to initialize tracker doc: %v", err)
		writeError(w, fmt.Sprintf("Failed to initialize document: %v", err), http.StatusInternalServerError)
		return
	}

	userEmail := r.Header.Get("X-User-Email")
	log.Printf("AUDIT: %s initialized tracker doc %s", userEmail, req.DocumentId)

	writeJSON(w, map[string]bool{"success": true})
}
