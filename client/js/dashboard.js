checkAuth(); 
const socket = io();


let users = [];
let roles = [];
let passengerModal;
let specialHandlingModal;
let flightDetailsModal;
let assignmentModal;
let specialHandlingDetailsModal;
const chatSessionToken = localStorage.getItem('token');
let displayedChatMessageIds = [];
let chatLoadVersion = 0;
async function markDisplayedChatRead(ids = displayedChatMessageIds.slice()) {
    try {
        if (!chatSessionToken || chatSessionToken !== localStorage.getItem('token')) return;
        for (let i = 0; i < ids.length; i += 500) {
            const response = await fetch(`/api/flights/${flightId}/mark-read`, {
                method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${chatSessionToken}`},
                body:JSON.stringify({messageIds:ids.slice(i, i + 500)})
            });
            if (!response.ok) throw new Error('Could not mark chat as read');
        }
        localStorage.setItem('flightChatReadChanged', JSON.stringify({flightId, at:Date.now()}));
    } catch (error) {
        console.error(error);
        showChatToast('System', 'Could not clear notifications. Click the chat to retry.', 'SYSTEM');
    }
}

let countdownInterval;
let currentFlight;
let currentEvents = [];
let refreshVersion = 0;
let dashboardActive = true;

let specialHandlingDetails = {

    depa:[],
    vipBaggage:[],

    wclb:[],

    wcbd:[],

    avih:[],

    petc:[],

    cbbg:[],

    weap:[]

};

function addWclb(){

    specialHandlingDetails.wclb.push({

        passengerName:"",
        seat:"",
        wh:0,
        batteryWeight:0

    });

    renderWclbList();

}

const CURRENT_USER =
JSON.parse(
    localStorage.getItem("user")
);

const CURRENT_USER_ID =
CURRENT_USER?._id;


const params =
new URLSearchParams(
    window.location.search
);


const flightId =
params.get("id");
let eventModal;
let completedEvents = [];


socket.emit(
    "joinFlight",
    flightId
);


socket.on(

    "newChatMessage",

    data=>{

        showChatToast(

            data.author,

            data.message,

            data.type

        );

    }

);

function showChatToast(
    author,
    message,
    type
){

    let headerClass =
"bg-primary text-white";



let title =
"💬 New Message";

if(
    type === "SYSTEM"
){

    headerClass =
    "bg-info text-dark";

    title =
    "⚙ System Update";

}

if(
    type === "EVENT"
){

    headerClass =
    "bg-success text-white";

    title =
    "✅ Event Completed";

}

    const toast =
    document.createElement(
        "div"
    );

    toast.className =

    "toast show position-fixed top-0 end-0 m-3";

    toast.style.zIndex =
    "9999";

    toast.style.minWidth =
    "320px";

    toast.innerHTML = `

    <div
        class="toast-header
               ${headerClass}">

<strong>

    ${title}

</strong>

    </div>

    <div class="toast-body">

        <strong>

            ${author}

        </strong>

        <br>

        ${message}

    </div>

    `;

    document.body.appendChild(
        toast
    );

    setTimeout(

        ()=>toast.remove(),

        5000

    );

}

async function loadCompletedEvents(){

    const response =
    await fetch(
        `/api/events/${flightId}/existing`
    );

    completedEvents =
    await response.json();

}



async function loadFlight() {
    const version = ++refreshVersion;
    let snapshot;
    try {
        const response = await fetch(`/api/flights/${flightId}/operational`);
        if (!response.ok) throw new Error("Operational data unavailable");
        snapshot = await response.json();
        if (!snapshot.flight || !Array.isArray(snapshot.events)) throw new Error("Invalid operational data");
    } catch (error) {
        if (version === refreshVersion && dashboardActive) {
            stopCountdown();
            currentFlight = null;
            currentEvents = [];
            const timer = document.getElementById("countdownValue");
            if (timer) timer.textContent = "Data unavailable — refresh required";
            const panel = document.getElementById("predictionPanel");
            if (panel) panel.textContent = "";
        }
        return;
    }
    if (version !== refreshVersion || !dashboardActive) return;
    const flight = snapshot.flight;
    currentFlight = flight;
    currentEvents = snapshot.events;

let readinessClass =
"bg-danger";

if(
    flight.readiness >= 80
){

    readinessClass =
    "bg-success";

}
else if(
    flight.readiness >= 50
){

    readinessClass =
    "bg-warning";

}
    document.getElementById(
    "flightInfo"
).innerHTML = `

<div class="card shadow-sm mb-3 sticky-flight-header">

    <div class="card-body py-2">

        <div
            class="d-flex
                   justify-content-between
                   align-items-start">

            <div>

                <div
                    class="d-flex
                           align-items-center">

                    <img

                        src="logos/${flight.airline.toLowerCase()}.png"

                        style="
                            height:28px;
                            width:auto;
                            margin-right:10px;
                        "

                        onerror="
                            this.style.display='none'
                        ">

                    <h5 class="mb-0">

                        ${flight.arrivalFlight}/${flight.departureFlight}

                    </h5>

                    <span
                        class="badge ms-3 ${getStatusBadgeClass(
                            flight.status
                        )}">

                        ${flight.status}

                    </span>

                </div>

                <div
                    class="small text-muted mt-2">
                    Aircraft    
                    <strong>
                    ${flight.aircraft?.aircraftType || "-"}
                    </strong>

                    |

                    Reg
                    <strong>
                    ${flight.aircraft?.registration || "-"}
                    </strong>

                    |

                    Stand
                    <strong>
                    ${flight.aircraft?.stand || "-"}
                    </strong>

                </div>

                <div
                    class="small mt-1">

                    STA
                    <strong>
                    ${formatDateTime(
                        flight.arrival?.sta
                    )}
                    </strong>

                    |

                    ETA
                    <strong>
                    ${formatDateTime(
                        flight.arrival?.eta
                    )}
                    </strong>

                    |

                    STD (London)
                    <strong>
                    ${formatDateTime(
                        flight.departure?.std
                    )} ${flight.departureDayOffset ? `(+${flight.departureDayOffset}d)` : ""}
                    </strong>

                    |

                    ETD
                    <strong>
                    ${formatDateTime(
                        flight.departure?.etd
                    )}
                    </strong>

                </div>

            </div>

            <div
    class="d-flex
           gap-2
           align-items-center">

                ${
                canEdit(
                    "FLIGHT_DETAILS"
                )
                ?
                `
                <button
                    class="btn btn-sm btn-outline-primary"
                    onclick="editFlightDetails()">

                    Edit

                </button>
                `
                :
                ""
                }

                ${
                flight.manual
                ?
                `
                <button

                    class="btn btn-sm btn-outline-danger"

                    onclick="deleteFlight()">

                    Delete

                </button>
                `
                :
                ""
                }

            </div>

        </div>
<div class="mt-3 text-center">

    <div
        id="countdownTitle"
        class="text-muted">

        Operational Timer

    </div>

    <div

        id="countdownValue"

        class="fw-bold text-success"

        style="
            font-size:36px;
            font-family:monospace;
        ">

        --:--:--

    </div>
    <div

    id="countdownInfo"

    class="small text-muted mt-2">

</div>
<div
    id="predictionPanel"
    class="mt-2 small">

</div>

</div>
        <div class="mt-2">

            <div
                class="d-flex
                       justify-content-between
                       small">

                <span>

                    Readiness

                </span>

                <strong>

                    ${flight.readiness || 0}%

                </strong>

            </div>

            <div
                class="progress"
                style="height:8px;">

                <div

                    class="progress-bar
                    ${readinessClass}"

                    style="
                        width:
                        ${flight.readiness || 0}%;
                    ">

                </div>

            </div>

        </div>

    </div>

</div>

`;

renderTimeline(currentEvents);
startCountdown();

    loadPassengerInfo(
    flight
);

loadSpecialHandling(
    flight
);


//await fetch(

//    `/api/flights/${flightId}/mark-read`,

//    {

//        method:"POST"

//    }

//);

}




function requiresNotoc(
    details
){

    return (

        details.wclb?.length > 0 ||

        details.wcbd?.length > 0 ||

        details.avih?.length > 0 ||

        details.weap?.length > 0

    );

}

async function saveEvent(
    eventType
){

    await fetch(
        "/api/events",
        {
            method:"POST",

            headers:{
                "Content-Type":
                "application/json"
            },

            body:JSON.stringify({

    turnaroundId:
    flightId,

    eventType:
    eventType,

    createdBy:
    CURRENT_USER_ID

})

        }
    );

await fetch(
    `/api/flights/${flightId}/update-status`,
    {
        method:"POST"
    }
);


    await loadFlight();
    await loadEventButtons();

}




function renderTimeline(events) {
    const timeline = document.getElementById("timeline");
    if (!timeline) return;
    const safe = value => String(value ?? "").replace(/[&<>"']/g, char =>
        ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char]);
    const ordered = [...(Array.isArray(events) ? events : [])]
        .filter(event => event && event.eventTime && !Number.isNaN(new Date(event.eventTime).getTime()))
        .sort((a,b) => new Date(a.eventTime) - new Date(b.eventTime));
    timeline.innerHTML = ordered.length ? ordered.map(event => {
        const date = new Date(event.eventTime);
        const time = date.toLocaleTimeString("en-GB", { timeZone:"Europe/London", hour:"2-digit", minute:"2-digit" });
        const day = date.toLocaleDateString("en-GB", { timeZone:"Europe/London", day:"2-digit", month:"short" });
        return `<div class="turnround-event">
            <div class="d-flex flex-wrap gap-2 align-items-baseline">
                <span class="turnround-event-time">${safe(time)}</span>
                <small class="text-muted">${safe(day)}</small>
                <strong>${safe(event.eventType)}</strong>
                <span class="badge text-bg-success">Recorded</span>
            </div>
            <small class="text-muted">👤 ${safe(event.createdBy?.name || "Unknown")}</small>
        </div>`;
    }).join("") : '<p class="text-muted mb-0">No operational events recorded yet.</p>';
    const badge = document.getElementById("turnroundProgressBadge");
    if (badge) badge.textContent = ordered.length + " events";
    const summary = document.getElementById("turnroundProgressSummary");
    if (summary) summary.textContent = ordered.length
        ? ordered.length + " recorded events · " + new Set(ordered.map(e => e.eventType)).size + " distinct milestones"
        : "Awaiting first operational event";
    // Do not imply an overall completion percentage until mandatory milestones
    // are configured for the flight's airline and aircraft type.
    const bar = document.getElementById("turnroundProgressBar");
    if (bar) bar.style.width = "0%";
    const progress = bar?.parentElement;
    if (progress) {
        progress.setAttribute("aria-valuenow", "0");
        progress.setAttribute("aria-label", "Completion percentage unavailable until mandatory milestones are configured");
        progress.classList.add("d-none");
    }
}

function canSeeEvent(def){

    const user =
    getCurrentUser();

    if(!user){
        return false;
    }

    const skills =
    user.skills || [];

    const position =
    user.position || "";

    if(
        position.includes("_DM")
    ){
        return true;
    }

    return def.roles?.some(
        role =>
        (role === "ARRIVAL_RAMP" && user.active !== false && user.department === "RAMP") || skills.includes(role)
    );

}


async function loadEventButtons(){

    await loadCompletedEvents();
    const response =
    await fetch(
        "/api/event-definitions"
    );

    const definitions =
    await response.json();

    const container =
    document.getElementById(
        "eventButtons"
    );

    container.innerHTML = "";

    const groups = {};

    definitions.forEach(def=>{

   if(
    !canSeeEvent(def)
){
    return;
}

    if(
        !groups[def.group]
    ){
        groups[def.group] = [];
    }

    groups[def.group].push(def);

});

    Object.keys(groups)
    .forEach(group=>{

        const section =
        document.createElement(
            "div"
        );

        section.className =
        "mb-4";

        section.innerHTML =

        `<h5>${group}</h5>`;

        groups[group]
        .forEach(def=>{

            const btn =
            document.createElement(
                "button"
            );

           const completed =
completedEvents.includes(
    def.code
);

btn.className =
completed
?
"btn btn-success me-2 mb-2"
:
"btn btn-outline-primary me-2 mb-2";

if(completed){

    btn.innerText =
    "✓ " + def.name;

    btn.onclick =
    ()=>editEvent(
        def.code
    );

}
else{

    btn.innerText =
    def.name;

    btn.onclick =
    ()=>saveEvent(
        def.code
    );

}

            section.appendChild(
                btn
            );

        });

        container.appendChild(
            section
        );

    });

}

document.addEventListener(
    "DOMContentLoaded",
    () => {

        eventModal =
        new bootstrap.Modal(
            document.getElementById(
                "eventModal"
            )
        );

        passengerModal =
        new bootstrap.Modal(
            document.getElementById(
                "passengerModal"
            )
        );

        specialHandlingModal =
        new bootstrap.Modal(
            document.getElementById(
                "specialHandlingModal"
            )
        );

        specialHandlingDetailsModal =
new bootstrap.Modal(

    document.getElementById(
        "specialHandlingDetailsModal"
    )

);

        flightDetailsModal =
        new bootstrap.Modal(
            document.getElementById(
                "flightDetailsModal"
            )
        );

        assignmentModal =
        new bootstrap.Modal(
            document.getElementById(
                "assignmentModal"
            )
        );

        document.getElementById('chatMessages').addEventListener('click', () => markDisplayedChatRead());
        document.getElementById('chatText').addEventListener('focus', () => markDisplayedChatRead());

        const chatInput =
        document.getElementById(
            "chatText"
        );

        if(chatInput){

            chatInput.addEventListener(
                "keydown",
                async(event)=>{

                    if(
                        event.key === "Enter"
                        &&
                        !event.shiftKey
                    ){

                        event.preventDefault();

                        await sendChatMessage();

                    }

                }
            );

        }

    }
);

async function openAssignmentModal(){

    if(!canEdit("ASSIGNMENTS")){

        return;

    }

    await loadAssignmentEditor();

    assignmentModal.show();

}


function applyDashboardPermissions(){

    const btn =
    document.getElementById(
        "editAssignmentsBtn"
    );

    if(btn){

        btn.style.display =
        canEdit("ASSIGNMENTS")
        ?
        ""
        :
        "none";

    }

}

function formatRole(role){

    const names = {
        DISPATCH:"Departure Dispatcher",
        ARRIVAL_DISPATCH:"Arrival Dispatcher",
        ARRIVAL_RAMP:"Arrival RAMP",
        RAMP:"Departure RAMP",
        ARRIVAL:"Arrival Agent",

        ADMIN:
        "👑 Admin",

        MANAGER:
        "📋 Manager",

        AIRLINE:
        "✈ Airline",

        OPERATIONS:
        "🎧 Operations",

        ARRIVAL_AGENT:
        "🛄 Arrival",

        CHECKIN_AGENT:
        "🧳 Check-In",

        GATE_AGENT:
        "🚪 Gate",

        RAMP_SERVICE:
        "🚜 Ramp",

        SPUR:
        "🛠 SPUR"

    };

    return names[role] || role;
}

async function editFlightDetails(){
    document.getElementById("detailsOccurrence").value = "reject";

    const response =
    await fetch(
        `/api/flights/${flightId}`
    );

    const flight =
    await response.json();

    document.getElementById(
        "aircraftType"
    ).value =
    flight.aircraft?.aircraftType || "";

    document.getElementById(
        "registration"
    ).value =
    flight.aircraft?.registration || "";

    document.getElementById(
        "stand"
    ).value =
    flight.aircraft?.stand || "";

    document.getElementById(
        "eta"
    ).value =
    flight.arrival?.eta
    ?
    OperationalTime.localInput(flight.arrival.eta).slice(0,16)
    :
    "";

    document.getElementById(
        "ata"
    ).value =
    flight.arrival?.ata
    ?
    OperationalTime.localInput(flight.arrival.ata).slice(0,16)
    :
    "";

    document.getElementById(
        "etd"
    ).value =
    flight.departure?.etd
    ?
    OperationalTime.localInput(flight.departure.etd).slice(0,16)
    :
    "";

    flightDetailsModal.show();

}


function canCancelFlight(){

    const position =
    getCurrentUser()?.position;

    return [

        "OPERATIONS_DM",
        "TRAFFIC_COORDINATOR"

    ].includes(position);

}

async function saveFlightDetails(){

const cancelBtn =
document.getElementById(
    "cancelFlightBtn"
);

if(cancelBtn){

    cancelBtn.style.display =

    canCancelFlight()
    ?
    ""
    :
    "none";

}
    const saveResponse = await fetch(

        `/api/flights/${flightId}/details`,

        {

            method:"PUT",

            headers:{
                "Content-Type":
                "application/json"
            },

            body:JSON.stringify({
                timeDisambiguation:document.getElementById("detailsOccurrence").value,

                aircraftType:
                document.getElementById(
                    "aircraftType"
                ).value,

                registration:
                document.getElementById(
                    "registration"
                ).value,

                stand:
                document.getElementById(
                    "stand"
                ).value,

                eta:
                document.getElementById(
                    "eta"
                ).value,

                ata:
                document.getElementById(
                    "ata"
                ).value,

                etd:
                document.getElementById(
                    "etd"
                ).value,
                updatedByName:
CURRENT_USER.name

            })
            

        }

    );

    if (!saveResponse.ok) {
        const error = await saveResponse.json();
        alert(error.error || "Save failed");
        return;
    }
    flightDetailsModal.hide();

    await loadFlight();

}

async function cancelFlight(){

    const reason =
    prompt(
        "Cancellation reason:"
    );

    if(!reason){
        return;
    }

    await fetch(

        `/api/flights/${flightId}/cancel`,

        {

            method:"POST",

            headers:{
                "Content-Type":
                "application/json"
            },

            body:JSON.stringify({

                reason,

                updatedByName:
                CURRENT_USER.name

            })

        }

    );

    flightDetailsModal.hide();

    await loadFlight();

    await loadChat();

}

async function editSpecialHandling(){

    const response =
    await fetch(
        `/api/flights/${flightId}`
    );

    const flight =
    await response.json();

    const sh =
    flight.specialHandling || {};

    document.getElementById(
        "liIonMobilityAids"
    ).value =
    sh.liIonMobilityAids || 0;

    document.getElementById(
        "dryCellMobilityAids"
    ).value =
    sh.dryCellMobilityAids || 0;

    document.getElementById(
        "avih"
    ).value =
    sh.avih || 0;

    document.getElementById(
        "umnr"
    ).value =
    sh.umnr || 0;

    document.getElementById(
        "weap"
    ).value =
    sh.weap || 0;

    document.getElementById(
        "cbbg"
    ).value =
    sh.cbbg || 0;

    document.getElementById(
        "vvip"
    ).value =
    sh.vvip || 0;

    specialHandlingModal.show();

}

async function saveSpecialHandling(){

    await fetch(

        `/api/flights/${flightId}/special-handling`,

        {

            method:"PUT",

            headers:{
                "Content-Type":
                "application/json"
            },

            body:JSON.stringify({

                liIonMobilityAids:
                Number(
                    document.getElementById(
                        "liIonMobilityAids"
                    ).value
                ),

                dryCellMobilityAids:
                Number(
                    document.getElementById(
                        "dryCellMobilityAids"
                    ).value
                ),

                avih:
                Number(
                    document.getElementById(
                        "avih"
                    ).value
                ),

                umnr:
                Number(
                    document.getElementById(
                        "umnr"
                    ).value
                ),

                weap:
                Number(
                    document.getElementById(
                        "weap"
                    ).value
                ),

                cbbg:
                Number(
                    document.getElementById(
                        "cbbg"
                    ).value
                ),

                vvip:
                Number(
                    document.getElementById(
                        "vvip"
                    ).value
                ),
                    updatedByName:
    CURRENT_USER.name

            })

        }

    );

    specialHandlingModal.hide();

    await loadFlight();

}

async function editEvent(
    eventType
){

    const response =
    await fetch(
        `/api/events/${flightId}/${eventType}`
    );

    const event =
    await response.json();

    document.getElementById(
        "modalEventId"
    ).value = event._id;

    document.getElementById(
        "modalEventType"
    ).value = event.eventType;

    document.getElementById(
        "modalEventTime"
    ).value = OperationalTime.localInput(event.eventTime).slice(0,16);

    document.getElementById(
        "modalEventNotes"
    ).value =
    event.notes || "";

    document.getElementById("eventOccurrence").value = "reject";
    eventModal.show();

}


async function saveEventEdit(){

    const eventId =
    document.getElementById(
        "modalEventId"
    ).value;

    const eventTime =
    document.getElementById(
        "modalEventTime"
    ).value;

    const notes =
    document.getElementById(
        "modalEventNotes"
    ).value;

    const saveResponse = await fetch(

        `/api/events/${eventId}`,

        {

            method:"PUT",

            headers:{
                "Content-Type":
                "application/json"
            },

            body:JSON.stringify({
                timeDisambiguation:document.getElementById("eventOccurrence").value,

                eventTime,
                notes

            })

        }

    );

    if (!saveResponse.ok) {
        const error = await saveResponse.json();
        alert(error.error || "Save failed");
        return;
    }
    eventModal.hide();

    await loadFlight();

    await loadEventButtons();

}

async function loadAssignments(){
    const panel=document.getElementById('staffPanel');
    const response=await fetch(`/api/assignments/${flightId}`,{headers:{Authorization:`Bearer ${localStorage.getItem('token') || ''}`}});
    if(!response.ok){panel.textContent='Unable to load assignments. Please sign in again.';return;}
    const assignments=await response.json();
    panel.replaceChildren();
    for(const a of assignments){
        const row=document.createElement('div');row.className='border-bottom pb-2 mb-2';
        const role=document.createElement('strong');role.textContent=formatRole(a.role);row.append(role);
        const name=document.createElement('div');name.textContent=a.userId?.name || '—';row.append(name);
        if(a.userId?.phone){const phone=document.createElement('a');phone.href=`tel:${a.userId.phone.replace(/[^+0-9]/g,'')}`;phone.textContent=`📞 ${a.userId.phone}`;row.append(phone);}
        const status=document.createElement('div');status.className='small mt-1';
        status.textContent=a.acceptedAt ? `✓ Accepted by ${a.acceptedByName || a.userId?.name} · ${new Date(a.acceptedAt).toLocaleString('en-GB',{timeZone:'Europe/London',timeZoneName:'short'})}` : 'Awaiting acceptance';row.append(status);
        if(a.qualificationWarning){const warning=document.createElement('div');warning.className='small text-danger';warning.textContent=`Training: ${a.qualificationWarning}`;row.append(warning);}
        if(!a.acceptedAt && a.userId?._id===CURRENT_USER._id){
            const button=document.createElement('button');button.className='btn btn-sm btn-success mt-2';button.textContent='Accept flight';
            button.onclick=async()=>{
                button.disabled=true;
                try{
                    const result=await fetch(`/api/acknowledgements/${flightId}/assignments/${a._id}/accept`,{method:'POST',headers:{Authorization:`Bearer ${localStorage.getItem('token') || ''}`}});
                    if(!result.ok)throw new Error((await result.json()).error || 'Unable to accept flight');
                    await loadAssignments();
                }catch(error){status.textContent=error.message;button.disabled=false;}
            };row.append(button);
        }
        panel.append(row);
    }
}
socket.on('assignmentAccepted',loadAssignments);


async function loadUsers(){

    const response =
    await fetch(
        "/api/users", {headers:{Authorization:`Bearer ${localStorage.getItem("token") || ""}`}}
    );

    users =
    await response.json();

}

async function loadRoleDefinitions(){

    const response =
    await fetch(
        "/api/role-definitions"
    );

    roles =
    await response.json();

    roles =
    roles.filter(role =>

        ![
            "ADMIN",
            "MANAGER"
        ].includes(
            role.code
        )

    );

}

async function loadAssignmentEditor(){

    await loadUsers();

    const roles = [
        {code:"ARRIVAL_DISPATCH",name:"Arrival Dispatcher"},
        {code:"ARRIVAL_RAMP",name:"Arrival RAMP"},

        {
            code:"DISPATCH",
            name:"Departure Dispatcher"
        },

        {
            code:"CHECKIN",
            name:"Check-In"
        },

        {
            code:"GATE",
            name:"Gate"
        },

        {
            code:"ARRIVAL",
            name:"Arrival Agent"
        },

        {
            code:"RAMP",
            name:"Departure RAMP"
        },

        {
            code:"SPUR",
            name:"SPUR"
        }

    ];

    let visibleRoles = roles;

    switch(
        CURRENT_USER.role === "ADMIN" ? "SUPER_ADMIN" : CURRENT_USER.position
    ){

        case "OPERATIONS_DM":
        case "TRAFFIC_COORDINATOR":

            visibleRoles =
            roles.filter(r=>

                ["DISPATCH","ARRIVAL_DISPATCH"].includes(r.code)

            );

            break;

        case "PAX_DM":
        case "CHECKIN_SUPERVISOR":

            visibleRoles =
            roles.filter(r=>

                [
                    "CHECKIN",
                    "GATE",
                    "ARRIVAL"
                ].includes(
                    r.code
                )

            );

            break;

        case "RAMP_DM":
        case "RAMP_ALLOCATOR":

            visibleRoles =
            roles.filter(r=>

                ["ARRIVAL_RAMP","RAMP"].includes(r.code)

            );

            break;

        case "SPUR_DM":
        case "SPUR_COORDINATOR":

            visibleRoles =
            roles.filter(r=>

                r.code === "SPUR"

            );

            break;

    }

    const response =
    await fetch(
        `/api/assignments/${flightId}`, {headers:{Authorization:`Bearer ${localStorage.getItem("token") || ""}`}}
    );

    const assignments =
    await response.json();

    const panel =
    document.getElementById(
        "assignmentEditor"
    );

    panel.innerHTML = "";

    visibleRoles.forEach(role=>{

        const assigned =
        assignments.find(
            a => a.role === role.code
        );

        const eligibleUsers = users.filter(user => AirlineQualifications.eligible(user,currentFlight?.airline,role.code,AirlineQualifications.flightDate(currentFlight,role.code)));
        const row = document.createElement('div');row.className='mb-3';
        const label = document.createElement('label');label.className='form-label';label.textContent=role.name;
        const select=document.createElement('select');select.className='form-select assignment';select.dataset.role=role.code;
        select.append(new Option('-- Unassigned --',''));
        for(const user of eligibleUsers)select.append(new Option(user.name,user._id));
        if(assigned?.userId && !eligibleUsers.some(user=>String(user._id)===String(assigned.userId._id))){
            const option=new Option(`${assigned.userId.name} (not qualified — replace or remove)`,assigned.userId._id);
            option.disabled=true;select.append(option);
        }
        select.value=assigned?.userId?._id || '';
        const help=document.createElement('small');help.className='d-block text-muted';
        help.textContent=role.code === 'ARRIVAL_RAMP' ? 'Available to every active RAMP employee. No skill or airline training required.' : `Valid ${currentFlight?.airline || 'airline'} / ${role.code} training required on ${AirlineQualifications.flightDate(currentFlight,role.code) || 'flight date'}. No override.`;
        row.append(label,select,help);panel.append(row);
    });

}

async function saveAssignments(){

    const assignments = [];

    document
    .querySelectorAll(
        ".assignment"
    )
    .forEach(select=>{

        if(
            !select.value
        ){
            return;
        }

        assignments.push({

            role:
            select.dataset.role,

            userId:
            select.value

        });

    });

    const response = await fetch(

        `/api/assignments/${flightId}`,

        {

            method:"POST",

            headers:{
                Authorization:`Bearer ${localStorage.getItem("token") || ""}`,
                "Content-Type":
                "application/json"
            },

           body:JSON.stringify({

    assignments,

    updatedByName:
    CURRENT_USER.name

})

        }

    );

    if (!response.ok) { alert((await response.json()).error || "Unable to save assignments"); return; }

    alert(
        "Assignments saved"
    );

    await loadAssignments();

}



function formatDateTime(value){

    if(!value)
        return "-";

    if(typeof value === "string"){

        if(
            value.includes(":")
            &&
            value.length <= 5
        ){
            return value;
        }

    }

    const date =
    new Date(value);

    if(
        isNaN(date)
    ){
        return value;
    }

    return date.toLocaleTimeString(
        "en-GB",
        {
            timeZone:"Europe/London",
            hour:"2-digit",
            minute:"2-digit"
        }
    );

}

let passengerEditRevision=0, passengerSaveBusy=false, passengerEditToken=null;
function passengerValue(value){return value===null?'—':value;}
function passengerRemaining(p){
    const bad=p.remaining<0||p.remainingInfants<0;
    return `<div class="${bad?'alert alert-warning':'bg-light rounded p-2'} mb-0">Remaining passengers: <strong>${passengerValue(p.remaining)}</strong> · Remaining infants: <strong>${passengerValue(p.remainingInfants)}</strong>${bad?'<br>Mismatch — on-board figures exceed check-in figures. Please verify.':''}</div>`;
}
function loadPassengerInfo(flight){
    const p=PassengerFigures.normalize(flight.passengers);
    document.getElementById('passengerPanel').innerHTML=`
      <div class="row g-3 mb-3">
        <section class="col-sm-6"><h6 class="text-muted">Check-in</h6>
          <div>Checked-in <small>(excluding infants)</small><h4>${passengerValue(p.checkedIn)}</h4></div>
          <div>Checked-in infants<h4>${passengerValue(p.checkedInInfants)}</h4></div>
        </section>
        <section class="col-sm-6"><h6 class="text-muted">On board</h6>
          <div>Boarded <small>(excluding infants)</small><h4>${passengerValue(p.boarded)}</h4></div>
          <div>Infants on board<h4>${passengerValue(p.infants)}</h4></div>
          <div class="bg-primary-subtle rounded p-2 mb-2">TOB <small>(Boarded + infants)</small><h3 class="mb-0">${passengerValue(p.tob)}</h3></div>
          <div>Jump seat <small>(excluded from TOB)</small><strong class="ms-2">${passengerValue(p.jumpSeat)}</strong></div>
        </section>
      </div>
      ${passengerRemaining(p)}
      ${p.checkedInInfants===null?'<p class="small text-muted mt-2">Checked-in infants have not been entered.</p>':''}
      ${p.invalidLegacy?'<p class="text-warning mt-2">Previous TOB is smaller than the infants count. Verify the on-board figures.</p>':p.legacy?'<p class="small text-muted mt-2">Boarded is derived from the previous TOB minus infants. Verify on first edit.</p>':''}
      ${canEdit('PASSENGERS')?'<button class="btn btn-primary mt-3" onclick="editPassengers()">Edit passengers</button>':''}`;
}
function passengerInput(){
    const body={};for(const field of PassengerFigures.fields){const value=document.getElementById(field).value;body[field]=value.trim()===''?null:Number(value);}return body;
}
function updatePassengerPreview(){
    const body=passengerInput(),p=PassengerFigures.normalize({...body,figuresVersion:2});
    document.getElementById('tob').value=p.tob===null?'':p.tob;
    document.getElementById('passengerEditRemaining').innerHTML=passengerRemaining(p);
}
for(const field of PassengerFigures.fields)document.getElementById(field).addEventListener('input',updatePassengerPreview);
async function editPassengers(){
    if(passengerSaveBusy)return;
    try{
        const response=await fetch(`/api/flights/${flightId}`);if(!response.ok)throw Error('Unable to load passenger figures');
        const flight=await response.json(),p=PassengerFigures.normalize(flight.passengers);
        passengerEditRevision=flight.passengerRevision||0;passengerEditToken=localStorage.getItem('token');
        for(const field of PassengerFigures.fields)document.getElementById(field).value=p[field]===null?'':p[field];
        document.getElementById('passengerEditMessage').textContent=p.legacy?'Verify the previous TOB / infants split and enter the checked-in infants count.':'TOB is calculated automatically. Jump seat is counted separately.';
        updatePassengerPreview();passengerModal.show();
    }catch(error){alert(error.message);}
}
async function savePassengers(){
    if(passengerSaveBusy)return;
    const message=document.getElementById('passengerEditMessage');
    try{
        if(!passengerEditToken||passengerEditToken!==localStorage.getItem('token'))throw Error('Account changed. Reopen the editor.');
        const figures=PassengerFigures.validate(passengerInput());passengerSaveBusy=true;
        const response=await fetch(`/api/flights/${flightId}/passengers`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${passengerEditToken}`},body:JSON.stringify({...figures,expectedRevision:passengerEditRevision})});
        if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.error||'Unable to save passenger figures');}
        passengerModal.hide();await loadFlight();
    }catch(error){message.textContent=error.message;}finally{passengerSaveBusy=false;}
}

function loadSpecialHandling(
    flight
){

    const details =
    flight.specialHandlingDetails || {};

    const vipBaggage = Array.isArray(details.vipBaggage) ? details.vipBaggage : [];
    const depa = Array.isArray(details.depa) ? details.depa : [];

    const wclbCount =
    details.wclb?.length || 0;

    const wcbdCount =
    details.wcbd?.length || 0;

    const avihCount =
    details.avih?.length || 0;

    const petcCount =
    details.petc?.length || 0;

    const cbbgCount =
    details.cbbg?.length || 0;

    const weapCount =
    details.weap?.length || 0;

    document.getElementById(
        "specialHandlingPanel"
    ).innerHTML = `

    <div class="row">

        <div class="col-md-4">

            ♿ WCLB:
            <strong>
            ${wclbCount}
            </strong>

        </div>

        <div class="col-md-4">

            ♿ WCBD:
            <strong>
            ${wcbdCount}
            </strong>

        </div>

        <div class="col-md-4">

            🐕 AVIH:
            <strong>
            ${avihCount}
            </strong>

        </div>

        <div class="col-md-4 mt-2">

            🐈 PETC:
            <strong>
            ${petcCount}
            </strong>

        </div>

        <div class="col-md-4 mt-2">

            🎻 CBBG:
            <strong>
            ${cbbgCount}
            </strong>

        </div>

        <div class="col-md-4 mt-2">

            🔫 WEAP:
            <strong>
            ${weapCount}
            </strong>

        </div>

        <div class="col-md-4 mt-2">

            🛂 DEPA:
            <strong>${depa.length}</strong>
            <div id="depaSeatSummary" class="small text-muted"></div>

        </div>
        <div class="col-md-4 mt-2">
            ⭐ VIP baggage: <strong>${vipBaggage.length}</strong>
            <div id="vipBaggageSummary" class="small text-muted text-break"></div>
        </div>

    </div>

    ${
    requiresNotoc(
        details
    )
    ?
    `
    <div class="alert alert-warning mt-3">

        ⚠ NOTOC REQUIRED

    </div>
    `
    :
    ""
    }

    ${
    canEdit(
        "SPECIAL_HANDLING"
    )
    ?
    `
    <button
        class="btn btn-primary mt-3"
        onclick="editSpecialHandlingDetails()">

        Edit Special Handling

    </button>
    `
    :
    ""
    }

    `;

    document.getElementById("vipBaggageSummary").textContent = vipBaggage.length ? `Tags: ${vipBaggage.map(item=>item.bagTag).join(", ")}` : "";
    document.getElementById("depaSeatSummary").textContent = depa.length
        ? `Seats: ${depa.map(item => item.seat || "Unassigned").join(", ")}`
        : "";

}

async function loadChat({markRead = false} = {}) {
    const version = ++chatLoadVersion;
    try {
        if (chatSessionToken !== localStorage.getItem('token')) return;
        const response = await fetch(`/api/chat/${flightId}`, {headers:{Authorization:`Bearer ${chatSessionToken}`}});
        if (!response.ok) throw new Error('Could not load chat');
        const messages = await response.json();
        if (chatSessionToken !== localStorage.getItem('token')) return;
        const ids = messages.map(m => m._id);
        if (version === chatLoadVersion) {
            const panel = document.getElementById('chatMessages');
            panel.replaceChildren();
            for (const msg of messages) {
                const row = document.createElement('div');
                row.className = msg.messageType === 'SYSTEM' ? 'alert alert-info py-1 mb-2'
                    : msg.messageType === 'EVENT' ? 'alert alert-success py-1 mb-2' : 'mb-2';
                const heading = document.createElement('strong');
                heading.textContent = msg.messageType === 'SYSTEM' ? '⚙ System ' : msg.messageType === 'EVENT' ? '✅ Event ' : `${msg.userId?.name || 'Unknown'} `;
                const time = document.createElement('small');
                time.textContent = new Date(msg.createdAt).toLocaleTimeString('en-GB', {timeZone:'Europe/London'});
                const body = document.createElement('div');
                body.textContent = msg.message;
                row.append(heading, time, body);
                panel.append(row);
            }
            displayedChatMessageIds = ids;
            panel.scrollTop = panel.scrollHeight;
        }
        // Only the opening snapshot is automatic. Background refreshes never clear new arrivals.
        if (markRead) await markDisplayedChatRead(ids);
    } catch (error) {
        console.error(error);
        showChatToast('System', 'Chat could not load. Reload the flight to retry.', 'SYSTEM');
    }
}

async function sendChatMessage(){
    const input = document.getElementById('chatText');
    const text = input.value.trim();
    if (!text) return;
    try {
        if (!chatSessionToken || chatSessionToken !== localStorage.getItem('token')) throw new Error('Account changed. Reload the flight.');
        const response = await fetch(`/api/chat/${flightId}`, {
            method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${chatSessionToken}`},
            body:JSON.stringify({message:text})
        });
        if (!response.ok) throw new Error('Message could not be sent. Please retry.');
        if (input.value.trim() === text) input.value = '';
        await markDisplayedChatRead();
        await loadChat();
    } catch (error) { alert(error.message); }
}


async function editSpecialHandlingDetails(){

    const response =
    await fetch(
        `/api/flights/${flightId}`
    );

    const flight =
    await response.json();

    specialHandlingDetails = flight.specialHandlingDetails || {};
    for (const category of ["wclb", "wcbd", "avih", "petc", "cbbg", "weap", "depa", "vipBaggage"]) {
        if (!Array.isArray(specialHandlingDetails[category])) specialHandlingDetails[category] = [];
    }
    renderDepaList();
    renderVipBaggageList();

    renderWclbList();
renderWcbdList();
renderAvihList();
renderPetcList();
renderCbbgList();
renderWeapList();

    specialHandlingDetailsModal.show();

}

function addAvih(){

    specialHandlingDetails.avih.push({

        animalType:"",
        weight:0,
        bagTag:"",
        passengerName:"",
        seat:""

    });

    renderAvihList();

}

function renderAvihList(){

    const panel =
    document.getElementById(
        "avihList"
    );

    panel.innerHTML = "";

    specialHandlingDetails.avih
    .forEach(
        (item,index)=>{

        panel.innerHTML += `

<div class="card mb-3">

    <div class="card-body">

        <div class="row">

            <div class="col-md-3">

                <label>

                    Type

                </label>

                <input

                    class="form-control"

                    value="${item.animalType}"

                    onchange="

specialHandlingDetails.avih[${index}].animalType=this.value

                    ">

            </div>

            <div class="col-md-2">

                <label>

                    Weight

                </label>

                <input

                    type="number"

                    class="form-control"

                    value="${item.weight}"

                    onchange="

specialHandlingDetails.avih[${index}].weight=Number(this.value)

                    ">

            </div>

            <div class="col-md-2">

                <label>

                    Bag Tag

                </label>

                <input

                    class="form-control"

                    value="${item.bagTag}"

                    onchange="

specialHandlingDetails.avih[${index}].bagTag=this.value

                    ">

            </div>

            <div class="col-md-3">

                <label>

                    Passenger

                </label>

                <input

                    class="form-control"

                    value="${item.passengerName}"

                    onchange="

specialHandlingDetails.avih[${index}].passengerName=this.value

                    ">

            </div>

            <div class="col-md-1">

                <label>

                    Seat

                </label>

                <input

                    class="form-control"

                    value="${item.seat}"

                    onchange="

specialHandlingDetails.avih[${index}].seat=this.value

                    ">

            </div>

            <div class="col-md-1">

                <label>

                    Del

                </label>

                <button

                    class="btn btn-danger"

                    onclick="deleteAvih(${index})">

                    X

                </button>

            </div>

        </div>

    </div>

</div>

`;

    });

}

function deleteAvih(index){

    specialHandlingDetails
    .avih
    .splice(
        index,
        1
    );

    renderAvihList();

}

async function saveSpecialHandlingDetails(){
    try { specialHandlingDetails.vipBaggage = VipBaggage.normalize(specialHandlingDetails.vipBaggage || []); }
    catch(error) { alert(error.message); return; }


    if ((specialHandlingDetails.depa || []).some(item => !item.seat?.trim())) {
        alert("Enter a seat for each DEPA passenger, or remove the unused row.");
        return;
    }
    const response = await fetch(

        `/api/flights/${flightId}/special-handling-details`,

        {

            method:"PUT",

            headers:{
                "Content-Type":
                "application/json"
            },

            body:JSON.stringify({

                details:
                specialHandlingDetails,

                updatedByName:
                CURRENT_USER.name

            })

        }

    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        alert(error.error || "Special handling could not be saved");
        return;
    }
    specialHandlingDetailsModal.hide();

    await loadFlight();

}



function renderWclbList(){

    const panel =
    document.getElementById(
        "wclbList"
    );

    panel.innerHTML = "";

    specialHandlingDetails.wclb
    .forEach((item,index)=>{

        panel.innerHTML += `

<div class="card mb-2">

<div class="card-body">

<div class="row">

<div class="col-md-3">

<label>Pax</label>

<input
class="form-control"
value="${item.passengerName}"

onchange="
specialHandlingDetails.wclb[${index}].passengerName=this.value
">

</div>

<div class="col-md-2">

<label>Seat</label>

<input
class="form-control"
value="${item.seat}"

onchange="
specialHandlingDetails.wclb[${index}].seat=this.value
">

</div>

<div class="col-md-2">

<label>Wh</label>

<input
type="number"
class="form-control"
value="${item.wh}"

onchange="
specialHandlingDetails.wclb[${index}].wh=Number(this.value)
">

</div>

<div class="col-md-2">

<label>Battery Kg</label>

<input
type="number"
class="form-control"
value="${item.batteryWeight}"

onchange="
specialHandlingDetails.wclb[${index}].batteryWeight=Number(this.value)
">

</div>

<div class="col-md-1">

<button
class="btn btn-danger mt-4"
onclick="deleteWclb(${index})">

X

</button>

</div>

</div>

</div>

</div>

`;

    });

}

function deleteWclb(index){

    specialHandlingDetails
    .wclb
    .splice(index,1);

    renderWclbList();

}


function addWcbd(){

    specialHandlingDetails.wcbd.push({

        passengerName:"",
        seat:"",
        wh:0,
        chairWeight:0,
        bagTag:""

    });

    renderWcbdList();

}

function deleteWcbd(index){

    specialHandlingDetails
    .wcbd
    .splice(index,1);

    renderWcbdList();

}

function renderWcbdList(){

    const panel =
    document.getElementById(
        "wcbdList"
    );

    panel.innerHTML = "";

    specialHandlingDetails.wcbd
    .forEach((item,index)=>{

        panel.innerHTML += `

<div class="card mb-3">

    <div class="card-body">

        <div class="row">

            <div class="col-md-3">

                <label>
                    Passenger
                </label>

                <input
                    class="form-control"
                    value="${item.passengerName}"

                    onchange="
specialHandlingDetails.wcbd[${index}].passengerName=this.value
                    ">

            </div>

            <div class="col-md-1">

                <label>
                    Seat
                </label>

                <input
                    class="form-control"
                    value="${item.seat}"

                    onchange="
specialHandlingDetails.wcbd[${index}].seat=this.value
                    ">

            </div>

            <div class="col-md-2">

                <label>
                    Wh
                </label>

                <input
                    type="number"
                    class="form-control"
                    value="${item.wh}"

                    onchange="
specialHandlingDetails.wcbd[${index}].wh=Number(this.value)
                    ">

            </div>

            <div class="col-md-2">

                <label>
                    Chair Weight (kg)
                </label>

                <input
                    type="number"
                    class="form-control"
                    value="${item.chairWeight}"

                    onchange="
specialHandlingDetails.wcbd[${index}].chairWeight=Number(this.value)
                    ">

            </div>

            <div class="col-md-2">

                <label>
                    Bag Tag
                </label>

                <input
                    class="form-control"
                    value="${item.bagTag}"

                    onchange="
specialHandlingDetails.wcbd[${index}].bagTag=this.value
                    ">

            </div>

            <div class="col-md-1">

                <button
                    class="btn btn-danger mt-4"
                    onclick="deleteWcbd(${index})">

                    X

                </button>

            </div>

        </div>

    </div>

</div>

        `;

    });

}


function addVipBaggage(){
    specialHandlingDetails.vipBaggage ||= [];
    if(specialHandlingDetails.vipBaggage.length>=200){alert('Maximum 200 VIP bags');return;}
    specialHandlingDetails.vipBaggage.push({bagTag:''});renderVipBaggageList();
}
function renderVipBaggageList(){
    const list=document.getElementById('vipBaggageList');list.replaceChildren();
    const rows=specialHandlingDetails.vipBaggage||[];
    document.getElementById('vipBaggageCount').textContent=rows.length;
    rows.forEach((item,index)=>{
        const card=document.createElement('div');card.className='card mb-3';
        const body=document.createElement('div');body.className='card-body';
        const row=document.createElement('div');row.className='row g-2 align-items-end';
        const column=document.createElement('div');column.className='col-9';
        const label=document.createElement('label');label.htmlFor=`vip-bag-${index}`;label.textContent=`VIP bag ${index+1} — tag`;
        const input=document.createElement('input');input.id=label.htmlFor;input.type='text';input.className='form-control';input.maxLength=24;input.required=true;input.value=item.bagTag||'';input.placeholder='e.g. 0012345678';
        input.addEventListener('input',()=>{item.bagTag=input.value.trim().toUpperCase();});
        input.addEventListener('blur',()=>{input.value=item.bagTag;});
        column.append(label,input);
        const buttons=document.createElement('div');buttons.className='col-3';
        const remove=document.createElement('button');remove.type='button';remove.className='btn btn-danger';remove.textContent='X';remove.setAttribute('aria-label',`Remove VIP bag ${index+1}`);
        remove.addEventListener('click',()=>{rows.splice(index,1);renderVipBaggageList();});
        buttons.append(remove);row.append(column,buttons);body.append(row);card.append(body);list.append(card);
    });
}

function addDepa() {
    specialHandlingDetails.depa ||= [];
    specialHandlingDetails.depa.push({ passengerName:"", seat:"" });
    renderDepaList();
}

function renderDepaList() {
    const list = document.getElementById("depaList");
    list.replaceChildren();
    (specialHandlingDetails.depa || []).forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "card mb-3";
        const body = document.createElement("div");
        body.className = "card-body";
        const row = document.createElement("div");
        row.className = "row";
        for (const [key, label, limit] of [["passengerName", "Passenger name (optional)", 120], ["seat", "Seat", 10]]) {
            const column = document.createElement("div");
            column.className = "col-md-4";
            const fieldLabel = document.createElement("label");
            fieldLabel.htmlFor = `depa-${index}-${key}`;
            fieldLabel.textContent = label;
            const input = document.createElement("input");
            input.className = "form-control";
            input.id = fieldLabel.htmlFor;
            input.type = "text";
            input.maxLength = limit;
            input.value = item[key] || "";
            input.required = key === "seat";
            if (key === "seat") input.placeholder = "e.g. 24A";
            input.addEventListener("input", () => {
                item[key] = key === "seat" ? input.value.trim().toUpperCase() : input.value;
            });
            input.addEventListener("blur", () => { input.value = item[key] || ""; });
            column.append(fieldLabel, input);
            row.appendChild(column);
        }
        const removeColumn = document.createElement("div");
        removeColumn.className = "col-md-1";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn btn-danger mt-4";
        remove.textContent = "X";
        remove.setAttribute("aria-label", `Remove DEPA passenger ${index + 1}`);
        remove.addEventListener("click", () => {
            specialHandlingDetails.depa.splice(index, 1);
            renderDepaList();
        });
        removeColumn.appendChild(remove);
        row.appendChild(removeColumn);
        body.appendChild(row);
        card.appendChild(body);
        list.appendChild(card);
    });
}

function addPetc(){

    specialHandlingDetails.petc.push({

        animalType:"",
        weight:0,
        seat:""

    });

    renderPetcList();

}

function deletePetc(index){

    specialHandlingDetails
    .petc
    .splice(index,1);

    renderPetcList();

}

function renderPetcList(){

    const panel =
    document.getElementById(
        "petcList"
    );

    panel.innerHTML = "";

    specialHandlingDetails.petc
    .forEach((item,index)=>{

        panel.innerHTML += `

<div class="card mb-3">

<div class="card-body">

<div class="row">

<div class="col-md-4">

<label>Type</label>

<input
class="form-control"
value="${item.animalType}"

onchange="
specialHandlingDetails.petc[${index}].animalType=this.value
">

</div>

<div class="col-md-3">

<label>Weight (kg)</label>

<input
type="number"
class="form-control"
value="${item.weight}"

onchange="
specialHandlingDetails.petc[${index}].weight=Number(this.value)
">

</div>

<div class="col-md-3">

<label>Seat</label>

<input
class="form-control"
value="${item.seat}"

onchange="
specialHandlingDetails.petc[${index}].seat=this.value
">

</div>

<div class="col-md-1">

<button
class="btn btn-danger mt-4"
onclick="deletePetc(${index})">

X

</button>

</div>

</div>

</div>

</div>

`;

    });

}

function addCbbg(){

    specialHandlingDetails.cbbg.push({

        weight:0,
        seat:""

    });

    renderCbbgList();

}

function deleteCbbg(index){

    specialHandlingDetails
    .cbbg
    .splice(index,1);

    renderCbbgList();

}

function renderCbbgList(){

    const panel =
    document.getElementById(
        "cbbgList"
    );

    panel.innerHTML = "";

    specialHandlingDetails.cbbg
    .forEach((item,index)=>{

        panel.innerHTML += `

<div class="card mb-3">

<div class="card-body">

<div class="row">

<div class="col-md-4">

<label>Weight (kg)</label>

<input
type="number"
class="form-control"
value="${item.weight}"

onchange="
specialHandlingDetails.cbbg[${index}].weight=Number(this.value)
">

</div>

<div class="col-md-4">

<label>Seat</label>

<input
class="form-control"
value="${item.seat}"

onchange="
specialHandlingDetails.cbbg[${index}].seat=this.value
">

</div>

<div class="col-md-1">

<button
class="btn btn-danger mt-4"
onclick="deleteCbbg(${index})">

X

</button>

</div>

</div>

</div>

</div>

`;

    });

}

function addWeap(){

    specialHandlingDetails.weap.push({

        weaponType:"",
        weight:0,
        bagTag:"",
        passengerName:"",
        seat:""

    });

    renderWeapList();

}

function deleteWeap(index){

    specialHandlingDetails
    .weap
    .splice(index,1);

    renderWeapList();

}

function renderWeapList(){

    const panel =
    document.getElementById(
        "weapList"
    );

    panel.innerHTML = "";

    specialHandlingDetails.weap
    .forEach((item,index)=>{

        panel.innerHTML += `

<div class="card mb-3">

<div class="card-body">

<div class="row">

<div class="col-md-2">

<label>Type</label>

<input
class="form-control"
value="${item.weaponType}"

onchange="
specialHandlingDetails.weap[${index}].weaponType=this.value
">

</div>

<div class="col-md-2">

<label>Weight</label>

<input
type="number"
class="form-control"
value="${item.weight}"

onchange="
specialHandlingDetails.weap[${index}].weight=Number(this.value)
">

</div>

<div class="col-md-2">

<label>Bag Tag</label>

<input
class="form-control"
value="${item.bagTag}"

onchange="
specialHandlingDetails.weap[${index}].bagTag=this.value
">

</div>

<div class="col-md-3">

<label>Passenger</label>

<input
class="form-control"
value="${item.passengerName}"

onchange="
specialHandlingDetails.weap[${index}].passengerName=this.value
">

</div>

<div class="col-md-1">

<label>Seat</label>

<input
class="form-control"
value="${item.seat}"

onchange="
specialHandlingDetails.weap[${index}].seat=this.value
">

</div>

<div class="col-md-1">

<button
class="btn btn-danger mt-4"
onclick="deleteWeap(${index})">

X

</button>

</div>

</div>

</div>

</div>

`;

    });

}


async function deleteFlight(){

    if(

        !confirm(

            "Delete this flight?"

        )

    ){
        return;
    }

    await fetch(

        `/api/flights/${flightId}/delete`,

        {

            method:"POST",

            headers:{
                "Content-Type":
                "application/json"
            },

            body:JSON.stringify({

                updatedByName:
                CURRENT_USER.name

            })

        }

    );

    window.location =
    "flights.html";

}

function getStatusBadgeClass(
    status
){

    switch(status){

        case "ARRIVING":
            return "bg-secondary";

        case "TURNAROUND":
            return "bg-primary";

        case "CHECKIN":
            return "bg-info text-dark";

        case "BOARDING":
            return "bg-warning text-dark";

        case "READY":
            return "bg-success";

        case "PUSHBACK":
            return "bg-dark";

        case "DEPARTED":
            return "bg-dark";

        case "CANCELLED":
            return "bg-danger";

        default:
            return "bg-secondary";
    }

}


function stopCountdown() {
    clearInterval(countdownInterval);
    countdownInterval = null;
}

function startCountdown() {
    stopCountdown();
    // updateCountdown returns whether the displayed state needs another tick.
    if (updateCountdown()) {
        countdownInterval = setInterval(() => {
            if (!updateCountdown()) stopCountdown();
        }, 1000);
    }
}

function duration(ms) {
    const seconds = Math.floor(Math.abs(ms) / 1000);
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
        .map(value => String(value).padStart(2, "0")).join(":");
}

function operationalDisplay(value) {
    return new Date(value).toLocaleString("en-GB", {
        timeZone:"Europe/London", day:"2-digit", month:"short",
        hour:"2-digit", minute:"2-digit", timeZoneName:"short"
    });
}

function getDepartureTarget() {
    const onBlocks = currentEvents.find(e => e.eventType === "ON_BLOCKS");
    return onBlocks ? OperationalTime.departurePlan(
        currentFlight.departure?.stdAt, onBlocks.eventTime, currentFlight.mgt
    ) : null;
}

function updateCountdown() {
    const timer = document.getElementById("countdownValue");
    const title = document.getElementById("countdownTitle");
    const info = document.getElementById("countdownInfo");
    const panel = document.getElementById("predictionPanel");
    if (!dashboardActive || !currentFlight || !timer || !title || !info || !panel) return false;
    timer.className = "fw-bold text-secondary";
    info.textContent = "";
    panel.textContent = "";
    const event = type => currentEvents.find(e => e.eventType === type);
    const terminal = currentFlight.status === "CANCELLED" ? "Cancelled" :
        event("AIRBORNE") || currentFlight.status === "DEPARTED" ? "Departed" :
        event("PUSHBACK") || currentFlight.status === "PUSHBACK" ? "Pushback" : null;
    if (terminal) {
        title.textContent = "Flight";
        timer.textContent = terminal;
        return false;
    }
    const now = Date.now();
    const landing = event("LANDED")?.eventTime || currentFlight.arrival?.ata;
    const onBlocks = event("ON_BLOCKS");
    let target, label;
    if (onBlocks) {
        const departure = getDepartureTarget();
        if (currentFlight.operationalTimeError || !departure || Date.parse(onBlocks.eventTime) > now) {
            title.textContent = "Departure";
            timer.textContent = "Time / MGT unavailable";
            info.textContent = currentFlight.operationalTimeError || "Check STD, On Blocks and MGT";
            return false;
        }
        target = departure.target.getTime();
        label = departure.mode === "STD" ? "STD" : "Ground Time";
        const warning = currentFlight.mgtSource === "fallback" ? " • Default MGT: verify rule" : "";
        const std = currentFlight.departure?.stdAt;
        const stdText = std ? operationalDisplay(std) : "Unavailable";
        const readyText = operationalDisplay(departure.ready);
        const bufferMinutes = Math.floor(departure.buffer);
        const delayMinutes = Math.ceil(departure.delay);
        info.textContent = `STD: ${stdText} • Ground Ready: ${readyText} • MGT: ${currentFlight.mgt} min`;
        if (departure.mode === "STD") {
            panel.textContent = `Buffer: +${bufferMinutes} min • Countdown to STD${warning}`;
        } else {
            panel.textContent = `Minimum delay: +${delayMinutes} min • Ground Ready later than STD${warning}`;
        }
        if (now > target) panel.textContent += ` • Target passed at ${operationalDisplay(target)} — awaiting actual departure`;
    } else if (landing) {
        const landedAt = Date.parse(landing);
        title.textContent = "Taxi In";
        if (!Number.isFinite(landedAt) || landedAt > now) {
            timer.textContent = "Check landing time";
            return false;
        }
        timer.textContent = duration(now - landedAt);
        timer.className = "fw-bold text-info";
        return true;
    } else {
        target = Date.parse(currentFlight.arrival?.eta);
        label = "ETA";
        if (!Number.isFinite(target)) {
            title.textContent = "Arrival";
            timer.textContent = "Awaiting valid ETA";
            return false;
        }
    }
    const diff = target - now;
    title.textContent = `${label} ${diff >= 0 ? "Remaining" : "Overdue"}`;
    timer.textContent = duration(diff);
    timer.className = "fw-bold " + (diff < 0 ? "text-danger" : diff < 600000 ? "text-warning" : "text-success");
    return true;
}

window.addEventListener("pagehide", () => {
    dashboardActive = false;
    ++refreshVersion;
    stopCountdown();
});
window.addEventListener("pageshow", event => {
    dashboardActive = true;
    if (event.persisted) loadFlight();
});
// Rejoin the room and refresh after reconnect, including missed events.
socket.on("connect", () => {
    socket.emit("joinFlight", flightId);
    if (dashboardActive) loadFlight();
});


loadFlight();
loadEventButtons();
loadAssignments();
loadChat({markRead:true});

socket.on(
    "flightUpdated",
    async ()=>{

        console.log(
            "Flight updated"
        );

        await loadFlight();

        await loadEventButtons();

        await loadAssignments();

        await loadChat();

    }
);


/*
setInterval(
    async ()=>{

        await loadFlight();

        await loadEventButtons();

        await loadAssignments();

        await loadChat();

    },
    15000
);


*/


applyDashboardPermissions();

let lirRequestId = 0;
async function loadLirSummary() {
    const requestId = ++lirRequestId;
    const card = document.getElementById('lirCard');
    try {
        const response = await fetch(`/api/lir/${flightId}`, {headers:{Authorization:`Bearer ${localStorage.getItem('token') || ''}`}});
        if (requestId !== lirRequestId) return;
        if (response.status === 403) { card.hidden = true; return; }
        if (!response.ok) throw new Error('LIR unavailable — reopen the page or sign in again');
        const data = await response.json();
        if (requestId !== lirRequestId) return;
        card.hidden = false;
        document.getElementById('lirSummary').textContent = data.document ? `v${data.document.revision} · ${data.document.status}` : 'Awaiting OPS upload';
        document.getElementById('lirLink').href = `lir.html?id=${encodeURIComponent(flightId)}`;
        if(data.document){
            const receiptResponse=await fetch(`/api/acknowledgements/${flightId}/lir/${data.document._id}`,{headers:{Authorization:`Bearer ${localStorage.getItem('token') || ''}`}});
            if(receiptResponse.ok){
                const acknowledgement=await receiptResponse.json();
                if(requestId!==lirRequestId)return;
                document.getElementById('lirSummary').textContent += acknowledgement.receipt ? ` · Received / read by ${acknowledgement.receipt.name}` : ' · Awaiting RAMP receipt';
            }
        }
    } catch(error) { card.hidden=false; document.getElementById('lirSummary').textContent=error.message; }
}
socket.on('lirUpdated', loadLirSummary);
socket.on('connect', loadLirSummary);
loadLirSummary();

socket.on('lirReceiptUpdated',loadLirSummary);
socket.on('assignmentsUpdated',loadLirSummary);

document.getElementById('handoverLink').href=`handover.html?id=${encodeURIComponent(flightId)}`;

document.getElementById('gateItemsLink').href=`gate-items.html?id=${encodeURIComponent(flightId)}`;

document.getElementById('messagesLink').href=`messages.html?id=${encodeURIComponent(flightId)}`;
