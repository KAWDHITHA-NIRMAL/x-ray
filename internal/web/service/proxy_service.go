package service

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/KAWDHITHA-NIRMAL/x-ray/internal/logger"
)

// UrbanProxy represents an Urban VPN proxy server entry with authentication credentials.
type UrbanProxy struct {
	ID          string `json:"id"`
	Country     string `json:"country"`
	CountryCode string `json:"countryCode"`
	Group       string `json:"group"`
	ServerName  string `json:"serverName"`
	Host        string `json:"host"`
	Port        int    `json:"port"`
	Username    string `json:"username"`
	Password    string `json:"password"`
	ProxyURL    string `json:"proxyUrl"`
	CurlTest    string `json:"curlTest"`
	Weight      int    `json:"weight"`
	Pool        string `json:"pool"`
	Latency     *int   `json:"latency"`
	UpdatedAt   string `json:"updatedAt"`
	ExpiresAt   string `json:"expiresAt"`
}

// UrbanCountrySummary provides country-level aggregation for client proxy selection.
type UrbanCountrySummary struct {
	Country     string       `json:"country"`
	CountryCode string       `json:"countryCode"`
	Group       string       `json:"group"`
	ProxyCount  int          `json:"proxyCount"`
	AvgLatency  *int         `json:"avgLatency"`
	Servers     []UrbanProxy `json:"servers"`
}

// ProxyService manages the Urban VPN proxy pool, scraping cycles, and latency diagnostics.
type ProxyService struct {
	mu           sync.RWMutex
	countryDir   string
	scriptPath   string
	proxies      []UrbanProxy
	latencyMap   map[string]int
	lastRefresh  time.Time
	isRefreshing bool
}

var (
	defaultProxyService *ProxyService
	proxyOnce           sync.Once
)

// GetProxyService returns the singleton instance of ProxyService.
func GetProxyService() *ProxyService {
	proxyOnce.Do(func() {
		// Try standard directories: E:/urban/Country, /etc/xray/Country, ./Country
		candidateDirs := []string{
			"E:/urban/Country",
			filepath.Join(".", "Country"),
			"/etc/xray/Country",
		}
		selectedDir := "E:/urban/Country"
		for _, d := range candidateDirs {
			if info, err := os.Stat(d); err == nil && info.IsDir() {
				selectedDir = d
				break
			}
		}

		selectedScript := "E:/urban/app.py"
		if _, err := os.Stat("E:/urban/app.py"); err != nil {
			selectedScript = filepath.Join(".", "app.py")
		}

		defaultProxyService = &ProxyService{
			countryDir: selectedDir,
			scriptPath: selectedScript,
			latencyMap: make(map[string]int),
		}
		defaultProxyService.ReloadFromDisk()
		defaultProxyService.startAutoRefreshLoop()
	})
	return defaultProxyService
}

// ReloadFromDisk reads all country JSON files from the Country/ directory.
func (s *ProxyService) ReloadFromDisk() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := os.Stat(s.countryDir); err != nil {
		logger.Warningf("ProxyService: country directory not found: %s", s.countryDir)
		return
	}

	var loaded []UrbanProxy
	err := filepath.Walk(s.countryDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() || !strings.HasSuffix(info.Name(), ".json") {
			return nil
		}
		raw, readErr := os.ReadFile(path)
		if readErr != nil {
			return nil
		}
		var items []struct {
			Country     string `json:"country"`
			CountryCode string `json:"country_code"`
			Group       string `json:"group"`
			ServerName  string `json:"server_name"`
			Host        string `json:"host"`
			Port        int    `json:"port"`
			Username    string `json:"username"`
			Password    string `json:"password"`
			ProxyURL    string `json:"proxy_url"`
			CurlTest    string `json:"curl_test"`
			Weight      int    `json:"weight"`
			Pool        string `json:"pool"`
			UpdatedAt   string `json:"updated_at"`
			ExpiresAt   string `json:"expires_at"`
		}
		if jsonErr := json.Unmarshal(raw, &items); jsonErr == nil {
			for idx, it := range items {
				key := fmt.Sprintf("%s:%d", it.Host, it.Port)
				var lat *int
				if v, ok := s.latencyMap[key]; ok {
					val := v
					lat = &val
				}
				loaded = append(loaded, UrbanProxy{
					ID:          fmt.Sprintf("%s-%s-%d", it.CountryCode, it.ServerName, idx),
					Country:     it.Country,
					CountryCode: strings.ToUpper(it.CountryCode),
					Group:       it.Group,
					ServerName:  it.ServerName,
					Host:        it.Host,
					Port:        it.Port,
					Username:    it.Username,
					Password:    it.Password,
					ProxyURL:    it.ProxyURL,
					CurlTest:    it.CurlTest,
					Weight:      it.Weight,
					Pool:        it.Pool,
					Latency:     lat,
					UpdatedAt:   it.UpdatedAt,
					ExpiresAt:   it.ExpiresAt,
				})
			}
		}
		return nil
	})

	if err != nil {
		logger.Warningf("ProxyService: walk error: %v", err)
	}

	s.proxies = loaded
	s.lastRefresh = time.Now()
	logger.Infof("ProxyService: Loaded %d proxies from %s", len(loaded), s.countryDir)
}

// GetAllProxies returns the cached proxies list with filtering options.
func (s *ProxyService) GetAllProxies(groupFilter, countryFilter, search string) []UrbanProxy {
	s.mu.RLock()
	defer s.mu.RUnlock()

	search = strings.ToLower(strings.TrimSpace(search))
	groupFilter = strings.ToLower(strings.TrimSpace(groupFilter))
	countryFilter = strings.ToLower(strings.TrimSpace(countryFilter))

	var result []UrbanProxy
	for _, p := range s.proxies {
		if groupFilter != "" && groupFilter != "all" && strings.ToLower(p.Group) != groupFilter {
			continue
		}
		if countryFilter != "" && strings.ToLower(p.Country) != countryFilter && strings.ToLower(p.CountryCode) != countryFilter {
			continue
		}
		if search != "" {
			match := strings.Contains(strings.ToLower(p.Country), search) ||
				strings.Contains(strings.ToLower(p.CountryCode), search) ||
				strings.Contains(p.Host, search) ||
				strings.Contains(strings.ToLower(p.Group), search) ||
				strings.Contains(strings.ToLower(p.ServerName), search)
			if !match {
				continue
			}
		}
		result = append(result, p)
	}
	return result
}

// GetCountrySummaries aggregates available proxy servers by country.
func (s *ProxyService) GetCountrySummaries() []UrbanCountrySummary {
	s.mu.RLock()
	defer s.mu.RUnlock()

	groups := make(map[string]*UrbanCountrySummary)
	for _, p := range s.proxies {
		cs, exists := groups[p.Country]
		if !exists {
			cs = &UrbanCountrySummary{
				Country:     p.Country,
				CountryCode: p.CountryCode,
				Group:       p.Group,
				ProxyCount:  0,
				Servers:     []UrbanProxy{},
			}
			groups[p.Country] = cs
		}
		cs.ProxyCount++
		cs.Servers = append(cs.Servers, p)
	}

	var list []UrbanCountrySummary
	for _, cs := range groups {
		list = append(list, *cs)
	}
	return list
}

// Ping checks TCP connectivity and measures round-trip latency to host:port using an HTTP proxy probe.
func (s *ProxyService) Ping(host string, port int, timeout time.Duration) (int, error) {
	start := time.Now()
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", host, port), timeout)
	if err != nil {
		return 0, err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(timeout))
	probe := "CONNECT cp.cloudflare.com:80 HTTP/1.1\r\nHost: cp.cloudflare.com:80\r\nProxy-Connection: close\r\n\r\n"
	_, _ = conn.Write([]byte(probe))
	buf := make([]byte, 128)
	_, _ = conn.Read(buf)
	latMs := int(time.Since(start).Milliseconds())

	s.mu.Lock()
	s.latencyMap[fmt.Sprintf("%s:%d", host, port)] = latMs
	for i := range s.proxies {
		if s.proxies[i].Host == host && s.proxies[i].Port == port {
			val := latMs
			s.proxies[i].Latency = &val
		}
	}
	s.mu.Unlock()

	return latMs, nil
}

// TriggerRefresh asynchronously runs the python scraper to get fresh JWT tokens.
func (s *ProxyService) TriggerRefresh() {
	s.mu.Lock()
	if s.isRefreshing {
		s.mu.Unlock()
		return
	}
	s.isRefreshing = true
	s.mu.Unlock()

	go func() {
		defer func() {
			s.mu.Lock()
			s.isRefreshing = false
			s.mu.Unlock()
		}()
		cmd := exec.Command("python", s.scriptPath, "--once")
		if output, err := cmd.CombinedOutput(); err != nil {
			logger.Warningf("ProxyService: refresh failed: %v, out: %s", err, string(output))
		} else {
			logger.Infof("ProxyService: refresh finished successfully")
			s.ReloadFromDisk()
		}
	}()
}

// startAutoRefreshLoop executes the scraper every 20 minutes to prevent token expiration.
func (s *ProxyService) startAutoRefreshLoop() {
	ticker := time.NewTicker(20 * time.Minute)
	go func() {
		for range ticker.C {
			logger.Infof("ProxyService: 20-minute auto-refresh triggered")
			s.TriggerRefresh()
		}
	}()
}
