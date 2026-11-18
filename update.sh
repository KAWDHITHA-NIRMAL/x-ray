#!/bin/bash

red='\033[0;31m'
green='\033[0;32m'
blue='\033[0;34m'
yellow='\033[0;33m'
plain='\033[0m'

xray_folder="${XRAY_MAIN_FOLDER:=/usr/local/x-ray}"
xray_service="${XRAY_SERVICE:=/etc/systemd/system}"

# Don't edit this config
b_source="${BASH_SOURCE[0]}"
while [ -h "$b_source" ]; do
    b_dir="$(cd -P "$(dirname "$b_source")" > /dev/null 2>&1 && pwd || pwd -P)"
    b_source="$(readlink "$b_source")"
    [[ $b_source != /* ]] && b_source="$b_dir/$b_source"
done
cur_dir="$(cd -P "$(dirname "$b_source")" > /dev/null 2>&1 && pwd || pwd -P)"
script_name=$(basename "$0")

# Check command exist function
_command_exists() {
    type "$1" &> /dev/null
}

# Fail, log and exit script function
_fail() {
    local msg=${1}
    echo -e "${red}${msg}${plain}"
    exit 2
}

# Records this run's outcome for the panel's web updater to poll, since it
# launches this script detached and has no other way to learn whether it
# finished. Written to a fixed path outside XRAY_MAIN_FOLDER so it survives
# the update regardless of what happens to that folder. The EXIT trap below
# covers every exit path in this file, including the bare `exit 1`/`exit 2`
# calls that don't go through _fail.
xray_update_run_id="${XRAY_UPDATE_RUN_ID:-0}"
[[ "${xray_update_run_id}" =~ ^[0-9]+$ ]] || xray_update_run_id="0"
xray_update_status_file="${XRAY_UPDATE_STATUS_FILE:-/etc/x-ray/update-status.json}"

_write_update_status() {
    local state="$1"
    local exit_code="$2"
    local status_dir
    status_dir="$(dirname "${xray_update_status_file}")"
    mkdir -p "${status_dir}" > /dev/null 2>&1
    local tmp_file="${xray_update_status_file}.tmp.$$"
    printf '{"runId":"%s","state":"%s","exitCode":%s,"finishedAt":%s}\n' \
        "${xray_update_run_id}" "${state}" "${exit_code}" "$(date +%s)" > "${tmp_file}" 2> /dev/null
    mv -f "${tmp_file}" "${xray_update_status_file}" > /dev/null 2>&1
}

_report_update_exit() {
    local code=$?
    if [[ "${code}" -eq 0 ]]; then
        _write_update_status "success" "0"
    else
        _write_update_status "failed" "${code}"
    fi
}
trap _report_update_exit EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

# check root
[[ $EUID -ne 0 ]] && _fail "FATAL ERROR: Please run this script with root privilege."

if _command_exists curl; then
    curl_bin=$(which curl)
else
    _fail "ERROR: Command 'curl' not found."
fi

# Check OS and set release variable
if [[ -f /etc/os-release ]]; then
    source /etc/os-release
    release=$ID
elif [[ -f /usr/lib/os-release ]]; then
    source /usr/lib/os-release
    release=$ID
else
    _fail "Failed to check the system OS, please contact the author!"
fi
echo "The OS release is: $release"

arch() {
    case "$(uname -m)" in
        x86_64 | x64 | amd64) echo 'amd64' ;;
        i*86 | x86) echo '386' ;;
        armv8* | armv8 | arm64 | aarch64) echo 'arm64' ;;
        armv7* | armv7 | arm) echo 'armv7' ;;
        armv6* | armv6) echo 'armv6' ;;
        armv5* | armv5) echo 'armv5' ;;
        s390x) echo 's390x' ;;
        *) echo -e "${red}Unsupported CPU architecture!${plain}" && rm -f "${cur_dir}/${script_name}" > /dev/null 2>&1 && exit 2 ;;
    esac
}

echo "Arch: $(arch)"

# Simple helpers
is_ipv4() {
    [[ "$1" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] && return 0 || return 1
}
is_ipv6() {
    [[ "$1" =~ : ]] && return 0 || return 1
}
is_ip() {
    is_ipv4 "$1" || is_ipv6 "$1"
}
is_domain() {
    [[ "$1" =~ ^([A-Za-z0-9](-*[A-Za-z0-9])*\.)+(xn--[a-z0-9]{2,}|[A-Za-z]{2,})$ ]] && return 0 || return 1
}

# acme.sh's standalone server binds IPv4 by default; --listen-v6 makes it
# v6-only, which breaks HTTP-01 validation when the domain's A record points
# at this host's IPv4 (#4994). Only force IPv6 when the host has no global
# IPv4 address at all.
acme_listen_flag() {
    if ip -4 addr show scope global 2> /dev/null | grep -q "inet "; then
        echo ""
    else
        echo "--listen-v6"
    fi
}

# Port helpers
is_port_in_use() {
    local port="$1"
    if command -v ss > /dev/null 2>&1; then
        ss -ltn 2> /dev/null | awk -v p=":${port}$" '$4 ~ p {exit 0} END {exit 1}'
        return
    fi
    if command -v netstat > /dev/null 2>&1; then
        netstat -lnt 2> /dev/null | awk -v p=":${port} " '$4 ~ p {exit 0} END {exit 1}'
        return
    fi
    if command -v lsof > /dev/null 2>&1; then
        lsof -nP -iTCP:${port} -sTCP:LISTEN > /dev/null 2>&1 && return 0
    fi
    return 1
}

gen_random_string() {
    local length="$1"
    openssl rand -base64 $((length * 2)) \
        | tr -dc 'a-zA-Z0-9' \
        | head -c "$length"
}

xray_env_file_path() {
    case "${release}" in
        ubuntu | debian | armbian)
            echo "/etc/default/x-ray"
            ;;
        arch | manjaro | parch | alpine)
            echo "/etc/conf.d/x-ray"
            ;;
        *)
            echo "/etc/sysconfig/x-ray"
            ;;
    esac
}

load_xray_env() {
    local env_file
    env_file="$(xray_env_file_path)"
    if [[ -r "$env_file" ]]; then
        set -a
        # shellcheck disable=SC1090
        source "$env_file"
        set +a
    fi
}

install_base() {
    echo -e "${green}Updating and install dependency packages...${plain}"
    case "${release}" in
        ubuntu | debian | armbian)
            apt-get update > /dev/null 2>&1 && apt-get install -y -q cron curl tar tzdata socat openssl > /dev/null 2>&1
            ;;
        fedora | amzn | virtuozzo | rhel | almalinux | rocky | ol)
            dnf makecache -y > /dev/null 2>&1 && dnf install -y -q cronie curl tar tzdata socat openssl > /dev/null 2>&1
            ;;
        centos)
            if [[ "${VERSION_ID}" =~ ^7 ]]; then
                yum makecache -y > /dev/null 2>&1 && yum install -y -q cronie curl tar tzdata socat openssl > /dev/null 2>&1
            else
                dnf makecache -y > /dev/null 2>&1 && dnf install -y -q cronie curl tar tzdata socat openssl > /dev/null 2>&1
            fi
            ;;
        arch | manjaro | parch)
            pacman -Sy --noconfirm cronie curl tar tzdata socat openssl > /dev/null 2>&1
            ;;
        opensuse-tumbleweed | opensuse-leap)
            zypper refresh > /dev/null 2>&1 && zypper -q install -y cron curl tar timezone socat openssl > /dev/null 2>&1
            ;;
        alpine)
            apk update > /dev/null 2>&1 && apk add dcron curl tar tzdata socat openssl > /dev/null 2>&1
            ;;
        *)
            apt-get update > /dev/null 2>&1 && apt install -y -q cron curl tar tzdata socat openssl > /dev/null 2>&1
            ;;
    esac
}

install_acme() {
    echo -e "${green}Installing acme.sh for SSL certificate management...${plain}"
    cd ~ || return 1
    curl -s https://get.acme.sh | sh > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo -e "${red}Failed to install acme.sh${plain}"
        return 1
    else
        echo -e "${green}acme.sh installed successfully${plain}"
    fi
    return 0
}

setup_ssl_certificate() {
    local domain="$1"
    local server_ip="$2"
    local existing_port="$3"
    local existing_webBasePath="$4"

    echo -e "${green}Setting up SSL certificate...${plain}"

    # Check if acme.sh is installed
    if ! command -v ~/.acme.sh/acme.sh &> /dev/null; then
        install_acme
        if [ $? -ne 0 ]; then
            echo -e "${yellow}Failed to install acme.sh, skipping SSL setup${plain}"
            return 1
        fi
    fi

    # Create certificate directory
    local certPath="/root/cert/${domain}"
    mkdir -p "$certPath"

    # Issue certificate
    echo -e "${green}Issuing SSL certificate for ${domain}...${plain}"
    echo -e "${yellow}Note: Port 80 must be open and accessible from the internet${plain}"

    ~/.acme.sh/acme.sh --set-default-ca --server letsencrypt --force > /dev/null 2>&1
    ~/.acme.sh/acme.sh --issue -d ${domain} $(acme_listen_flag) --standalone --httpport 80 --force

    if [ $? -ne 0 ]; then
        echo -e "${yellow}Failed to issue certificate for ${domain}${plain}"
        echo -e "${yellow}Please ensure port 80 is open and try again later with: x-ray${plain}"
        rm -rf ~/.acme.sh/${domain} 2> /dev/null
        rm -rf "$certPath" 2> /dev/null
        return 1
    fi

    # Install certificate
    ~/.acme.sh/acme.sh --installcert --force -d ${domain} \
        --key-file /root/cert/${domain}/privkey.pem \
        --fullchain-file /root/cert/${domain}/fullchain.pem \
        --reloadcmd "systemctl restart x-ray" > /dev/null 2>&1

    if [ $? -ne 0 ]; then
        echo -e "${yellow}Failed to install certificate${plain}"
        return 1
    fi

    # Enable auto-renew
    ~/.acme.sh/acme.sh --upgrade --auto-upgrade > /dev/null 2>&1
    chmod 600 $certPath/privkey.pem 2> /dev/null
    chmod 644 $certPath/fullchain.pem 2> /dev/null

    # Set certificate for panel
    local webCertFile="/root/cert/${domain}/fullchain.pem"
    local webKeyFile="/root/cert/${domain}/privkey.pem"

    if [[ -f "$webCertFile" && -f "$webKeyFile" ]]; then
        ${xray_folder}/x-ray cert -webCert "$webCertFile" -webCertKey "$webKeyFile" > /dev/null 2>&1
        echo -e "${green}SSL certificate installed and configured successfully!${plain}"
        return 0
    else
        echo -e "${yellow}Certificate files not found${plain}"
        return 1
    fi
}

# Issue Let's Encrypt IP certificate with shortlived profile (~6 days validity)
# Requires acme.sh and port 80 open for HTTP-01 challenge
setup_ip_certificate() {
    local ipv4="$1"
    local ipv6="$2" # optional

    echo -e "${green}Setting up Let's Encrypt IP certificate (shortlived profile)...${plain}"
    echo -e "${yellow}Note: IP certificates are valid for ~6 days and will auto-renew.${plain}"
    echo -e "${yellow}Default listener is port 80. If you choose another port, ensure external port 80 forwards to it.${plain}"

    # Check for acme.sh
    if ! command -v ~/.acme.sh/acme.sh &> /dev/null; then
        install_acme
        if [ $? -ne 0 ]; then
            echo -e "${red}Failed to install acme.sh${plain}"
            return 1
        fi
    fi

    # Validate IP address
    if [[ -z "$ipv4" ]]; then
        echo -e "${red}IPv4 address is required${plain}"
        return 1
    fi

    if ! is_ipv4 "$ipv4"; then
        echo -e "${red}Invalid IPv4 address: $ipv4${plain}"
        return 1
    fi

    # Create certificate directory
    local certDir="/root/cert/ip"
    mkdir -p "$certDir"

    # Build domain arguments
    local domain_args="-d ${ipv4}"
    if [[ -n "$ipv6" ]] && is_ipv6 "$ipv6"; then
        domain_args="${domain_args} -d ${ipv6}"
        echo -e "${green}Including IPv6 address: ${ipv6}${plain}"
    fi

    # Set reload command for auto-renewal (add || true so it doesn't fail if service stopped)
    local reloadCmd="systemctl restart x-ray 2>/dev/null || rc-service x-ray restart 2>/dev/null || true"

    # Choose port for HTTP-01 listener (default 80, prompt override)
    local WebPort=""
    read -rp "Port to use for ACME HTTP-01 listener (default 80): " WebPort
    WebPort="${WebPort:-80}"
    if ! [[ "${WebPort}" =~ ^[0-9]+$ ]] || ((WebPort < 1 || WebPort > 65535)); then
        echo -e "${red}Invalid port provided. Falling back to 80.${plain}"
        WebPort=80
    fi
    echo -e "${green}Using port ${WebPort} for standalone validation.${plain}"
    if [[ "${WebPort}" -ne 80 ]]; then
        echo -e "${yellow}Reminder: Let's Encrypt still connects on port 80; forward external port 80 to ${WebPort}.${plain}"
    fi

    # Ensure chosen port is available
    while true; do
        if is_port_in_use "${WebPort}"; then
            echo -e "${yellow}Port ${WebPort} is currently in use.${plain}"

            local alt_port=""
            read -rp "Enter another port for acme.sh standalone listener (leave empty to abort): " alt_port
            alt_port="${alt_port// /}"
            if [[ -z "${alt_port}" ]]; then
                echo -e "${red}Port ${WebPort} is busy; cannot proceed.${plain}"
                return 1
            fi
            if ! [[ "${alt_port}" =~ ^[0-9]+$ ]] || ((alt_port < 1 || alt_port > 65535)); then
                echo -e "${red}Invalid port provided.${plain}"
                return 1
            fi
            WebPort="${alt_port}"
            continue
        else
            echo -e "${green}Port ${WebPort} is free and ready for standalone validation.${plain}"
            break
        fi
    done

    # Issue certificate with shortlived profile
    echo -e "${green}Issuing IP certificate for ${ipv4}...${plain}"
    ~/.acme.sh/acme.sh --set-default-ca --server letsencrypt --force > /dev/null 2>&1

    ~/.acme.sh/acme.sh --issue \
        ${domain_args} \
        --standalone \
        --server letsencrypt \
        --certificate-profile shortlived \
        --days 6 \
        --httpport ${WebPort} \
        --force

    if [ $? -ne 0 ]; then
        echo -e "${red}Failed to issue IP certificate${plain}"
        echo -e "${yellow}Please ensure port ${WebPort} is reachable (or forwarded from external port 80)${plain}"
        # Cleanup acme.sh data for both IPv4 and IPv6 if specified
        rm -rf ~/.acme.sh/${ipv4} 2> /dev/null
        [[ -n "$ipv6" ]] && rm -rf ~/.acme.sh/${ipv6} 2> /dev/null
        rm -rf ${certDir} 2> /dev/null
        return 1
    fi

    echo -e "${green}Certificate issued successfully, installing...${plain}"

    # Install certificate
    # Note: acme.sh may report "Reload error" and exit non-zero if reloadcmd fails,
    # but the cert files are still installed. We check for files instead of exit code.
    ~/.acme.sh/acme.sh --installcert --force -d ${ipv4} \
        --key-file "${certDir}/privkey.pem" \
        --fullchain-file "${certDir}/fullchain.pem" \
        --reloadcmd "${reloadCmd}" 2>&1 || true

    # Verify certificate files exist (don't rely on exit code - reloadcmd failure causes non-zero)
    if [[ ! -f "${certDir}/fullchain.pem" || ! -f "${certDir}/privkey.pem" ]]; then
        echo -e "${red}Certificate files not found after installation${plain}"
        # Cleanup acme.sh data for both IPv4 and IPv6 if specified
        rm -rf ~/.acme.sh/${ipv4} 2> /dev/null
        [[ -n "$ipv6" ]] && rm -rf ~/.acme.sh/${ipv6} 2> /dev/null
        rm -rf ${certDir} 2> /dev/null
        return 1
    fi

    echo -e "${green}Certificate files installed successfully${plain}"

    # Enable auto-upgrade for acme.sh (ensures cron job runs)
    ~/.acme.sh/acme.sh --upgrade --auto-upgrade > /dev/null 2>&1

    chmod 600 ${certDir}/privkey.pem 2> /dev/null
    chmod 644 ${certDir}/fullchain.pem 2> /dev/null

    # Configure panel to use the certificate
    echo -e "${green}Setting certificate paths for the panel...${plain}"
    ${xray_folder}/x-ray cert -webCert "${certDir}/fullchain.pem" -webCertKey "${certDir}/privkey.pem"
    if [ $? -ne 0 ]; then
        echo -e "${yellow}Warning: Could not set certificate paths automatically.${plain}"
        echo -e "${yellow}You may need to set them manually in the panel settings.${plain}"
        echo -e "${yellow}Cert path: ${certDir}/fullchain.pem${plain}"
        echo -e "${yellow}Key path: ${certDir}/privkey.pem${plain}"
    else
        echo -e "${green}Certificate paths set successfully!${plain}"
    fi

    echo -e "${green}IP certificate installed and configured successfully!${plain}"
    echo -e "${green}Certificate valid for ~6 days, auto-renews via acme.sh cron job.${plain}"
    echo -e "${yellow}Panel will automatically restart after each renewal.${plain}"
    return 0
}

# Comprehensive manual SSL certificate issuance via acme.sh
ssl_cert_issue() {
    local existing_webBasePath=$(${xray_folder}/x-ray setting -show true | grep 'webBasePath:' | awk -F': ' '{print $2}' | tr -d '[:space:]' | sed 's#^/##')
    local existing_port=$(${xray_folder}/x-ray setting -show true | grep 'port:' | awk -F': ' '{print $2}' | tr -d '[:space:]')

    # check for acme.sh first
    if ! command -v ~/.acme.sh/acme.sh &> /dev/null; then
        echo "acme.sh could not be found. Installing now..."
        cd ~ || return 1
        curl -s https://get.acme.sh | sh
        if [ $? -ne 0 ]; then
            echo -e "${red}Failed to install acme.sh${plain}"
            return 1
        else
            echo -e "${green}acme.sh installed successfully${plain}"
        fi
    fi

    # get the domain here, and we need to verify it
    local domain=""
    while true; do
        read -rp "Please enter your domain name: " domain
        domain="${domain// /}" # Trim whitespace

        if [[ -z "$domain" ]]; then
            echo -e "${red}Domain name cannot be empty. Please try again.${plain}"
            continue
        fi

        if ! is_domain "$domain"; then
            echo -e "${red}Invalid domain format: ${domain}. Please enter a valid domain name.${plain}"
            continue
        fi

        break
    done
    echo -e "${green}Your domain is: ${domain}, checking it...${plain}"
    SSL_ISSUED_DOMAIN="${domain}"

    # detect existing certificate and reuse it if present
    local cert_exists=0
    if ~/.acme.sh/acme.sh --list 2> /dev/null | awk '{print $1}' | grep -Fxq "${domain}"; then
        cert_exists=1
        local certInfo=$(~/.acme.sh/acme.sh --list 2> /dev/null | grep -F "${domain}")
        echo -e "${yellow}Existing certificate found for ${domain}, will reuse it.${plain}"
        [[ -n "${certInfo}" ]] && echo "$certInfo"
    else
        echo -e "${green}Your domain is ready for issuing certificates now...${plain}"
    fi

    # create a directory for the certificate
    certPath="/root/cert/${domain}"
    if [ ! -d "$certPath" ]; then
        mkdir -p "$certPath"
    else
        rm -rf "$certPath"
        mkdir -p "$certPath"
    fi

    # get the port number for the standalone server
    local WebPort=80
    read -rp "Please choose which port to use (default is 80): " WebPort
    if [[ -z ${WebPort} ]]; then
        WebPort=80
    elif [[ ! ${WebPort} =~ ^[1-9][0-9]*$ || ${WebPort} -gt 65535 ]]; then
        echo -e "${yellow}Your input ${WebPort} is invalid, will use default port 80.${plain}"
        WebPort=80
    fi
    echo -e "${green}Will use port: ${WebPort} to issue certificates. Please make sure this port is open.${plain}"

    # Stop panel temporarily
    echo -e "${yellow}Stopping panel temporarily...${plain}"
    systemctl stop x-ray 2> /dev/null || rc-service x-ray stop 2> /dev/null

    if [[ ${cert_exists} -eq 0 ]]; then
        # issue the certificate
        ~/.acme.sh/acme.sh --set-default-ca --server letsencrypt --force
        ~/.acme.sh/acme.sh --issue -d ${domain} $(acme_listen_flag) --standalone --httpport ${WebPort} --force
        if [ $? -ne 0 ]; then
            echo -e "${red}Issuing certificate failed, please check logs.${plain}"
            rm -rf ~/.acme.sh/${domain}
            systemctl start x-ray 2> /dev/null || rc-service x-ray start 2> /dev/null
            return 1
        else
            echo -e "${green}Issuing certificate succeeded, installing certificates...${plain}"
        fi
    else
        echo -e "${green}Using existing certificate, installing certificates...${plain}"
    fi

    # Setup reload command
    reloadCmd="systemctl restart x-ray || rc-service x-ray restart"
    echo -e "${green}Default --reloadcmd for ACME is: ${yellow}systemctl restart x-ray || rc-service x-ray restart${plain}"
    echo -e "${green}This command will run on every certificate issue and renew.${plain}"
    read -rp "Would you like to modify --reloadcmd for ACME? (y/n): " setReloadcmd
    if [[ "$setReloadcmd" == "y" || "$setReloadcmd" == "Y" ]]; then
        echo -e "\n${green}\t1.${plain} Preset: systemctl reload nginx ; systemctl restart x-ray"
        echo -e "${green}\t2.${plain} Input your own command"
        echo -e "${green}\t0.${plain} Keep default reloadcmd"
        read -rp "Choose an option: " choice
        case "$choice" in
            1)
                echo -e "${green}Reloadcmd is: systemctl reload nginx ; systemctl restart x-ray${plain}"
                reloadCmd="systemctl reload nginx ; systemctl restart x-ray"
                ;;
            2)
                echo -e "${yellow}It's recommended to put x-ray restart at the end${plain}"
                read -rp "Please enter your custom reloadcmd: " reloadCmd
                echo -e "${green}Reloadcmd is: ${reloadCmd}${plain}"
                ;;
            *)
                echo -e "${green}Keeping default reloadcmd${plain}"
                ;;
        esac
    fi

    # install the certificate
    local installOutput=""
    installOutput=$(~/.acme.sh/acme.sh --installcert --force -d ${domain} \
        --key-file /root/cert/${domain}/privkey.pem \
        --fullchain-file /root/cert/${domain}/fullchain.pem --reloadcmd "${reloadCmd}" 2>&1)
    local installRc=$?
    echo "${installOutput}"

    local installWroteFiles=0
    if echo "${installOutput}" | grep -q "Installing key to:" && echo "${installOutput}" | grep -q "Installing full chain to:"; then
        installWroteFiles=1
    fi

    if [[ -f "/root/cert/${domain}/privkey.pem" && -f "/root/cert/${domain}/fullchain.pem" && (${installRc} -eq 0 || ${installWroteFiles} -eq 1) ]]; then
        echo -e "${green}Installing certificate succeeded, enabling auto renew...${plain}"
    else
        echo -e "${red}Installing certificate failed, exiting.${plain}"
        if [[ ${cert_exists} -eq 0 ]]; then
            rm -rf ~/.acme.sh/${domain}
        fi
        systemctl start x-ray 2> /dev/null || rc-service x-ray start 2> /dev/null
        return 1
    fi

    # enable auto-renew
    ~/.acme.sh/acme.sh --upgrade --auto-upgrade
    if [ $? -ne 0 ]; then
        echo -e "${yellow}Auto renew setup had issues, certificate details:${plain}"
        ls -lah /root/cert/${domain}/
        chmod 600 $certPath/privkey.pem
        chmod 644 $certPath/fullchain.pem
    else
        echo -e "${green}Auto renew succeeded, certificate details:${plain}"
        ls -lah /root/cert/${domain}/
        chmod 600 $certPath/privkey.pem
        chmod 644 $certPath/fullchain.pem
    fi

    # Restart panel
    systemctl start x-ray 2> /dev/null || rc-service x-ray start 2> /dev/null

    # Prompt user to set panel paths after successful certificate installation
    read -rp "Would you like to set this certificate for the panel? (y/n): " setPanel
    if [[ "$setPanel" == "y" || "$setPanel" == "Y" ]]; then
        local webCertFile="/root/cert/${domain}/fullchain.pem"
        local webKeyFile="/root/cert/${domain}/privkey.pem"

        if [[ -f "$webCertFile" && -f "$webKeyFile" ]]; then
            ${xray_folder}/x-ray cert -webCert "$webCertFile" -webCertKey "$webKeyFile"
            echo -e "${green}Certificate paths set for the panel${plain}"
            echo -e "${green}Certificate File: $webCertFile${plain}"
            echo -e "${green}Private Key File: $webKeyFile${plain}"
            echo ""
            echo -e "${green}Access URL: https://${domain}:${existing_port}/${existing_webBasePath}${plain}"
            echo -e "${yellow}Panel will restart to apply SSL certificate...${plain}"
            systemctl restart x-ray 2> /dev/null || rc-service x-ray restart 2> /dev/null
        else
            echo -e "${red}Error: Certificate or private key file not found for domain: $domain.${plain}"
        fi
    else
        echo -e "${yellow}Skipping panel path setting.${plain}"
    fi

    return 0
}

install_cloudflared() {
    if command -v cloudflared &> /dev/null; then
        return 0
    fi
    echo -e "${yellow}Downloading & installing Cloudflare Tunnel (cloudflared)...${plain}"
    local cf_arch=""
    case "$(uname -m)" in
        x86_64 | amd64) cf_arch="amd64" ;;
        aarch64 | arm64) cf_arch="arm64" ;;
        armv7* | armhf) cf_arch="arm" ;;
        i386 | i686) cf_arch="386" ;;
        *)
            echo -e "${red}Unsupported architecture for cloudflared: $(uname -m)${plain}"
            return 1
            ;;
    esac
    curl -fsSL --retry 3 "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${cf_arch}" -o /usr/local/bin/cloudflared
    if [[ $? -ne 0 || ! -s /usr/local/bin/cloudflared ]]; then
        echo -e "${red}Failed to download cloudflared binary.${plain}"
        return 1
    fi
    chmod +x /usr/local/bin/cloudflared
    ln -sf /usr/local/bin/cloudflared /usr/bin/cloudflared 2>/dev/null || true
    echo -e "${green}cloudflared installed successfully!${plain}"
    return 0
}

setup_cloudflare_tunnel() {
    local panel_port="$1"
    local web_base_path="$2"
    if [[ -z "$panel_port" ]]; then
        panel_port=$(${xray_folder}/x-ray setting -show true 2>/dev/null | grep -Eo 'port: .+' | awk '{print $2}')
        panel_port="${panel_port:-4523}"
    fi
    if [[ -z "$web_base_path" ]]; then
        web_base_path=$(${xray_folder}/x-ray setting -show true 2>/dev/null | grep -Eo 'webBasePath: .+' | awk '{print $2}' | sed 's#^/##')
    fi

    install_cloudflared || return 1

    echo ""
    echo -e "${green}═══════════════════════════════════════════════════════════${plain}"
    echo -e "${green}        Cloudflare Tunnel Setup                            ${plain}"
    echo -e "${green}═══════════════════════════════════════════════════════════${plain}"
    echo -e "Benefits of Cloudflare Tunnel:"
    echo -e "  • ${green}Free official Cloudflare SSL certificate${plain}"
    echo -e "  • ${green}Zero open ports needed on VPS (bypasses Port 80/443/Nginx conflicts)${plain}"
    echo -e "  • ${green}DDoS protection, CDN acceleration, and Web Application Firewall${plain}"
    echo ""
    echo -e "  ${green}1.${plain} Auto-Login via Browser URL (Zero credentials required — Recommended)"
    echo -e "  ${green}2.${plain} Connect using Cloudflare Zero Trust Tunnel Token"
    echo -e "  ${green}0.${plain} Skip / Back"
    echo ""
    read -rp "Please enter choice [1-2]: " cf_choice

    case "$cf_choice" in
        1)
            echo ""
            echo -e "${yellow}═══════════════════════════════════════════════════════════${plain}"
            echo -e "${yellow}           Cloudflare Tunnel Auto-Login                    ${plain}"
            echo -e "${yellow}═══════════════════════════════════════════════════════════${plain}"
            echo -e "1. Below you will see an authorization URL."
            echo -e "2. Copy and open the link in your browser."
            echo -e "3. Select your domain (e.g. digitaltv.lk) and click 'Authorize'."
            echo -e "4. As soon as you click Authorize, the terminal will auto-continue!"
            echo -e "${yellow}═══════════════════════════════════════════════════════════${plain}"
            echo ""

            if [[ -f ~/.cloudflared/cert.pem || -f /etc/cloudflared/cert.pem ]]; then
                read -rp "Existing Cloudflare login session found. Use existing authorization? [Y/n]: " use_existing_auth
                if [[ "$use_existing_auth" =~ ^[nN]$ ]]; then
                    rm -f ~/.cloudflared/cert.pem /etc/cloudflared/cert.pem
                    cloudflared tunnel login
                fi
            else
                cloudflared tunnel login
            fi

            local cert_path=""
            if [[ -f ~/.cloudflared/cert.pem ]]; then
                cert_path=~/.cloudflared/cert.pem
            elif [[ -f /etc/cloudflared/cert.pem ]]; then
                cert_path=/etc/cloudflared/cert.pem
            fi

            if [[ -z "$cert_path" ]]; then
                echo -e "${red}Login authorization was not completed. Please try again.${plain}"
                return 1
            fi
            echo -e "${green}✓ Cloudflare authorization successful!${plain}"
            echo ""

            local tunnel_domain=""
            read -rp "Please enter your domain or subdomain for the panel (e.g. vpn.digitaltv.lk): " tunnel_domain
            tunnel_domain="${tunnel_domain// /}"
            if [[ -z "$tunnel_domain" ]]; then
                echo -e "${red}Domain cannot be empty.${plain}"
                return 1
            fi

            local tunnel_name="xray-panel-tunnel"
            echo -e "${green}Configuring tunnel '${tunnel_name}'...${plain}"
            cloudflared tunnel delete -f "$tunnel_name" > /dev/null 2>&1 || true
            local tunnel_output=$(cloudflared tunnel create "$tunnel_name" 2>&1)
            local tunnel_id=$(echo "$tunnel_output" | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -n1)
            if [[ -z "$tunnel_id" ]]; then
                tunnel_id=$(cloudflared tunnel list 2>&1 | grep "$tunnel_name" | awk '{print $1}')
            fi

            if [[ -z "$tunnel_id" ]]; then
                echo -e "${red}Failed to create tunnel. Output:${plain}"
                echo "$tunnel_output"
                return 1
            fi
            echo -e "${green}✓ Tunnel created with ID: ${tunnel_id}${plain}"

            echo -e "${green}Routing Cloudflare DNS for ${tunnel_domain}...${plain}"
            cloudflared tunnel route dns --overwrite-dns "$tunnel_name" "$tunnel_domain"

            mkdir -p /etc/cloudflared
            local cred_src="/root/.cloudflared/${tunnel_id}.json"
            if [[ ! -f "$cred_src" ]]; then
                cred_src=$(find /root/.cloudflared /etc/cloudflared -name "${tunnel_id}.json" 2>/dev/null | head -n1)
            fi
            if [[ -n "$cred_src" && -f "$cred_src" ]]; then
                cp -f "$cred_src" "/etc/cloudflared/${tunnel_id}.json" 2>/dev/null || true
            fi

            cat > /etc/cloudflared/config.yml <<EOF
tunnel: ${tunnel_id}
credentials-file: /etc/cloudflared/${tunnel_id}.json

ingress:
  - hostname: ${tunnel_domain}
    service: http://127.0.0.1:${panel_port}
  - service: http_status:404
EOF

            echo -e "${green}Installing cloudflared service...${plain}"
            cloudflared service uninstall > /dev/null 2>&1 || true
            cloudflared --config /etc/cloudflared/config.yml service install > /dev/null 2>&1 || true
            systemctl daemon-reload
            systemctl enable cloudflared
            systemctl restart cloudflared

            sleep 2
            if systemctl is-active --quiet cloudflared; then
                echo ""
                echo -e "${green}═══════════════════════════════════════════════════════════${plain}"
                echo -e "${green}  ✓ Cloudflare Tunnel is LIVE and ACTIVE!                  ${plain}"
                echo -e "${green}═══════════════════════════════════════════════════════════${plain}"
                echo -e "${green}Access URL: https://${tunnel_domain}/${web_base_path}${plain}"
                echo -e "${yellow}• SSL is 100% active with green padlock via Cloudflare CDN.${plain}"
                echo -e "${yellow}• Port 80 and port ${panel_port} do NOT need to be exposed externally!${plain}"
                echo -e "${green}═══════════════════════════════════════════════════════════${plain}"
                SSL_SCHEME="https"
                SSL_HOST="${tunnel_domain}"
                IS_CF_TUNNEL="true"
                return 0
            else
                echo -e "${yellow}Tunnel service installed. Checking status...${plain}"
                systemctl status cloudflared --no-pager
                return 0
            fi
            ;;
        2)
            echo ""
            local cf_token=""
            read -rp "Please enter your Cloudflare Tunnel Token (eyJh...): " cf_token
            cf_token="${cf_token// /}"
            if [[ -z "$cf_token" ]]; then
                echo -e "${red}Token cannot be empty.${plain}"
                return 1
            fi
            cloudflared service uninstall > /dev/null 2>&1 || true
            cloudflared service install "$cf_token"
            systemctl daemon-reload
            systemctl enable cloudflared
            systemctl restart cloudflared
            echo -e "${green}✓ Cloudflare Tunnel installed and active with Token!${plain}"
            IS_CF_TUNNEL="true"
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

ssl_cert_issue_CF() {
    echo -e "${green}═══════════════════════════════════════════${plain}"
    echo -e "${green}     Cloudflare DNS API SSL Setup          ${plain}"
    echo -e "${green}═══════════════════════════════════════════${plain}"
    echo -e "Requires Cloudflare API Token (Zone:DNS:Edit) or Global API Key + email."
    echo -e "${yellow}No port 80 is required for this method.${plain}"
    echo ""

    if ! command -v ~/.acme.sh/acme.sh &> /dev/null; then
        echo "acme.sh could not be found. We will install it."
        install_acme || return 1
    fi

    local CF_Domain=""
    read -rp "Please enter your domain (e.g. digitaltv.lk or vpn.digitaltv.lk): " CF_Domain
    CF_Domain="${CF_Domain// /}"
    [[ -z "$CF_Domain" ]] && return 1

    local CF_KeyType=""
    read -rp "Are you using a Cloudflare API Token or Global API Key? (t/g) [Default t]: " CF_KeyType
    CF_KeyType=${CF_KeyType:-t}

    if [[ "$CF_KeyType" == "g" || "$CF_KeyType" == "G" ]]; then
        local CF_GlobalKey=""
        local CF_AccountEmail=""
        read -rp "Please enter your Global API Key: " CF_GlobalKey
        read -rp "Please enter your registered Cloudflare email: " CF_AccountEmail
        export CF_Key="${CF_GlobalKey// /}"
        export CF_Email="${CF_AccountEmail// /}"
    else
        local CF_ApiToken=""
        read -rp "Please enter your Cloudflare API Token: " CF_ApiToken
        export CF_Token="${CF_ApiToken// /}"
    fi

    ~/.acme.sh/acme.sh --set-default-ca --server letsencrypt --force
    echo -e "${green}Issuing certificate via Cloudflare DNS...${plain}"
    ~/.acme.sh/acme.sh --issue --dns dns_cf -d "${CF_Domain}" --log --force
    if [[ $? -ne 0 ]]; then
        echo -e "${red}Cloudflare DNS certificate issuance failed.${plain}"
        return 1
    fi

    local certPath="/root/cert/${CF_Domain}"
    rm -rf "${certPath}"
    mkdir -p "${certPath}"

    ~/.acme.sh/acme.sh --installcert --force -d "${CF_Domain}" \
        --key-file "${certPath}/privkey.pem" \
        --fullchain-file "${certPath}/fullchain.pem" \
        --reloadcmd "systemctl restart x-ray || rc-service x-ray restart"

    ~/.acme.sh/acme.sh --upgrade --auto-upgrade
    chmod 600 "${certPath}/privkey.pem"
    chmod 644 "${certPath}/fullchain.pem"

    ${xray_folder}/x-ray cert -webCert "${certPath}/fullchain.pem" -webCertKey "${certPath}/privkey.pem"
    echo -e "${green}✓ Certificate paths configured for panel!${plain}"
    SSL_HOST="${CF_Domain}"
    SSL_SCHEME="https"
    systemctl restart x-ray > /dev/null 2>&1 || rc-service x-ray restart > /dev/null 2>&1
    return 0
}
# Unified interactive SSL setup (domain or IP)
# Sets global `SSL_HOST` to the chosen domain/IP
prompt_and_setup_ssl() {
    local panel_port="$1"
    local web_base_path="$2" # expected without leading slash
    local server_ip="$3"

    local ssl_choice=""
    IS_CF_TUNNEL="false"

    echo -e "${yellow}Choose SSL / Access setup method:${plain}"
    echo -e "${green}1.${plain} Cloudflare Tunnel (RECOMMENDED — auto browser URL, zero port conflicts, free SSL)"
    echo -e "${green}2.${plain} Let's Encrypt for Domain (90-day validity, requires port 80 open)"
    echo -e "${green}3.${plain} Let's Encrypt for IP Address (6-day validity, requires port 80 open)"
    echo -e "${green}4.${plain} Cloudflare DNS API (Direct wildcard SSL via API Key/Token, no port 80 conflict)"
    echo -e "${green}5.${plain} Custom SSL Certificate (Path to existing files)"
    echo -e "${green}6.${plain} Skip SSL (advanced — behind reverse proxy / SSH tunnel only)"
    echo -e "${blue}Note:${plain} Option 1 gives instant Cloudflare SSL with zero open ports on VPS (bypasses Nginx port 80/443)."
    echo -e "${blue}Note:${plain} Options 2 & 3 require port 80 open. Option 4 requires Cloudflare API token/key."
    echo -e "${blue}Note:${plain} Option 6 serves the panel over plain HTTP — only safe behind nginx/Caddy or an SSH tunnel."
    read -rp "Choose an option (default 1 for Cloudflare Tunnel): " ssl_choice
    ssl_choice="${ssl_choice// /}" # Trim whitespace

    if [[ "$ssl_choice" != "1" && "$ssl_choice" != "2" && "$ssl_choice" != "3" && "$ssl_choice" != "4" && "$ssl_choice" != "5" && "$ssl_choice" != "6" ]]; then
        ssl_choice="1"
    fi

    case "$ssl_choice" in
        1)
            # User chose Cloudflare Tunnel option
            if setup_cloudflare_tunnel "${panel_port}" "${web_base_path}"; then
                IS_CF_TUNNEL="true"
            else
                echo -e "${yellow}Cloudflare Tunnel setup skipped. Falling back to HTTP.${plain}"
                SSL_SCHEME="http"
                SSL_HOST="${server_ip}"
            fi
            ;;
        2)
            # User chose Let's Encrypt domain option
            echo -e "${green}Using Let's Encrypt for domain certificate...${plain}"
            if ssl_cert_issue; then
                local cert_domain="${SSL_ISSUED_DOMAIN}"
                if [[ -z "${cert_domain}" ]]; then
                    cert_domain=$(~/.acme.sh/acme.sh --list 2> /dev/null | tail -1 | awk '{print $1}')
                fi

                if [[ -n "${cert_domain}" ]]; then
                    SSL_HOST="${cert_domain}"
                    echo -e "${green}✓ SSL certificate configured successfully with domain: ${cert_domain}${plain}"
                else
                    echo -e "${yellow}SSL setup may have completed, but domain extraction failed${plain}"
                    SSL_HOST="${server_ip}"
                fi
            else
                echo -e "${red}SSL certificate setup failed for domain mode.${plain}"
                SSL_HOST="${server_ip}"
            fi
            ;;
        3)
            # User chose Let's Encrypt IP certificate option
            echo -e "${green}Using Let's Encrypt for IP certificate (shortlived profile)...${plain}"

            # Confirm the auto-detected IP before issuing for it: with asymmetric
            # routing / multi-WAN the echo services can return a transit address.
            local ip_confirm=""
            read -rp "Is ${server_ip} the correct incoming public IPv4 address for this server? [Default y]: " ip_confirm
            if [[ -n "$ip_confirm" && "$ip_confirm" != "y" && "$ip_confirm" != "Y" ]]; then
                server_ip=""
                while [[ -z "$server_ip" ]]; do
                    read -rp "Please enter your server's public IPv4 address: " server_ip
                    server_ip="${server_ip// /}"
                    if [[ ! "$server_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                        echo -e "${red}Invalid IPv4 address. Please try again.${plain}"
                        server_ip=""
                    fi
                done
            fi

            # Ask for optional IPv6
            local ipv6_addr=""
            read -rp "Do you have an IPv6 address to include? (leave empty to skip): " ipv6_addr
            ipv6_addr="${ipv6_addr// /}" # Trim whitespace

            # Stop panel if running (port 80 needed)
            if [[ $release == "alpine" ]]; then
                rc-service x-ray stop > /dev/null 2>&1
            else
                systemctl stop x-ray > /dev/null 2>&1
            fi

            setup_ip_certificate "${server_ip}" "${ipv6_addr}"
            if [ $? -eq 0 ]; then
                SSL_HOST="${server_ip}"
                echo -e "${green}✓ Let's Encrypt IP certificate configured successfully${plain}"
            else
                echo -e "${red}✗ IP certificate setup failed. Please check port 80 is open.${plain}"
                SSL_HOST="${server_ip}"
            fi

            # Restart panel after SSL is configured (restart applies new cert settings)
            if [[ $release == "alpine" ]]; then
                rc-service x-ray restart > /dev/null 2>&1
            else
                systemctl restart x-ray > /dev/null 2>&1
            fi

            ;;
        4)
            # User chose Cloudflare DNS API option
            if ssl_cert_issue_CF; then
                echo -e "${green}✓ Cloudflare DNS SSL configured.${plain}"
            else
                echo -e "${red}Cloudflare DNS SSL failed. Falling back to HTTP.${plain}"
                SSL_SCHEME="http"
                SSL_HOST="${server_ip}"
            fi
            ;;
        5)
            # User chose Custom Paths (User Provided) option
            echo -e "${green}Using custom existing certificate...${plain}"
            local custom_cert=""
            local custom_key=""
            local custom_domain=""

            # 3.1 Request Domain to compose Panel URL later
            read -rp "Please enter domain name certificate issued for: " custom_domain
            custom_domain="${custom_domain// /}" # Remove spaces

            # 3.2 Loop for Certificate Path
            while true; do
                read -rp "Input certificate path (keywords: .crt / fullchain): " custom_cert
                # Strip quotes if present
                custom_cert=$(echo "$custom_cert" | tr -d '"' | tr -d "'")

                if [[ -f "$custom_cert" && -r "$custom_cert" && -s "$custom_cert" ]]; then
                    break
                elif [[ ! -f "$custom_cert" ]]; then
                    echo -e "${red}Error: File does not exist! Try again.${plain}"
                elif [[ ! -r "$custom_cert" ]]; then
                    echo -e "${red}Error: File exists but is not readable (check permissions)!${plain}"
                else
                    echo -e "${red}Error: File is empty!${plain}"
                fi
            done

            # 3.3 Loop for Private Key Path
            while true; do
                read -rp "Input private key path (keywords: .key / privatekey): " custom_key
                # Strip quotes if present
                custom_key=$(echo "$custom_key" | tr -d '"' | tr -d "'")

                if [[ -f "$custom_key" && -r "$custom_key" && -s "$custom_key" ]]; then
                    break
                elif [[ ! -f "$custom_key" ]]; then
                    echo -e "${red}Error: File does not exist! Try again.${plain}"
                elif [[ ! -r "$custom_key" ]]; then
                    echo -e "${red}Error: File exists but is not readable (check permissions)!${plain}"
                else
                    echo -e "${red}Error: File is empty!${plain}"
                fi
            done

            # 3.4 Apply Settings via x-ray binary
            ${xray_folder}/x-ray cert -webCert "$custom_cert" -webCertKey "$custom_key" > /dev/null 2>&1

            # Set SSL_HOST for composing Panel URL
            if [[ -n "$custom_domain" ]]; then
                SSL_HOST="$custom_domain"
            else
                SSL_HOST="${server_ip}"
            fi

            echo -e "${green}✓ Custom certificate paths applied.${plain}"
            echo -e "${yellow}Note: You are responsible for renewing these files externally.${plain}"

            systemctl restart x-ray > /dev/null 2>&1 || rc-service x-ray restart > /dev/null 2>&1
            ;;
        6)
            echo ""
            echo -e "${red}⚠ Panel will be installed WITHOUT SSL/TLS.${plain}"
            echo -e "${yellow}Login credentials and cookies will travel as plain HTTP.${plain}"
            echo -e "${yellow}Only safe when:${plain}"
            echo -e "${yellow}  • A reverse proxy (nginx, Caddy, Traefik) terminates TLS for you, or${plain}"
            echo -e "${yellow}  • You access the panel exclusively via SSH tunnel${plain}"
            echo ""

            SSL_SCHEME="http"
            SSL_HOST="${server_ip}"

            local bind_local=""
            read -rp "Bind the panel to 127.0.0.1 only? (recommended — forces SSH tunnel / reverse-proxy access) [y/N]: " bind_local
            if [[ "$bind_local" == "y" || "$bind_local" == "Y" ]]; then
                ${xray_folder}/x-ray setting -listenIP "127.0.0.1" > /dev/null 2>&1
                SSL_HOST="127.0.0.1"
                echo -e "${green}✓ Panel bound to 127.0.0.1 only. It is now unreachable from the public internet.${plain}"
                echo ""
                echo -e "${green}SSH Port Forwarding — open the panel from your local machine via:${plain}"
                echo -e "  Standard SSH command:"
                echo -e "  ${yellow}ssh -L 2222:127.0.0.1:${panel_port} root@${server_ip}${plain}"
                echo -e "  If using an SSH key:"
                echo -e "  ${yellow}ssh -i <sshkeypath> -L 2222:127.0.0.1:${panel_port} root@${server_ip}${plain}"
                echo -e "  Then open in your browser:"
                echo -e "  ${yellow}http://localhost:2222/${web_base_path}${plain}"
                echo ""
                echo -e "${yellow}Alternative: point a reverse proxy (nginx/Caddy) at 127.0.0.1:${panel_port} and let it terminate TLS.${plain}"
            else
                echo -e "${yellow}Panel will listen on all interfaces over plain HTTP. Make sure something else is terminating TLS in front of it.${plain}"
            fi

            systemctl restart x-ray > /dev/null 2>&1 || rc-service x-ray restart > /dev/null 2>&1
            echo -e "${green}✓ SSL setup skipped.${plain}"
            ;;
        *)
            echo -e "${red}Invalid option. Skipping SSL setup.${plain}"
            SSL_HOST="${server_ip}"
            ;;
    esac
}

config_after_update() {
    local panel_needs_restart=0

    echo -e "${yellow}x-ray settings:${plain}"
    ${xray_folder}/x-ray setting -show true
    ${xray_folder}/x-ray migrate

    # Properly detect empty cert by checking if cert: line exists and has content after it
    local existing_cert=$(${xray_folder}/x-ray setting -getCert true 2> /dev/null | grep 'cert:' | awk -F': ' '{print $2}' | tr -d '[:space:]')
    local existing_port=$(${xray_folder}/x-ray setting -show true | grep -Eo 'port: .+' | awk '{print $2}')
    local existing_webBasePath=$(${xray_folder}/x-ray setting -show true | grep -Eo 'webBasePath: .+' | awk '{print $2}' | sed 's#^/##')

    # Get server IP
    local URL_lists=(
        "https://api4.ipify.org"
        "https://ipv4.icanhazip.com"
        "https://v4.api.ipinfo.io/ip"
        "https://ipv4.myexternalip.com/raw"
        "https://4.ident.me"
        "https://check-host.net/ip"
    )
    local server_ip=""
    for ip_address in "${URL_lists[@]}"; do
        local response=$(curl -s -w "\n%{http_code}" --max-time 3 "${ip_address}" 2> /dev/null)
        local http_code=$(echo "$response" | tail -n1)
        local ip_result=$(echo "$response" | head -n-1 | tr -d '[:space:]"')
        if [[ "${http_code}" == "200" && "${ip_result}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            server_ip="${ip_result}"
            break
        fi
    done

    if [[ -z "$server_ip" ]]; then
        echo -e "${yellow}Could not auto-detect server IP from any provider.${plain}"
        while [[ -z "$server_ip" ]]; do
            read -rp "Please enter your server's public IPv4 address: " server_ip
            server_ip="${server_ip// /}"
            if [[ ! "$server_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                echo -e "${red}Invalid IPv4 address. Please try again.${plain}"
                server_ip=""
            fi
        done
    fi

    # Handle missing/short webBasePath
    if [[ ${#existing_webBasePath} -lt 4 ]]; then
        echo -e "${yellow}WebBasePath is missing or too short. Generating a new one...${plain}"
        local config_webBasePath=$(gen_random_string 18)
        ${xray_folder}/x-ray setting -webBasePath "${config_webBasePath}"
        existing_webBasePath="${config_webBasePath}"
        panel_needs_restart=1
        echo -e "${green}New WebBasePath: ${config_webBasePath}${plain}"
    fi

    # Check and prompt for SSL if missing
    if [[ -z "$existing_cert" ]]; then
        echo ""
        echo -e "${red}═══════════════════════════════════════════${plain}"
        echo -e "${red}      ⚠ NO SSL CERTIFICATE DETECTED ⚠     ${plain}"
        echo -e "${red}═══════════════════════════════════════════${plain}"
        echo -e "${yellow}For security, SSL certificate is MANDATORY for all panels.${plain}"
        echo -e "${yellow}Let's Encrypt now supports both domains and IP addresses!${plain}"
        echo ""

        # Prompt and setup SSL (domain or IP)
        prompt_and_setup_ssl "${existing_port}" "${existing_webBasePath}" "${server_ip}"

        echo ""
        echo -e "${green}═══════════════════════════════════════════${plain}"
        echo -e "${green}     Panel Access Information              ${plain}"
        echo -e "${green}═══════════════════════════════════════════${plain}"
        if [[ "$IS_CF_TUNNEL" == "true" ]]; then
            echo -e "${green}Access URL: https://${SSL_HOST}/${existing_webBasePath}${plain}"
        else
            echo -e "${green}Access URL: https://${SSL_HOST}:${existing_port}/${existing_webBasePath}${plain}"
        fi
        echo -e "${green}═══════════════════════════════════════════${plain}"
        echo -e "${yellow}⚠ SSL Certificate: Enabled and configured${plain}"
    else
        echo -e "${green}SSL certificate is already configured${plain}"
        # Show access URL with existing certificate
        local cert_domain=$(basename "$(dirname "$existing_cert")")
        echo ""
        echo -e "${green}═══════════════════════════════════════════${plain}"
        echo -e "${green}     Panel Access Information              ${plain}"
        echo -e "${green}═══════════════════════════════════════════${plain}"
        echo -e "${green}Access URL: https://${cert_domain}:${existing_port}/${existing_webBasePath}${plain}"
        echo -e "${green}═══════════════════════════════════════════${plain}"
    fi

    if [[ "$panel_needs_restart" -eq 1 ]]; then
        echo -e "${yellow}Restarting panel to apply the new web base path...${plain}"
        systemctl restart x-ray 2> /dev/null || rc-service x-ray restart 2> /dev/null
    fi
}

# setup_fail2ban auto-installs and configures fail2ban for the IP Limit feature
# by invoking the freshly downloaded x-ray CLI. IP Limit is load-bearing on
# fail2ban (without it the panel disables the limitIp field and zeroes existing
# limits), so updating an older install should make it work without a manual
# trip through the IP Limit menu. Non-fatal: a fail2ban failure must never abort
# the update. XRAY_ENABLE_FAIL2BAN is honored (load_xray_env exports it from the
# persisted env file, so a deliberate opt-out survives updates).
setup_fail2ban() {
    if [[ -n "${XRAY_ENABLE_FAIL2BAN+x}" && "${XRAY_ENABLE_FAIL2BAN}" != "true" ]]; then
        echo -e "${yellow}XRAY_ENABLE_FAIL2BAN=${XRAY_ENABLE_FAIL2BAN}, skipping Fail2ban auto-setup.${plain}"
        return 0
    fi

    if [[ ! -x /usr/bin/x-ray ]]; then
        echo -e "${yellow}x-ray CLI not found; skipping Fail2ban auto-setup.${plain}"
        return 0
    fi

    # Scripts older than v1.0.0 have no setup-fail2ban and exit 0 from the
    # usage banner, which would read as success here.
    if ! grep -q '"setup-fail2ban")' /usr/bin/x-ray; then
        echo -e "${yellow}This x-ray.sh predates 'x-ray setup-fail2ban'; skipping Fail2ban auto-setup.${plain}"
        return 0
    fi

    echo -e "${green}Setting up Fail2ban for the IP Limit feature...${plain}"
    if /usr/bin/x-ray setup-fail2ban; then
        echo -e "${green}Fail2ban setup complete.${plain}"
    else
        echo -e "${yellow}Fail2ban setup did not finish; IP Limit stays disabled until you run 'x-ray' and open the IP Limit menu. Continuing.${plain}"
    fi
    return 0
}

# Lands a systemd unit file at ${xray_service}/x-ray.service via a temp file +
# atomic mv, so a failed cp/curl or an interrupted mv never leaves a
# truncated unit file at the live path -- systemd would then fail to parse
# it on the next daemon-reload/start. Same pattern already used for
# /usr/bin/x-ray elsewhere in this script. source_is_url picks cp (from a
# file already extracted from the release tarball) vs curl (GitHub fallback).
_install_xray_service_unit() {
    local source="$1"
    local source_is_url="$2"
    local dest="${xray_service}/x-ray.service"
    local temp_file="${dest}.tmp.$$"

    rm -f "$temp_file"
    if [[ "$source_is_url" == "true" ]]; then
        ${curl_bin} -fLRo "$temp_file" "$source" > /dev/null 2>&1
    else
        cp -f "$source" "$temp_file" > /dev/null 2>&1
    fi
    if [[ $? -ne 0 ]]; then
        rm -f "$temp_file"
        return 1
    fi
    if [[ ! -s "$temp_file" ]]; then
        rm -f "$temp_file"
        return 1
    fi
    mv -f "$temp_file" "$dest"
    if [[ $? -ne 0 ]]; then
        rm -f "$temp_file"
        return 1
    fi
    return 0
}

# Older tags predate some of these files (x-ray.rc arrived in v2.8.4). Serving
# main's copy against an old binary is the mismatch this pinning exists to
# prevent, so probe before the old install is removed and refuse the tag.
require_repo_files() {
    local ref="$1" name status
    shift
    [[ "${ref}" == "main" ]] && return 0
    for name in "$@"; do
        status=$(${curl_bin} -sIL --retry 3 --connect-timeout 15 -o /dev/null -w '%{http_code}' "https://raw.githubusercontent.com/KAWDHITHA-NIRMAL/x-ray/${ref}/${name}")
        if [[ "${status}" != "200" ]]; then
            _fail "ERROR: ${name} is not available for ${ref} (HTTP ${status}). Update to a release that ships it, or to 'dev-latest'. The current installation is untouched."
        fi
    done
}

update_x-ray() {
    cd ${xray_folder%/x-ray}/

    load_xray_env

    if [ -f "${xray_folder}/x-ray" ]; then
        current_xray_version=$(${xray_folder}/x-ray -v)
        echo -e "${green}Current x-ray version: ${current_xray_version}${plain}"
    else
        _fail "ERROR: Current x-ray version: unknown"
    fi

    echo -e "${green}Downloading new x-ray version...${plain}"

    # XRAY_UPDATE_TAG lets the panel target a specific release tag (e.g. the
    # rolling dev-latest pre-release). Empty keeps the default latest-stable flow.
    if [[ -n "${XRAY_UPDATE_TAG}" ]]; then
        tag_version="${XRAY_UPDATE_TAG}"
        echo -e "${green}Using update tag: ${tag_version}${plain}"
    else
        tag_version=$(${curl_bin} -Ls "https://api.github.com/repos/KAWDHITHA-NIRMAL/x-ray/releases/latest" 2> /dev/null | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
        if [[ ! -n "$tag_version" ]]; then
            _fail "ERROR: Failed to fetch x-ray version, it may be due to GitHub API restrictions, please try it later"
        fi
    fi
    echo -e "Got x-ray latest version: ${tag_version}, beginning the installation..."
    # x-ray.sh, x-ray.rc and the unit files must come from the same release as
    # the binary; only the rolling dev build tracks main.
    script_ref="${tag_version}"
    if [[ "${tag_version}" == "dev-latest" ]]; then
        script_ref="main"
    fi
    # The unit files are only fetched when the release tarball lacks them, so
    # they are checked at that point instead of here.
    local required_files=("x-ray.sh")
    [[ $release == "alpine" ]] && required_files+=("x-ray.rc")
    require_repo_files "${script_ref}" "${required_files[@]}"
    ${curl_bin} -fLRo ${xray_folder}-linux-$(arch).tar.gz https://github.com/KAWDHITHA-NIRMAL/x-ray/releases/download/${tag_version}/x-ray-linux-$(arch).tar.gz 2> /dev/null
    if [[ $? -ne 0 ]]; then
        _fail "ERROR: Failed to download x-ray, please be sure that your server can access GitHub"
    fi
    if [[ ! -s ${xray_folder}-linux-$(arch).tar.gz ]]; then
        rm ${xray_folder}-linux-$(arch).tar.gz -f > /dev/null 2>&1
        _fail "ERROR: Downloaded x-ray release archive is empty, please be sure that your server can access GitHub"
    fi
    # Releases publish <asset>.sha256 next to each archive. A mismatch or a
    # failed sidecar download aborts the update; only a 404 (releases
    # predating the sidecar) is tolerated with a warning.
    archive="${xray_folder}-linux-$(arch).tar.gz"
    rm -f "${archive}.sha256"
    sidecar_code=$(${curl_bin} -sL --retry 3 --retry-delay 3 --connect-timeout 15 --max-time 60 -o "${archive}.sha256" -w '%{http_code}' "https://github.com/KAWDHITHA-NIRMAL/x-ray/releases/download/${tag_version}/x-ray-linux-$(arch).tar.gz.sha256" 2> /dev/null)
    if [[ "${sidecar_code}" == "200" ]]; then
        expected_sha256=$(awk 'NR == 1 {print $1}' "${archive}.sha256")
        actual_sha256=$(sha256sum "${archive}" | awk '{print $1}')
        rm -f "${archive}.sha256"
        if [[ ! "${expected_sha256}" =~ ^[0-9a-f]{64}$ || "${expected_sha256}" != "${actual_sha256}" ]]; then
            rm -f "${archive}"
            _fail "ERROR: Checksum mismatch for $(basename "${archive}"): expected ${expected_sha256:-<none>}, got ${actual_sha256}"
        fi
        echo -e "${green}Checksum verified: ${actual_sha256}${plain}"
    elif [[ "${sidecar_code}" == "404" ]]; then
        rm -f "${archive}.sha256"
        echo -e "${yellow}No checksum published for this release, skipping verification${plain}"
    else
        rm -f "${archive}.sha256" "${archive}"
        _fail "ERROR: Failed to download the checksum for x-ray-linux-$(arch).tar.gz (HTTP ${sidecar_code})"
    fi

    if [[ -e ${xray_folder}/ ]]; then
        echo -e "${green}Stopping x-ray...${plain}"
        if [[ $release == "alpine" ]]; then
            if [ -f "/etc/init.d/x-ray" ]; then
                rc-service x-ray stop > /dev/null 2>&1
                rc-update del x-ray > /dev/null 2>&1
                echo -e "${green}Removing old service unit version...${plain}"
                rm -f /etc/init.d/x-ray > /dev/null 2>&1
            else
                rm x-ray-linux-$(arch).tar.gz -f > /dev/null 2>&1
                _fail "ERROR: x-ray service unit not installed."
            fi
        else
            if [ -f "${xray_service}/x-ray.service" ]; then
                systemctl stop x-ray > /dev/null 2>&1
                systemctl disable x-ray > /dev/null 2>&1
                echo -e "${green}Removing old systemd unit version...${plain}"
                rm ${xray_service}/x-ray.service -f > /dev/null 2>&1
                systemctl daemon-reload > /dev/null 2>&1
            else
                rm x-ray-linux-$(arch).tar.gz -f > /dev/null 2>&1
                _fail "ERROR: x-ray systemd unit not installed."
            fi
        fi
        # Kill any leftover mtg (MTProto) sidecars. x-ray runs them outside its own
        # lifecycle, so on Linux a stale one can survive the stop and keep holding
        # an inbound port with an outdated secret, silently breaking new clients.
        # The new panel respawns a clean mtg per inbound on next start.
        pkill -f 'mtg-linux-[^ ]* run ' > /dev/null 2>&1 || true
        pkill -f 'tuic-server.*-c .*bin/tuic/tuic_[0-9]+\.json' > /dev/null 2>&1 || true
        echo -e "${green}Removing old x-ray version...${plain}"
        rm ${xray_folder} -f > /dev/null 2>&1
        rm ${xray_folder}/x-ray.service -f > /dev/null 2>&1
        rm ${xray_folder}/x-ray.service.debian -f > /dev/null 2>&1
        rm ${xray_folder}/x-ray.service.arch -f > /dev/null 2>&1
        rm ${xray_folder}/x-ray.service.rhel -f > /dev/null 2>&1
        rm ${xray_folder}/x-ray -f > /dev/null 2>&1
        rm ${xray_folder}/x-ray.sh -f > /dev/null 2>&1
        echo -e "${green}Removing old mtg version...${plain}"
        rm ${xray_folder}/bin/mtg-linux-$(arch) -f > /dev/null 2>&1
        echo -e "${green}Removing old xray version...${plain}"
        rm ${xray_folder}/bin/xray-linux-$(arch) -f > /dev/null 2>&1
        echo -e "${green}Removing old README and LICENSE file...${plain}"
        rm ${xray_folder}/bin/README.md -f > /dev/null 2>&1
        rm ${xray_folder}/bin/LICENSE -f > /dev/null 2>&1
    else
        rm x-ray-linux-$(arch).tar.gz -f > /dev/null 2>&1
        _fail "ERROR: x-ray not installed."
    fi

    echo -e "${green}Installing new x-ray version...${plain}"
    tar zxvf x-ray-linux-$(arch).tar.gz > /dev/null 2>&1
    if [[ $? -ne 0 ]]; then
        rm x-ray-linux-$(arch).tar.gz -f > /dev/null 2>&1
        _fail "ERROR: Failed to extract the x-ray release archive -- the previous installation has already been removed, so the panel will not start until this is fixed; try running the update again"
    fi
    rm x-ray-linux-$(arch).tar.gz -f > /dev/null 2>&1
    cd x-ray > /dev/null 2>&1
    if [[ $? -ne 0 || ! -s x-ray ]]; then
        _fail "ERROR: Extracted x-ray archive is missing the x-ray binary -- the previous installation has already been removed, so the panel will not start until this is fixed; try running the update again"
    fi
    chmod +x x-ray > /dev/null 2>&1

    # Check the system's architecture and rename the file accordingly.
    # The panel binary maps GOARCH=arm to "arm32" (internal/xray/process.go),
    # so the Xray binary must be named xray-linux-arm32; mtg keeps plain "arm".
    if [[ $(arch) == "armv5" || $(arch) == "armv6" || $(arch) == "armv7" ]]; then
        mv bin/xray-linux-$(arch) bin/xray-linux-arm32 > /dev/null 2>&1
        chmod +x bin/xray-linux-arm32 > /dev/null 2>&1
        if [[ -f bin/mtg-linux-$(arch) ]]; then
            mv bin/mtg-linux-$(arch) bin/mtg-linux-arm > /dev/null 2>&1
            chmod +x bin/mtg-linux-arm > /dev/null 2>&1
        fi
    fi

    chmod +x x-ray bin/xray-linux-$(arch) > /dev/null 2>&1
    if [[ -f bin/mtg-linux-arm ]]; then
        chmod +x bin/mtg-linux-arm > /dev/null 2>&1
    elif [[ -f bin/mtg-linux-$(arch) ]]; then
        chmod +x bin/mtg-linux-$(arch) > /dev/null 2>&1
    fi
    if [[ -f bin/tuic-server ]]; then
        chmod +x bin/tuic-server > /dev/null 2>&1
    fi

    echo -e "${green}Downloading and installing x-ray.sh script...${plain}"
    local xray_script_temp="/usr/bin/x-ray-temp.$$"
    rm -f "${xray_script_temp}"
    ${curl_bin} -fLRo "${xray_script_temp}" "https://raw.githubusercontent.com/KAWDHITHA-NIRMAL/x-ray/${script_ref}/x-ray.sh" > /dev/null 2>&1
    if [[ $? -ne 0 ]]; then
        rm -f "${xray_script_temp}"
        _fail "ERROR: Failed to download x-ray.sh script, please be sure that your server can access GitHub"
    fi
    if [[ ! -s "${xray_script_temp}" ]]; then
        rm -f "${xray_script_temp}"
        _fail "ERROR: Downloaded x-ray.sh script is empty, please be sure that your server can access GitHub"
    fi
    mv -f "${xray_script_temp}" /usr/bin/x-ray && ln -sf /usr/bin/x-ray /usr/bin/xray
    if [[ $? -ne 0 ]]; then
        rm -f "${xray_script_temp}"
        _fail "ERROR: Failed to install x-ray.sh script"
    fi

    chmod +x ${xray_folder}/x-ray.sh > /dev/null 2>&1
    chmod +x /usr/bin/x-ray /usr/bin/xray 2>/dev/null || true > /dev/null 2>&1
    mkdir -p /var/log/x-ray > /dev/null 2>&1

    echo -e "${green}Changing owner...${plain}"
    chown -R root:root ${xray_folder} > /dev/null 2>&1

    if [ -f "${xray_folder}/bin/config.json" ]; then
        echo -e "${green}Changing on config file permissions...${plain}"
        chmod 640 ${xray_folder}/bin/config.json > /dev/null 2>&1
    fi

    if [[ $release == "alpine" ]]; then
        echo -e "${green}Downloading and installing startup unit x-ray.rc...${plain}"
        xray_rc_temp="/etc/init.d/x-ray.tmp.$$"
        rm -f "${xray_rc_temp}"
        ${curl_bin} -fLRo "${xray_rc_temp}" "https://raw.githubusercontent.com/KAWDHITHA-NIRMAL/x-ray/${script_ref}/x-ray.rc" > /dev/null 2>&1
        if [[ $? -ne 0 ]]; then
            rm -f "${xray_rc_temp}"
            _fail "ERROR: Failed to download startup unit x-ray.rc, please be sure that your server can access GitHub"
        fi
        if [[ ! -s "${xray_rc_temp}" ]]; then
            rm -f "${xray_rc_temp}"
            _fail "ERROR: Downloaded startup unit x-ray.rc is empty, please be sure that your server can access GitHub"
        fi
        mv -f "${xray_rc_temp}" /etc/init.d/x-ray
        if [[ $? -ne 0 ]]; then
            rm -f "${xray_rc_temp}"
            _fail "ERROR: Failed to install startup unit x-ray.rc"
        fi
        chmod +x /etc/init.d/x-ray > /dev/null 2>&1
        chown root:root /etc/init.d/x-ray > /dev/null 2>&1
        rc-update add x-ray > /dev/null 2>&1
        rc-service x-ray start > /dev/null 2>&1
    else
        if [ -f "x-ray.service" ]; then
            echo -e "${green}Installing systemd unit...${plain}"
            if ! _install_xray_service_unit "x-ray.service" "false"; then
                echo -e "${red}Failed to copy x-ray.service${plain}"
                exit 1
            fi
        else
            service_installed=false
            case "${release}" in
                ubuntu | debian | armbian)
                    if [ -f "x-ray.service.debian" ]; then
                        echo -e "${green}Installing debian-like systemd unit...${plain}"
                        if _install_xray_service_unit "x-ray.service.debian" "false"; then
                            service_installed=true
                        fi
                    fi
                    ;;
                arch | manjaro | parch)
                    if [ -f "x-ray.service.arch" ]; then
                        echo -e "${green}Installing arch-like systemd unit...${plain}"
                        if _install_xray_service_unit "x-ray.service.arch" "false"; then
                            service_installed=true
                        fi
                    fi
                    ;;
                *)
                    if [ -f "x-ray.service.rhel" ]; then
                        echo -e "${green}Installing rhel-like systemd unit...${plain}"
                        if _install_xray_service_unit "x-ray.service.rhel" "false"; then
                            service_installed=true
                        fi
                    fi
                    ;;
            esac

            # If service file not found in tar.gz, download from GitHub
            if [ "$service_installed" = false ]; then
                echo -e "${yellow}Service files not found in tar.gz, downloading from GitHub...${plain}"
                case "${release}" in
                    ubuntu | debian | armbian)
                        service_unit_url="https://raw.githubusercontent.com/KAWDHITHA-NIRMAL/x-ray/${script_ref}/x-ray.service.debian"
                        ;;
                    arch | manjaro | parch)
                        service_unit_url="https://raw.githubusercontent.com/KAWDHITHA-NIRMAL/x-ray/${script_ref}/x-ray.service.arch"
                        ;;
                    *)
                        service_unit_url="https://raw.githubusercontent.com/KAWDHITHA-NIRMAL/x-ray/${script_ref}/x-ray.service.rhel"
                        ;;
                esac

                if ! _install_xray_service_unit "$service_unit_url" "true"; then
                    echo -e "${red}Failed to install x-ray.service from GitHub (${script_ref}) -- the release tarball did not ship one either${plain}"
                    exit 1
                fi
            fi
        fi
        chown root:root ${xray_service}/x-ray.service > /dev/null 2>&1
        chmod 644 ${xray_service}/x-ray.service > /dev/null 2>&1
        systemctl daemon-reload > /dev/null 2>&1
        systemctl enable x-ray > /dev/null 2>&1
        systemctl start x-ray > /dev/null 2>&1
    fi

    config_after_update

    # IP Limit relies on fail2ban; install + configure it now so the feature
    # works out of the box on update too (no-op when XRAY_ENABLE_FAIL2BAN=false).
    # Never fatal.
    setup_fail2ban

    echo -e "${green}x-ray ${tag_version}${plain} updating finished, it is running now..."
    echo -e ""
    echo -e "┌───────────────────────────────────────────────────────┐
│  ${blue}x-ray control menu usages (subcommands):${plain}              │
│                                                       │
│  ${blue}x-ray${plain}              - Admin Management Script          │
│  ${blue}x-ray start${plain}        - Start                            │
│  ${blue}x-ray stop${plain}         - Stop                             │
│  ${blue}x-ray restart${plain}      - Restart                          │
│  ${blue}x-ray status${plain}       - Current Status                   │
│  ${blue}x-ray settings${plain}     - Current Settings                 │
│  ${blue}x-ray enable${plain}       - Enable Autostart on OS Startup   │
│  ${blue}x-ray disable${plain}      - Disable Autostart on OS Startup  │
│  ${blue}x-ray log${plain}          - Check logs                       │
│  ${blue}x-ray banlog${plain}       - Check Fail2ban ban logs          │
│  ${blue}x-ray update${plain}       - Update                           │
│  ${blue}x-ray legacy${plain}       - Legacy version                   │
│  ${blue}x-ray install${plain}      - Install                          │
│  ${blue}x-ray uninstall${plain}    - Uninstall                        │
└───────────────────────────────────────────────────────┘"
}

echo -e "${green}Running...${plain}"
install_base
update_x-ray $1
