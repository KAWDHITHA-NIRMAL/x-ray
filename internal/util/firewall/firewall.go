package firewall

// OpenPort asynchronously opens the given port in host firewalls (ufw, firewalld, iptables, ip6tables).
func OpenPort(port int) {
	if port <= 0 || port > 65535 {
		return
	}
	go openPort(port)
}

// ClosePort asynchronously removes firewall rules for the given port.
func ClosePort(port int) {
	if port <= 0 || port > 65535 {
		return
	}
	go closePort(port)
}

// SyncPorts opens all provided ports in host firewalls.
func SyncPorts(ports []int) {
	if len(ports) == 0 {
		return
	}
	go func() {
		for _, p := range ports {
			if p > 0 && p <= 65535 {
				openPort(p)
			}
		}
	}()
}
