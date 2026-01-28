package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/grant-tracker/server/api"
)

var (
	clientID      string
	clientSecret  string
	redirectURI   string
	staticDir     string
	allowedOrigin string
	apiServer     *api.Server
)

// TokenResponse represents the response from Google's token endpoint
type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
	Scope        string `json:"scope,omitempty"`
}

// UserInfo represents basic user profile info
type UserInfo struct {
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

func main() {
	// Load configuration from environment
	clientID = os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret = os.Getenv("GOOGLE_CLIENT_SECRET")
	redirectURI = os.Getenv("REDIRECT_URI")
	staticDir = os.Getenv("STATIC_DIR")
	allowedOrigin = os.Getenv("ALLOWED_ORIGIN")

	if clientID == "" || clientSecret == "" {
		log.Fatal("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set")
	}

	if staticDir == "" {
		staticDir = "./static"
	}

	// Default redirect URI for local development
	if redirectURI == "" {
		if publicURL := os.Getenv("PUBLIC_URL"); publicURL != "" {
			redirectURI = publicURL + "/auth/callback"
		} else {
			redirectURI = "http://localhost:8080/auth/callback"
		}
	}
	log.Printf("Using redirect URI: %s", redirectURI)

	// Initialize API server (service account)
	var err error
	apiServer, err = api.NewServer(clientID)
	if err != nil {
		log.Printf("Warning: API server initialization failed: %v", err)
		log.Printf("Service account API endpoints will not be available")
	}

	// Create router
	mux := http.NewServeMux()

	// Auth endpoints
	mux.HandleFunc("/auth/login", handleLogin)
	mux.HandleFunc("/auth/callback", handleCallback)
	mux.HandleFunc("/auth/refresh", handleRefresh)
	mux.HandleFunc("/auth/logout", handleLogout)
	mux.HandleFunc("/auth/status", handleStatus)

	// Register API routes if service account is available
	if apiServer != nil && apiServer.IsConfigured() {
		grantsFolderID := os.Getenv("GRANTS_FOLDER_ID")

		// Config endpoint (public)
		mux.HandleFunc("/api/config", apiServer.GetConfig)

		// Sheets endpoints (require auth + drive access)
		mux.HandleFunc("/api/sheets/read", api.RequireDriveAccess(grantsFolderID, apiServer.ReadSheet))
		mux.HandleFunc("/api/sheets/append", api.RequireDriveAccess(grantsFolderID, apiServer.AppendRow))
		mux.HandleFunc("/api/sheets/update", api.RequireDriveAccess(grantsFolderID, apiServer.UpdateRow))
		mux.HandleFunc("/api/sheets/delete", api.RequireDriveAccess(grantsFolderID, apiServer.DeleteRow))
		mux.HandleFunc("/api/sheets/batch-update", api.RequireDriveAccess(grantsFolderID, apiServer.BatchUpdateCells))

		// Drive endpoints (require auth + drive access)
		mux.HandleFunc("/api/drive/list", api.RequireDriveAccess(grantsFolderID, apiServer.ListFiles))
		mux.HandleFunc("/api/drive/create-folder", api.RequireDriveAccess(grantsFolderID, apiServer.CreateFolder))
		mux.HandleFunc("/api/drive/create-doc", api.RequireDriveAccess(grantsFolderID, apiServer.CreateDoc))
		mux.HandleFunc("/api/drive/create-shortcut", api.RequireDriveAccess(grantsFolderID, apiServer.CreateShortcut))
		mux.HandleFunc("/api/drive/move", api.RequireDriveAccess(grantsFolderID, apiServer.MoveFile))
		mux.HandleFunc("/api/drive/get", api.RequireDriveAccess(grantsFolderID, apiServer.GetFile))

		log.Printf("Service account API routes registered")
	} else {
		// Fallback config endpoint without service account
		mux.HandleFunc("/api/config", handleConfigFallback)
		log.Printf("Running without service account - client-side auth only")
	}

	// Static files and SPA routing
	mux.HandleFunc("/", handleStatic)

	// Wrap with logging and CORS
	handler := logRequests(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on :%s", port)
	log.Printf("Static files from: %s", staticDir)
	log.Printf("Redirect URI: %s", redirectURI)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}

// logRequests is a simple logging middleware
func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

// generateState creates a random state parameter for CSRF protection
func generateState() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

// handleLogin initiates the OAuth flow
func handleLogin(w http.ResponseWriter, r *http.Request) {
	state := generateState()

	// Store state in a short-lived cookie for verification
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		MaxAge:   600, // 10 minutes
		Secure:   r.TLS != nil || strings.HasPrefix(redirectURI, "https"),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	// Build Google OAuth URL
	authURL := "https://accounts.google.com/o/oauth2/v2/auth?" + url.Values{
		"client_id":     {clientID},
		"redirect_uri":  {redirectURI},
		"response_type": {"code"},
		"scope":         {"openid email profile https://www.googleapis.com/auth/drive.file"},
		"access_type":   {"offline"},
		"prompt":        {"consent"},
		"state":         {state},
	}.Encode()

	http.Redirect(w, r, authURL, http.StatusFound)
}

// handleCallback processes the OAuth callback from Google
func handleCallback(w http.ResponseWriter, r *http.Request) {
	// Verify state
	stateCookie, err := r.Cookie("oauth_state")
	if err != nil || stateCookie.Value != r.URL.Query().Get("state") {
		http.Error(w, "Invalid state parameter", http.StatusBadRequest)
		return
	}

	// Clear state cookie
	http.SetCookie(w, &http.Cookie{
		Name:   "oauth_state",
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})

	// Check for errors from Google
	if errParam := r.URL.Query().Get("error"); errParam != "" {
		http.Error(w, "OAuth error: "+errParam, http.StatusBadRequest)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "Missing authorization code", http.StatusBadRequest)
		return
	}

	// Exchange code for tokens
	tokens, err := exchangeCode(code)
	if err != nil {
		log.Printf("Token exchange error: %v", err)
		http.Error(w, "Failed to exchange code for tokens", http.StatusInternalServerError)
		return
	}

	// Get user info
	userInfo, err := getUserInfo(tokens.AccessToken)
	if err != nil {
		log.Printf("Get user info error: %v", err)
		http.Error(w, "Failed to get user info", http.StatusInternalServerError)
		return
	}

	// Set cookies with tokens
	secure := r.TLS != nil || strings.HasPrefix(redirectURI, "https")
	maxAge := 7 * 24 * 60 * 60 // 7 days

	// Refresh token cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "gt_refresh_token",
		Value:    tokens.RefreshToken,
		Path:     "/",
		MaxAge:   maxAge,
		Secure:   secure,
		HttpOnly: true, // Not accessible to JS - only sent to our server
		SameSite: http.SameSiteLaxMode,
	})

	// Access token cookie (JS needs to read this for direct Google API calls)
	http.SetCookie(w, &http.Cookie{
		Name:     "gt_access_token",
		Value:    tokens.AccessToken,
		Path:     "/",
		MaxAge:   tokens.ExpiresIn,
		Secure:   secure,
		HttpOnly: false, // JS readable
		SameSite: http.SameSiteLaxMode,
	})

	// User info cookie (JS readable for display)
	userJSON, _ := json.Marshal(userInfo)
	http.SetCookie(w, &http.Cookie{
		Name:     "gt_user",
		Value:    base64.StdEncoding.EncodeToString(userJSON),
		Path:     "/",
		MaxAge:   maxAge,
		Secure:   secure,
		HttpOnly: false,
		SameSite: http.SameSiteLaxMode,
	})

	// Redirect to app
	http.Redirect(w, r, "/", http.StatusFound)
}

// handleRefresh refreshes the access token using the refresh token
func handleRefresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get refresh token from cookie
	refreshCookie, err := r.Cookie("gt_refresh_token")
	if err != nil {
		http.Error(w, "No refresh token", http.StatusUnauthorized)
		return
	}

	// Refresh the token
	tokens, err := refreshToken(refreshCookie.Value)
	if err != nil {
		log.Printf("Token refresh error: %v", err)
		http.Error(w, "Failed to refresh token", http.StatusUnauthorized)
		return
	}

	// Update access token cookie
	secure := r.TLS != nil || strings.HasPrefix(redirectURI, "https")
	http.SetCookie(w, &http.Cookie{
		Name:     "gt_access_token",
		Value:    tokens.AccessToken,
		Path:     "/",
		MaxAge:   tokens.ExpiresIn,
		Secure:   secure,
		HttpOnly: false,
		SameSite: http.SameSiteLaxMode,
	})

	// Return token info
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"access_token": tokens.AccessToken,
		"expires_in":   tokens.ExpiresIn,
	})
}

// handleLogout clears all auth cookies
func handleLogout(w http.ResponseWriter, r *http.Request) {
	cookies := []string{"gt_refresh_token", "gt_access_token", "gt_user"}
	for _, name := range cookies {
		http.SetCookie(w, &http.Cookie{
			Name:   name,
			Value:  "",
			Path:   "/",
			MaxAge: -1,
		})
	}

	if r.Method == http.MethodPost {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	} else {
		http.Redirect(w, r, "/", http.StatusFound)
	}
}

// handleConfigFallback returns client configuration when no service account is available
func handleConfigFallback(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"clientId":              clientID,
		"serviceAccountEnabled": false,
	})
}

// handleStatus returns current auth status
func handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	accessCookie, err := r.Cookie("gt_access_token")
	if err != nil || accessCookie.Value == "" {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated": false,
		})
		return
	}

	// Decode user info from cookie
	var userInfo *UserInfo
	if userCookie, err := r.Cookie("gt_user"); err == nil {
		if decoded, err := base64.StdEncoding.DecodeString(userCookie.Value); err == nil {
			userInfo = &UserInfo{}
			json.Unmarshal(decoded, userInfo)
		}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"authenticated": true,
		"user":          userInfo,
	})
}

// handleStatic serves static files with SPA fallback
func handleStatic(w http.ResponseWriter, r *http.Request) {
	// Clean the path
	path := filepath.Clean(r.URL.Path)
	if path == "/" {
		path = "/index.html"
	}

	fullPath := filepath.Join(staticDir, path)

	// Check if file exists
	if _, err := os.Stat(fullPath); err == nil {
		http.ServeFile(w, r, fullPath)
		return
	}

	// SPA fallback - serve index.html for client-side routing
	indexPath := filepath.Join(staticDir, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	http.ServeFile(w, r, indexPath)
}

// exchangeCode exchanges an authorization code for tokens
func exchangeCode(code string) (*TokenResponse, error) {
	resp, err := http.PostForm("https://oauth2.googleapis.com/token", url.Values{
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"code":          {code},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token exchange failed: %s", string(body))
	}

	var tokens TokenResponse
	if err := json.Unmarshal(body, &tokens); err != nil {
		return nil, err
	}

	return &tokens, nil
}

// refreshToken uses a refresh token to get a new access token
func refreshToken(token string) (*TokenResponse, error) {
	resp, err := http.PostForm("https://oauth2.googleapis.com/token", url.Values{
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"refresh_token": {token},
		"grant_type":    {"refresh_token"},
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token refresh failed: %s", string(body))
	}

	var tokens TokenResponse
	if err := json.Unmarshal(body, &tokens); err != nil {
		return nil, err
	}

	return &tokens, nil
}

// getUserInfo fetches user profile information
func getUserInfo(accessToken string) (*UserInfo, error) {
	req, _ := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("get user info failed: %s", string(body))
	}

	var userInfo UserInfo
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, err
	}

	return &userInfo, nil
}
