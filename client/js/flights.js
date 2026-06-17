checkAuth(); 


let flightModal;

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

        container.innerHTML = "";

        flights.forEach(flight => {

            const card =
            document.createElement(
                "div"
            );

           card.className =

`card shadow-sm mb-3 flight-card
 border-3
 ${getStatusClass(
    flight.status
 )}`;

            card.innerHTML = `

                <div class="card-body">

                    <div class="row">

                        <div class="col-8">

                            <h5>

                            ${flight.arrivalFlight}
                            /
                            ${flight.departureFlight}

                            </h5>

                            <div>

                            ${flight.airline}

                            </div>

<div>

Aircraft:
${flight.aircraft?.aircraftType || "-"}

</div>

<div>

STA:
${flight.arrival?.sta || "-"}

</div>

<div>

STD:
${flight.departure?.std || "-"}

</div>

                        </div>

                        <div class="col-4 text-end">

${getStatusBadge(
    flight.status
)}

                        </div>
                        <div class="mt-2">

    <div
        class="progress">

       <div
    class="progress-bar
    ${getReadinessColor(
        flight.readiness || 0
    )}"

            style="
            width:
            ${flight.readiness || 0}%
            ">

            ${flight.readiness || 0}%

        </div>

    </div>

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
