//go:build !linux

package firewall

func openPort(port int)  {}
func closePort(port int) {}
