checkAuth(); 


let flightModal;
let showDeparted = false;

function getStatusBadge(
    status
){

    switch(status){

        case "READY":
            return `
            <span class="badge bg-success">
            READY
            </span>`;

        case "BOARDING":
            return `
            <span class="badge bg-warning text-dark">
            BOARDING
            </span>`;

        case "CHECKIN":
            return `
            <span class="badge bg-info text-dark">
            CHECK-IN
            </span>`;

            case "CANCELLED":
    return `
    <span class="badge bg-danger">
    CANCELLED
    </span>`;

        case "TURNAROUND":
            return `
            <span class="badge bg-primary">
            TURNAROUND
            </span>`;

        case "ARRIVING":
            return `
            <span class="badge bg-secondary">
            ARRIVING
            </span>`;

        case "PUSHBACK":
            return `
            <span class="badge bg-dark">
            PUSHBACK
            </span>`;

        case "DEPARTED":
            return `
            <span class="badge bg-black">
            DEPARTED
            </span>`;

        default:
            return `
            <span class="badge bg-light text-dark">
            ${status}
            </span>`;
    }

}


function formatTime(value){

    if(!value){
        return "-";
    }

    const date =
    new Date(value);

    return date
    .toLocaleTimeString(
        "en-GB",
        {

            hour:"2-digit",

            minute:"2-digit"

        }
    );

}




function getStatusBorderColor(status){

    switch(status){

        case "ARRIVING":
            return "#6c757d";

        case "TURNAROUND":
            return "#0d6efd";

        case "CHECKIN":
            return "#0dcaf0";

        case "BOARDING":
            return "#ffc107";

        case "READY":
            return "#198754";

        case "PUSHBACK":
            return "#212529";

        case "DEPARTED":
            return "#6c757d";

        case "CANCELLED":
            return "#dc3545";

        default:
            return "#6c757d";

    }

}

async function loadFlights() {

    const container =
    document.getElementById(
        "flightContainer"
    );


    const date =
getSelectedDate();

const response =
await fetch(
    `/api/flights?date=${date}`
);

    container.innerHTML =
    "<p>Loading...</p>";

    try {

 

        const flights =
        await response.json();


const departed =

flights.filter(
    f => f.status === "DEPARTED"
).length;

const cancelled =

flights.filter(
    f => f.status === "CANCELLED"
).length;

const active =

flights.length -
departed -
cancelled;


let visibleFlights =
[...flights];

if(!showDeparted){

    visibleFlights =
    visibleFlights.filter(

        f =>

        f.status !==
        "DEPARTED"

        &&

        f.status !==
        "CANCELLED"

    );

}



        

document.getElementById(
    "flightSummary"
).innerHTML = `

<strong>

    Flights:
    ${flights.length}

</strong>

<span>

    Active:
    ${active}

</span>

<span>

    Departed:
    ${departed}

</span>
<span>

    Cancelled:
    ${cancelled}

</span>


<label
    class="form-check
           form-switch
           ms-auto">

    <input

        class="form-check-input"

        type="checkbox"

        id="showDeparted"

        ${
            showDeparted
            ?
            "checked"
            :
            ""
        }

    >

    <span
        class="form-check-label">

        Show Departed

    </span>

</label>

`;

document
.getElementById(
    "showDeparted"
)
?.addEventListener(
    "change",
    e=>{

        showDeparted =
        e.target.checked;

        loadFlights();

    }
);



        container.innerHTML = "";

        visibleFlights.forEach(flight => {

            const card =
            document.createElement(
                "div"
            );

card.className =
"card shadow-sm mb-2";

            card.innerHTML = `

<div

    class="card-body py-2"

    style="
        border-left:
        6px solid
        ${getStatusBorderColor(
            flight.status
        )};
    "

>

    <div
        class="d-flex
               justify-content-between
               align-items-center">

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

<strong>

    ${flight.arrivalFlight}/${flight.departureFlight}

</strong>

${
flight.unreadNotifications > 0
?
`
<span
    class="badge bg-danger ms-2">

    🔔
    ${flight.unreadNotifications}

</span>
`
:
""
}

        </div>

        <div>

            ${getStatusBadge(
                flight.status
            )}

        </div>

    </div>

    <div
        class="small
               text-muted
               mt-1">

        Aircraft <strong>${flight.aircraft?.aircraftType || "-"}</strong>
        |

        Reg <strong>${flight.aircraft?.registration || "-"}</strong>

        |

        Stand
        <strong>${flight.aircraft?.stand || "-"}</strong>

        |

        STA
        <strong>${flight.arrival?.sta || "-"}</strong>

        |

        STD
        <strong>${flight.departure?.std || "-"}</strong>

        |

       ETA
       <strong>
${formatTime(
    flight.arrival?.eta
)}
</strong>

        |

     ETD
     <strong>
${formatTime(
    flight.departure?.etd
)}
</strong>
    </div>

    <div
        class="progress mt-2"
        style="height:8px;">

        <div

            class="progress-bar
            ${getReadinessColor(
                flight.readiness || 0
            )}"

            style="
                width:
                ${flight.readiness || 0}%;
            ">

        </div>

    </div>

</div>

`;

            card.onclick = () => {

                window.location =
                `dashboard.html?id=${flight._id}`;

            };

            container.appendChild(
                card
            );

        });

    }
    catch(err){

        console.error(err);

        container.innerHTML =
        "<p>Error loading flights</p>";

    }

}


function goToday(){

    document.getElementById(
        "flightDate"
    ).value =

    new Date()
    .toISOString()
    .substring(0,10);

    loadFlights();

}

function changeDate(days){

    const input =
    document.getElementById(
        "flightDate"
    );

    const date =
    new Date(
        input.value
    );

    date.setDate(
        date.getDate() + days
    );

    input.value =
    date
    .toISOString()
    .substring(0,10);

    loadFlights();

}

function getStatusClass(
    status
){

    switch(status){

        case "READY":
            return "border-success";

        case "BOARDING":
            return "border-warning";

        case "CHECKIN":
            return "border-info";

        case "TURNAROUND":
            return "border-primary";

        case "ARRIVING":
            return "border-secondary";

        case "PUSHBACK":
            return "border-dark";

        case "DEPARTED":
            return "border-dark opacity-75";
            case "CANCELLED":
    return "border-danger";

        default:
            return "";
    }

}


function getReadinessColor(
    readiness
){

    if(readiness >= 80)
        return "bg-success";

    if(readiness >= 50)
        return "bg-warning";

    return "bg-danger";

}

function getSelectedDate(){

    return document.getElementById(
        "flightDate"
    ).value;

}


document.addEventListener(
    "DOMContentLoaded",
    async ()=>{

        document.getElementById(
            "flightDate"
        ).value =
        new Date()
        .toISOString()
        .substring(0,10);

        document.getElementById(
            "flightDate"
        ).addEventListener(
            "change",
            loadFlights
        );

        flightModal =
        new bootstrap.Modal(

            document.getElementById(
                "flightModal"
            )

        );

        await loadFlights();

    }
);

function newFlight(){
    if(
        !canCreateFlight()
    ){
        return;
    }
    document.getElementById(
        "newFlightDate"
    ).value =
    getSelectedDate();

    document.getElementById(
        "newAirline"
    ).value = "";

    document.getElementById(
        "newArrivalFlight"
    ).value = "";

    document.getElementById(
        "newDepartureFlight"
    ).value = "";

    document.getElementById(
        "newSta"
    ).value = "";

    document.getElementById(
        "newStd"
    ).value = "";

    document.getElementById(
        "newAircraftType"
    ).value = "";

    flightModal.show();

}

async function saveNewFlight(){

    await fetch(

        "/api/flights",

        {

            method:"POST",

            headers:{
                "Content-Type":
                "application/json"
            },

            body:JSON.stringify({

                operatingDate:
                document.getElementById(
                    "newFlightDate"
                ).value,

                airline:
                document.getElementById(
                    "newAirline"
                ).value,

                arrivalFlight:
                document.getElementById(
                    "newArrivalFlight"
                ).value,

                departureFlight:
                document.getElementById(
                    "newDepartureFlight"
                ).value,

                sta:
                document.getElementById(
                    "newSta"
                ).value,

                std:
                document.getElementById(
                    "newStd"
                ).value,

                aircraftType:
                document.getElementById(
                    "newAircraftType"
                ).value

            })

        }

    );

    flightModal.hide();

    await loadFlights();

}

const addFlightBtn =
document.getElementById(
    "addFlightBtn"
);

if(
    addFlightBtn &&
    !canCreateFlight()
){

    addFlightBtn.remove();

}
