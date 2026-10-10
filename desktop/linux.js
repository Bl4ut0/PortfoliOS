window.renderLinuxInfo = () => {
    const systems = window.systems || [];
    const linuxNeofetch = window.byId ? window.byId("linux-neofetch") : document.getElementById("linux-neofetch");
    const linuxNodeList = window.byId ? window.byId("linux-node-list") : document.getElementById("linux-node-list");

    if (linuxNeofetch) {
        linuxNeofetch.textContent = [
            "OS: Bl4ut0 Linux Lab",
            "Host: homelab / local-first portfolio",
            "Kernel: curiosity-13y+",
            "Shell: bash, PowerShell, Lua, JavaScript",
            "Services: Proxmox, Docker, Tailscale, Netdata, n8n",
            "Theme: quiet infra, loud ideas"
        ].join("\n");
    }

    if (linuxNodeList) {
        linuxNodeList.textContent = systems
            .map((item) => `${item.id.padEnd(12)} ${item.status.padEnd(8)} ${item.title}`)
            .join("\n");
    }
};
