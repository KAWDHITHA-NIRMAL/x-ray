//go:build linux

package firewall

import (
	"context"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/KAWDHITHA-NIRMAL/x-ray/internal/logger"
)

func openPort(port int) {
	if port <= 0 || port > 65535 {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	portStr := strconv.Itoa(port)

	// 1. UFW (Ubuntu / Debian)
	if ufwPath, err := exec.LookPath("ufw"); err == nil {
		out, err := exec.CommandContext(ctx, ufwPath, "status").Output()
		if err == nil && strings.Contains(string(out), "Status: active") {
			_ = exec.CommandContext(ctx, ufwPath, "allow", portStr+"/tcp").Run()
			_ = exec.CommandContext(ctx, ufwPath, "allow", portStr+"/udp").Run()
			logger.Infof("[Firewall] UFW: allowed port %d (tcp/udp)", port)
		}
	}

	// 2. Firewalld (CentOS / RHEL / Fedora / Alma / Rocky)
	if fwCmdPath, err := exec.LookPath("firewall-cmd"); err == nil {
		out, err := exec.CommandContext(ctx, fwCmdPath, "--state").Output()
		if err == nil && strings.Contains(string(out), "running") {
			_ = exec.CommandContext(ctx, fwCmdPath, "--permanent", "--add-port="+portStr+"/tcp", "--add-port="+portStr+"/udp").Run()
			_ = exec.CommandContext(ctx, fwCmdPath, "--reload").Run()
			logger.Infof("[Firewall] firewalld: allowed port %d (tcp/udp)", port)
		}
	}

	// 3. iptables (Oracle Cloud, Debian / Ubuntu minimal, Alpine)
	if iptablesPath, err := exec.LookPath("iptables"); err == nil {
		if exec.CommandContext(ctx, iptablesPath, "-C", "INPUT", "-p", "tcp", "--dport", portStr, "-j", "ACCEPT").Run() != nil {
			_ = exec.CommandContext(ctx, iptablesPath, "-I", "INPUT", "-p", "tcp", "--dport", portStr, "-j", "ACCEPT").Run()
		}
		if exec.CommandContext(ctx, iptablesPath, "-C", "INPUT", "-p", "udp", "--dport", portStr, "-j", "ACCEPT").Run() != nil {
			_ = exec.CommandContext(ctx, iptablesPath, "-I", "INPUT", "-p", "udp", "--dport", portStr, "-j", "ACCEPT").Run()
		}
	}

	// 4. ip6tables (IPv6)
	if ip6tablesPath, err := exec.LookPath("ip6tables"); err == nil {
		if exec.CommandContext(ctx, ip6tablesPath, "-C", "INPUT", "-p", "tcp", "--dport", portStr, "-j", "ACCEPT").Run() != nil {
			_ = exec.CommandContext(ctx, ip6tablesPath, "-I", "INPUT", "-p", "tcp", "--dport", portStr, "-j", "ACCEPT").Run()
		}
		if exec.CommandContext(ctx, ip6tablesPath, "-C", "INPUT", "-p", "udp", "--dport", portStr, "-j", "ACCEPT").Run() != nil {
			_ = exec.CommandContext(ctx, ip6tablesPath, "-I", "INPUT", "-p", "udp", "--dport", portStr, "-j", "ACCEPT").Run()
		}
	}
}

func closePort(port int) {
	if port <= 0 || port > 65535 {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	portStr := strconv.Itoa(port)

	// 1. UFW
	if ufwPath, err := exec.LookPath("ufw"); err == nil {
		out, err := exec.CommandContext(ctx, ufwPath, "status").Output()
		if err == nil && strings.Contains(string(out), "Status: active") {
			_ = exec.CommandContext(ctx, ufwPath, "delete", "allow", portStr+"/tcp").Run()
			_ = exec.CommandContext(ctx, ufwPath, "delete", "allow", portStr+"/udp").Run()
			logger.Infof("[Firewall] UFW: deleted port %d (tcp/udp)", port)
		}
	}

	// 2. Firewalld
	if fwCmdPath, err := exec.LookPath("firewall-cmd"); err == nil {
		out, err := exec.CommandContext(ctx, fwCmdPath, "--state").Output()
		if err == nil && strings.Contains(string(out), "running") {
			_ = exec.CommandContext(ctx, fwCmdPath, "--permanent", "--remove-port="+portStr+"/tcp", "--remove-port="+portStr+"/udp").Run()
			_ = exec.CommandContext(ctx, fwCmdPath, "--reload").Run()
			logger.Infof("[Firewall] firewalld: removed port %d (tcp/udp)", port)
		}
	}

	// 3. iptables
	if iptablesPath, err := exec.LookPath("iptables"); err == nil {
		for exec.CommandContext(ctx, iptablesPath, "-C", "INPUT", "-p", "tcp", "--dport", portStr, "-j", "ACCEPT").Run() == nil {
			_ = exec.CommandContext(ctx, iptablesPath, "-D", "INPUT", "-p", "tcp", "--dport", portStr, "-j", "ACCEPT").Run()
		}
		for exec.CommandContext(ctx, iptablesPath, "-C", "INPUT", "-p", "udp", "--dport", portStr, "-j", "ACCEPT").Run() == nil {
			_ = exec.CommandContext(ctx, iptablesPath, "-D", "INPUT", "-p", "udp", "--dport", portStr, "-j", "ACCEPT").Run()
		}
	}

	// 4. ip6tables
	if ip6tablesPath, err := exec.LookPath("ip6tables"); err == nil {
		for exec.CommandContext(ctx, ip6tablesPath, "-C", "INPUT", "-p", "tcp", "--dport", portStr, "-j", "ACCEPT").Run() == nil {
			_ = exec.CommandContext(ctx, ip6tablesPath, "-D", "INPUT", "-p", "tcp", "--dport", portStr, "-j", "ACCEPT").Run()
		}
		for exec.CommandContext(ctx, ip6tablesPath, "-C", "INPUT", "-p", "udp", "--dport", portStr, "-j", "ACCEPT").Run() == nil {
			_ = exec.CommandContext(ctx, ip6tablesPath, "-D", "INPUT", "-p", "udp", "--dport", portStr, "-j", "ACCEPT").Run()
		}
	}
}
