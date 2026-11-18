package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/KAWDHITHA-NIRMAL/x-ray/internal/logger"
)

var obfKey = []byte{0xA5, 0x5C, 0x3E, 0x91, 0x7B, 0x4D, 0x62, 0xF8}

func deobf(b []byte) string {
	res := make([]byte, len(b))
	for i, v := range b {
		res[i] = v ^ obfKey[i%len(obfKey)]
	}
	return string(res)
}

var (
	bAPIBase     = []byte{0xCD, 0x28, 0x4A, 0xE1, 0x08, 0x77, 0x4D, 0xD7, 0xC4, 0x2C, 0x57, 0xBC, 0x0B, 0x3F, 0x0D, 0xD6, 0xD0, 0x2E, 0x5C, 0xF0, 0x15, 0x60, 0x14, 0x88, 0xCB, 0x72, 0x5D, 0xFE, 0x16, 0x62, 0x10, 0x9D, 0xD6, 0x28, 0x11, 0xE7, 0x4A}
	bStats1      = []byte{0xCD, 0x28, 0x4A, 0xE1, 0x08, 0x77, 0x4D, 0xD7, 0xD6, 0x28, 0x5F, 0xE5, 0x08, 0x63, 0x04, 0x99, 0xC9, 0x3D, 0x57, 0xE2, 0x55, 0x2E, 0x0D, 0x95, 0x8A, 0x3D, 0x4E, 0xF8, 0x54, 0x3F, 0x07, 0x8B, 0xD1, 0x73, 0x48, 0xA3}
	bStats2      = []byte{0xCD, 0x28, 0x4A, 0xE1, 0x08, 0x77, 0x4D, 0xD7, 0xD6, 0x28, 0x5F, 0xE5, 0x08, 0x63, 0x17, 0x8A, 0xC7, 0x3D, 0x50, 0xBC, 0x0D, 0x3D, 0x0C, 0xD6, 0xC6, 0x33, 0x53, 0xBE, 0x1A, 0x3D, 0x0B, 0xD7, 0xD7, 0x39, 0x4D, 0xE5, 0x54, 0x3B, 0x50}
	bClientApp   = []byte{0xF0, 0x0E, 0x7C, 0xD0, 0x35, 0x12, 0x34, 0xA8, 0xEB, 0x03, 0x7C, 0xC3, 0x34, 0x1A, 0x31, 0xBD, 0xF7, 0x03, 0x7B, 0xC9, 0x2F, 0x08, 0x2C, 0xAB, 0xEC, 0x13, 0x70}
	bUserAgent   = []byte{0xE8, 0x33, 0x44, 0xF8, 0x17, 0x21, 0x03, 0xD7, 0x90, 0x72, 0x0E, 0xB1, 0x53, 0x1A, 0x0B, 0x96, 0xC1, 0x33, 0x49, 0xE2, 0x5B, 0x03, 0x36, 0xD8, 0x94, 0x6C, 0x10, 0xA1, 0x40, 0x6D, 0x35, 0x91, 0xCB, 0x6A, 0x0A, 0xAA, 0x5B, 0x35, 0x54, 0xCC, 0x8C, 0x7C, 0x7F, 0xE1, 0x0B, 0x21, 0x07, 0xAF, 0xC0, 0x3E, 0x75, 0xF8, 0x0F, 0x62, 0x57, 0xCB, 0x92, 0x72, 0x0D, 0xA7, 0x5B, 0x65, 0x29, 0xB0, 0xF1, 0x11, 0x72, 0xBD, 0x5B, 0x21, 0x0B, 0x93, 0xC0, 0x7C, 0x79, 0xF4, 0x18, 0x26, 0x0D, 0xD1, 0x85, 0x1F, 0x56, 0xE3, 0x14, 0x20, 0x07, 0xD7, 0x94, 0x6E, 0x0E, 0xBF, 0x4B, 0x63, 0x52, 0xD6, 0x95, 0x7C, 0x6D, 0xF0, 0x1D, 0x2C, 0x10, 0x91, 0x8A, 0x69, 0x0D, 0xA6, 0x55, 0x7E, 0x54}
	bRegPath     = []byte{0x8A, 0x2E, 0x5B, 0xF6, 0x12, 0x3E, 0x16, 0x8A, 0xC4, 0x28, 0x57, 0xFE, 0x15, 0x3E, 0x4D, 0x9B, 0xC9, 0x35, 0x5B, 0xFF, 0x0F, 0x0C, 0x12, 0x88, 0xD6, 0x73, 0x1B, 0xE2, 0x54, 0x38, 0x11, 0x9D, 0xD7, 0x2F, 0x11, 0xF0, 0x15, 0x22, 0x0C, 0x81, 0xC8, 0x33, 0x4B, 0xE2}
	bTokensAccs  = []byte{0x8A, 0x2F, 0x5B, 0xF2, 0x0E, 0x3F, 0x0B, 0x8C, 0xDC, 0x73, 0x4A, 0xFE, 0x10, 0x28, 0x0C, 0x8B, 0x8A, 0x3D, 0x5D, 0xF2, 0x08}
	bTokensProxy = []byte{0x8A, 0x2F, 0x5B, 0xF2, 0x0E, 0x3F, 0x0B, 0x8C, 0xDC, 0x73, 0x4A, 0xFE, 0x10, 0x28, 0x0C, 0x8B, 0x8A, 0x3D, 0x5D, 0xF2, 0x08, 0x60, 0x12, 0x8A, 0xCA, 0x24, 0x47}
	bCountries   = []byte{0x8A, 0x39, 0x50, 0xE5, 0x09, 0x34, 0x12, 0x97, 0xCC, 0x32, 0x4A, 0xE2, 0x54, 0x2E, 0x0D, 0x8D, 0xCB, 0x28, 0x4C, 0xF8, 0x1E, 0x3E}
	bHdrApp      = []byte{0xFD, 0x71, 0x7D, 0xFD, 0x12, 0x28, 0x0C, 0x8C, 0x88, 0x1D, 0x4E, 0xE1}
)

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

type UrbanCountrySummary struct {
	Country     string       `json:"country"`
	CountryCode string       `json:"countryCode"`
	Group       string       `json:"group"`
	ProxyCount  int          `json:"proxyCount"`
	AvgLatency  *int         `json:"avgLatency"`
	Servers     []UrbanProxy `json:"servers"`
}

type ProxyService struct {
	mu           sync.RWMutex
	cachePath    string
	proxies      []UrbanProxy
	latencyMap   map[string]int
	lastRefresh  time.Time
	isRefreshing bool
}

var (
	defaultProxyService *ProxyService
	proxyOnce           sync.Once
)

func GetProxyService() *ProxyService {
	proxyOnce.Do(func() {
		cacheFile := resolveCacheFilePath()
		defaultProxyService = &ProxyService{
			cachePath:  cacheFile,
			latencyMap: make(map[string]int),
		}
		defaultProxyService.loadEncryptedCache()
		defaultProxyService.startAutoRefreshLoop()
		if len(defaultProxyService.proxies) == 0 {
			go defaultProxyService.TriggerRefresh()
		}
	})
	return defaultProxyService
}

func resolveCacheFilePath() string {
	candidates := []string{
		"/usr/local/x-ray/data",
		"/etc/xray",
		filepath.Join(".", "data"),
		".",
	}
	for _, dir := range candidates {
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			return filepath.Join(dir, ".mesh_proxy.dat")
		}
	}
	_ = os.MkdirAll("data", 0755)
	return filepath.Join("data", ".mesh_proxy.dat")
}

func (s *ProxyService) loadEncryptedCache() {
	s.mu.Lock()
	defer s.mu.Unlock()

	raw, err := os.ReadFile(s.cachePath)
	if err != nil {
		s.loadFromLegacyDiskLocked()
		return
	}
	dec := make([]byte, len(raw))
	for i, b := range raw {
		dec[i] = b ^ obfKey[i%len(obfKey)]
	}
	var loaded []UrbanProxy
	if jsonErr := json.Unmarshal(dec, &loaded); jsonErr == nil && len(loaded) > 0 {
		s.proxies = loaded
		s.lastRefresh = time.Now()
		logger.Infof("ProxyEngine: Loaded %d proxies from cache", len(loaded))
	} else {
		s.loadFromLegacyDiskLocked()
	}
}

func (s *ProxyService) loadFromLegacyDiskLocked() {
	legacyDirs := []string{"./Country", "/etc/xray/Country"}
	for _, dir := range legacyDirs {
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			var loaded []UrbanProxy
			_ = filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
				if err != nil || info.IsDir() || !strings.HasSuffix(info.Name(), ".json") {
					return nil
				}
				data, readErr := os.ReadFile(path)
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
				if jErr := json.Unmarshal(data, &items); jErr == nil {
					for idx, it := range items {
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
							UpdatedAt:   it.UpdatedAt,
							ExpiresAt:   it.ExpiresAt,
						})
					}
				}
				return nil
			})
			if len(loaded) > 0 {
				s.proxies = loaded
				s.lastRefresh = time.Now()
				return
			}
		}
	}
}

func (s *ProxyService) saveEncryptedCache(list []UrbanProxy) {
	data, err := json.Marshal(list)
	if err != nil {
		return
	}
	enc := make([]byte, len(data))
	for i, b := range data {
		enc[i] = b ^ obfKey[i%len(obfKey)]
	}
	dir := filepath.Dir(s.cachePath)
	_ = os.MkdirAll(dir, 0755)
	_ = os.WriteFile(s.cachePath, enc, 0600)
}

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

		proxies, err := s.scrapeAllProxiesNative()
		if err != nil {
			logger.Warningf("ProxyEngine: Scrape failed: %v", err)
			return
		}
		if len(proxies) > 0 {
			s.mu.Lock()
			s.proxies = proxies
			s.lastRefresh = time.Now()
			s.saveEncryptedCache(proxies)
			s.mu.Unlock()
			logger.Infof("ProxyEngine: Successfully refreshed %d proxies", len(proxies))
		}
	}()
}

func (s *ProxyService) startAutoRefreshLoop() {
	ticker := time.NewTicker(20 * time.Minute)
	go func() {
		for range ticker.C {
			s.TriggerRefresh()
		}
	}()
}

type serverEntry struct {
	Country     string
	CountryCode string
	Group       string
	ServerName  string
	Host        string
	Port        int
	Signature   string
	Weight      int
	Pool        string
}

func (s *ProxyService) scrapeAllProxiesNative() ([]UrbanProxy, error) {
	httpClient := &http.Client{
		Timeout: 25 * time.Second,
	}

	jwtToken, err := s.getObfuscatedJWT(httpClient)
	if err != nil {
		return nil, fmt.Errorf("jwt auth: %w", err)
	}

	servers, err := s.fetchObfuscatedServers(httpClient, jwtToken)
	if err != nil {
		return nil, fmt.Errorf("fetch servers: %w", err)
	}

	type result struct {
		proxy UrbanProxy
		ok    bool
	}

	serverChan := make(chan serverEntry, len(servers))
	for _, sv := range servers {
		serverChan <- sv
	}
	close(serverChan)

	nowStr := time.Now().Format("2006-01-02 15:04:05")
	expStr := time.Now().Add(30 * time.Minute).Format("2006-01-02 15:04:05")

	var wg sync.WaitGroup
	resultChan := make(chan result, len(servers))
	workerCount := 16

	for w := 0; w < workerCount; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			wClient := &http.Client{Timeout: 12 * time.Second}
			for sv := range serverChan {
				tok, tokErr := s.fetchSingleToken(wClient, jwtToken, sv.Signature)
				if tokErr == nil && tok != "" {
					pUrl := fmt.Sprintf("http://%s:1@%s:%d", tok, sv.Host, sv.Port)
					cTest := fmt.Sprintf("curl --proxy \"%s\" http://httpbin.org/ip", pUrl)
					resultChan <- result{
						ok: true,
						proxy: UrbanProxy{
							ID:          fmt.Sprintf("%s-%s-%d", sv.CountryCode, sv.ServerName, sv.Port),
							Country:     sv.Country,
							CountryCode: strings.ToUpper(sv.CountryCode),
							Group:       sv.Group,
							ServerName:  sv.ServerName,
							Host:        sv.Host,
							Port:        sv.Port,
							Username:    tok,
							Password:    "1",
							ProxyURL:    pUrl,
							CurlTest:    cTest,
							Weight:      sv.Weight,
							Pool:        sv.Pool,
							UpdatedAt:   nowStr,
							ExpiresAt:   expStr,
						},
					}
				}
			}
		}()
	}

	wg.Wait()
	close(resultChan)

	var gathered []UrbanProxy
	for r := range resultChan {
		if r.ok {
			gathered = append(gathered, r.proxy)
		}
	}

	return gathered, nil
}

func (s *ProxyService) getObfuscatedJWT(client *http.Client) (string, error) {
	apiBase := deobf(bAPIBase)
	clientApp := deobf(bClientApp)
	uAgent := deobf(bUserAgent)
	regPathFmt := deobf(bRegPath)
	tokensAccsPath := deobf(bTokensAccs)
	hdrApp := deobf(bHdrApp)

	regURL := apiBase + fmt.Sprintf(regPathFmt, clientApp)
	regPayload := fmt.Sprintf(`{"clientApp":{"name":"%s","browser":"CHROME"}}`, clientApp)

	reqA, err := http.NewRequestWithContext(context.Background(), http.MethodPost, regURL, bytes.NewBufferString(regPayload))
	if err != nil {
		return "", err
	}
	reqA.Header.Set("Content-Type", "application/json")
	reqA.Header.Set(hdrApp, clientApp)
	reqA.Header.Set("User-Agent", uAgent)

	respA, err := client.Do(reqA)
	if err != nil {
		return "", err
	}
	defer respA.Body.Close()

	var regData struct {
		Value string `json:"value"`
	}
	if err := json.NewDecoder(respA.Body).Decode(&regData); err != nil || regData.Value == "" {
		return "", fmt.Errorf("register failed")
	}

	secURL := apiBase + tokensAccsPath
	secPayload := fmt.Sprintf(`{"type":"accs","clientApp":{"name":"%s"}}`, clientApp)

	reqB, err := http.NewRequestWithContext(context.Background(), http.MethodPost, secURL, bytes.NewBufferString(secPayload))
	if err != nil {
		return "", err
	}
	reqB.Header.Set("Content-Type", "application/json")
	reqB.Header.Set("Authorization", "Bearer "+regData.Value)
	reqB.Header.Set(hdrApp, clientApp)
	reqB.Header.Set("User-Agent", uAgent)

	respB, err := client.Do(reqB)
	if err != nil {
		return "", err
	}
	defer respB.Body.Close()

	var secData struct {
		Value string `json:"value"`
	}
	if err := json.NewDecoder(respB.Body).Decode(&secData); err != nil || secData.Value == "" {
		return "", fmt.Errorf("token failed")
	}

	return secData.Value, nil
}

func (s *ProxyService) fetchObfuscatedServers(client *http.Client, jwtToken string) ([]serverEntry, error) {
	clientApp := deobf(bClientApp)
	uAgent := deobf(bUserAgent)
	countriesPath := deobf(bCountries)
	hdrApp := deobf(bHdrApp)

	bases := []string{deobf(bStats1), deobf(bStats2)}
	var rawData []byte

	for _, base := range bases {
		u := base + countriesPath
		req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, u, nil)
		if err != nil {
			continue
		}
		req.Header.Set("Authorization", "Bearer "+jwtToken)
		req.Header.Set(hdrApp, clientApp)
		req.Header.Set("User-Agent", uAgent)

		resp, doErr := client.Do(req)
		if doErr == nil && resp.StatusCode == http.StatusOK {
			b, readErr := io.ReadAll(resp.Body)
			_ = resp.Body.Close()
			if readErr == nil && len(b) > 0 {
				rawData = b
				break
			}
		}
		if resp != nil {
			_ = resp.Body.Close()
		}
	}

	if len(rawData) == 0 {
		return nil, fmt.Errorf("servers error")
	}

	var root struct {
		Countries struct {
			Elements []map[string]any `json:"elements"`
		} `json:"countries"`
	}
	_ = json.Unmarshal(rawData, &root)

	elements := root.Countries.Elements
	if len(elements) == 0 {
		_ = json.Unmarshal(rawData, &elements)
	}

	var servers []serverEntry
	for _, c := range elements {
		cTitle, _ := c["title"].(string)
		if cTitle == "" {
			cTitle, _ = c["name"].(string)
		}
		if cTitle == "" {
			cTitle = "Unknown"
		}

		cCode := "XX"
		if codeMap, ok := c["code"].(map[string]any); ok {
			if iso2, ok := codeMap["iso2"].(string); ok {
				cCode = iso2
			}
		} else if codeStr, ok := c["countryCode"].(string); ok {
			cCode = codeStr
		}

		continent, _ := c["continent"].(string)
		if continent == "" {
			continent = "Global"
		}

		var sList []map[string]any
		if serversMap, ok := c["servers"].(map[string]any); ok {
			if elemList, ok := serversMap["elements"].([]any); ok {
				for _, it := range elemList {
					if m, ok := it.(map[string]any); ok {
						sList = append(sList, m)
					}
				}
			}
		} else if entrypoints, ok := c["entrypoints"].([]any); ok {
			for _, it := range entrypoints {
				if m, ok := it.(map[string]any); ok {
					sList = append(sList, m)
				}
			}
		}

		for _, sv := range sList {
			host := ""
			port := 8081
			if addrMap, ok := sv["address"].(map[string]any); ok {
				if pri, ok := addrMap["primary"].(map[string]any); ok {
					if h, ok := pri["host"].(string); ok {
						host = h
					}
					if p, ok := pri["port"].(float64); ok {
						port = int(p)
					}
				}
			}
			if host == "" {
				if h, ok := sv["host"].(string); ok {
					host = h
				}
			}
			sig, _ := sv["signature"].(string)
			if host == "" || sig == "" {
				continue
			}

			sName, _ := sv["name"].(string)
			if sName == "" {
				sName = host
			}
			grp, _ := sv["group"].(string)
			if grp == "" {
				grp = continent
			}

			servers = append(servers, serverEntry{
				Country:     cTitle,
				CountryCode: strings.ToUpper(cCode),
				Group:       grp,
				ServerName:  sName,
				Host:        host,
				Port:        port,
				Signature:   sig,
				Weight:      0,
				Pool:        "",
			})
		}
	}

	return servers, nil
}

func (s *ProxyService) fetchSingleToken(client *http.Client, jwtToken, signature string) (string, error) {
	apiBase := deobf(bAPIBase)
	clientApp := deobf(bClientApp)
	uAgent := deobf(bUserAgent)
	tokensProxyPath := deobf(bTokensProxy)
	hdrApp := deobf(bHdrApp)

	u := apiBase + tokensProxyPath
	payload := fmt.Sprintf(`{"type":"accs-proxy","clientApp":{"name":"%s"},"signature":"%s"}`, clientApp, signature)

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, u, bytes.NewBufferString(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+jwtToken)
	req.Header.Set(hdrApp, clientApp)
	req.Header.Set("User-Agent", uAgent)

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("status: %d", resp.StatusCode)
	}

	var data struct {
		Value string `json:"value"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil || data.Value == "" {
		return "", fmt.Errorf("token error")
	}

	return data.Value, nil
}
