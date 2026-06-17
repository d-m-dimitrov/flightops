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


async function loadSchedules(){

    const response =
    await fetch(
        "/api/schedules"
    );

    const schedules =
    await response.json();

    const panel =
    document.getElementById(
        "scheduleList"
    );

    panel.innerHTML = "";

    schedules.forEach(schedule=>{

        panel.innerHTML += `

        <div class="card mb-3">

            <div class="card-body">

                <h5>

                ${schedule.arrivalFlight}
                /
                ${schedule.departureFlight}

                </h5>

                <div>

                ${schedule.origin}
                →
                ${schedule.destination}

                </div>

                <div>

                STA:
                ${schedule.sta}

                STD:
                ${schedule.std}

                </div>

                <div>

                Aircraft:
                ${schedule.aircraftType}

                </div>

                <div>

                Days:
                ${schedule.daysOfWeek?.join(", ")}

                </div>

                <button
                    class="btn btn-sm btn-primary mt-2"
                    onclick="
                    editSchedule(
                    '${schedule._id}'
                    )
                    ">

                    Edit

                </button>

            </div>

        </div>

        `;

    });

}



function newSchedule(){

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

    const payload = {

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

    if(scheduleId){

        await fetch(

            `/api/schedules/${scheduleId}`,

            {

                method:"PUT",

                headers:{
                    "Content-Type":
                    "application/json"
                },

                body:JSON.stringify(
                    payload
                )

            }

        );

    }
    else{

        await fetch(

            "/api/schedules",

            {

                method:"POST",

                headers:{
                    "Content-Type":
                    "application/json"
                },

                body:JSON.stringify(
                    payload
                )

            }

        );

    }

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

