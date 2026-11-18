package service

import (
	"encoding/json"
	"strings"

	"github.com/KAWDHITHA-NIRMAL/x-ray/internal/database/model"
	"github.com/KAWDHITHA-NIRMAL/x-ray/internal/logger"
	"github.com/KAWDHITHA-NIRMAL/x-ray/internal/util/json_util"
	"github.com/KAWDHITHA-NIRMAL/x-ray/internal/web/entity"
	"github.com/KAWDHITHA-NIRMAL/x-ray/internal/xray"
)

// InboundAccessSettings models the access tab configuration stored within inbound.Settings.
type InboundAccessSettings struct {
	Enabled                   bool     `json:"enabled"`
	Mode                      string   `json:"mode"`            // "off", "allow", "block"
	AllowedDomains            []string `json:"allowedDomains"`  // e.g. ["*.zoom.us", "kawditha.lk", "teams.microsoft.com"]
	AllowedPackages           []string `json:"allowedPackages"` // For client reference (v2rayNG per-app proxy)
	UnmatchedAction           string   `json:"unmatchedAction"` // "direct" or "block"
	OutboundTag               string   `json:"outboundTag"`     // Upstream proxy target outbound (e.g. "urban-outbound-lk" or "proxy-lk")
	BlockEnabled              bool     `json:"blockEnabled"`
	BlockedDomains            []string `json:"blockedDomains"`  // e.g. ["*.tiktok.com"]
	BlockedPackages           []string `json:"blockedPackages"`
	CountryRestrictionEnabled bool     `json:"countryRestrictionEnabled"`
	CountryRestrictionMode    string   `json:"countryRestrictionMode"` // "allow" or "block"
	CountryRestriction        string   `json:"countryRestriction"`     // e.g. "LK" or "LK,SG"
}

// normalizeXrayDomain converts user domain entries (e.g. "*.zoom.us", "zoom.us", "full:example.com")
// into standard Xray routing domain matchers.
func normalizeXrayDomain(raw string) string {
	d := strings.TrimSpace(raw)
	if d == "" {
		return ""
	}
	// Strip wildcard prefix *.zoom.us -> zoom.us
	if strings.HasPrefix(d, "*.") {
		d = strings.TrimPrefix(d, "*.")
	}
	// Keep existing Xray prefixes as-is
	if strings.HasPrefix(d, "domain:") || strings.HasPrefix(d, "full:") ||
		strings.HasPrefix(d, "regexp:") || strings.HasPrefix(d, "geosite:") {
		return d
	}
	return "domain:" + d
}

// normalizeDomainList cleans, normalizes and deduplicates a slice of domain strings.
func normalizeDomainList(domains []string) []string {
	if len(domains) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(domains))
	var result []string
	for _, raw := range domains {
		norm := normalizeXrayDomain(raw)
		if norm == "" {
			continue
		}
		if _, exists := seen[norm]; !exists {
			seen[norm] = struct{}{}
			result = append(result, norm)
		}
	}
	return result
}

// resolveDefaultRoutingTags detects the standard direct and blackhole outbound tags from OutboundConfigs.
func resolveDefaultRoutingTags(outbounds json_util.RawMessage) (directTag, blockTag string) {
	directTag = "direct"
	blockTag = "blocked"

	var parsed []struct {
		Protocol string `json:"protocol"`
		Tag      string `json:"tag"`
	}
	if err := json.Unmarshal(outbounds, &parsed); err == nil {
		for _, ob := range parsed {
			proto := strings.ToLower(ob.Protocol)
			if proto == "freedom" && ob.Tag != "" && directTag == "direct" {
				directTag = ob.Tag
			}
			if proto == "blackhole" && ob.Tag != "" {
				blockTag = ob.Tag
			}
		}
	}
	return directTag, blockTag
}

// injectInboundAccessRules reads access control settings from each inbound and prepends
// corresponding domain-based routing rules into cfg.RouterConfig.
// This enforces whitelist/blacklist rules directly in Xray Core on the server side.
func injectInboundAccessRules(cfg *xray.Config, inbounds []*model.Inbound) {
	if len(inbounds) == 0 {
		return
	}

	routing := map[string]any{}
	if len(cfg.RouterConfig) > 0 {
		if err := json.Unmarshal(cfg.RouterConfig, &routing); err != nil {
			logger.Warning("inbound access rules: routing section is unparsable, skipping injection:", err)
			return
		}
	}

	rules, _ := routing["rules"].([]any)
	directTag, blockTag := resolveDefaultRoutingTags(cfg.OutboundConfigs)

	newRules := make([]any, 0)

	for _, inbound := range inbounds {
		if inbound == nil || !inbound.Enable || inbound.NodeID != nil {
			continue
		}
		tag := strings.TrimSpace(inbound.Tag)
		if tag == "" {
			continue
		}

		// Parse settings JSON for access field
		var parsedSettings struct {
			Access *InboundAccessSettings `json:"access"`
		}
		if err := json.Unmarshal([]byte(inbound.Settings), &parsedSettings); err != nil {
			continue
		}
		access := parsedSettings.Access
		if access == nil {
			continue
		}

		// 0. Client Country Geo-Fence (Inbound IP Restriction)
		if access.CountryRestrictionEnabled && strings.TrimSpace(access.CountryRestriction) != "" {
			parts := strings.Split(access.CountryRestriction, ",")
			var geoSources []any
			for _, p := range parts {
				p = strings.ToLower(strings.TrimSpace(p))
				if p != "" {
					geoSources = append(geoSources, "geoip:"+p)
				}
			}
			if len(geoSources) > 0 {
				if access.CountryRestrictionMode == "block" {
					newRules = append(newRules, map[string]any{
						"type":        "field",
						"inboundTag":  []any{tag},
						"source":      geoSources,
						"outboundTag": blockTag,
					})
				} else {
					geoSourcesWithPrivate := append(geoSources, "geoip:private")
					newRules = append(newRules, map[string]any{
						"type":        "field",
						"inboundTag":  []any{tag},
						"source":      geoSourcesWithPrivate,
						"outboundTag": directTag,
					})
					newRules = append(newRules, map[string]any{
						"type":        "field",
						"inboundTag":  []any{tag},
						"outboundTag": blockTag,
					})
				}
			}
		}

		if !access.Enabled || access.Mode == "off" || access.Mode == "" {
			continue
		}

		// 1. If Block mode OR BlockEnabled with BlockedDomains -> prepend block rule
		if (access.Mode == "block" || access.BlockEnabled) && len(access.BlockedDomains) > 0 {
			blockedList := normalizeDomainList(access.BlockedDomains)
			if len(blockedList) > 0 {
				newRules = append(newRules, map[string]any{
					"type":        "field",
					"inboundTag":  []any{tag},
					"domain":      blockedList,
					"outboundTag": blockTag,
				})
			}
		}

		// 2. If Allow (Whitelist / Selective Proxy) mode -> prepend route rule for allowed domains
		if access.Mode == "allow" {
			allowedList := normalizeDomainList(access.AllowedDomains)
			targetOutbound := directTag
			if strings.TrimSpace(access.OutboundTag) != "" {
				targetOutbound = strings.TrimSpace(access.OutboundTag)
			}

			if len(allowedList) > 0 {
				newRules = append(newRules, map[string]any{
					"type":        "field",
					"inboundTag":  []any{tag},
					"domain":      allowedList,
					"outboundTag": targetOutbound,
				})
			}

			// 3. Fallback unmatched action:
			// If target is an upstream proxy and unmatched action is direct, route remaining traffic to directTag
			// so the proxy is only used for the specified allowed domains (selective website proxying).
			if access.UnmatchedAction == "direct" || access.UnmatchedAction == "" {
				if targetOutbound != directTag {
					newRules = append(newRules, map[string]any{
						"type":        "field",
						"inboundTag":  []any{tag},
						"outboundTag": directTag,
					})
				}
			} else if access.UnmatchedAction == "block" {
				newRules = append(newRules, map[string]any{
					"type":        "field",
					"inboundTag":  []any{tag},
					"outboundTag": blockTag,
				})
			}
		}
	}

	if len(newRules) == 0 {
		return
	}

	// Prepend access rules before the general panel routing rules so they take priority
	routing["rules"] = append(newRules, rules...)
	newRouting, err := json.Marshal(routing)
	if err != nil {
		logger.Warning("inbound access rules: failed to rebuild routing section, skipping injection:", err)
		return
	}
	cfg.RouterConfig = json_util.RawMessage(newRouting)
}

// injectGlobalGeoShield applies server-wide country restriction if enabled in AllSetting.
func injectGlobalGeoShield(cfg *xray.Config, allSetting *entity.AllSetting) {
	if allSetting == nil || !allSetting.GeoShieldEnable || strings.TrimSpace(allSetting.GeoShieldCountries) == "" {
		return
	}
	// Target can be "both", "v2ray", or "panel". If it's "panel" only, V2Ray routing is not affected.
	target := strings.ToLower(strings.TrimSpace(allSetting.GeoShieldTarget))
	if target == "panel" {
		return
	}

	routing := map[string]any{}
	if len(cfg.RouterConfig) > 0 {
		if err := json.Unmarshal(cfg.RouterConfig, &routing); err != nil {
			logger.Warning("global geo-shield: routing section is unparsable, skipping injection:", err)
			return
		}
	}
	rules, _ := routing["rules"].([]any)
	directTag, blockTag := resolveDefaultRoutingTags(cfg.OutboundConfigs)

	parts := strings.Split(allSetting.GeoShieldCountries, ",")
	var geoSources []any
	for _, p := range parts {
		p = strings.ToLower(strings.TrimSpace(p))
		if p != "" {
			geoSources = append(geoSources, "geoip:"+p)
		}
	}
	if len(geoSources) == 0 {
		return
	}

	var newRules []any
	mode := strings.ToLower(strings.TrimSpace(allSetting.GeoShieldMode))
	if mode == "block" {
		// Block selected countries
		newRules = append(newRules, map[string]any{
			"type":        "field",
			"source":      geoSources,
			"outboundTag": blockTag,
		})
	} else {
		// Allowlist mode: allow selected countries + optional private IPs, block all other external IPs
		allowed := geoSources
		if allSetting.GeoShieldAllowPrivate {
			allowed = append(allowed, "geoip:private")
		}
		newRules = append(newRules, map[string]any{
			"type":        "field",
			"source":      allowed,
			"outboundTag": directTag,
		})
		newRules = append(newRules, map[string]any{
			"type":        "field",
			"outboundTag": blockTag,
		})
	}

	routing["rules"] = append(newRules, rules...)
	if newRouting, err := json.Marshal(routing); err == nil {
		cfg.RouterConfig = json_util.RawMessage(newRouting)
	}
}
