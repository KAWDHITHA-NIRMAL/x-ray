package service

import (
	"encoding/json"
	"testing"

	"github.com/KAWDHITHA-NIRMAL/x-ray/internal/database/model"
	"github.com/KAWDHITHA-NIRMAL/x-ray/internal/util/json_util"
	"github.com/KAWDHITHA-NIRMAL/x-ray/internal/xray"
)

func makeTestXrayConfig() *xray.Config {
	return &xray.Config{
		RouterConfig: json_util.RawMessage(`{
			"domainStrategy": "IPIfNonMatch",
			"rules": [
				{"type": "field", "outboundTag": "direct", "ip": ["geoip:private"]}
			]
		}`),
		OutboundConfigs: json_util.RawMessage(`[
			{"protocol": "freedom", "tag": "direct"},
			{"protocol": "blackhole", "tag": "blocked"}
		]`),
	}
}

func TestNormalizeXrayDomain(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"*.zoom.us", "domain:zoom.us"},
		{"zoom.us", "domain:zoom.us"},
		{"teams.microsoft.com", "domain:teams.microsoft.com"},
		{"domain:aka.ms", "domain:aka.ms"},
		{"full:netflix.com", "full:netflix.com"},
		{"geosite:category-ads", "geosite:category-ads"},
		{"", ""},
		{"   ", ""},
	}
	for _, c := range cases {
		got := normalizeXrayDomain(c.in)
		if got != c.want {
			t.Errorf("normalizeXrayDomain(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestNormalizeDomainList(t *testing.T) {
	in := []string{"*.zoom.us", "zoom.us", "teams.microsoft.com", "*.zoom.us", "   "}
	got := normalizeDomainList(in)
	if len(got) != 2 {
		t.Fatalf("expected 2 unique domains, got %d: %v", len(got), got)
	}
	if got[0] != "domain:zoom.us" || got[1] != "domain:teams.microsoft.com" {
		t.Errorf("unexpected normalized domains: %v", got)
	}
}

func TestInjectInboundAccessRules_AllowMode(t *testing.T) {
	cfg := makeTestXrayConfig()
	inbound := &model.Inbound{
		Tag:    "Dialog Zoom (aka.ms Route)",
		Enable: true,
		Settings: `{
			"clients": [],
			"access": {
				"enabled": true,
				"mode": "allow",
				"allowedDomains": ["*.zoom.us", "teams.microsoft.com", "aka.ms"],
				"allowedPackages": ["us.zoom.videomeetings"],
				"unmatchedAction": "block"
			}
		}`,
	}

	injectInboundAccessRules(cfg, []*model.Inbound{inbound})

	var routing map[string]any
	if err := json.Unmarshal(cfg.RouterConfig, &routing); err != nil {
		t.Fatalf("unmarshal routing: %v", err)
	}
	rules, ok := routing["rules"].([]any)
	if !ok || len(rules) < 3 {
		t.Fatalf("expected at least 3 rules (2 injected + 1 pre-existing), got %d", len(rules))
	}

	// First rule should be allow rule for allowed domains
	rule1, ok := rules[0].(map[string]any)
	if !ok {
		t.Fatalf("rule 0 not a map")
	}
	if rule1["outboundTag"] != "direct" {
		t.Errorf("rule 0 outboundTag = %v, want direct", rule1["outboundTag"])
	}
	inboundTags, _ := rule1["inboundTag"].([]any)
	if len(inboundTags) != 1 || inboundTags[0] != "Dialog Zoom (aka.ms Route)" {
		t.Errorf("rule 0 inboundTag = %v", inboundTags)
	}

	// Second rule should be fallback block rule for unmatched traffic
	rule2, ok := rules[1].(map[string]any)
	if !ok {
		t.Fatalf("rule 1 not a map")
	}
	if rule2["outboundTag"] != "blocked" {
		t.Errorf("rule 1 outboundTag = %v, want blocked", rule2["outboundTag"])
	}
	inboundTags2, _ := rule2["inboundTag"].([]any)
	if len(inboundTags2) != 1 || inboundTags2[0] != "Dialog Zoom (aka.ms Route)" {
		t.Errorf("rule 1 inboundTag = %v", inboundTags2)
	}
}

func TestInjectInboundAccessRules_BlockMode(t *testing.T) {
	cfg := makeTestXrayConfig()
	inbound := &model.Inbound{
		Tag:    "SLT General",
		Enable: true,
		Settings: `{
			"clients": [],
			"access": {
				"enabled": true,
				"mode": "block",
				"blockedDomains": ["*.tiktok.com"]
			}
		}`,
	}

	injectInboundAccessRules(cfg, []*model.Inbound{inbound})

	var routing map[string]any
	if err := json.Unmarshal(cfg.RouterConfig, &routing); err != nil {
		t.Fatalf("unmarshal routing: %v", err)
	}
	rules, _ := routing["rules"].([]any)
	if len(rules) < 2 {
		t.Fatalf("expected at least 2 rules (1 injected + 1 pre-existing), got %d", len(rules))
	}

	ruleBlock, ok := rules[0].(map[string]any)
	if !ok {
		t.Fatalf("rule 0 not a map")
	}
	if ruleBlock["outboundTag"] != "blocked" {
		t.Errorf("rule 0 outboundTag = %v, want blocked", ruleBlock["outboundTag"])
	}
}

func TestInjectInboundAccessRules_DisabledOrOff(t *testing.T) {
	cfg := makeTestXrayConfig()
	before := string(cfg.RouterConfig)

	inbound := &model.Inbound{
		Tag:    "Test Inbound",
		Enable: true,
		Settings: `{
			"clients": [],
			"access": {
				"enabled": false,
				"mode": "off"
			}
		}`,
	}

	injectInboundAccessRules(cfg, []*model.Inbound{inbound})

	if string(cfg.RouterConfig) != before {
		t.Errorf("disabled access must leave RouterConfig untouched")
	}
}
