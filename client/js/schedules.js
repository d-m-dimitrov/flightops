checkAuth();

const user =
getCurrentUser();

if(
    user.role !== "ADMIN"
    &&
    user.position !== "OPERATIONS_DM"
){
    window.location =
    "flights.html";
}


let scheduleModal;


let allSchedules = [];
const escapeSchedule = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function renderScheduleTable() {
    const query = document.getElementById('scheduleSearch').value.trim().toLowerCase();
    const airline = document.getElementById('scheduleAirlineFilter').value;
    const type = document.getElementById('scheduleTypeFilter').value;
    const status = document.getElementById('scheduleStatusFilter').value;
    const date = document.getElementById('scheduleDateFilter').value;
    const rows = allSchedules.filter(s => {
        if (airline && s.airline !== airline) return false;
        if (type && ![s.arrivalFlightType || 'PASSENGER', s.departureFlightType || 'PASSENGER'].includes(type)) return false;
        if (status && (s.active !== false ? 'active' : 'inactive') !== status) return false;
        if (date && ((s.validFrom && date < s.validFrom) || (s.validTo && date > s.validTo))) return false;
        if (date) {
            const weekday = new Date(date + 'T12:00:00Z').getUTCDay() || 7;
            if (!s.daysOfWeek?.includes(weekday)) return false;
        }
        return !query || [s.airline,s.arrivalFlight,s.departureFlight,s.origin,s.destination,s.aircraftType]
            .some(v => String(v || '').toLowerCase().includes(query));
    });
    document.getElementById('scheduleCount').textContent = `Showing ${rows.length} of ${allSchedules.length} schedules`;
    const panel = document.getElementById('scheduleList');
    if (!rows.length) {
        panel.innerHTML = '<div class="alert alert-light border">No schedules match the selected filters.</div>';
        return;
    }
    panel.innerHTML = `<div class="table-responsive"><table class="table table-striped table-hover align-middle">
    <thead><tr><th>Airline</th><th>Flights</th><th>Route</th><th>STA / STD</th><th>Aircraft</th><th>Flight Type</th><th>Service</th><th>Days</th><th>Validity</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows.map(s => `<tr>
      <td class="fw-semibold">${escapeSchedule(s.airline)}</td>
      <td>${escapeSchedule(s.arrivalFlight)} / ${escapeSchedule(s.departureFlight)}</td>
      <td>${escapeSchedule(s.origin)} → ${escapeSchedule(s.destination)}</td>
      <td class="text-nowrap">${escapeSchedule(s.sta)} / ${escapeSchedule(s.std)}${(s.departureDayOffset ?? Number(s.std < s.sta)) ? ' (+' + escapeSchedule(s.departureDayOffset ?? 1) + 'd)' : ''}</td>
      <td>${escapeSchedule(s.aircraftType)}</td>
      <td class="text-nowrap">${escapeSchedule(s.arrivalFlightType || 'PASSENGER')} → ${escapeSchedule(s.departureFlightType || 'PASSENGER')}</td>
      <td>${escapeSchedule(s.serviceType || 'SCHEDULED')}</td>
      <td class="text-nowrap">${(s.daysOfWeek || []).map(d => escapeSchedule(dayNames[d-1] || d)).join(' ')}</td>
      <td class="text-nowrap">${escapeSchedule(s.validFrom || 'Open')} — ${escapeSchedule(s.validTo || 'Open')}</td>
      <td><span class="badge ${s.active === false ? 'text-bg-secondary' : 'text-bg-success'}">${s.active === false ? 'Inactive' : 'Active'}</span></td>
      <td><button class="btn btn-sm btn-outline-primary schedule-edit" data-id="${escapeSchedule(s._id)}">Edit</button></td>
    </tr>`).join('')}</tbody></table></div>`;
    panel.querySelectorAll('.schedule-edit').forEach(btn => btn.addEventListener('click', () => editSchedule(btn.dataset.id)));
}
async function loadSchedules() {
    const response = await fetch('/api/schedules');
    if (!response.ok) { document.getElementById('scheduleList').textContent = 'Unable to load schedules'; return; }
    allSchedules = await response.json();
    const airlineSelect = document.getElementById('scheduleAirlineFilter');
    const selected = airlineSelect.value;
    const airlines = [...new Set(allSchedules.map(s => s.airline).filter(Boolean))].sort();
    airlineSelect.innerHTML = '<option value="">All airlines</option>';
    for (const airline of airlines) {
        const option = document.createElement('option');
        option.value = airline;
        option.textContent = airline;
        airlineSelect.append(option);
    }
    airlineSelect.value = airlines.includes(selected) ? selected : '';
    renderScheduleTable();
}

function newSchedule(){
    document.getElementById("arrivalFlightType").value="PASSENGER";
    document.getElementById("departureFlightType").value="SAME";
    document.getElementById("serviceType").value="SCHEDULED";
    document.getElementById("validFrom").value="";
    document.getElementById("validTo").value="";
    document.getElementById("departureDayOffset").value = "0";
    document.getElementById("scheduleOccurrence").value = "reject";

    document.getElementById(
        "scheduleId"
    ).value = "";

    document.getElementById(
        "airline"
    ).value = "";

    document.getElementById(
        "arrivalFlight"
    ).value = "";

    document.getElementById(
        "departureFlight"
    ).value = "";

    document.getElementById(
        "origin"
    ).value = "";

    document.getElementById(
        "destination"
    ).value = "";

    document.getElementById(
        "sta"
    ).value = "";

    document.getElementById(
        "std"
    ).value = "";

    document.getElementById(
        "aircraftType"
    ).value = "";

    renderDays([]);

    scheduleModal.show();

}

async function saveSchedule(){

    const scheduleId =
    document.getElementById(
        "scheduleId"
    ).value;

    const days = [];

    document
    .querySelectorAll(
        ".day-checkbox:checked"
    )
    .forEach(cb=>{

        days.push(
            Number(cb.value)
        );

    });

    const arrivalFlightType=document.getElementById("arrivalFlightType").value;
    const selectedDepartureType=document.getElementById("departureFlightType").value;
    const validFrom=document.getElementById("validFrom").value;
    const validTo=document.getElementById("validTo").value;
    if(validFrom && validTo && validFrom>validTo){alert("Valid To must not precede Valid From");return;}
    const payload = {
        arrivalFlightType,
        departureFlightType:selectedDepartureType==="SAME"?arrivalFlightType:selectedDepartureType,
        serviceType:document.getElementById("serviceType").value,
        validFrom:validFrom || null,
        validTo:validTo || null,
        departureDayOffset:Number(document.getElementById("departureDayOffset").value),
        timeDisambiguation:document.getElementById("scheduleOccurrence").value,

        airline:
        document.getElementById(
            "airline"
        ).value,

        arrivalFlight:
        document.getElementById(
            "arrivalFlight"
        ).value,

        departureFlight:
        document.getElementById(
            "departureFlight"
        ).value,

        origin:
        document.getElementById(
            "origin"
        ).value,

        destination:
        document.getElementById(
            "destination"
        ).value,

        sta:
        document.getElementById(
            "sta"
        ).value,

        std:
        document.getElementById(
            "std"
        ).value,

        aircraftType:
        document.getElementById(
            "aircraftType"
        ).value,

        daysOfWeek:
        days,

        active:true

    };

    const response = await fetch(scheduleId ? `/api/schedules/${scheduleId}` : "/api/schedules", {
        method:scheduleId ? "PUT" : "POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify(payload)
    });
    if (!response.ok) { alert((await response.json()).error || "Save failed"); return; }

    scheduleModal.hide();

    await loadSchedules();

}


async function editSchedule(id){

    const response =
    await fetch(
        `/api/schedules/${id}`
    );

    const schedule =
    await response.json();
    document.getElementById("arrivalFlightType").value=schedule.arrivalFlightType || "PASSENGER";
    document.getElementById("departureFlightType").value=(schedule.departureFlightType || "PASSENGER")===(schedule.arrivalFlightType || "PASSENGER")?"SAME":schedule.departureFlightType;
    document.getElementById("serviceType").value=schedule.serviceType || "SCHEDULED";
    document.getElementById("validFrom").value=schedule.validFrom || "";
    document.getElementById("validTo").value=schedule.validTo || "";

    document.getElementById("departureDayOffset").value = schedule.departureDayOffset ?? Number(schedule.std < schedule.sta);
    document.getElementById("scheduleOccurrence").value = schedule.timeDisambiguation || "reject";

    document.getElementById(
        "scheduleId"
    ).value =
    schedule._id;

    document.getElementById(
        "airline"
    ).value =
    schedule.airline || "";

    document.getElementById(
        "arrivalFlight"
    ).value =
    schedule.arrivalFlight || "";

    document.getElementById(
        "departureFlight"
    ).value =
    schedule.departureFlight || "";

    document.getElementById(
        "origin"
    ).value =
    schedule.origin || "";

    document.getElementById(
        "destination"
    ).value =
    schedule.destination || "";

    document.getElementById(
        "sta"
    ).value =
    schedule.sta || "";

    document.getElementById(
        "std"
    ).value =
    schedule.std || "";

    document.getElementById(
        "aircraftType"
    ).value =
    schedule.aircraftType || "";

    renderDays(
        schedule.daysOfWeek || []
    );

    scheduleModal.show();

}

document.addEventListener(
    "DOMContentLoaded",
    async ()=>{

        scheduleModal =
        new bootstrap.Modal(

            document.getElementById(
                "scheduleModal"
            )

        );

        for (const id of ["scheduleSearch","scheduleAirlineFilter","scheduleTypeFilter","scheduleStatusFilter","scheduleDateFilter"]) {
            document.getElementById(id).addEventListener(id === "scheduleSearch" || id === "scheduleDateFilter" ? "input" : "change", renderScheduleTable);
        }
        document.getElementById("scheduleResetFilters").addEventListener("click", () => {
            for (const id of ["scheduleSearch","scheduleAirlineFilter","scheduleTypeFilter","scheduleStatusFilter","scheduleDateFilter"]) document.getElementById(id).value = "";
            renderScheduleTable();
        });
        await loadSchedules();

    }
);

function renderDays(
    selected = []
){

    const days = [

        {id:1,name:"Mon"},
        {id:2,name:"Tue"},
        {id:3,name:"Wed"},
        {id:4,name:"Thu"},
        {id:5,name:"Fri"},
        {id:6,name:"Sat"},
        {id:7,name:"Sun"}

    ];

    const panel =
    document.getElementById(
        "daysPanel"
    );

    panel.innerHTML = "";

    days.forEach(day=>{

        panel.innerHTML += `

        <div class="form-check">

            <input
                class="form-check-input day-checkbox"

                type="checkbox"

                value="${day.id}"

                ${
                    selected.includes(
                        day.id
                    )
                    ?
                    "checked"
                    :
                    ""
                }>

            <label
                class="form-check-label">

                ${day.name}

            </label>

        </div>

        `;

    });

}

