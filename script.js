// === REFERINȚE ELEMENTE HTML ===
const calendarGrid = document.getElementById("calendarGrid");
const summaryElement = document.getElementById("summary");
const monthTitle = document.getElementById("monthTitle");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importInput = document.getElementById("importInput");
const resetBtn = document.getElementById("resetBtn");
const bulkOfficeBtn = document.getElementById("bulkOfficeBtn");
const bulkHomeBtn = document.getElementById("bulkHomeBtn");
const addHolidayBtn = document.getElementById("addHolidayBtn");
const customHolidayDate = document.getElementById("customHolidayDate");
const customHolidayName = document.getElementById("customHolidayName");
const filterType = document.getElementById("filterType");
const filterDay = document.getElementById("filterDay");
const filterBtn = document.getElementById("filterBtn");
const clearFilterBtn = document.getElementById("clearFilterBtn");
const toggleThemeBtn = document.getElementById("toggleThemeBtn");
const userProfileDiv = document.getElementById("userProfile");
const massEditPopup = document.getElementById("massEditPopup");
const massEditPopupType = document.getElementById("massEditPopupType");
const massEditPopupApply = document.getElementById("massEditPopupApply");
const massEditCancelPopup = document.getElementById("massEditCancelPopup");
const showStatsBtn = document.getElementById("showStatsBtn");
const statsModal = document.getElementById("statsModal");
const statsModalContent = document.getElementById("statsModalContent");
const logoutBtn = document.getElementById("logoutBtn");

// === AUTENTIFICARE SIMPLĂ ===
let user = localStorage.getItem("calendar-current-user");
if (!user) {
  user = prompt("Bun venit! Introdu numele tău pentru a folosi calendarul:").trim().toLowerCase();
  while (!user) {
    user = prompt("Trebuie să introduci un nume pentru a folosi calendarul!").trim().toLowerCase();
  }
  localStorage.setItem("calendar-current-user", user);
}

let currentDate = new Date();
let maxHomeDays = 12;
const months = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];

// === UTILITARE ===
function pad(n) { return n < 10 ? "0" + n : n; }
function dateStr(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }
function isToday(date) {
  const t = new Date();
  return date.getFullYear() === t.getFullYear() && date.getMonth() === t.getMonth() && date.getDate() === t.getDate();
}
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// === SĂRBĂTORI ===
const holidaysRO = {
  "2025-01-01": "Anul Nou",
  "2025-01-02": "Anul Nou (a doua zi)",
  // ...alte sărbători...
};

// === SĂRBĂTORI PERSONALIZATE ===
function getCustomHolidays(user) {
  return JSON.parse(localStorage.getItem(`customHolidays-${user}`) || "{}");
}
function saveCustomHolidays(user, obj) {
  localStorage.setItem(`customHolidays-${user}`, JSON.stringify(obj));
}
function getHoliday(dateString, user) {
  const custom = getCustomHolidays(user);
  return custom[dateString] || holidaysRO[dateString];
}

// === FIREBASE: SALVARE/ÎNCĂRCARE ===
function saveSelectionsToDB(user, year, month, selections) {
  return db.collection("calendars")
    .doc(`${user}_${year}_${month}`)
    .set({ user, year, month, selections });
}

function loadSelectionsFromDB(user, year, month) {
  return db.collection("calendars")
    .doc(`${user}_${year}_${month}`)
    .get()
    .then(doc => doc.exists ? doc.data().selections : []);
}

function loadAllSelectionsFromDB(year, month) {
  return db.collection("calendars")
    .where("year", "==", year)
    .where("month", "==", month)
    .get()
    .then(snapshot => {
      const data = {};
      snapshot.forEach(doc => {
        data[doc.data().user] = doc.data().selections;
      });
      return data;
    });
}

// === ZILE LUCRĂTOARE ===
function numaraZileLucratoare(year, month) {
  const days = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d);
    if (!isWeekend(date) && !getHoliday(dateStr(year, month + 1, d), user)) count++;
  }
  return count;
}

// === REZUMAT ===
function updateSummary(year, month, selections) {
  const counts = { office: 0, home: 0, vacation: 0 };
  selections.forEach(val => { if (counts[val] !== undefined) counts[val]++; });
  const zileLucratoare = numaraZileLucratoare(year, month);
  const mandatoryOfficeDays = Math.max(zileLucratoare - maxHomeDays, 0);
  summaryElement.innerHTML = `
    <strong>Rezumat:</strong><br/>
    - Zile Office: ${counts.office}<br/>
    - Zile Home: ${counts.home} ${counts.home > maxHomeDays ? "⚠ DEPĂȘIT!" : ""}<br/>
    - Zile Vacanță: ${counts.vacation}<br/>
    - Total zile alese: ${counts.office + counts.home + counts.vacation}<br/>
    - <strong>Mandatory days in office:</strong> ${mandatoryOfficeDays} din ${zileLucratoare} zile lucrătoare
  `;
}

// === CALENDAR PRINCIPAL ===
let weekView = false;
const toggleWeekViewBtn = document.getElementById("toggleWeekViewBtn");
toggleWeekViewBtn.addEventListener("click", () => {
  weekView = !weekView;
  toggleWeekViewBtn.textContent = weekView ? "Vizualizare lunară" : "Vizualizare săptămânală";
  generateCalendar(currentDate);
});

// === MASS EDIT VIZUAL ===
let isMassSelecting = false;
let massSelectedDays = [];
let popupX = 0, popupY = 0;

function generateCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  // Încarcă toate selecțiile pentru luna curentă
  loadAllSelectionsFromDB(year, month).then(allSelections => {
    loadSelectionsFromDB(user, year, month).then(savedSelections => {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1);
      const startDay = (firstDay.getDay() + 6) % 7; // luni = 0

      monthTitle.textContent = `${months[month]} ${year}`;
      calendarGrid.innerHTML = "";

      // Header zile săptămână
      ["Lun", "Mar", "Mie", "Joi", "Vin", "Sam", "Dum"].forEach(day => {
        const div = document.createElement("div");
        div.textContent = day;
        div.style.fontWeight = "bold";
        calendarGrid.appendChild(div);
      });

      // Spații goale pentru începutul lunii (doar în modul lunar)
      if (!weekView) {
        for (let i = 0; i < startDay; i++) {
          const empty = document.createElement("div");
          empty.className = "day disabled";
          calendarGrid.appendChild(empty);
        }
      }

      let startDayIdx = 1;
      let endDayIdx = daysInMonth;
      if (weekView) {
        const today = new Date();
        if (today.getMonth() === month && today.getFullYear() === year) {
          const dayOfMonth = today.getDate();
          const dayOfWeek = (new Date(year, month, dayOfMonth).getDay() + 6) % 7; // luni=0
          startDayIdx = Math.max(1, dayOfMonth - dayOfWeek);
          endDayIdx = Math.min(daysInMonth, startDayIdx + 6);
        } else {
          startDayIdx = 1;
          endDayIdx = 7;
        }
      }

      // Zilele lunii
      for (let d = startDayIdx; d <= endDayIdx; d++) {
        const cell = document.createElement("div");
        cell.className = "day";
        const dateObj = new Date(year, month, d);
        const dateString = dateStr(year, month + 1, d);

        if (isToday(dateObj)) cell.classList.add("today");

        // Label zi
        const label = document.createElement("div");
        label.textContent = d;
        cell.appendChild(label);

        // Select tip zi
        const select = document.createElement("select");
        ["", "office", "home", "vacation"].forEach(opt => {
          const option = document.createElement("option");
          option.value = opt;
          option.textContent = opt ? opt.charAt(0).toUpperCase() + opt.slice(1) : "";
          select.appendChild(option);
        });

        // Weekend/sărbătoare
        const weekend = isWeekend(dateObj);
        const holiday = getHoliday(dateString, user);

        if (weekend) {
          select.disabled = true;
          cell.classList.add("weekend");
          cell.title = "Weekend";
        }
        if (holiday) {
          cell.title = holiday;
          select.disabled = true;
          if (!weekend) {
            select.value = "office";
            cell.classList.add("worked-office");
          } else {
            select.value = "";
            cell.classList.add("holiday-weekend");
          }
          cell.setAttribute("data-tooltip", holiday);
        }

        // Reîncarcă selecția salvată
        if (savedSelections[d - 1]) {
          select.value = savedSelections[d - 1];
          if (select.value === "office") cell.classList.add("worked-office");
          if (select.value === "home") cell.classList.add("free");
          if (select.value === "vacation") cell.classList.add("remote-work");
        }

        select.addEventListener("change", () => {
          cell.classList.remove("worked-office", "free", "remote-work");
          if (select.value === "office") cell.classList.add("worked-office");
          if (select.value === "home") cell.classList.add("free");
          if (select.value === "vacation") cell.classList.add("remote-work");
          // Salvează pentru userul curent în Firestore
          const selections = Array.from(document.querySelectorAll("#calendarGrid .day select")).map(s => s.value);
          saveSelectionsToDB(user, year, month, selections);
          updateSummary(year, month, selections);
          afterAnySelectionChange();
        });

        // Drag & drop rapid
        let dragType = null;
        select.addEventListener("mousedown", (e) => {
          if (select.disabled) return;
          dragType = select.value;
          select.setAttribute("data-dragging", "true");
        });
        select.addEventListener("mouseup", (e) => {
          dragType = null;
          select.removeAttribute("data-dragging");
        });
        select.addEventListener("mouseenter", (e) => {
          if (dragType && !select.disabled) {
            select.value = dragType;
            select.dispatchEvent(new Event("change"));
          }
        });
        document.addEventListener("mouseup", () => {
          dragType = null;
          document.querySelectorAll('select[data-dragging="true"]').forEach(s => s.removeAttribute("data-dragging"));
        });

        cell.appendChild(select);

        // Mass edit vizual (selectare cu mouse-ul)
        cell.addEventListener("mousedown", (e) => {
          if (cell.querySelector("select")?.disabled) return;
          isMassSelecting = true;
          massSelectedDays = [];
          document.querySelectorAll(".day").forEach(c => c.classList.remove("selected-mass"));
          cell.classList.add("selected-mass");
          massSelectedDays.push(cell);
          popupX = e.clientX;
          popupY = e.clientY;
        });
        cell.addEventListener("mouseenter", (e) => {
          if (isMassSelecting && !cell.querySelector("select")?.disabled) {
            cell.classList.add("selected-mass");
            if (!massSelectedDays.includes(cell)) massSelectedDays.push(cell);
          }
        });
        document.addEventListener("mouseup", (e) => {
          if (isMassSelecting && massSelectedDays.length > 0) {
            isMassSelecting = false;
            // Centrează popup-ul pe ecran
            massEditPopup.style.display = "block";
            massEditPopup.style.left = `calc(50vw - ${massEditPopup.offsetWidth/2}px)`;
            massEditPopup.style.top = `calc(50vh - ${massEditPopup.offsetHeight/2}px)`;
          }
        });

        calendarGrid.appendChild(cell);
      }

      // --- Afișează buline cu numele utilizatorilor prezenți la birou ---
      for (let d = startDayIdx; d <= endDayIdx; d++) {
        const cell = calendarGrid.children[d + startDay - 1];

        const usersAtOffice = [];
        for (const [u, sel] of Object.entries(allSelections)) {
          if (sel[d - 1] === "office") usersAtOffice.push(u);
        }
        if (usersAtOffice.length > 0) {
          const teamDiv = document.createElement("div");
          teamDiv.style.display = "flex";
          teamDiv.style.flexWrap = "wrap";
          teamDiv.style.gap = "2px";
          usersAtOffice.forEach(u => {
            const span = document.createElement("span");
            span.title = u;
            span.style.display = "inline-block";
            span.style.width = "18px";
            span.style.height = "18px";
            span.style.borderRadius = "50%";
            span.style.background = "#2196f3";
            span.style.color = "#fff";
            span.style.fontSize = "12px";
            span.style.textAlign = "center";
            span.style.lineHeight = "18px";
            span.style.marginRight = "2px";
            span.textContent = u.charAt(0).toUpperCase();
            teamDiv.appendChild(span);
          });
          cell.appendChild(teamDiv);
        }
      }

      updateSummary(year, month, savedSelections);
      renderUserProfile(savedSelections);
    });
  });
}

// === EXPORT CSV ===
function exportCSV(year, month) {
  loadSelectionsFromDB(user, year, month).then(selections => {
    const csv = selections.map((val, idx) => `${idx + 1},${val || ""}`).join("\n");
    const header = `Ziua,Tip\n`;
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calendar-${user}-${year}-${pad(month + 1)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// === IMPORT CSV ===
function importCSV(year, month, file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const lines = e.target.result.split("\n").slice(1); // fără header
    const values = [];
    for (let line of lines) {
      if (!line.trim()) continue;
      const [zi, tip] = line.split(",");
      if (!["", "office", "home", "vacation"].includes(tip)) {
        alert(`Tip invalid la ziua ${zi}: ${tip}`);
        return;
      }
      values[parseInt(zi, 10) - 1] = tip;
    }
    saveSelectionsToDB(user, year, month, values).then(() => generateCalendar(currentDate));
  };
  reader.readAsText(file);
}

// === RESETARE SELECȚII ===
function resetMonth(year, month) {
  if (confirm("Sigur vrei să resetezi selecțiile pentru această lună?")) {
    saveSelectionsToDB(user, year, month, []).then(() => generateCalendar(currentDate));
  }
}

// === BULK SELECT ===
function bulkSelect(type) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const selections = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (!isWeekend(date) && !getHoliday(dateStr(year, month + 1, d), user)) {
      selections[d - 1] = type;
    } else {
      selections[d - 1] = "";
    }
  }
  saveSelectionsToDB(user, year, month, selections).then(() => generateCalendar(currentDate));
}

// === SĂRBĂTORI PERSONALIZATE ===
addHolidayBtn.addEventListener("click", () => {
  const date = customHolidayDate.value;
  const name = customHolidayName.value.trim();
  if (!date || !name) {
    alert("Completează data și numele sărbătorii!");
    return;
  }
  const custom = getCustomHolidays(user);
  custom[date] = name;
  saveCustomHolidays(user, custom);
  customHolidayDate.value = "";
  customHolidayName.value = "";
  renderCustomHolidaysList();
  generateCalendar(currentDate);
});

// === FILTRU ===
filterBtn.addEventListener("click", () => {
  const type = filterType.value;
  const day = parseInt(filterDay.value, 10);
  document.querySelectorAll("#calendarGrid .day").forEach((cell, idx) => {
    if (idx < 7) return; // skip header
    let show = true;
    if (type) {
      if (!cell.querySelector("select") || cell.querySelector("select").value !== type) show = false;
    }
    if (day && cell.querySelector("div") && cell.querySelector("div").textContent != day) show = false;
    cell.style.opacity = show ? "1" : "0.2";
  });
});
clearFilterBtn.addEventListener("click", () => {
  filterType.value = "";
  filterDay.value = "";
  document.querySelectorAll("#calendarGrid .day").forEach(cell => cell.style.opacity = "1");
});

// === NAVIGARE LUNĂ ===
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
prevBtn.addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  generateCalendar(currentDate);
});
nextBtn.addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  generateCalendar(currentDate);
});

// === EXPORT/IMPORT/RESET EVENTS ===
exportBtn.addEventListener("click", () => {
  exportCSV(currentDate.getFullYear(), currentDate.getMonth());
});
importBtn.addEventListener("click", () => {
  importInput.click();
});
importInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) importCSV(currentDate.getFullYear(), currentDate.getMonth(), file);
  importInput.value = "";
});
resetBtn.addEventListener("click", () => {
  resetMonth(currentDate.getFullYear(), currentDate.getMonth());
});

// === BULK SELECT EVENTS ===
bulkOfficeBtn.addEventListener("click", () => bulkSelect("office"));
bulkHomeBtn.addEventListener("click", () => bulkSelect("home"));

// === INIȚIALIZARE ===
generateCalendar(currentDate);

// === SĂRBĂTORI PERSONALIZATE - LISTARE ȘI ȘTERGERE ===
function renderCustomHolidaysList() {
  const listDiv = document.getElementById("customHolidaysList");
  const custom = getCustomHolidays(user);
  listDiv.innerHTML = "<strong>Sărbători personalizate:</strong><br/>";
  const keys = Object.keys(custom);
  if (keys.length === 0) {
    listDiv.innerHTML += "<em>Nicio sărbătoare adăugată.</em>";
    return;
  }
  keys.forEach(date => {
    const row = document.createElement("div");
    row.style.marginBottom = "4px";
    row.textContent = `${date} - ${custom[date]} `;
    const delBtn = document.createElement("button");
    delBtn.textContent = "Șterge";
    delBtn.style.marginLeft = "10px";
    delBtn.style.fontSize = "12px";
    delBtn.addEventListener("click", () => {
      if (confirm(`Ștergi sărbătoarea "${custom[date]}" (${date})?`)) {
        delete custom[date];
        saveCustomHolidays(user, custom);
        renderCustomHolidaysList();
        generateCalendar(currentDate);
      }
    });
    row.appendChild(delBtn);
    listDiv.appendChild(row);
  });
}
renderCustomHolidaysList();

// === DARK MODE ===
toggleThemeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem("calendar-dark-mode", document.body.classList.contains("dark-mode"));
});
if (localStorage.getItem("calendar-dark-mode") === "true") {
  document.body.classList.add("dark-mode");
}

// === DELOGARE ===
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("calendar-current-user");
    location.reload();
  });
}

// === PROFIL UTILIZATOR ===
function renderUserProfile(selections) {
  const profileDiv = document.getElementById("userProfile");
  const stats = { office: 0, home: 0, vacation: 0 };
  selections.forEach(val => { if (stats[val] !== undefined) stats[val]++; });
  const total = stats.office + stats.home + stats.vacation;
  profileDiv.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;">
      <div style="width:48px;height:48px;border-radius:50%;background:#2196f3;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;">
        ${user.charAt(0).toUpperCase()}
      </div>
      <div>
        <div style="font-size:18px;font-weight:bold;">${user.charAt(0).toUpperCase() + user.slice(1)}</div>
        <div style="font-size:13px;color:#888;">Zile Office: <b>${stats.office}</b> | Home: <b>${stats.home}</b> | Vacanță: <b>${stats.vacation}</b></div>
        <div style="font-size:13px;color:#888;">Total selectate: <b>${total}</b></div>
      </div>
    </div>
  `;
}
function afterAnySelectionChange() {
  loadSelectionsFromDB(user, currentDate.getFullYear(), currentDate.getMonth()).then(renderUserProfile);
}

// === MASS EDIT POPUP LOGIC ===
massEditPopupApply.addEventListener("click", () => {
  const type = massEditPopupType.value;
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  loadSelectionsFromDB(user, year, month).then(selections => {
    massSelectedDays.forEach(cell => {
      const select = cell.querySelector("select");
      if (select && !select.disabled) {
        select.value = type;
        const idx = Array.from(calendarGrid.querySelectorAll(".day select")).indexOf(select);
        selections[idx] = type;
      }
      cell.classList.remove("selected-mass");
    });
    saveSelectionsToDB(user, year, month, selections).then(() => {
      generateCalendar(currentDate);
      massEditPopup.style.display = "none";
      massSelectedDays = [];
    });
  });
});
massEditCancelPopup.addEventListener("click", () => {
  massSelectedDays.forEach(cell => cell.classList.remove("selected-mass"));
  massEditPopup.style.display = "none";
  massSelectedDays = [];
});

// === STATISTICI DETALIATE ===
showStatsBtn.addEventListener("click", () => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  loadSelectionsFromDB(user, year, month).then(selections => {
    const stats = { office: 0, home: 0, vacation: 0 };
    selections.forEach(val => { if (stats[val] !== undefined) stats[val]++; });
    statsModalContent.innerHTML = `
      <h3>Statistici pentru ${months[month]} ${year}</h3>
      <ul>
        <li><b>Zile Office:</b> ${stats.office}</li>
        <li><b>Zile Home:</b> ${stats.home}</li>
        <li><b>Zile Vacanță:</b> ${stats.vacation}</li>
      </ul>
      <canvas id="statsModalChart" width="300" height="150"></canvas>
    `;
    statsModal.style.display = "block";
    setTimeout(() => {
      const ctx = document.getElementById('statsModalChart').getContext('2d');
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Office', 'Home', 'Vacanță'],
          datasets: [{
            data: [stats.office, stats.home, stats.vacation],
            backgroundColor: ['#2196f3', '#43a047', '#ff9800']
          }]
        },
        options: { plugins: { legend: { position: 'bottom' } } }
      });
    }, 100);
  });
});

// Exemplu: număr persoane la birou pentru fiecare zi
function getOfficeStatsPerDay(allSelections, daysInMonth) {
  const stats = [];
  for (let d = 0; d < daysInMonth; d++) {
    let count = 0;
    for (const sel of Object.values(allSelections)) {
      if (sel[d] === "office") count++;
    }
    stats.push(count);
  }
  return stats;
}
