checkAuth(); 
const socket = io();


let users = [];
let roles = [];
let passengerModal;
let specialHandlingModal;
let flightDetailsModal;
let assignmentModal;
let specialHandlingDetailsModal;

let specialHandlingDetails = {

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

async function loadCompletedEvents(){

    const response =
    await fetch(
        `/api/events/${flightId}/existing`
    );

    completedEvents =
    await response.json();

}



async function loadFlight() {

    const response =
    await fetch(
        `/api/flights/${flightId}`
    );

    const flight =
    await response.json();

    
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

        <div class="card-body">

            <div class="d-flex justify-content-between">

                <div>

                    <h3>

                    ${flight.arrivalFlight}
                    /
                    ${flight.departureFlight}
<a href="flights.html" class="btn btn-danger mb-3"> ← Flights</a>

                    </h3>
                    <div>

                        Airline:
                        <strong>${flight.airline}</strong>

                    </div>

                    <div>

                        Aircraft:
                        <strong>${flight.aircraft?.aircraftType || "-"}</strong>

                    </div>

                    <div>

                        Registration:
                        <strong>${flight.aircraft?.registration || "-"}</strong>

                    </div>

                    <div>

                        Stand:
                        <strong>${flight.aircraft?.stand || "-"}</strong>

                    </div>

                    <div>

    STA:
    <strong>
    ${formatDateTime(
        flight.arrival?.sta
    )}
    </strong>

    |

    ETA:
    <strong>
    ${formatDateTime(
        flight.arrival?.eta
    )}
    </strong>

</div>

<div>

    STD:
    <strong>
    ${formatDateTime(
        flight.departure?.std
    )}
    </strong>

    |

    ETD:
    <strong>
    ${formatDateTime(
        flight.departure?.etd
    )}
    </strong>

</div>

                </div>

                <div>

                    <span class="badge ${getStatusBadgeClass(
    flight.status
)}">

                        ${flight.status}

                    </span>
  <br>

${
canEdit(
    "FLIGHT_DETAILS"
)
?
`
<button
    class="btn btn-sm btn-outline-primary mt-2"
    onclick="editFlightDetails()">

    Edit Flight

</button>
`
:
""
}
    
    

                </div>

            </div>

            <div class="mt-3">

                <div>

                    Readiness

                </div>

                <div class="progress">

                    <div
                        class="progress-bar ${readinessClass}"
                        style="width:${flight.readiness || 0}%">

                        ${flight.readiness || 0}%
                        

                    </div>

                </div>

            </div>

        </div>

    </div>

    
    </div>

    `;
    loadPassengerInfo(
    flight
);

loadSpecialHandling(
    flight
);

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

    await loadTimeline();
    await loadEventButtons();

}




async function loadTimeline(){

    const response =
    await fetch(
        `/api/events/${flightId}`
    );

    const events =
    await response.json();

    const timeline =
    document.getElementById(
        "timeline"
    );

    timeline.innerHTML = "";

    events.forEach(event=>{

        const div =
        document.createElement(
            "div"
        );

        const time =
        new Date(
            event.eventTime
        );

        div.className =
        "border-start border-3 ps-2 mb-2";

div.innerHTML = `

<strong>

${time.toLocaleTimeString(
    "en-GB"
)}

</strong>

-

${event.eventType}

<br>

<small
class="text-muted">

👤

${event.createdBy?.name || "Unknown"}

</small>

`;

        timeline.appendChild(
            div
        );

    });

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
        skills.includes(role)
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
    new Date(
        flight.arrival.eta
    ).toISOString().substring(0,16)
    :
    "";

    document.getElementById(
        "ata"
    ).value =
    flight.arrival?.ata
    ?
    new Date(
        flight.arrival.ata
    ).toISOString().substring(0,16)
    :
    "";

    document.getElementById(
        "etd"
    ).value =
    flight.departure?.etd
    ?
    new Date(
        flight.departure.etd
    ).toISOString().substring(0,16)
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

    document.getElementById(
    "cancelFlightBtn"
).style.display =

canCancelFlight()
?
""
:
"none";
    await fetch(

        `/api/flights/${flightId}/details`,

        {

            method:"PUT",

            headers:{
                "Content-Type":
                "application/json"
            },

            body:JSON.stringify({

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
    ).value = new Date(
        event.eventTime
    )
    .toISOString()
    .substring(0,16);

    document.getElementById(
        "modalEventNotes"
    ).value =
    event.notes || "";

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

    await fetch(

        `/api/events/${eventId}`,

        {

            method:"PUT",

            headers:{
                "Content-Type":
                "application/json"
            },

            body:JSON.stringify({

                eventTime,
                notes

            })

        }

    );

    eventModal.hide();

    await loadFlight();

    await loadTimeline();

    await loadEventButtons();

}

async function loadAssignments(){

    const response =
    await fetch(
        `/api/assignments/${flightId}`
    );

    const assignments =
    await response.json();

    const panel =
    document.getElementById(
        "staffPanel"
    );

    panel.innerHTML = "";

    assignments.forEach(a=>{

        panel.innerHTML += `

<div class="border-bottom pb-2 mb-2">

    <strong>

    ${formatRole(a.role)}

    </strong>

    <br>

    ${a.userId?.name || "-"}

    <br>

      📞



<a href="tel:${a.userId?.phone}">

    ${a.userId?.phone || "-"}

</a>

</div>

`;

    });

}


async function loadUsers(){

    const response =
    await fetch(
        "/api/users"
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

    {
        code:"DISPATCH",
        name:"Dispatcher"
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
        name:"Arrival"
    },

    {
        code:"RAMP",
        name:"Ramp"
    },

    {
        code:"SPUR",
        name:"SPUR"
    }

];
let visibleRoles = roles;

switch(
    CURRENT_USER.position
){

    case "TRAFFIC_COORDINATOR":

        visibleRoles =
        roles.filter(r=>

            r.code === "OPERATIONS"

        );

        break;

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

    case "RAMP_ALLOCATOR":

        visibleRoles =
        roles.filter(r=>

            r.code === "RAMP_SERVICE"

        );

        break;

    case "SPUR_COORDINATOR":

        visibleRoles =
        roles.filter(r=>

            r.code === "SPUR"

        );

        break;

}


    const response =
    await fetch(
        `/api/assignments/${flightId}`
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



const eligibleUsers =
users.filter(user => {

    const skills =
    user.skills || [];

    return skills.includes(
        role.code
    );

});

        let options =

        `<option value="">
            -- Select --
        </option>`;

        eligibleUsers.forEach(user=>{

            options += `

            <option

                value="${user._id}"

                ${
                    assigned &&
                    assigned.userId &&
                    assigned.userId._id ==
                    user._id
                    ?
                    "selected"
                    :
                    ""
                }

            >

                ${user.name}

            </option>

            `;

        });

        panel.innerHTML += `

        <div class="mb-3">

            <label
                class="form-label">

                ${role.name}

            </label>

            <select

                class="form-select assignment"

                data-role="${role.code}">

                ${options}

            </select>

        </div>

        `;

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

    await fetch(

        `/api/assignments/${flightId}`,

        {

            method:"POST",

            headers:{
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
            hour:"2-digit",
            minute:"2-digit"
        }
    );

}

function loadPassengerInfo(
    flight
){

    document.getElementById(
        "passengerPanel"
    ).innerHTML = `

    <div class="row">

        <div class="col-md-3">

            Checked In

            <h4>
            ${flight.passengers?.checkedIn || 0}
            </h4>

        </div>

<div class="col-md-3">

    Jump Seat

    <h4>
    ${flight.passengers?.jumpSeat || 0}
    </h4>

</div>

        <div class="col-md-3">

            TOB

            <h4>
            ${flight.passengers?.tob || 0}
            </h4>

        </div>

        <div class="col-md-3">

            INF

            <h4>
            ${flight.passengers?.infants || 0}
            </h4>

        </div>

    </div>

${
canEdit(
    "PASSENGERS"
)
?
`
<button
    class="btn btn-primary mt-3"
    onclick="editPassengers()">

    Edit Passengers

</button>
`
:
""
}

    `;

}


async function editPassengers(){

    const response =
    await fetch(
        `/api/flights/${flightId}`
    );

    const flight =
    await response.json();

    document.getElementById(
        "checkedIn"
    ).value =
    flight.passengers?.checkedIn || 0;

document.getElementById(
    "jumpSeat"
).value =
flight.passengers?.jumpSeat || 0;

    document.getElementById(
        "tob"
    ).value =
    flight.passengers?.tob || 0;

    document.getElementById(
        "infants"
    ).value =
    flight.passengers?.infants || 0;

    passengerModal.show();

}

async function savePassengers(){

    await fetch(

        `/api/flights/${flightId}/passengers`,

        {

            method:"PUT",

            headers:{
                "Content-Type":
                "application/json"
            },

            body:JSON.stringify({

                checkedIn:
                Number(
                    document.getElementById(
                        "checkedIn"
                    ).value
                ),

jumpSeat:
Number(
    document.getElementById(
        "jumpSeat"
    ).value
),

                tob:
                Number(
                    document.getElementById(
                        "tob"
                    ).value
                ),

                infants:
                Number(
                    document.getElementById(
                        "infants"
                    ).value
                ),

    updatedByName:
    CURRENT_USER.name

            })

        }

    );

    passengerModal.hide();

    await loadFlight();

}

function loadSpecialHandling(
    flight
){

    const details =
    flight.specialHandlingDetails || {};

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

}

async function loadChat(){

    const response =
    await fetch(

        `/api/chat/${flightId}`

    );

    const messages =
    await response.json();

    const panel =
    document.getElementById(
        "chatMessages"
    );

    panel.innerHTML = "";

    messages.forEach(msg=>{

        if(
            msg.messageType ===
            "SYSTEM"
        ){

            panel.innerHTML += `

            <div
                class="alert alert-info py-1 mb-2">

                <small>

                ${new Date(
                    msg.createdAt
                ).toLocaleTimeString(
                    "en-GB"
                )}

                </small>

                <br>

                ⚙ ${msg.message}

            </div>

            `;

            return;

        }

        panel.innerHTML += `

        <div class="mb-2">

            <strong>

            ${msg.userId?.name || "Unknown"}

            </strong>

            <small class="text-muted">

                ${new Date(
                    msg.createdAt
                ).toLocaleTimeString(
                    "en-GB"
                )}

            </small>

            <br>

            ${msg.message}

        </div>

        `;

    });

    panel.scrollTop =
    panel.scrollHeight;

}

async function sendChatMessage(){

    const text =
    document.getElementById(
        "chatText"
    ).value;

    if(!text){
        return;
    }

    await fetch(

        `/api/chat/${flightId}`,

        {

            method:"POST",

            headers:{
                "Content-Type":
                "application/json"
            },

            body:JSON.stringify({

                userId:
                CURRENT_USER_ID,

                message:
                text

            })

        }

    );

    document.getElementById(
        "chatText"
    ).value = "";

    await loadChat();
    const panel =
document.getElementById(
    "chatMessages"
);

panel.scrollTop =
panel.scrollHeight;

}


async function editSpecialHandlingDetails(){

    const response =
    await fetch(
        `/api/flights/${flightId}`
    );

    const flight =
    await response.json();

    specialHandlingDetails =
    flight.specialHandlingDetails ||

    {
        avih:[]
    };

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

    await fetch(

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



loadFlight();
loadTimeline();
loadEventButtons();
loadAssignments();
loadChat();

socket.on(
    "flightUpdated",
    async ()=>{

        console.log(
            "Flight updated"
        );

        await loadFlight();

        await loadTimeline();

        await loadEventButtons();

        await loadAssignments();

        await loadChat();

    }
);


/*
setInterval(
    async ()=>{

        await loadFlight();

        await loadTimeline();

        await loadEventButtons();

        await loadAssignments();

        await loadChat();

    },
    15000
);


*/


applyDashboardPermissions();