/**
 * PortfoliOS: Calendar Flyout & Clock Tray Components
 * Formats visitor local timezones and renders a clock read-out and calendar month grid.
 */

window.visitorTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

window.getTimeZoneLabel = (now) => {
    const zonePart = new Intl.DateTimeFormat("en-CA", {
        timeZone: window.visitorTimeZone,
        timeZoneName: "short"
    }).formatToParts(now).find((part) => part.type === "timeZoneName");
    return zonePart?.value || window.visitorTimeZone;
};

window.getZonedDateParts = (now) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: window.visitorTimeZone,
        year: "numeric",
        month: "numeric",
        day: "numeric"
    }).formatToParts(now);

    return {
        year: Number(parts.find((part) => part.type === "year")?.value || now.getFullYear()),
        month: Number(parts.find((part) => part.type === "month")?.value || now.getMonth() + 1),
        day: Number(parts.find((part) => part.type === "day")?.value || now.getDate())
    };
};

window.renderCalendar = (now) => {
    const calendarGrid = window.byId ? window.byId("calendar-grid") : document.getElementById("calendar-grid");
    if (!calendarGrid) return;
    
    const zoned = window.getZonedDateParts(now);
    const monthStart = new Date(zoned.year, zoned.month - 1, 1);
    const firstDay = monthStart.getDay();
    const daysInMonth = new Date(zoned.year, zoned.month, 0).getDate();
    const cells = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<span class="calendar-day-name">${day}</span>`);

    for (let index = 0; index < firstDay; index += 1) {
        cells.push("<span></span>");
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        cells.push(`<span class="${day === zoned.day ? "today" : ""}">${day}</span>`);
    }

    calendarGrid.innerHTML = cells.join("");
};

window.updateClock = () => {
    const now = new Date();
    const zoneLabel = window.getTimeZoneLabel(now);
    const compactTime = new Intl.DateTimeFormat("en-CA", {
        timeZone: window.visitorTimeZone,
        hour: "2-digit",
        minute: "2-digit",
        weekday: "short"
    }).format(now);
    const desktopTime = new Intl.DateTimeFormat("en-CA", {
        timeZone: window.visitorTimeZone,
        hour: "2-digit",
        minute: "2-digit"
    }).format(now);

    const systemClock = window.byId ? window.byId("system-clock") : document.getElementById("system-clock");
    const desktopClock = window.byId ? window.byId("desktop-clock") : document.getElementById("desktop-clock");
    const calTime = window.byId ? window.byId("calendar-time") : document.getElementById("calendar-time");
    const calDate = window.byId ? window.byId("calendar-date") : document.getElementById("calendar-date");

    if (systemClock) {
        systemClock.textContent = `${compactTime} ${zoneLabel}`;
        systemClock.title = window.visitorTimeZone;
    }
    if (desktopClock) {
        desktopClock.textContent = `${desktopTime} ${zoneLabel}`;
        desktopClock.title = window.visitorTimeZone;
    }
    if (calTime) {
        calTime.textContent = new Intl.DateTimeFormat("en-CA", {
            timeZone: window.visitorTimeZone,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZoneName: "short"
        }).format(now);
    }
    if (calDate) {
        calDate.textContent = new Intl.DateTimeFormat("en-CA", {
            timeZone: window.visitorTimeZone,
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        }).format(now);
    }
    window.renderCalendar(now);
};

// Start update loop
setInterval(window.updateClock, 30000);
