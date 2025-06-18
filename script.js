// === REFERINȚE ELEMENTE HTML ===
const calendarGrid = document.getElementById("calendarGrid");
const summaryElement = document.getElementById("summary");
const monthTitle = document.getElementById("monthTitle");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const toggleThemeBtn = document.getElementById("toggleThemeBtn");
const toggleWeekViewBtn = document.getElementById("toggleWeekViewBtn");
const userProfileDiv = document.getElementById("userProfile");
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
    if (!isWeekend(date) && !holidaysRO[dateStr(year, month + 1, d)]) count++;
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
toggleWeekViewBtn.addEventListener("click", () => {
  weekView = !weekView;
  toggleWeekViewBtn.textContent = weekView ? "Vizualizare lunară" : "Vizualizare săptămânală";
  generateCalendar(currentDate);
});

function generateCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth();

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
        const holiday = holidaysRO[dateString];

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
        });

        cell.appendChild(select);

        // --- Buline cu utilizatorii prezenți la birou ---
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
            span.className = "bulina";
            span.textContent = u.charAt(0).toUpperCase();
            teamDiv.appendChild(span);
          });
          cell.appendChild(teamDiv);
        }

        calendarGrid.appendChild(cell);
      }

      updateSummary(year, month, savedSelections);
      renderUserProfile(savedSelections);
    });
  });
}

// === PROFIL UTILIZATOR ===
function renderUserProfile(selections) {
  const stats = { office: 0, home: 0, vacation: 0 };
  selections.forEach(val => { if (stats[val] !== undefined) stats[val]++; });
  const total = stats.office + stats.home + stats.vacation;
  userProfileDiv.innerHTML = `
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

// === NAVIGARE LUNĂ ===
prevBtn.addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  generateCalendar(currentDate);
});
nextBtn.addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  generateCalendar(currentDate);
});

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

// === INIȚIALIZARE ===
generateCalendar(currentDate);
